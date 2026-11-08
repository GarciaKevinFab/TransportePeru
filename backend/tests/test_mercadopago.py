"""Mercado Pago sin red y sin base: modos, firma, referencia, estados y limitador.

    python -m pytest backend/tests/test_mercadopago.py -q

Lo que necesita base de datos (webhook, alta, cancelacion, comprobantes) vive
en test_suscripcion_mercadopago.py. Aqui solo lo que se puede comprobar con
funciones puras, para que corra en cualquier maquina.
"""
import asyncio
import hashlib
import hmac
import logging
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import comprobantes  # noqa: E402
import limites  # noqa: E402
import mercadopago  # noqa: E402
import planes  # noqa: E402
import suscripciones  # noqa: E402

CLAVE = "clave-de-prueba-del-webhook"
TOKEN = "APP_USR-token-que-no-debe-salir-nunca"
EMPRESA = "6f1c2b3a-1111-4222-8333-944455556666"


@pytest.fixture
def mp_activo(monkeypatch):
    monkeypatch.setenv("MERCADOPAGO_MODO", "produccion")
    monkeypatch.setenv("MERCADOPAGO_ACCESS_TOKEN", TOKEN)
    monkeypatch.setenv("MERCADOPAGO_WEBHOOK_SECRET", CLAVE)


def firmar(data_id, request_id, ts="1730000000", clave=CLAVE):
    manifiesto = ""
    if data_id:
        manifiesto += f"id:{data_id.lower()};"
    if request_id:
        manifiesto += f"request-id:{request_id};"
    manifiesto += f"ts:{ts};"
    v1 = hmac.new(clave.encode(), manifiesto.encode(), hashlib.sha256).hexdigest()
    return f"ts={ts},v1={v1}"


# ─── Los tres modos ──────────────────────────────────────

def test_sin_modo_es_simulado_aunque_haya_llaves(monkeypatch):
    monkeypatch.delenv("MERCADOPAGO_MODO", raising=False)
    monkeypatch.setenv("MERCADOPAGO_ACCESS_TOKEN", TOKEN)
    monkeypatch.setenv("MERCADOPAGO_WEBHOOK_SECRET", CLAVE)
    assert mercadopago.modo() == "simulado"
    assert not mercadopago.activo()
    assert not mercadopago.disponible_para("cualquiera@ejemplo.pe")


@pytest.mark.parametrize("falta", ["MERCADOPAGO_ACCESS_TOKEN", "MERCADOPAGO_WEBHOOK_SECRET"])
def test_sin_una_llave_se_queda_en_simulado(monkeypatch, mp_activo, falta):
    monkeypatch.delenv(falta)
    assert mercadopago.modo() == "simulado"


def test_modo_prueba_solo_para_los_correos_de_prueba(monkeypatch, mp_activo):
    monkeypatch.setenv("MERCADOPAGO_MODO", "prueba")
    monkeypatch.setenv("MERCADOPAGO_CORREOS_PRUEBA", "kevin@sisac.pe, Otro@Sisac.pe")
    assert mercadopago.disponible_para("KEVIN@sisac.pe")
    assert mercadopago.disponible_para("otro@sisac.pe")
    assert not mercadopago.disponible_para("cliente@transportes.pe")
    assert not mercadopago.disponible_para(None)


def test_produccion_para_todos(mp_activo):
    assert mercadopago.disponible_para("cliente@transportes.pe")


# ─── La firma: falla cerrada ─────────────────────────────

def test_firma_buena(mp_activo):
    assert mercadopago.verificar_firma(firmar("ABC123", "req-1"), "req-1", "ABC123")


@pytest.mark.parametrize("firma, request_id, data_id", [
    (None, "req-1", "abc"),                              # sin cabecera
    ("", "req-1", "abc"),
    ("ts=1730000000", "req-1", "abc"),                   # sin v1
    ("v1=deadbeef", "req-1", "abc"),                     # sin ts
    ("basura sin igual", "req-1", "abc"),
    (firmar("abc", "req-1"), "req-1", "otro-id"),        # id cambiado
    (firmar("abc", "req-1"), "req-2", "abc"),            # request-id cambiado
    (firmar("abc", "req-1", clave="otra"), "req-1", "abc"),  # otra clave
])
def test_firma_mala_falla_cerrada(mp_activo, firma, request_id, data_id):
    assert not mercadopago.verificar_firma(firma, request_id, data_id)


