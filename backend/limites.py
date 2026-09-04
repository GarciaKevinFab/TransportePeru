"""Techo de peticiones por IP para toda la API.

QUE PROBLEMA QUEDA, TENIENDO YA slowapi

  server.py protege siete endpoints con @limiter.limit: signup, login, olvide,
  restablecer, las dos de checkout y reclamaciones. Estan bien elegidos y aqui
  no se tocan.

  Pero son siete de 205. Los otros 198 -- viajes, vehiculos, neumaticos, caja,
  liquidaciones, informes -- no tienen ningun freno, y decorar de uno en uno no
  arregla eso: lo que se olvida no avisa, queda abierto y con el mismo aspecto
  que el resto. Peor, cada endpoint nuevo nace sin limite por omision.

  Este modulo pone el suelo que faltaba. El limite se decide por (metodo,
  prefijo de ruta) en una sola tabla, y la ultima regla es un techo que aplica
  a TODA la API: un endpoint nuevo nace protegido. Los limites finos de slowapi
  siguen mandando donde estan, porque son mas estrictos que el techo.

  No hay nada detras que ayude: el tunel de Cloudflare entrega directo a
  uvicorn en 127.0.0.1:8001, sin proxy intermedio con reglas.

POR QUE EN MEMORIA Y NO EN REDIS

  El contenedor corre un solo proceso uvicorn, sin --workers. Con un unico
  proceso, un contador en memoria es exacto y no anade una pieza mas que
  mantener. Si algun dia se levantan varios workers o varias replicas, esto
  hay que mover a un almacen compartido: cada proceso contaria por su cuenta y
  el limite real seria el configurado multiplicado por el numero de procesos.

POR QUE MIDDLEWARE ASGI Y NO BaseHTTPMiddleware

  server.py devuelve StreamingResponse en tres sitios. BaseHTTPMiddleware
  consume y reemite el cuerpo de la respuesta, que con streaming es justo lo
  que no se quiere. Un middleware ASGI puro decide antes de llamar a la
  aplicacion y, si deja pasar, no toca la respuesta en absoluto.
"""

import json
import time
from collections import defaultdict, deque


def ip_del_cliente(cabeceras: dict) -> str:
    """La IP real de quien pide, no la del tunel.

    Es el mismo criterio que la funcion del mismo nombre de server.py, que
    slowapi usa como key_func, y esta escrita por el mismo motivo: al backend
    NO llega nadie directamente -- el puerto 8001 esta atado a 127.0.0.1 y todo
    entra por el tunel --, asi que la direccion de la conexion es SIEMPRE la
    puerta de la red de Docker.

    Sin esto el limite no seria por IP sino GLOBAL. Ya paso una vez aqui: los
    cuatro limites de slowapi eran en realidad "diez por minuto para todo el
    sistema", y con tres empresas y sus choferes entrando al cambio de turno
    eso devuelve 429 a gente que no ha hecho nada.

    Esta version recibe el diccionario de cabeceras del scope ASGI (claves y
    valores en bytes) en vez de un Request, porque un middleware ASGI puro
    trabaja antes de que exista el Request de Starlette.
    """
    for nombre in (b"cf-connecting-ip", b"x-forwarded-for"):
        valor = cabeceras.get(nombre)
        if valor:
            # X-Forwarded-For puede traer una cadena; el cliente es el primero.
            return valor.decode("latin-1").split(",")[0].strip()
    return "desconocida"


# Reglas: (metodo o None para cualquiera, prefijo, cuantas, en cuantos segundos).
#
# Gana la PRIMERA que encaja, asi que lo estricto va arriba y el techo al final.
#
# Lo que ya cubre slowapi por endpoint no se repite aqui: los limites de login,
# signup, olvide, restablecer, checkout y reclamaciones siguen en server.py y
# son mas estrictos que cualquiera de estas reglas, asi que saltan antes.
#
#   refresh     La renovacion del token es automatica y no la dispara una
#               persona. Un cliente sano la pide cada varias horas; sesenta por
#               hora deja sitio a varias pestanas abiertas y corta el bucle de
#               un cliente roto reintentando sin parar.
#   ocr         Procesar un documento cuesta tiempo de CPU y, si algun dia sale
#               a un servicio externo, dinero. Los choferes suben de uno en uno.
#   upload      Un checklist puede llevar varias fotos, y en un dia con mucha
#               actividad son muchas subidas. Trescientas por hora es holgado
#               para trabajar y estrecho para llenar el disco del VPS.
#   escrituras  Nadie opera a mas de dos o tres por segundo. Ciento veinte por
#               minuto es holgado.
#   techo       Diez por segundo sostenidos por IP. Una empresa entera sale por
#               la misma IP publica -- varios puestos tras el mismo router -- y
#               aun asi navegando no se acerca, menos ahora con el cache de
#               lecturas del frontend. Existe para que nadie pueda tumbar el
#               servicio, no para racionar el uso.
REGLAS = [
    ("POST", "/api/auth/refresh", 60, 3600),
    ("POST", "/api/documentos/ocr", 60, 3600),
    ("POST", "/api/upload", 300, 3600),
    ("POST", None, 120, 60),
    ("PUT", None, 120, 60),
    ("PATCH", None, 120, 60),
    ("DELETE", None, 120, 60),
    (None, None, 600, 60),
]

