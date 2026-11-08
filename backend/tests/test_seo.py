"""SEO del sitio publico: lo que ven los buscadores tiene que decir la verdad.

QUE PROTEGE

  1. Que cada ruta publica salga del servidor con SU titulo y SU canonical
     (seo_rutas.py), y las demas con noindex. Si alguien cambia el formato de
     las etiquetas en index.html, las expresiones dejan de encajar sin error y
     todas las paginas vuelven a decir que son la portada.
  2. Que los datos estructurados no inventen: el precio del JSON-LD es el que
     cobra planes.py, la empresa es la de proveedor.py, y el FAQPage repite
     exactamente las preguntas visibles de la portada.
  3. Que el titulo que pone el servidor y el que pone la SPA al navegar sean
     el mismo (seo_rutas.py y frontend/src/config/seo.js).
  4. Que sitemap.xml solo liste paginas publicas reales.
  5. Que ningun numero de WhatsApp quede escrito en el frontend.

Nada de esto necesita base de datos.
"""
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import planes  # noqa: E402
import proveedor  # noqa: E402
import seo_rutas  # noqa: E402

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PUBLIC = os.path.join(RAIZ, "frontend", "public")
SRC = os.path.join(RAIZ, "frontend", "src")


def _leer(*partes):
    with open(os.path.join(*partes), encoding="utf-8") as f:
        return f.read()


@pytest.fixture(scope="module")
def index_html():
    return _leer(PUBLIC, "index.html")


def _jsonld(html, ident):
    m = re.search(r'<script type="application/ld\+json" id="' + ident + r'">(.*?)</script>', html, re.S)
    return json.loads(m.group(1)) if m else None


def _titulo(html):
    return re.search(r"<title>(.*?)</title>", html, re.S).group(1)


def _canonical(html):
    return re.search(r'<link rel="canonical" href="([^"]*)"', html).group(1)


def _meta(html, atributo, nombre):
    return re.search(r'<meta\s+' + atributo + r'="' + re.escape(nombre) + r'"\s+content="([^"]*)"', html).group(1)


# ─── 1. Metadatos por ruta ───────────────────────────────

@pytest.mark.parametrize("clave", list(seo_rutas.PAGINAS))
def test_cada_ruta_publica_sale_con_su_titulo_y_su_canonical(index_html, clave):
    from html import escape
    pagina = seo_rutas.PAGINAS[clave]
    html = seo_rutas.personalizar(index_html, "/" + clave)
    url = f"{seo_rutas.URL_BASE}/{clave}"
    assert _titulo(html) == escape(pagina.titulo)
    assert _canonical(html) == url
    assert _meta(html, "property", "og:url") == url
    assert _meta(html, "name", "description") == escape(pagina.descripcion)
    assert _meta(html, "property", "og:title") == escape(pagina.titulo)
    assert _meta(html, "name", "twitter:description") == escape(pagina.descripcion)
    assert 'content="noindex' not in html


def test_la_portada_tal_cual_coincide_con_lo_que_pone_el_servidor(index_html):
    """El index.html sin tocar ya es el de la portada: lo que se sirva si el
    servidor no personaliza (otro hosting, el build abierto en local)."""
    assert seo_rutas.personalizar(index_html, "/") == index_html


def test_query_y_barra_final_no_cambian_la_pagina(index_html):
    html = seo_rutas.personalizar(index_html, "/comprar/?plan=pro")
    assert _canonical(html) == f"{seo_rutas.URL_BASE}/comprar"


@pytest.mark.parametrize("ruta", ["dashboard", "vehicles/abc/tires", "no-existe"])
def test_las_demas_rutas_salen_con_noindex(index_html, ruta):
    html = seo_rutas.personalizar(index_html, ruta)
    assert '<meta name="robots" content="noindex, follow"' in html
    assert _jsonld(html, "ld-faq") is None


def test_el_faq_solo_va_en_la_portada(index_html):
    assert _jsonld(seo_rutas.personalizar(index_html, ""), "ld-faq") is not None
    assert _jsonld(seo_rutas.personalizar(index_html, "terminos"), "ld-faq") is None
    # Lo demas del JSON-LD se queda en todas.
    assert _jsonld(seo_rutas.personalizar(index_html, "terminos"), "ld-organizacion") is not None


