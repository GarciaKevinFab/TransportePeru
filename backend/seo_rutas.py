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

EL CONTENIDO, NO SOLO LOS METADATOS

  Con lo anterior el HTML crudo traia un titulo correcto y, debajo, un
  <div id="root"></div> vacio y ~110 palabras de <noscript>. Un rastreador de
  IA sin JavaScript no veia la propuesta, ni los planes, ni las 12 preguntas
  del FAQPage, que asi era un JSON-LD sin texto visible que lo respaldara.

  `con_contenido(html, ruta)` mete DENTRO del root el contenido de la pagina en
  HTML semantico (encabezados, listas, tabla, preguntas). React lo reemplaza
  al montar; mientras tanto se ve con unos estilos minimos parecidos a los de
  la landing, y frontend/src/lib/prerender.js lo deja a la vista hasta que la
  pagina de React esta pintada, para que no haya un salto a pantalla en blanco.

  Las cifras salen del mismo catalogo que aplica el backend (planes.py): el
  precio que se cobra, los dias de prueba que da el alta y el tope de
  vehiculos que corta suscripciones.py. Las preguntas salen del JSON-LD del
  propio index.html, asi que el texto visible y el estructurado son el mismo
  por construccion. El resto del texto es copia del de LandingPage.jsx y
  tests/test_seo.py comprueba que siga siendolo.

RUTAS DESCONOCIDAS: 404 DE VERDAD

  `es_ruta_spa(ruta)` dice si la ruta es una pantalla de la SPA (el panel, la
  app del chofer...). Lo que no es pagina publica, ni pantalla de la SPA, ni
  fichero del build sale con 404: antes todo respondia 200 con la portada, y
  /panel o /llms-full.txt parecian paginas que existian.
"""
import json
import re
from datetime import datetime, timezone
from html import escape
from typing import NamedTuple

import planes
import proveedor

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


# ─── Rutas de la SPA ──────────────────────────────────────────────────────
#
# Las pantallas que existen en frontend/src/App.js. Al recargar cualquiera de
# ellas el servidor tiene que devolver el index.html con 200, o el panel deja
# de funcionar con F5. tests/test_seo.py compara esta lista con los
# `path="..."` de App.js: si alguien anade una pantalla y no la apunta aqui, la
# prueba falla antes de que la recarga empiece a dar 404 en produccion.
RUTAS_SPA = (
    "/", "/registro", "/privacidad", "/terminos", "/reclamaciones", "/olvide",
    "/restablecer", "/comprar", "/login",
    "/dashboard", "/vehicles", "/units", "/vehicles/:vehicleId/tires",
    "/vehicles/:vehicleId/tires/rotate", "/vehicles/:vehicleId/tires/align",
    "/vehicles/:vehicleId/tires/graphs", "/tires/required-by-dimension",
    "/tires/lifecycle", "/equipment", "/documents", "/trips", "/fuel", "/tires",
    "/maintenance", "/inventory", "/issues", "/settlements", "/billing",
    "/detracciones", "/cashbox", "/liquidacion-flete", "/liquidacion-flete/:id",
    "/trips/:tripId/checklist", "/reports", "/users", "/settings", "/companies",
    "/suscripcion", "/admin/comprobantes",
    "/driver/login", "/driver", "/driver/trip", "/driver/checklist",
    "/driver/fuel", "/driver/expenses", "/driver/issues",
)

_RE_RUTAS_SPA = [
    re.compile("^" + re.sub(r":[A-Za-z]+", "[^/]+", r.strip("/")) + "$")
    for r in RUTAS_SPA
]


def es_ruta_spa(ruta: str) -> bool:
    """True si `ruta` es una pantalla de la SPA (publica o del panel)."""
    clave = ruta_normalizada(ruta)
    return any(r.match(clave) for r in _RE_RUTAS_SPA)


# ─── /.well-known/security.txt (RFC 9116) ─────────────────────────────────
#
# Fecha fija y no "hoy + un ano": un Expires que se mueve solo no le dice a
# nadie que el contacto sigue vigente. Hay prueba que falla cuando queda menos
# de un mes, para que se renueve a mano revisando el contacto.
SECURITY_TXT_EXPIRA = datetime(2027, 11, 9, 5, 0, tzinfo=timezone.utc)


def security_txt() -> str:
    return (
        f"Contact: mailto:{proveedor.EMAIL}\n"
        f"Expires: {SECURITY_TXT_EXPIRA.strftime('%Y-%m-%dT%H:%M:%S.000Z')}\n"
        "Preferred-Languages: es, en\n"
        f"Canonical: {URL_BASE}/.well-known/security.txt\n"
    )


# ─── Contenido de las paginas publicas, puesto por el servidor ────────────

ANCLA_ROOT = '<div id="root"></div>'
_RE_NOSCRIPT = re.compile(r"\s*<noscript>.*?</noscript>", re.S)
_RE_LD_FAQ = re.compile(r'<script type="application/ld\+json" id="ld-faq">(.*?)</script>', re.S)

# Estilos minimos y con prefijo `pre-`: se ven ANTES de que cargue el CSS de
# React, asi que no pueden depender de sus clases. Imitan los colores de la
# landing (grafito-950 de fondo, rojo de la marca) para que el paso al React
# no sea un fogonazo blanco.
ESTILOS = """<style>
.pre{background:#0b0908;color:#f3f2f0;min-height:100vh;margin:0;
  font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;line-height:1.6}