def test_sin_clave_ninguna_firma_vale(monkeypatch, mp_activo):
    monkeypatch.delenv("MERCADOPAGO_WEBHOOK_SECRET")
    assert not mercadopago.verificar_firma(firmar("abc", "r", clave=""), "r", "abc")


# ─── La referencia ───────────────────────────────────────

def test_referencia_ida_y_vuelta():
    ref = mercadopago.referencia(EMPRESA, "pro")
    assert mercadopago.leer_referencia(ref) == {
        "company_id": EMPRESA, "plan": "pro", "periodo": "mensual",
        "meses": 1, "adelantado": False}


@pytest.mark.parametrize("texto", [
    None, "", "licitapro|12|pro|mensual",                # la otra app de la misma cuenta
    "cargoxprez|no-es-uuid|pro|mensual",
    f"cargoxprez|{EMPRESA}|pro|anual",                   # periodo que no se vende
    f"cargoxprez|{EMPRESA}||mensual",
    f"cargoxprez|{EMPRESA}|pro",
])
def test_referencia_ajena_no_se_lee(texto):
    assert mercadopago.leer_referencia(texto) is None


# ─── El alta: monto del servidor y host del init_point ───

def test_el_alta_lleva_el_monto_del_servidor(monkeypatch, mp_activo):
    enviados = []

    async def falso(metodo, ruta, cuerpo=None):
        enviados.append((metodo, ruta, cuerpo))
        return {"id": "pre1", "init_point": "https://www.mercadopago.com.pe/subscriptions/checkout?x=1"}

    monkeypatch.setattr(mercadopago, "_pedir", falso)
    descripcion, monto = planes.PRECIOS_CHECKOUT["pro"]
    asyncio.run(mercadopago.crear_preapproval(EMPRESA, "a@b.pe", "pro", descripcion, monto,
                                              "https://cargoxprez.sisac.pe/suscripcion"))
    metodo, ruta, cuerpo = enviados[0]
    assert (metodo, ruta) == ("POST", "/preapproval")
    assert cuerpo["status"] == "pending"
    assert cuerpo["auto_recurring"] == {"frequency": 1, "frequency_type": "months",
                                        "transaction_amount": 199.0, "currency_id": "PEN"}
    assert cuerpo["external_reference"] == f"cargoxprez|{EMPRESA}|pro|mensual"
    assert "preapproval_plan_id" not in cuerpo


def test_init_point_en_otro_host_se_rechaza(monkeypatch, mp_activo):
    async def falso(metodo, ruta, cuerpo=None):
        return {"init_point": "https://phishing.example.com/pagar"}

    monkeypatch.setattr(mercadopago, "_pedir", falso)
    with pytest.raises(mercadopago.ErrorMercadoPago):
        asyncio.run(mercadopago.crear_preapproval(EMPRESA, "a@b.pe", "pro", "Plan", 199, "https://x"))


def test_el_token_no_sale_en_errores_ni_logs(monkeypatch, mp_activo, caplog):
    """Un fallo de red o un 401 de la API no puede arrastrar la llave."""
    import httpx

    class Transporte(httpx.MockTransport):
        pass

    def responder(peticion):
        assert peticion.headers["authorization"] == f"Bearer {TOKEN}"
        return httpx.Response(401, json={"message": "invalid access token"})

    original = httpx.AsyncClient

    def cliente(*a, **kw):
        kw["transport"] = Transporte(responder)
        return original(*a, **kw)

    monkeypatch.setattr(mercadopago.httpx, "AsyncClient", cliente)
    caplog.set_level(logging.DEBUG)
    with pytest.raises(mercadopago.ErrorMercadoPago) as e:
        asyncio.run(mercadopago.leer_preapproval("pre1"))
    assert e.value.http == 401 and not e.value.transitorio
    assert TOKEN not in str(e.value)
    assert TOKEN not in caplog.text


def test_importe_no_pasa_por_float():
    assert str(mercadopago.importe(199)) == "199.00"
    assert str(mercadopago.importe("199.0")) == "199.00"
    assert mercadopago.importe(None) is None
    assert mercadopago.importe("no") is None


# ─── La maquina de estados ───────────────────────────────

AHORA = datetime(2026, 11, 7, 12, 0, tzinfo=timezone.utc)
DIA = timedelta(days=1)