def test_el_ancla_de_react_sobrevive_a_la_personalizacion(index_html):
    import checkout_sin_js
    assert checkout_sin_js.ANCLA_ROOT in seo_rutas.personalizar(index_html, "comprar")


# ─── 2. Datos estructurados que no inventan ──────────────

def _nodos(index_html):
    return {n["@type"]: n for n in _jsonld(index_html, "ld-organizacion")["@graph"]}


def test_el_precio_del_jsonld_es_el_que_se_cobra(index_html):
    ofertas = {o["name"]: o for o in _nodos(index_html)["SoftwareApplication"]["offers"]}
    _, monto = planes.PRECIOS_CHECKOUT["pro"]
    pro = ofertas["Plan Pro"]
    assert float(pro["price"]) == monto
    assert float(pro["priceSpecification"]["price"]) == monto
    assert pro["priceCurrency"] == "PEN"
    assert float(ofertas["Plan Gratis"]["price"]) == 0


def test_sin_resenas_ni_valoraciones_inventadas(index_html):
    texto = json.dumps(_jsonld(index_html, "ld-organizacion"))
    assert "aggregateRating" not in texto and "review" not in texto.lower()


def test_la_empresa_del_jsonld_es_la_de_proveedor(index_html):
    org = _nodos(index_html)["Organization"]
    assert org["legalName"] == proveedor.RAZON_SOCIAL
    assert org["taxID"] == proveedor.RUC
    assert org["email"] == proveedor.EMAIL


def test_el_faq_repite_las_preguntas_visibles(index_html):
    fuente = _leer(SRC, "components", "landing", "Comparativa.jsx")
    visibles = re.findall(r"p: '([^']*)',\s*r: '([^']*)'", fuente)
    faq = [(q["name"], q["acceptedAnswer"]["text"]) for q in _jsonld(index_html, "ld-faq")["mainEntity"]]
    assert visibles and faq == visibles


# ─── 3. Titulos del servidor y de la SPA ─────────────────

def test_los_titulos_de_la_spa_son_los_del_servidor():
    fuente = _leer(SRC, "config", "seo.js")
    bloque = re.search(r"TITULOS = \{(.*?)\};", fuente, re.S).group(1)
    en_js = dict(re.findall(r"'(/[^']*)':\s*'([^']*)'", bloque))
    en_py = {"/" + k: p.titulo for k, p in seo_rutas.PAGINAS.items()}
    assert en_js == en_py


# ─── 4. sitemap y robots ─────────────────────────────────

def test_el_sitemap_solo_lista_paginas_publicas():
    arbol = ET.parse(os.path.join(PUBLIC, "sitemap.xml"))
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = [e.text for e in arbol.getroot().findall("s:url/s:loc", ns)]
    assert f"{seo_rutas.URL_BASE}/" in urls
    for url in urls:
        assert url.startswith(seo_rutas.URL_BASE + "/")
        assert seo_rutas.ruta_normalizada(url[len(seo_rutas.URL_BASE):]) in seo_rutas.PAGINAS, url


def test_robots_apunta_al_sitemap():
    robots = _leer(PUBLIC, "robots.txt")
    assert f"Sitemap: {seo_rutas.URL_BASE}/sitemap.xml" in robots
    assert re.search(r"^Disallow: /$", robots, re.M) is None


# ─── 5. Ningun numero de WhatsApp en el codigo ───────────

def test_no_hay_numeros_de_whatsapp_escritos_en_el_frontend():
    """El numero sale de WHATSAPP_VENTAS via /api/config/publica, nunca del codigo."""
    patron = re.compile(r"wa\.me/\+?\d|api\.whatsapp\.com/send\?phone=\d")
    culpables = []
    for base, _, ficheros in os.walk(SRC):
        for nombre in ficheros:
            if nombre.endswith((".js", ".jsx")):
                if patron.search(_leer(base, nombre)):
                    culpables.append(nombre)
    for nombre in ("index.html", "llms.txt"):
        if patron.search(_leer(PUBLIC, nombre)):
            culpables.append(nombre)
    assert not culpables, culpables