.pre a{color:#ff5a5a}
.pre header,.pre main>section,.pre footer{max-width:72rem;margin:0 auto;padding:1.5rem}
.pre header nav{display:flex;flex-wrap:wrap;gap:1rem;align-items:center}
.pre header nav a{color:#f3f2f0;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
.pre .marca{font-weight:900;font-size:1.25rem;margin-right:auto}
.pre h1{font-size:clamp(2.2rem,6vw,4.5rem);line-height:1.05;letter-spacing:-.03em;margin:2rem 0 1rem;font-weight:900}
.pre h2{font-size:1.9rem;letter-spacing:-.02em;margin:2.5rem 0 .75rem}
.pre h3{font-size:1.15rem;margin:1.5rem 0 .25rem}
.pre p,.pre li,.pre dd{color:#a19d97}
.pre dt{font-weight:700;margin-top:1rem}
.pre dd{margin:0}
.pre .cta{display:inline-flex;min-height:48px;align-items:center;padding:0 1.6rem;border-radius:999px;
  background:#e00000;color:#fff;font-weight:700;text-decoration:none}
.pre table{border-collapse:collapse;width:100%;font-size:.9rem}
.pre th,.pre td{border-bottom:1px solid #2a2622;padding:.5rem;text-align:left}
.pre .precio{font-size:2rem;font-weight:900;color:#f3f2f0}
</style>"""


def _soles(monto: float) -> str:
    """199.0 -> 'S/ 199'; 199.5 -> 'S/ 199.50'. Como lo escribe la landing."""
    monto = float(monto)
    return f"S/ {monto:.0f}" if monto.is_integer() else f"S/ {monto:.2f}"


def preguntas_frecuentes(html: str) -> list[tuple[str, str]]:
    """Las preguntas del FAQPage de index.html, en el mismo orden."""
    m = _RE_LD_FAQ.search(html)
    if not m:
        return []
    datos = json.loads(m.group(1))
    return [(q["name"], q["acceptedAnswer"]["text"]) for q in datos.get("mainEntity", [])]


def cifras() -> dict:
    """Lo que la portada promete y el backend aplica, del mismo sitio."""
    _, precio_pro = planes.PRECIOS_CHECKOUT["pro"]
    return {
        "dias": planes.DIAS_DE_PRUEBA,
        "tope_gratis": planes.LIMITE_VEHICULOS["gratis"],
        "tope_pro": planes.LIMITE_VEHICULOS["pro"],
        "precio_pro": _soles(precio_pro),
    }


# Copia del texto de frontend/src/pages/LandingPage.jsx y de sus componentes.
# tests/test_seo.py comprueba que cada frase siga estando alli, tal cual.
ETIQUETA = "Gestión de flota para transportistas del Perú"
TITULAR = ("Tu flota ya genera los datos.", "El problema es que viven",
           "en seis cuadernos distintos.")
PROPUESTA = (
    "Viajes, combustible, llantas, mantenimiento y documentos en un solo sitio. "
    "El chofer carga desde el celular, la liquidación sale sola y el SOAT "
    "vencido te avisa antes de que lo pare la policía."
)
COMO_FUNCIONA = ("Operar, mantener, cumplir.",
                 "Las tres cosas que hacen que un camión salga hoy y siga saliendo el mes que viene.")
PASOS = [
    ("Operación", "Viajes, viáticos, combustible y caja. La liquidación de flete sale con lo que ya cargaron el chofer y el taller, en vez de rearmarse en una hoja de cálculo a fin de mes."),
    ("Flota", "Vehículos, unidades, llantas e inventario. Cada llanta lleva su historial: montaje, rotación, inspecciones con profundidad, reencauche y baja, con su costo por kilómetro."),
    ("Cumplimiento", "Documentos con sus vencimientos, incidentes, guías de transportista y facturas electronicas para SUNAT, y detracciones. Un documento vencido bloquea la salida antes de que sea una multa."),
]
TITULO_MODULOS = "Todo lo que hoy está en un cuaderno."
MODULOS = [
    ("Viajes y rutas", "Programación, enganches y cierre con liquidación."),
    ("Combustible", "Vales, cargas y consumo por unidad."),
    ("Llantas", "Esquema por eje, inspecciones, rotación y reencauche."),
    ("Mantenimiento", "Órdenes de trabajo, planes preventivos e indisponibilidad."),
    ("Documentos", "Vencimientos, alertas y bloqueos operativos."),
    ("SUNAT", "Guias de transportista, facturas y detracciones."),
]
TITULO_DIFERENCIAS = "Hecho para como se trabaja en carretera."
DIFERENCIAS = [
    ("El chofer carga desde el celular, con o sin señal", "Checklist previo al viaje, gastos, incidentes y fotos. Si no hay cobertura se guarda y sube después, que en carretera es la mitad del tiempo."),
    ("También por WhatsApp", "El chofer manda la foto de la factura por WhatsApp y entra al sistema. Sin instalar nada y sin capacitación."),
    ("Las facturas se leen solas", "La foto de una factura o una guía se convierte en datos: monto, RUC y fecha, sin teclear."),
    ("Los datos de cada empresa, separados de verdad", "El aislamiento no depende de que el programador no se olvide de un filtro: lo impone la base de datos. Una consulta sin empresa devuelve cero filas, no las de otro."),
]
TITULO_PLANES = ("Un viaje mal liquidado cuesta más.",
                 "Empiezas gratis y sin tarjeta. Si no te sirve, no pagas nada.")
PLANES = [
    # (nombre, para quien, lo que incluye)
    ("Gratis", "Para empezar y ver si encaja.",
     ["Viajes y liquidaciones", "Llantas y mantenimiento", "Documentos y vencimientos", "App del chofer"]),
    ("Pro", "Para la flota que ya factura todos los días.",
     ["Todo lo del plan Gratis", "SUNAT: guías y facturas", "Detracciones", "Bot de WhatsApp",
      "Lectura de facturas", "Reportes y costo por kilómetro"]),
    ("Empresa", "Para varias sedes o más de una razón social.",
     ["Todo lo del plan Pro", "Varias empresas en una cuenta", "Integraciones a medida", "Soporte dedicado"]),
]
COMPARATIVA = [
    ("Viajes, viáticos y liquidación de flete", True, True, True),
    ("Llantas, mantenimiento e inventario", True, True, True),
    ("Documentos y alertas de vencimiento", True, True, True),
    ("App del chofer, con modo sin señal", True, True, True),
    ("Guías y facturas para SUNAT", False, True, True),
    ("Detracciones", False, True, True),
    ("Bot de WhatsApp", False, True, True),
    ("Lectura automática de facturas", False, True, True),
    ("Reportes y costo por kilómetro", False, True, True),
    ("Varias empresas en una cuenta", False, False, True),
    ("Integraciones a medida y soporte dedicado", False, False, True),
]
TITULO_PREGUNTAS = "Lo que todos preguntan."


def como_se_contrata(c: dict) -> list[tuple[str, str]]:
    """Los pasos de components/ComoSeContrata.jsx, con las cifras del catalogo."""
    return [
        (f"Pruébalo {c['dias']} días gratis, sin tarjeta",
         "Creas la cuenta de tu empresa y cargas tu flota completa, sin límite de vehículos durante la prueba."),
        ("Al terminar eliges tu plan y pagas en línea",
         "Paga con Yape, desde tu banca móvil o con tarjeta, desde tu cuenta y con el total con IGV a la vista."),
        ("Boleta o factura electrónica a tu RUC",
         "Escribes tu RUC y completamos la razón social con el padrón de SUNAT. Recibes un comprobante por cada cobro."),
        ("Sin contrato: cancelas cuando quieras desde tu cuenta",
         "Se detiene el cobro automático y mantienes el acceso hasta el fin del mes ya pagado."),
        ("Si no eliges plan, sigues en el plan Gratis",
         f"Sin cobro: sigues trabajando con hasta {c['tope_gratis']} vehículos activos y no se borra nada de lo que cargaste."),
    ]


def _lista(items) -> str:
    return "<ul>" + "".join(f"<li>{escape(i)}</li>" for i in items) + "</ul>"


def _cabecera() -> str:
    return (
        '<header><nav aria-label="Principal">'
        f'<a class="marca" href="/">{escape(proveedor.PRODUCTO)}</a>'
        '<a href="/#como-funciona">Cómo funciona</a>'
        '<a href="/#planes">Planes</a>'
        '<a href="/#preguntas">Preguntas</a>'
        '<a href="/login">Entrar</a>'
        '<a href="/registro">Crear la cuenta de tu empresa</a>'
        "</nav></header>"
    )


def _pie() -> str:
    return (
        '<footer><nav aria-label="Legal y contacto"><ul>'
        '<li><a href="/privacidad">Privacidad</a></li>'
        '<li><a href="/terminos">Términos del servicio</a></li>'
        '<li><a href="/reclamaciones">Libro de Reclamaciones</a></li>'
        f'<li><a href="mailto:{escape(proveedor.EMAIL)}">{escape(proveedor.EMAIL)}</a></li>'
        "</ul></nav>"
        f"<p>{escape(proveedor.RAZON_SOCIAL)} — RUC {escape(proveedor.RUC)}</p>"
        "</footer>"
    )


def _plan(nombre: str, para: str, incluye: list[str], c: dict) -> str:
    if nombre == "Gratis":
        precio = f'<p><span class="precio">{_soles(0)}</span></p>'
        limite = f"Hasta {c['tope_gratis']} vehículos"
        enlace = '<a href="/registro">Empezar con el plan Gratis</a>'
    elif nombre == "Pro":
        precio = f'<p><span class="precio">{c["precio_pro"]}</span>/mes, con IGV incluido</p>'
        limite = f"Hasta {c['tope_pro']} vehículos"
        enlace = '<a href="/comprar?plan=pro">Contratar el plan Pro</a>'
    else:
        # Sin precio publicado: no se inventa uno.
        precio = "<p>Precio a medida.</p>"
        limite = "Sin límite de vehículos"
        enlace = ""
    return (f"<h3>{escape(nombre)}</h3><p>{escape(para)}</p>{precio}"
            f"<p>{escape(limite)}</p>{_lista(incluye)}"
            + (f"<p>{enlace}</p>" if enlace else ""))


def _portada(html: str) -> str:
    c = cifras()
    filas = "".join(
        f'<tr><th scope="row">{escape(f)}</th>'
        + "".join(f"<td>{'Incluido' if v else 'No incluido'}</td>" for v in vs)
        + "</tr>"
        for f, *vs in COMPARATIVA
    )
    return "".join([
        "<main>",
        '<section aria-labelledby="pre-titular">',
        f"<p>{escape(ETIQUETA)}</p>",
        f'<h1 id="pre-titular">{escape(" ".join(TITULAR))}</h1>',
        f"<p>{escape(PROPUESTA)}</p>",
        '<p><a class="cta" href="/registro">Empezar gratis: crear la cuenta de tu empresa</a></p>',
        f"<p>{c['dias']} días de prueba. Sin tarjeta.</p>",
        "</section>",
        f'<section id="como-funciona"><h2>{escape(COMO_FUNCIONA[0])}</h2>',
        f"<p>{escape(COMO_FUNCIONA[1])}</p>",
        "".join(f"<h3>{escape(t)}</h3><p>{escape(x)}</p>" for t, x in PASOS),
        "</section>",
        f'<section id="modulos"><h2>{escape(TITULO_MODULOS)}</h2><dl>',
        "".join(f"<dt>{escape(t)}</dt><dd>{escape(x)}</dd>" for t, x in MODULOS),
        "</dl></section>",
        f"<section><h2>{escape(TITULO_DIFERENCIAS)}</h2>",
        "".join(f"<h3>{escape(t)}</h3><p>{escape(x)}</p>" for t, x in DIFERENCIAS),
        "</section>",
        f'<section id="planes"><h2>{escape(TITULO_PLANES[0])}</h2>',
        f"<p>{escape(TITULO_PLANES[1])}</p>",
        "".join(_plan(n, p, i, c) for n, p, i in PLANES),
        "<table><caption>Comparación de lo que incluye cada plan</caption>"
        '<thead><tr><th scope="col">Qué incluye</th><th scope="col">Gratis</th>'
        '<th scope="col">Pro</th><th scope="col">Empresa</th></tr></thead><tbody>'
        f'<tr><th scope="row">Vehículos</th><td>Hasta {c["tope_gratis"]}</td>'
        f'<td>Hasta {c["tope_pro"]}</td><td>Sin límite</td></tr>'
        f"{filas}</tbody></table>",
        '<h3 id="como-se-contrata">Cómo se contrata</h3><ol>',
        "".join(f"<li><strong>{escape(t)}</strong>. {escape(x)}</li>" for t, x in como_se_contrata(c)),
        "</ol>",
        f"<p>Te vende y te factura {escape(proveedor.RAZON_SOCIAL)}, RUC {escape(proveedor.RUC)}.</p>",
        "</section>",
        f'<section id="preguntas"><h2>{escape(TITULO_PREGUNTAS)}</h2>',
        "".join(f"<h3>{escape(p)}</h3><p>{escape(r)}</p>" for p, r in preguntas_frecuentes(html)),
        "</section>",
        "</main>",
    ])


def _simple(titulo: str, parrafos: list[str], enlaces: list[tuple[str, str]]) -> str:
    return (
        "<main><section>"
        f"<h1>{escape(titulo)}</h1>"
        + "".join(f"<p>{escape(p)}</p>" for p in parrafos)
        + "<ul>" + "".join(f'<li><a href="{escape(h)}">{escape(t)}</a></li>' for h, t in enlaces)
        + "</ul></section></main>"
    )


def _interior(clave: str, html: str) -> str | None:
    """El cuerpo de la pagina publica `clave`, o None si no lleva."""
    c = cifras()
    if clave == "":
        return _portada(html)
    if clave == "registro":
        return _simple(
            "Crea la cuenta de tu empresa de transporte",
            [PAGINAS["registro"].descripcion,
             f"Durante los {c['dias']} días de prueba usas todo el sistema sin límite de "
             f"vehículos. Si después no eliges un plan, sigues en el plan Gratis con hasta "
             f"{c['tope_gratis']} vehículos activos. El plan Pro cuesta {c['precio_pro']} al "
             f"mes con IGV, hasta {c['tope_pro']} vehículos.",
             "Para crear la cuenta necesitas un navegador con JavaScript activado."],
            [("/", "Qué es CargoXprez"), ("/#planes", "Planes y precios"),
             ("/#preguntas", "Preguntas frecuentes"), ("/login", "Ya tengo cuenta: entrar")],
        )
    if clave == "login":
        return _simple(
            "Entrar a CargoXprez",
            [PAGINAS["login"].descripcion,
             "Para entrar necesitas un navegador con JavaScript activado."],
            [("/olvide", "Recuperar contraseña"), ("/registro", "Crear la cuenta de tu empresa"),
             ("/", "Qué es CargoXprez")],
        )
    if clave in ("privacidad", "terminos", "reclamaciones"):
        p = PAGINAS[clave]
        return _simple(
            p.titulo.split(" | ")[0],
            [p.descripcion,
             f"{proveedor.RAZON_SOCIAL}, RUC {proveedor.RUC}. Contacto: {proveedor.EMAIL}.",
             "El texto completo se muestra con JavaScript activado."],
            [("/privacidad", "Política de privacidad"), ("/terminos", "Términos del servicio"),
             ("/reclamaciones", "Libro de Reclamaciones"), ("/", "Volver a la portada")],
        )
    return None


NO_ENCONTRADA = (
    "<main><section><h1>Esta página no existe</h1>"
    "<p>La dirección que abriste no corresponde a ninguna página de CargoXprez.</p>"
    '<p><a href="/">Ir a la portada</a></p></section></main>'
)


def _envolver(html: str, interior: str) -> str:
    if ANCLA_ROOT not in html:
        return html
    bloque = (f'<div id="root"><div class="pre" data-prerender="1">{ESTILOS}'
              f"{_cabecera()}{interior}{_pie()}</div></div>")
    # El <noscript> repetiria en pequeno lo mismo que ya esta a la vista.
    html = _RE_NOSCRIPT.sub("", html, count=1)
    return html.replace(ANCLA_ROOT, bloque, 1)


def con_contenido(html: str, ruta: str) -> str:
    """El index.html de `ruta` con sus metadatos y, si es una pagina publica,
    su contenido dentro del root."""
    clave = ruta_normalizada(ruta)
    html_meta = personalizar(html, ruta)
    interior = _interior(clave, html) if clave in PAGINAS else None
    if interior is None:
        return html_meta
    return _envolver(html_meta, interior)


def no_encontrada(html: str, ruta: str) -> str:
    """El index.html para una ruta que no existe: noindex y un aviso visible."""
    return _envolver(personalizar(html, ruta), NO_ENCONTRADA)
