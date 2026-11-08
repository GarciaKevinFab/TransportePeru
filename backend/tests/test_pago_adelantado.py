"""Pago adelantado: catalogo, referencia y preferencia de Checkout Pro, sin base de datos.

Lo que toca Postgres (webhook, vigencia, devoluciones, recordatorios) esta en
test_suscripcion_mercadopago.py. Aqui va lo que se puede probar con funciones
puras y una API de Mercado Pago falsa: que el importe salga del catalogo, que la
preferencia lleve lo que pide la documentacion y que el repositorio no guarde
llaves.
"""
import asyncio
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import mercadopago  # noqa: E402
import planes  # noqa: E402

RAIZ = Path(__file__).resolve().parents[2]
CID = "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"


# ─── El catalogo ─────────────────────────────────────────

@pytest.mark.parametrize("meses,total", [(1, 199.0), (3, 597.0), (6, 1194.0), (12, 2388.0)])
def test_el_total_es_el_precio_mensual_por_los_meses(meses, total):
    assert planes.total_adelantado("pro", meses) == total


@pytest.mark.parametrize("plan,meses", [("pro", 0), ("pro", 2), ("pro", 24), ("pro", -1),
                                        ("empresa", 3), ("gratis", 1), ("", 1)])
def test_lo_que_no_se_vende_no_tiene_precio(plan, meses):
    assert planes.total_adelantado(plan, meses) is None


def test_yape_solo_hasta_su_tope():
    """Yape acepta hasta S/ 2.000: los 12 meses (S/ 2.388) lo pasan."""
    opciones = {o["meses"]: o for o in planes.opciones_adelantado("pro")}
    assert sorted(opciones) == [1, 3, 6, 12]
    assert [m for m, o in opciones.items() if not o["yape"]] == [12]
    for o in opciones.values():
        d = o["desglose"]
        assert round(d["base"] + d["igv"], 2) == o["total"]


# ─── La referencia ───────────────────────────────────────

@pytest.mark.parametrize("meses", [1, 3, 6, 12])
def test_la_referencia_adelantada_se_lee(meses):
    texto = mercadopago.referencia(CID, "pro", mercadopago.periodo_adelantado(meses))
    assert texto == f"cargoxprez|{CID}|pro|adelantado-{meses}"
    ref = mercadopago.leer_referencia(texto)
    assert ref == {"company_id": CID, "plan": "pro", "periodo": f"adelantado-{meses}",
                   "meses": meses, "adelantado": True}


def test_la_referencia_de_la_tarjeta_sigue_igual():
    ref = mercadopago.leer_referencia(f"cargoxprez|{CID}|pro|mensual")
    assert (ref["periodo"], ref["meses"], ref["adelantado"]) == ("mensual", 1, False)


@pytest.mark.parametrize("periodo", ["adelantado-2", "adelantado-03", "adelantado-", "adelantado-x",
                                     "adelantado-12.0", "adelantado--1", "anual"])
def test_periodos_inventados_no_valen(periodo):
    assert mercadopago.leer_referencia(f"cargoxprez|{CID}|pro|{periodo}") is None


def test_la_referencia_de_licitapro_no_vale():
    assert mercadopago.leer_referencia(f"licitapro|{CID}|pro|adelantado-3") is None


# ─── La preferencia de Checkout Pro ──────────────────────

def _crear(monkeypatch, init_point="https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=x"):
    enviado = {}

    async def pedir(metodo, ruta, cuerpo=None):
        enviado.update(metodo=metodo, ruta=ruta, cuerpo=cuerpo)
        return {"id": "x", "init_point": init_point}
    monkeypatch.setattr(mercadopago, "_pedir", pedir)
    asyncio.run(mercadopago.crear_preferencia(
        CID, "dueno@prueba.pe", "pro", "Plan Pro", 6, planes.total_adelantado("pro", 6),
        "https://empresa.sisac.pe/suscripcion",
        "https://cargoxprez.sisac.pe/webhooks/mercadopago?source_news=webhooks"))
    return enviado


def test_la_preferencia_lleva_lo_que_pide_la_documentacion(monkeypatch):
    enviado = _crear(monkeypatch)
    assert (enviado["metodo"], enviado["ruta"]) == ("POST", "/checkout/preferences")
    c = enviado["cuerpo"]
    assert c["items"] == [{"id": "pro-6m", "title": "CargoXprez - Plan Pro - 6 meses",
                           "quantity": 1, "currency_id": "PEN", "unit_price": 1194.0}]
    assert c["payer"] == {"email": "dueno@prueba.pe"}
    assert c["external_reference"] == f"cargoxprez|{CID}|pro|adelantado-6"
    assert c["back_urls"] == {
        "success": "https://empresa.sisac.pe/suscripcion?pago=aprobado",
        "pending": "https://empresa.sisac.pe/suscripcion?pago=pendiente",
        "failure": "https://empresa.sisac.pe/suscripcion?pago=error",
    }
    assert c["auto_return"] == "approved"
    assert c["notification_url"] == "https://cargoxprez.sisac.pe/webhooks/mercadopago?source_news=webhooks"
    assert c["statement_descriptor"] == "CARGOXPREZ"
    # Una cuota, y ni Yape ni PagoEfectivo excluidos.
    assert c["payment_methods"] == {"installments": 1}


def test_el_codigo_de_pago_vence_a_los_3_dias(monkeypatch):
    c = _crear(monkeypatch)["cuerpo"]
    assert re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000-05:00", c["date_of_expiration"])
    vence = datetime.fromisoformat(c["date_of_expiration"])
    falta = vence - datetime.now(timezone.utc)
    assert timedelta(days=2, hours=23) < falta <= timedelta(days=3)


def test_no_se_manda_a_pagar_a_un_host_ajeno(monkeypatch):
    with pytest.raises(mercadopago.ErrorMercadoPago):
        _crear(monkeypatch, init_point="https://mercadopago.com.pe.ejemplo.net/pagar")


# ─── Sin llaves en el repositorio ────────────────────────

# Formas de las llaves de Mercado Pago (produccion y prueba): APP_USR-<digitos>...
# y TEST-<digitos>.... Los tests usan "APP_USR-falso", que no tiene esa forma.
_LLAVE = re.compile(r"\b(?:APP_USR|TEST)-\d{6,}[-0-9a-f]{10,}")


def test_no_hay_llaves_de_mercado_pago_en_el_repo():
    try:
        archivos = subprocess.run(["git", "ls-files"], cwd=RAIZ, capture_output=True,
                                  text=True, check=True).stdout.split("\n")
    except (OSError, subprocess.CalledProcessError):
        pytest.skip("sin git")
    halladas = []
    for nombre in filter(None, archivos):
        ruta = RAIZ / nombre
        if ruta.suffix in (".png", ".jpg", ".jpeg", ".ico", ".woff", ".woff2", ".pdf", ".lock") \
                or not ruta.is_file() or os.path.getsize(ruta) > 2_000_000:
            continue
        try:
            texto = ruta.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        if _LLAVE.search(texto):
            halladas.append(nombre)
    assert halladas == []
