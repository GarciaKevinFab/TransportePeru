"""Adaptador de Mercado Pago Suscripciones. Lo especifico del proveedor vive aqui.

Es el mismo diseno que ya cobra en produccion en LicitaPro (misma empresa y
misma cuenta de Mercado Pago), adaptado a que en CargoXprez quien paga es la
EMPRESA: la referencia lleva el company_id, no un usuario.

COMO COBRA

  Suscripcion sin plan asociado y con pago pendiente: se crea un `preapproval`
  con `status=pending` y el cliente termina en el `init_point`, en el sitio de
  Mercado Pago. La tarjeta nunca pasa por este servidor. Desde ahi Mercado Pago
  cobra solo cada mes y avisa por webhook.

  No se usa `preapproval_plan` porque su enlace es comun a todos los clientes y
  no lleva `external_reference`: el aviso no diria de que empresa es el pago.

QUE ESTA APAGADO POR DEFECTO, Y POR QUE

  `MERCADOPAGO_MODO` vacio es `simulado`: el sitio ignora las llaves aunque
  esten en el `.env`. Tener llaves no es decidir cobrar.

    prueba      solo lo ven los correos de MERCADOPAGO_CORREOS_PRUEBA. Se prueba
                en el sitio real, que es el unico con una URL publica para el
                webhook, sin ensenarle a un visitante un pago que no cobra.
    produccion  lo ve todo el mundo.

  Falta una pieza -- token o clave del webhook -- y se queda en `simulado`. Sin
  la clave del webhook se cobraria sin poder activar la cuenta.

LAS LLAVES NO SALEN DE AQUI

  Se leen del entorno en cada uso y no se guardan en ninguna variable de
  modulo, ni van a un log ni a un mensaje de error: `ErrorMercadoPago` lleva
  metodo, ruta, codigo y el `message` de la API, nunca la cabecera ni el
  cuerpo enviado.

LO QUE SE VIO EN LA API REAL (LicitaPro, noviembre de 2026)

  - El estado cancelado que devuelve la API es `cancelled`. La documentacion
    vigente escribe `canceled` en el PUT de cancelacion; aqui se manda
    `cancelled` (lo probado con dinero real) y se aceptan los dos al leer.
  - `end_date` figura como obligatorio en la referencia, pero la API acepta la
    suscripcion sin el: sin fin, que es lo que se quiere.
  - /authorized_payments/{id} trae `preapproval_id`, `transaction_amount`,
    `currency_id`, `status` y `payment`; `payment` llega con `id`, `status` y
    `status_detail` cuando hay cobro.
  - Con el primer cobro rechazado, Mercado Pago cancela la suscripcion al
    momento: reintentar es volver a pulsar Pagar, que crea otra.

DEVOLUCIONES

  Llegan por el aviso `payment` (en el panel, "Pagos"). Una devolucion total
  marca el pago `devuelto` y quita su periodo. Una parcial deja el `status` en
  `approved` y no cambia nada: se resuelve a mano.
"""
import hashlib
import hmac
import logging
import os
from decimal import Decimal
from urllib.parse import urlsplit

import httpx

log = logging.getLogger("mercadopago")

API = "https://api.mercadopago.com"
MONEDA = "PEN"
CANCELADO = "cancelled"
ESTADOS_CANCELADOS = ("cancelled", "canceled")
#: Meses por periodo. CargoXprez solo vende el mensual.
MESES = {"mensual": 1}
#: Hosts admitidos para mandar al cliente a pagar.
HOSTS_PAGO = ("www.mercadopago.com.pe", "sandbox.mercadopago.com.pe")
_PREFIJO_REFERENCIA = "cargoxprez"


class ErrorMercadoPago(Exception):
    """La API rechazo la operacion. `http` None es que ni siquiera respondio."""

    def __init__(self, mensaje: str, http: int | None = None):
        super().__init__(mensaje)
        self.http = http

    @property
    def transitorio(self) -> bool:
        """Si vale la pena que Mercado Pago reintente el aviso."""
        return self.http is None or self.http >= 500 or self.http == 429


def _token() -> str:
    return os.getenv("MERCADOPAGO_ACCESS_TOKEN", "").strip()


def _clave_webhook() -> str:
    return os.getenv("MERCADOPAGO_WEBHOOK_SECRET", "").strip()


def modo() -> str:
    """'prueba', 'produccion' o 'simulado'. Ver la cabecera del modulo."""
    pedido = os.getenv("MERCADOPAGO_MODO", "").strip().lower()
    if pedido not in ("prueba", "produccion"):
        return "simulado"
    if not (_token() and _clave_webhook()):
        log.warning("MERCADOPAGO_MODO=%s sin token o sin clave de webhook: "
                    "sigue en modo simulado.", pedido)
        return "simulado"
    return pedido


def activo() -> bool:
    return modo() != "simulado"


def disponible_para(correo: str | None) -> bool:
    """Si a esta persona se le ofrece pagar con Mercado Pago."""
    actual = modo()
    if actual == "produccion":
        return True
    if actual != "prueba" or not correo:
        return False
    permitidos = os.getenv("MERCADOPAGO_CORREOS_PRUEBA", "").lower().split(",")
    return correo.strip().lower() in {c.strip() for c in permitidos if c.strip()}


