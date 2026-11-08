"""Titulo, descripcion y canonical de cada pagina publica, puestos por el servidor.

EL PROBLEMA

  CargoXprez es una SPA: el servidor devuelve el MISMO index.html para toda
  URL. Un buscador que descarga /privacidad ve el titulo, la descripcion y el
  canonical de la portada, y con un canonical que apunta a "/" en todas las
  rutas le estariamos diciendo que cada pagina es un duplicado de la portada.

  Cambiarlos con JavaScript despues de cargar no basta: el HTML crudo diria una
  cosa y el renderizado otra, y los rastreadores que no ejecutan JS (la mayoria
  de los de IA) solo ven el primero.

QUE HACE

  `personalizar(html, ruta)` reescribe en el index.html del build el <title>,
  la meta description, el canonical y sus copias de Open Graph y Twitter para
  las rutas publicas de PAGINAS. El FAQPage de JSON-LD se queda solo en la
  portada, que es la unica pagina donde las preguntas estan a la vista.

  Cualquier otra ruta (el panel, una URL inventada) sale con `noindex`: son
  pantallas detras de un login o direcciones que no existen, y hoy se indexaban
  como copias de la portada con un 200.

  Los titulos se repiten en frontend/src/config/seo.js, que es lo que cambia la
  pestana al navegar dentro de la SPA. tests/test_seo.py obliga a que coincidan.
"""
import re
from html import escape
from typing import NamedTuple

URL_BASE = "https://cargoxprez.sisac.pe"


class Pagina(NamedTuple):
    titulo: str
    descripcion: str


# Clave: la ruta sin la barra inicial ("" es la portada).
PAGINAS: dict[str, Pagina] = {
    "": Pagina(
        "Software de gestión de flota para transporte de carga | CargoXprez",
        "Controla viajes, combustible, llantas, mantenimiento y documentos de tu "
        "flota de transporte de carga en Perú. Guías y facturas para SUNAT. "
        "Prueba gratis 14 días, sin tarjeta.",
    ),
    "comprar": Pagina(
        "Contratar el plan Pro: S/ 199 al mes | CargoXprez",
        "Plan Pro de CargoXprez: hasta 20 vehículos, guías y facturas para SUNAT, "
        "detracciones y bot de WhatsApp. S/ 199 al mes con IGV, con boleta o factura.",
    ),
    "registro": Pagina(
        "Crear cuenta gratis | CargoXprez",
        "Crea la cuenta de tu empresa de transporte en CargoXprez. 14 días de "
        "prueba sin tarjeta y plan Gratis hasta 3 vehículos.",
    ),
    "login": Pagina(
        "Entrar | CargoXprez",
        "Entra a CargoXprez, el sistema de gestión de flota de tu empresa de transporte.",
    ),
    "privacidad": Pagina(
        "Política de privacidad | CargoXprez",
        "Cómo CargoXprez trata los datos de tu empresa y de tus choferes, según la "
        "Ley 29733 de Protección de Datos Personales del Perú.",
    ),
    "terminos": Pagina(
        "Términos del servicio | CargoXprez",
        "Condiciones de uso de CargoXprez, el software de gestión de flota de "
        "SOLUCIONES INFORMÁTICAS MDD S.A.C.",
    ),
    "reclamaciones": Pagina(
        "Libro de Reclamaciones | CargoXprez",
        "Libro de Reclamaciones virtual de CargoXprez (SOLUCIONES INFORMÁTICAS MDD "
        "S.A.C., RUC 20490042068), según la Ley 29571.",
    ),
}

_RE_TITULO = re.compile(r"<title>.*?</title>", re.S)
_RE_FAQ = re.compile(r'\s*<script type="application/ld\+json" id="ld-faq">.*?</script>', re.S)


def _meta(html: str, atributo: str, nombre: str, valor: str) -> str:
    """Reemplaza el content de <meta {atributo}="{nombre}" content="...">."""
    patron = re.compile(
        r'(<meta\s+' + atributo + r'="' + re.escape(nombre) + r'"\s+content=")[^"]*(")')
    return patron.sub(lambda m: m.group(1) + escape(valor) + m.group(2), html, count=1)


def ruta_normalizada(ruta: str) -> str:
    """'/privacidad/' -> 'privacidad'; sin query ni barras."""
    return ruta.split("?", 1)[0].strip("/")


def personalizar(html: str, ruta: str) -> str:
    """El index.html con los metadatos de `ruta`."""
    clave = ruta_normalizada(ruta)
    pagina = PAGINAS.get(clave)

    if pagina is None:
        # Panel, pantallas internas o una URL que no existe.
        html = _RE_FAQ.sub("", html)
        return html.replace(
            '<meta name="robots" content="index, follow"',
            '<meta name="robots" content="noindex, follow"', 1)

    url = f"{URL_BASE}/{clave}" if clave else f"{URL_BASE}/"
    html = _RE_TITULO.sub(lambda _: f"<title>{escape(pagina.titulo)}</title>", html, count=1)
    html = _meta(html, "name", "description", pagina.descripcion)
    html = _meta(html, "property", "og:title", pagina.titulo)
    html = _meta(html, "property", "og:description", pagina.descripcion)
    html = _meta(html, "property", "og:url", url)
    html = _meta(html, "name", "twitter:title", pagina.titulo)
    html = _meta(html, "name", "twitter:description", pagina.descripcion)
    html = re.sub(r'(<link rel="canonical" href=")[^"]*(")',
                  lambda m: m.group(1) + url + m.group(2), html, count=1)
    if clave:
        html = _RE_FAQ.sub("", html)
    return html
