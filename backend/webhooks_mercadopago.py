"""Webhook de Mercado Pago: enterarse de lo que pasa con cada suscripcion.

    POST /webhooks/mercadopago

Fuera de /api a proposito, y EXENTO del techo de peticiones (limites.py):
Mercado Pago avisa desde pocas IP, y un 429 aqui es un cobro sin registrar.
Lo que protege este endpoint no es un contador, es la firma y la API.

DOS DEFENSAS, Y LA SEGUNDA ES LA QUE MANDA

  La firma `x-signature` rechaza el ruido. Pero del aviso solo se usa el id: el
  estado, el importe y la empresa salen de consultar la API con nuestro token.
  Un aviso no puede afirmar nada que Mercado Pago no confirme.

EL PERIODO SE CONCEDE CON EL PAGO, NO CON LA SUSCRIPCION

  `authorized` solo dice que el cliente dejo su tarjeta. Por eso ese aviso
  vincula la suscripcion y nada mas, y el plan llega con cada pago aprobado, el
  primero incluido. Hay un solo camino que extiende el vencimiento.

QUE SE RESPONDE

  200  procesado, tambien si no habia nada que aplicar (o ya estaba aplicado).
  401  la firma no vale.
  503  Mercado Pago no respondio: que reintente, o el pago se pierde.

LOS DOS IDS

  `subscription_authorized_payment` trae el id de la factura (mp_payment_id).
  `payment` trae el id del cobro (mp_cobro_id), que es por donde llegan las
  devoluciones.
"""
import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

import mercadopago
import planes
import suscripciones

log = logging.getLogger("webhooks_mercadopago")
router = APIRouter()

RUTA = "/webhooks/mercadopago"

#: Estados de pago rechazado que cuentan como intento fallido.
RECHAZADOS = ("rejected", "cancelled")
#: Estados de un cobro que ya estaba aprobado y cuyo dinero se fue.
DEVUELTOS = ("refunded", "charged_back")


def _ok(**datos) -> JSONResponse:
    return JSONResponse({"ok": True, **datos})


async def _duplicada(preapproval_id: str, company_id: str) -> None:
    """La empresa ya tiene otra suscripcion: esta sobra y no debe seguir cobrando."""
    log.error("Suscripcion %s sobrante para la empresa %s: se cancela en Mercado "
              "Pago. Si ya cobro, hay que devolverlo a mano.", preapproval_id, company_id)
    await mercadopago.cancelar(preapproval_id)


async def _suscripcion(data_id: str) -> JSONResponse:
    pre = await mercadopago.leer_preapproval(data_id)
    ref = mercadopago.leer_referencia(pre.get("external_reference"))
    if not ref:
        log.info("Suscripcion %s no es de CargoXprez", data_id)
        return _ok(aplicado=False, motivo="referencia ajena")

    estado = pre.get("status")
    if estado == "authorized":
        if not await suscripciones.vincular_preapproval(ref["company_id"], data_id):
            await _duplicada(data_id, ref["company_id"])
            return _ok(aplicado=False, motivo="suscripcion duplicada")
        return _ok(aplicado=True, estado=estado)
    if estado in mercadopago.ESTADOS_CANCELADOS:
        company_id = await suscripciones.olvidar_preapproval(data_id)
        if company_id:
            await suscripciones.cancelar(company_id)
        return _ok(aplicado=bool(company_id), estado=estado)
    return _ok(aplicado=False, estado=estado)