# Solo se cuenta lo que cuelga de estos prefijos. Los ficheros de la SPA
# (/static/js/...) quedan fuera a proposito: una primera carga pide decenas de
# ellos de golpe y gastaria el cubo de la API sin que nadie haya llamado a
# ningun endpoint. En moviles con mala cobertura, ademas, esa carga se reintenta.
PREFIJOS = ("/api",)

# Rutas exentas de todo limite.
EXENTAS = ("/api/health",)


class LimitePeticiones:
    """Middleware ASGI que cuenta peticiones por (IP, regla) en ventana deslizante."""

    def __init__(self, app, reglas=REGLAS, prefijos=PREFIJOS, exentas=EXENTAS):
        self.app = app
        self.reglas = reglas
        self.prefijos = tuple(prefijos)
        self.exentas = tuple(exentas)
        # (ip, indice de regla) -> deque de instantes
        self._marcas = defaultdict(deque)
        self._ultima_purga = time.monotonic()

    def _regla_para(self, metodo: str, ruta: str):
        for indice, (met, prefijo, cuantas, ventana) in enumerate(self.reglas):
            if met is not None and met != metodo:
                continue
            if prefijo is not None and not ruta.startswith(prefijo):
                continue
            return indice, cuantas, ventana
        return None

    def _purgar(self, ahora: float) -> None:
        """Tira los cubos que ya no cuentan nada.

        Sin esto, el diccionario crece con una entrada por cada IP que haya
        pasado alguna vez -- que en una API publica es memoria que solo sube.
        Cada minuto basta: las ventanas mas largas son de una hora, y esas se
        vacian solas cuando les toca.
        """
        if ahora - self._ultima_purga < 60:
            return
        self._ultima_purga = ahora
        for clave in [c for c, marcas in self._marcas.items() if not marcas]:
            del self._marcas[clave]

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        ruta = scope.get("path", "")
        if not ruta.startswith(self.prefijos) or ruta.startswith(self.exentas):
            return await self.app(scope, receive, send)

        regla = self._regla_para(scope.get("method", "GET"), ruta)
        if regla is None:
            return await self.app(scope, receive, send)
        indice, cuantas, ventana = regla

        cabeceras = dict(scope.get("headers") or [])
        clave = (ip_del_cliente(cabeceras), indice)

        ahora = time.monotonic()
        marcas = self._marcas[clave]
        limite = ahora - ventana
        while marcas and marcas[0] <= limite:
            marcas.popleft()

        if len(marcas) >= cuantas:
            # Cuanto falta para que la mas antigua salga de la ventana.
            espera = max(1, int(marcas[0] + ventana - ahora) + 1)
            cuerpo = json.dumps({
                "detail": (
                    "Demasiadas peticiones desde esta conexion. "
                    f"Vuelve a intentarlo en {espera} segundos."
                )
            }).encode("utf-8")
            await send({
                "type": "http.response.start",
                "status": 429,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(cuerpo)).encode("latin-1")),
                    # Retry-After es la parte que un cliente educado puede
                    # obedecer sola. Sin ella, reintentar en bucle es lo
                    # razonable desde fuera y el 429 no calma nada. Aqui pesa
                    # doble: la aplicacion del chofer reintenta en cuanto
                    # vuelve la cobertura.
                    (b"retry-after", str(espera).encode("latin-1")),
                ],
            })
            await send({"type": "http.response.body", "body": cuerpo})
            return

        marcas.append(ahora)
        self._purgar(ahora)
        return await self.app(scope, receive, send)