@pytest.mark.parametrize("estado, trial, vence, esperado, escribe", [
    ("trial", AHORA + DIA, None, "trial", True),
    ("trial", AHORA - DIA, None, "prueba_vencida", False),          # el corte de siempre
    ("trial", None, None, "trial", True),
    ("activa", None, None, "activa", True),                         # las de antes de los planes
    ("activa", None, AHORA + DIA, "activa", True),
    ("activa", None, AHORA - DIA, "vencida", True),                 # en gracia
    ("activa", None, AHORA - 7 * DIA, "vencida", True),             # ultimo dia de gracia
    ("activa", None, AHORA - 8 * DIA, "suspendida", False),
    ("vencida", None, None, "suspendida", False),                   # corte manual de siempre
    ("suspendida", None, AHORA + DIA, "suspendida", False),         # intentos agotados
    ("cancelada", None, AHORA + DIA, "cancelada", True),            # conserva lo pagado
    ("cancelada", None, AHORA - DIA, "cancelada_vencida", False),
    ("cancelada", None, None, "cancelada_vencida", False),
])
def test_estado_efectivo(estado, trial, vence, esperado, escribe):
    efectivo = suscripciones.estado_efectivo(estado, trial, vence, AHORA)
    assert efectivo == esperado
    assert suscripciones.puede_escribir(efectivo) is escribe


# ─── El webhook, fuera del limitador ─────────────────────

async def _ok(scope, receive, send):
    await send({"type": "http.response.start", "status": 200, "headers": []})
    await send({"type": "http.response.body", "body": b"ok"})


def _pedir(mw, ruta, metodo="POST"):
    async def correr():
        estado = {}

        async def send(m):
            if m["type"] == "http.response.start":
                estado["status"] = m["status"]

        async def receive():
            return {"type": "http.request", "body": b"", "more_body": False}

        await mw({"type": "http", "method": metodo, "path": ruta,
                  "headers": [(b"cf-connecting-ip", b"203.0.113.50")]}, receive, send)
        return estado["status"]
    return asyncio.run(correr())


def test_el_webhook_no_cuenta_contra_el_techo():
    """Mercado Pago avisa desde pocas IP: un 429 es un cobro sin registrar."""
    mw = limites.LimitePeticiones(_ok)
    codigos = {_pedir(mw, "/webhooks/mercadopago") for _ in range(700)}
    assert codigos == {200}
    # Y la misma IP sigue teniendo su cubo de la API intacto.
    assert _pedir(mw, "/api/vehicles", "GET") == 200


def test_el_webhook_sigue_exento_si_se_amplian_los_prefijos():
    mw = limites.LimitePeticiones(_ok, prefijos=("/",))
    codigos = {_pedir(mw, "/webhooks/mercadopago") for _ in range(700)}
    assert codigos == {200}
    # Lo demas, con ese prefijo, si se limita: la exencion es solo del webhook.
    codigos_api = [_pedir(mw, "/otra/ruta") for _ in range(130)]
    assert 429 in codigos_api


# ─── Comprobantes, sin base ──────────────────────────────

@pytest.mark.parametrize("tipo, doc, ok", [
    ("boleta", "", True), ("boleta", "12345678", True), ("boleta", "20490042068", True),
    ("boleta", "123", False), ("factura", "", False), ("factura", "12345678", False),
    ("factura", "20490042068", True), ("factura", "20490042069", False),  # verificador malo
])
def test_validar_datos_de_comprobante(tipo, doc, ok):
    datos, motivo = comprobantes.validar(tipo, doc)
    assert (datos is not None) is ok and (motivo is None) is ok


@pytest.mark.parametrize("total", [199.00, 0.01, 33.33, 49.00])
def test_el_desglose_del_comprobante_es_el_del_checkout(total):
    a, b = comprobantes.desglose(total), planes.desglose(total)
    assert (float(a["base"]), float(a["igv"]), float(a["total"])) == (b["base"], b["igv"], b["total"])


@pytest.mark.parametrize("serie, numero, ok", [
    ("F001", "123", True), ("b002", "00000045", True), ("F01", "1", False),
    ("X001", "1", False), ("F001", "123456789", False), ("F001", "1a", False),
])
def test_serie_y_numero(serie, numero, ok):
    assert (comprobantes.numero_valido(serie, numero) is not None) is ok
