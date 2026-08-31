"""
Envio de correo por SMTP.
=========================
Mismo buzon que usa LicitaPro: soporte@sisac.pe en mail.sisac.pe:465.

Hoy lo usa una sola cosa, la recuperacion de contrasena, y eso condiciona el
diseno entero: es un correo que alguien esta ESPERANDO con la pantalla abierta.
De ahi las tres decisiones de abajo.

1. NO BLOQUEA EL EVENT LOOP. smtplib es sincrono, y una conexion SMTP que tarda
   -o que se queda colgada hasta el timeout- pararia TODO el backend, no solo
   esta peticion. Se manda con asyncio.to_thread.

2. TIMEOUT CORTO. Diez segundos. Si el servidor de correo no responde, es
   preferible fallar y decirlo a dejar a alguien mirando una pantalla que no
   avanza.

3. NO LEVANTA EXCEPCION. Devuelve True o False. Quien llama tiene que poder
   decidir que contar al usuario, y en el caso de la recuperacion la respuesta
   es siempre la misma exista o no la cuenta -para no revelar quien esta
   registrado-, asi que un fallo de envio no puede convertirse en un 500 que
   delate lo contrario.
"""
import asyncio
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

logger = logging.getLogger(__name__)

TIEMPO_LIMITE = 10  # segundos


def _clave():
    """La contrasena del buzon, preferentemente en base64.

    SMTP_PASSWORD_B64 existe por un motivo concreto y comprobado. La clave de
    soporte@sisac.pe contiene un '$', y Docker Compose INTERPOLA las variables
    dentro de los valores de env_file: leyo "$xxxxx" como una variable que no
    existe y la sustituyo por nada. De 16 caracteres llegaban 10 -justo los 6
    que ocupaba esa supuesta variable-.

    El sintoma era un 535 "Incorrect authentication data" que no apuntaba a
    ningun sitio: la clave del fichero era correcta y la que recibia el proceso
    no. Las comillas no arreglan nada, porque el problema no es el troceado
    sino la sustitucion.

    La forma nativa de escribirlo es duplicando el dolar ($$), que es lo que
    hace LicitaPro en su .env. Aqui se usa base64 porque no depende de recordar
    esa regla: el valor queda en [A-Za-z0-9+/=] y ningun lector de .env tiene
    nada que interpretar, hoy ni cuando la clave cambie. Se mantiene
    SMTP_PASSWORD como respaldo.
    """
    b64 = os.environ.get("SMTP_PASSWORD_B64", "").strip()
    if b64:
        import base64
        try:
            return base64.b64decode(b64).decode()
        except Exception:
            logger.error("correo: SMTP_PASSWORD_B64 no es base64 valido")
            return ""
    return os.environ.get("SMTP_PASSWORD", "")


def _config():
    return {
        "host": os.environ.get("SMTP_HOST", "").strip(),
        "puerto": int(os.environ.get("SMTP_PORT", "465") or 465),
        "usuario": os.environ.get("SMTP_USER", "").strip(),
        "clave": _clave(),
        "remitente": os.environ.get("SMTP_REMITENTE", "").strip(),
    }


def configurado() -> bool:
    """Si hay servidor de correo. Sin el, quien llama NO debe ofrecer el envio.

    Se comprueba en cada uso y no al importar: el modulo lo carga server.py
    antes de load_dotenv(), igual que db_pg, y leyendo el entorno al importar la
    configuracion llegaria siempre vacia.
    """
    c = _config()
    return bool(c["host"] and c["usuario"] and c["clave"])


def _remitente(c):
    """Cabecera From. Sin SMTP_REMITENTE se cae al propio usuario, que es lo
    unico que el servidor va a aceptar igualmente."""
    return c["remitente"] or formataddr(("FletePro", c["usuario"]))


def _enviar_sincrono(destino: str, asunto: str, texto: str, html: str) -> None:
    c = _config()
    msg = EmailMessage()
    msg["From"] = _remitente(c)
    msg["To"] = destino
    msg["Subject"] = asunto
    msg.set_content(texto)
    if html:
        # El texto plano va primero y es la version completa, no un resumen:
        # hay clientes que no pintan HTML, y un correo con un enlace tiene que
        # seguir siendo utilizable ahi.
        msg.add_alternative(html, subtype="html")

    contexto = ssl.create_default_context()
    if c["puerto"] == 465:
        # 465 es TLS implicito: la conexion nace cifrada, sin STARTTLS.
        with smtplib.SMTP_SSL(c["host"], c["puerto"], timeout=TIEMPO_LIMITE,
                              context=contexto) as s:
            s.login(c["usuario"], c["clave"])
            s.send_message(msg)
    else:
        with smtplib.SMTP(c["host"], c["puerto"], timeout=TIEMPO_LIMITE) as s:
            s.starttls(context=contexto)
            s.login(c["usuario"], c["clave"])
            s.send_message(msg)


async def enviar(destino: str, asunto: str, texto: str, html: str = "") -> bool:
    """Manda el correo. True si salio, False si no. Nunca levanta.

    El destinatario NO se escribe en el log. Registrar a quien se le manda un
    correo de recuperacion es dejar en un fichero de texto la lista de quien
    perdio su clave y cuando; para diagnosticar basta con saber que fallo.
    """
    if not configurado():
        logger.warning("correo: SMTP sin configurar, no se envia nada")
        return False
    try:
        await asyncio.to_thread(_enviar_sincrono, destino, asunto, texto, html)
        return True
    except Exception as e:
        logger.error("correo: fallo el envio (%s: %s)", type(e).__name__, e)
        return False
