"""
Lo que ve cualquiera desde fuera (auditoria del 2026-11-09).

Integracion contra el backend levantado: documentacion oculta, cabeceras de
seguridad como cabeceras HTTP, CORS sin cabeceras para origenes ajenos, 404 de
verdad, security.txt y la portada con su texto ya escrito en el HTML.
"""
import html as html_lib
import json
import os
import re
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests

import planes

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "http://127.0.0.1:8001").rstrip("/")
PERMITIDO = "http://localhost:3000"
AJENO = "https://malo.ejemplo.com"


# ─── Documentacion ───────────────────────────────────────

@pytest.mark.parametrize("ruta", ["/docs", "/redoc", "/openapi.json", "/docs/oauth2-redirect"])
def test_la_documentacion_no_se_publica(ruta):
    """Sin HABILITAR_DOCS no existe: 404, no la SPA ni el esquema."""
    r = requests.get(f"{BASE_URL}{ruta}")
    assert r.status_code == 404
    assert "openapi" not in r.text.lower() or "swagger" not in r.text.lower()


def test_salud_responde_para_los_chequeos_del_despliegue():
    r = requests.get(f"{BASE_URL}/api/salud")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


# ─── Cabeceras ───────────────────────────────────────────

@pytest.mark.parametrize("ruta", ["/", "/api/salud", "/login", "/ruta-que-no-existe"])
def test_cabeceras_de_seguridad_como_cabeceras_http(ruta):
    c = requests.get(f"{BASE_URL}{ruta}").headers
    assert c["Strict-Transport-Security"].startswith("max-age=31536000")
    assert c["X-Content-Type-Options"] == "nosniff"
    assert c["X-Frame-Options"] == "DENY"
    assert c["Referrer-Policy"] == "no-referrer"
    assert "microphone=()" in c["Permissions-Policy"]
    assert c["Cross-Origin-Opener-Policy"] == "same-origin"
    assert "frame-ancestors 'none'" in c["Content-Security-Policy"]


def test_la_csp_de_la_cabecera_es_la_del_html_mas_frame_ancestors():
    """frame-ancestors no vale en un <meta>; lo demas tiene que ser lo mismo
    para que no haya dos politicas distintas segun por donde se lea."""
    r = requests.get(f"{BASE_URL}/")
    meta = re.search(r'http-equiv="Content-Security-Policy"\s+content="([^"]+)"', r.text)
    assert meta, "index.html perdio su CSP en <meta>"
    def partes(csp):
        return {p.strip() for p in csp.split(";") if p.strip()}
    cabecera = partes(r.headers["Content-Security-Policy"])
    assert cabecera - partes(html_lib.unescape(meta.group(1))) == {"frame-ancestors 'none'"}


# ─── CORS ────────────────────────────────────────────────

def test_cors_no_regala_cabeceras_a_un_origen_ajeno():
    r = requests.get(f"{BASE_URL}/api/salud", headers={"Origin": AJENO})
    assert r.status_code == 200
    assert not [k for k in r.headers if k.lower().startswith("access-control-")]
    assert "Origin" in r.headers.get("Vary", "")


def test_preflight_de_un_origen_ajeno_sin_cabeceras_cors():
    r = requests.options(f"{BASE_URL}/api/auth/login", headers={
        "Origin": AJENO, "Access-Control-Request-Method": "POST"})
    assert r.status_code == 400
    assert not [k for k in r.headers if k.lower().startswith("access-control-")]


def test_preflight_valido_responde_200_con_sus_cabeceras():
    r = requests.options(f"{BASE_URL}/api/auth/login", headers={
        "Origin": PERMITIDO, "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,authorization"})
    assert r.status_code in (200, 204)
    assert r.headers["Access-Control-Allow-Origin"] == PERMITIDO
    assert r.headers["Access-Control-Allow-Credentials"] == "true"


def test_peticion_simple_de_origen_permitido_lleva_sus_cabeceras():
    r = requests.get(f"{BASE_URL}/api/salud", headers={"Origin": PERMITIDO})
    assert r.headers["Access-Control-Allow-Origin"] == PERMITIDO