# ─── La referencia que une un pago con una empresa ───────

def referencia(company_id: str, plan: str, periodo: str = "mensual") -> str:
    return f"{_PREFIJO_REFERENCIA}|{company_id}|{plan}|{periodo}"


def leer_referencia(texto: str | None) -> dict | None:
    """Empresa, plan y periodo de una referencia, o None si no es de CargoXprez.

    Solo se llama con lo que devolvio la API con nuestro token: quien manda un
    aviso falso no puede elegir este texto. Es la MISMA cuenta de Mercado Pago
    que LicitaPro, asi que sus suscripciones tambien pueden llegar aqui si
    alguien apunta mal un webhook: el prefijo las deja fuera.
    """
    partes = (texto or "").split("|")
    if len(partes) != 4 or partes[0] != _PREFIJO_REFERENCIA:
        return None
    try:
        import uuid
        company_id = str(uuid.UUID(partes[1]))
    except ValueError:
        return None
    if partes[3] not in MESES or not partes[2]:
        return None
    return {"company_id": company_id, "plan": partes[2], "periodo": partes[3]}


# ─── La API ──────────────────────────────────────────────

async def _pedir(metodo: str, ruta: str, cuerpo: dict | None = None) -> dict:
    try:
        async with httpx.AsyncClient(timeout=15) as cliente:
            r = await cliente.request(
                metodo, f"{API}{ruta}", json=cuerpo,
                headers={"Authorization": f"Bearer {_token()}"})
    except httpx.HTTPError as e:
        # Solo el tipo: el texto de algunas excepciones de httpx incluye la
        # peticion, y con ella la cabecera.
        raise ErrorMercadoPago(f"{metodo} {ruta}: {type(e).__name__}") from None
    if r.status_code >= 400:
        # El cuerpo no va al log entero: puede traer el correo del pagador.
        try:
            motivo = r.json().get("message")
        except ValueError:
            motivo = None
        raise ErrorMercadoPago(f"{metodo} {ruta}: {r.status_code} {motivo}",
                               http=r.status_code)
    return r.json()


async def crear_preapproval(company_id: str, correo: str, plan: str, nombre_plan: str,
                            monto, volver_a: str, periodo: str = "mensual") -> dict:
    """Crea la suscripcion pendiente. Todavia no cobra: cobra el `init_point`."""
    respuesta = await _pedir("POST", "/preapproval", {
        # Sin tildes: acaba en el extracto de la tarjeta.
        "reason": f"CargoXprez - {nombre_plan}",
        "external_reference": referencia(company_id, plan, periodo),
        "payer_email": correo,
        "auto_recurring": {
            "frequency": MESES[periodo],
            "frequency_type": "months",
            "transaction_amount": float(monto),
            "currency_id": MONEDA,
        },
        "back_url": volver_a,
        "status": "pending",
    })
    enlace = respuesta.get("init_point") or ""
    if urlsplit(enlace).hostname not in HOSTS_PAGO:
        raise ErrorMercadoPago(f"init_point en un host inesperado: "
                               f"{urlsplit(enlace).hostname}")
    return respuesta


async def leer_preapproval(preapproval_id: str) -> dict:
    return await _pedir("GET", f"/preapproval/{preapproval_id}")


async def leer_pago_autorizado(pago_id: str) -> dict:
    return await _pedir("GET", f"/authorized_payments/{pago_id}")


async def leer_pago(pago_id: str) -> dict:
    """El cobro en si. Distinto de la factura: tiene otro id y otra ruta."""
    return await _pedir("GET", f"/v1/payments/{pago_id}")


async def cancelar(preapproval_id: str) -> dict:
    return await _pedir("PUT", f"/preapproval/{preapproval_id}", {"status": CANCELADO})


# ─── El aviso ────────────────────────────────────────────

def verificar_firma(firma: str | None, request_id: str | None,
                    data_id: str | None) -> bool:
    """Si `x-signature` lo firmo quien tiene nuestra clave. Falla cerrado.

    Manifiesto documentado: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`,
    omitiendo los pares que no vengan. El id va en minusculas (los de
    suscripcion son hexadecimales y la documentacion pide pasarlos asi).
    """
    clave = _clave_webhook()
    if not (clave and firma):
        return False
    try:
        partes = dict(p.strip().split("=", 1) for p in firma.split(",") if "=" in p)
    except ValueError:
        return False
    marca, recibido = partes.get("ts"), partes.get("v1")
    if not (marca and recibido):
        return False
    manifiesto = ""
    if data_id:
        manifiesto += f"id:{data_id.lower()};"
    if request_id:
        manifiesto += f"request-id:{request_id};"
    manifiesto += f"ts:{marca};"
    calculado = hmac.new(clave.encode(), manifiesto.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(calculado, recibido)


def importe(valor) -> Decimal | None:
    """Un importe de la API como Decimal, sin pasar por el error de float."""
    if valor in (None, ""):
        return None
    try:
        return Decimal(str(valor)).quantize(Decimal("0.01"))
    except ArithmeticError:
        return None