async def _pago(data_id: str) -> JSONResponse:
    factura = await mercadopago.leer_pago_autorizado(data_id)
    preapproval_id = factura.get("preapproval_id")
    if not preapproval_id:
        log.error("Factura %s sin preapproval_id: revisar la forma de la respuesta", data_id)
        return _ok(aplicado=False, motivo="factura sin suscripcion")

    pre = await mercadopago.leer_preapproval(preapproval_id)
    ref = mercadopago.leer_referencia(pre.get("external_reference"))
    if not ref:
        return _ok(aplicado=False, motivo="referencia ajena")
    if ref["plan"] not in planes.PRECIOS_CHECKOUT:
        log.error("Factura %s con un plan que no se vende (%s): conciliar a mano.",
                  data_id, ref["plan"])
        return _ok(aplicado=False, motivo="plan desconocido")

    estado = (factura.get("payment") or {}).get("status")
    monto = mercadopago.importe(factura.get("transaction_amount"))
    if estado in RECHAZADOS:
        contado = await suscripciones.registrar_rechazo_mp(
            ref["company_id"], ref["plan"], data_id, monto, factura, preapproval_id)
        return _ok(aplicado=False, cobrado=False, contado=contado)
    if estado != "approved":
        return _ok(aplicado=False, estado=estado)

    # El importe tiene que ser el que se pacto al crear la suscripcion, que a su
    # vez salio del servidor (planes.py), nunca del navegador.
    pactado = pre.get("auto_recurring") or {}
    moneda = factura.get("currency_id") or pactado.get("currency_id")
    if (monto is None or monto != mercadopago.importe(pactado.get("transaction_amount"))
            or moneda != mercadopago.MONEDA):
        log.error("Factura %s de %s %s y la suscripcion %s pacta otra cosa. No se "
                  "aplica; conciliar a mano.", data_id, moneda, monto, preapproval_id)
        return _ok(aplicado=False, motivo="importe no coincide")

    if not await suscripciones.vincular_preapproval(ref["company_id"], preapproval_id):
        await _duplicada(preapproval_id, ref["company_id"])
        return _ok(aplicado=False, motivo="suscripcion duplicada")

    resultado = await suscripciones.aplicar_pago_mp(
        ref["company_id"], ref["plan"], data_id, monto, factura, preapproval_id,
        ref["periodo"])
    if resultado == "sin_fila":
        log.error("Factura %s aprobada y la empresa %s no existe: hay un pago sin "
                  "aplicar.", data_id, ref["company_id"])
    return _ok(aplicado=resultado == "aplicado", resultado=resultado)


async def _cobro(data_id: str) -> JSONResponse:
    """Solo interesan las devoluciones: lo demas ya lo dice la factura."""
    cobro = await mercadopago.leer_pago(data_id)
    estado = cobro.get("status")
    if estado not in DEVUELTOS:
        return _ok(aplicado=False, estado=estado)
    if not mercadopago.leer_referencia(cobro.get("external_reference")):
        return _ok(aplicado=False, motivo="referencia ajena")
    resultado = await suscripciones.devolver_pago_mp(str(data_id))
    return _ok(aplicado=resultado == "devuelto", resultado=resultado)


@router.post(RUTA)
async def recibir(request: Request):
    """Aviso de Mercado Pago. Sin sesion: la autenticidad la dan la firma y la API."""
    try:
        cuerpo = await request.json()
    except ValueError:
        cuerpo = {}
    if not isinstance(cuerpo, dict):
        cuerpo = {}

    consulta = request.query_params
    data = cuerpo.get("data") if isinstance(cuerpo.get("data"), dict) else {}
    data_id = consulta.get("data.id") or str(data.get("id") or "")
    tipo = consulta.get("type") or cuerpo.get("type") or ""

    if not mercadopago.verificar_firma(request.headers.get("x-signature"),
                                       request.headers.get("x-request-id"), data_id):
        log.warning("Aviso de Mercado Pago con firma invalida (%s)", tipo)
        return JSONResponse({"ok": False, "motivo": "firma invalida"}, status_code=401)

    if not mercadopago.activo():
        # Firmado de verdad pero con la pasarela apagada: es un cobro real que
        # no se puede confirmar ahora. 503 para que Mercado Pago lo reintente
        # (cada 15 min) y se asiente al volver a encender; un 200 lo perderia.
        log.warning("Aviso de Mercado Pago con la pasarela apagada (%s %s)", tipo, data_id)
        return JSONResponse({"ok": False, "motivo": "pasarela apagada"}, status_code=503)
    if not data_id:
        return _ok(aplicado=False, motivo="sin id")

    try:
        if tipo == "subscription_preapproval":
            return await _suscripcion(data_id)
        if tipo == "subscription_authorized_payment":
            return await _pago(data_id)
        if tipo == "payment":
            return await _cobro(data_id)
    except mercadopago.ErrorMercadoPago as e:
        if e.transitorio:
            log.warning("Mercado Pago no respondio al aviso %s %s: %s", tipo, data_id, e)
            return JSONResponse({"ok": False, "motivo": "reintentar"}, status_code=503)
        # 404 y similares: Mercado Pago no reconoce ese id, no hay nada que aplicar.
        log.warning("Aviso %s %s no confirmado: %s", tipo, data_id, e)
        return _ok(aplicado=False, motivo="no confirmado")

    return _ok(aplicado=False, motivo="tema ignorado")