# ─── 404 de verdad ───────────────────────────────────────

@pytest.mark.parametrize("ruta", ["/panel", "/llms-full.txt", "/wp-login.php",
                                  f"/{uuid.uuid4().hex}", "/vehicles/abc/tires/extra"])
def test_lo_que_no_es_pagina_responde_404(ruta):
    r = requests.get(f"{BASE_URL}{ruta}")
    assert r.status_code == 404
    assert "noindex" in r.text
    # Y sin el texto de la portada: no es un soft 404.
    assert "Cómo se contrata" not in r.text


@pytest.mark.parametrize("ruta", ["/", "/login", "/registro", "/dashboard",
                                  "/vehicles/abc/tires", "/privacidad", "/terminos"])
def test_las_rutas_de_la_spa_siguen_respondiendo_200(ruta):
    assert requests.get(f"{BASE_URL}{ruta}").status_code == 200


def test_head_tambien_responde():
    assert requests.head(f"{BASE_URL}/").status_code == 200
    assert requests.head(f"{BASE_URL}/panel").status_code == 404


# ─── security.txt ────────────────────────────────────────

def test_security_txt():
    r = requests.get(f"{BASE_URL}/.well-known/security.txt")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/plain")
    lineas = dict(l.split(": ", 1) for l in r.text.strip().splitlines() if ": " in l)
    assert lineas["Contact"] == "mailto:soporte@sisac.pe"
    expira = datetime.fromisoformat(lineas["Expires"].replace("Z", "+00:00"))
    ahora = datetime.now(timezone.utc)
    assert ahora + timedelta(days=30) < expira <= ahora + timedelta(days=366)
    assert lineas["Canonical"].endswith("/.well-known/security.txt")


# ─── La portada con su texto ─────────────────────────────

def _texto_del_root(pagina):
    inicio = pagina.index('<div id="root">')
    fin = pagina.index("</body>")
    sin_etiquetas = re.sub(r"<[^>]+>", " ", pagina[inicio:fin])
    return re.sub(r"\s+", " ", html_lib.unescape(sin_etiquetas))


def _normal(texto):
    return re.sub(r"\s+", " ", texto).strip()


def test_la_portada_servida_trae_el_faq_completo_dentro_del_root():
    pagina = requests.get(f"{BASE_URL}/").text
    bloque = re.search(r'<script[^>]*id="ld-faq"[^>]*>(.*?)</script>', pagina, re.S)
    assert bloque
    faq = json.loads(bloque.group(1))["mainEntity"]
    assert len(faq) >= 10
    visible = _texto_del_root(pagina)
    for p in faq:
        assert _normal(p["name"]) in visible, p["name"]
        assert _normal(p["acceptedAnswer"]["text"]) in visible, p["name"]


def test_la_portada_servida_trae_propuesta_planes_y_como_se_contrata():
    pagina = requests.get(f"{BASE_URL}/").text
    assert 'data-prerender="1"' in pagina
    # Dentro de #root, como primer hijo: lo que React reemplaza al montar.
    assert '<div id="root"><div class="pre" data-prerender="1">' in pagina
    visible = _texto_del_root(pagina)
    assert "<h1" in pagina[pagina.index('<div id="root">'):]
    assert "Cómo se contrata" in visible
    assert f"Hasta {planes.LIMITE_VEHICULOS['gratis']} vehículos" in visible
    assert f"{planes.DIAS_DE_PRUEBA} días" in visible
    _, monto_pro = planes.PRECIOS_CHECKOUT["pro"]
    assert f"S/ {monto_pro:,.0f}".replace(",", " ") in visible or f"S/ {int(monto_pro)}" in visible
    # Sin cotizacion a mano ni WhatsApp de ventas.
    assert "wa.me" not in pagina


def test_una_pagina_del_panel_no_lleva_el_texto_de_la_portada():
    pagina = requests.get(f"{BASE_URL}/dashboard").text
    assert "Cómo se contrata" not in pagina
