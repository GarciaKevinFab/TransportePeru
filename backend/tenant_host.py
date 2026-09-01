"""
Resolucion del inquilino a partir del host de la peticion.
==========================================================
`<slug>.sisac.pe` -> la empresa duena de ese subdominio.

QUE ES Y QUE NO ES
------------------
Esto NO es la frontera de seguridad. La frontera sigue siendo la que ya era: el
`company_id` firmado dentro del JWT, mas las politicas RLS de Postgres que lo
aplican en cada consulta. Un host no lo firma nadie y cualquiera puede mandar
la cabecera `Host` que se le antoje.

Lo que el host aporta son dos cosas que el token no puede dar, porque pasan
ANTES de que exista un token:

  1. ACOTAR EL LOGIN. Hoy `/auth/login` busca en todo el sistema
     (`where email = $1`, `where dni = $1`) porque en ese momento no sabe de
     que empresa se trata. El indice de email ya es (company_id, email), pero
     users_dni_idx NO es unico: con dos inquilinos que compartan un DNI,
     fetchrow se queda con la fila que le toque y uno de los dos choferes no
     puede entrar nunca, sin ningun error que lo explique. El host dice cual es
     la empresa antes de validar credenciales, y eso desaparece.

  2. MARCAR LA PANTALLA DE ACCESO con el nombre, el logo y el color del
     cliente, que hoy no se pueden saber antes de autenticar.

Y una tercera, defensiva: si el host resuelve a una empresa, un token de OTRA
empresa se rechaza (ver `server.get_current_user`). No tapa ninguna fuga -RLS
sigue mandando por el token, no por el host- pero evita que la sesion de un
inquilino siga viva en el origen de otro, que es la clase de cosa que nadie
entiende cuando aparece en un log seis meses despues.

HOSTS QUE NO SON DE NADIE
-------------------------
`localhost`, una IP, el dominio raiz y los subdominios de servicio
(`fletepro`, `www`, `api`...) devuelven None: son la landing, el alta y el
acceso de rescate, y ahi el inquilino se sigue resolviendo solo por el token,
exactamente igual que hasta ahora. Devolver None es el caso NORMAL, no un
error.
"""
import os
import re
import time
from typing import Optional

import db_pg

# El dominio bajo el que colgarian los inquilinos, si los hubiera.
#
# VACIO POR DEFECTO, Y ESO ES LA DECISION DE PRODUCTO: no hay subdominio por
# empresa. Todo el mundo entra por fletepro.sisac.pe/login y cae en su empresa
# por su usuario, que es mas simple de explicar a un cliente y de operar para
# nosotros: una sola direccion que recordar, un solo certificado, ningun
# hostname que crear en Cloudflare por cada alta.
#
# Vacio, slug_desde_host() devuelve None para CUALQUIER host y todo lo que
# cuelga de el se apaga solo: /api/tenant responde 404 siempre, el login busca
# en todo el sistema y la comprobacion de host no compara nada.
#
# Poniendo TENANT_BASE_DOMAIN=sisac.pe vuelve a activarse entero. Se deja asi
# -y no borrado- porque la maquinaria esta escrita y probada, y el dia que un
# cliente pida su propia direccion es una variable de entorno y un hostname en
# Cloudflare, no un desarrollo.
DOMINIO_BASE = os.environ.get("TENANT_BASE_DOMAIN", "").strip().lower().strip(".")

# Etiquetas que NUNCA pueden ser de una empresa, porque son -o van a ser- del
# servicio. Reservar de mas es gratis; reservar de menos significa quitarle
# despues la direccion a un cliente que ya la tiene en marcadores y la app
# instalada como PWA con ese origen grabado.
#
# Esta es la lista AUTORITATIVA. La migracion 016 lleva un minimo defensivo
# solo para su relleno, porque son palabras que van a crecer -hoy 'api', manana
# 'facturacion'- y no quiero una migracion por cada una.
RESERVADOS = {
    # marca y servicio. 'fletepro' se queda al lado de 'cargoxprez' aunque el
    # producto ya no se llame asi: mientras el subdominio viejo siga resuelto
    # en el tunel tiene que seguir cayendo en la landing, y en cualquier caso
    # un slug que alguna vez fue la marca no puede quedar libre para que lo
    # tome una empresa cliente.
    "cargoxprez", "cargo", "xprez",
    "fletepro", "sisac", "transportes", "app", "api", "www", "admin",
    "soporte", "ayuda", "help", "status", "blog", "docs", "cuenta",
    # infraestructura y correo
    "mail", "smtp", "imap", "pop", "mx", "ns", "ns1", "ns2", "autodiscover",
    "static", "assets", "cdn", "img", "media", "files", "uploads",
    # entornos
    "dev", "test", "staging", "demo", "preview", "sandbox", "local",
    "localhost",
    # rutas de producto que algun dia podrian querer host propio
    "login", "signup", "registro", "billing", "pagos", "facturacion",
}
RESERVADOS |= {
    s.strip().lower()
    for s in os.environ.get("TENANT_RESERVED_SLUGS", "").split(",")
    if s.strip()
}

# El mismo formato que exige la CHECK de la migracion 016. Duplicado a
# proposito: la base es la ultima linea de defensa, y esto es el primer filtro,
# que ademas tiene que poder decir POR QUE falla antes de llegar a Postgres.
_RE_SLUG = re.compile(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$")

LARGO_MIN, LARGO_MAX = 2, 30

# Tildes -> ASCII. La tabla es corta y fija a proposito: un slug es un nombre
# de dominio y ahi no entra nada que no sea [a-z0-9-].
_SIN_TILDES = str.maketrans(
    "áàäâãéèëê"
    "íìïîóòöôõ"
    "úùüûñç",
    "aaaaaeeeeiiiiooooouuuunc",
)


class SlugInvalido(ValueError):
    """El slug pedido no sirve como subdominio. El mensaje va tal cual al usuario."""


def validar_slug(slug: str) -> str:
    """Devuelve el slug normalizado, o levanta SlugInvalido diciendo que pasa."""
    s = (slug or "").strip().lower()
    if not s:
        raise SlugInvalido("Falta la direccion web de la empresa")
    if not (LARGO_MIN <= len(s) <= LARGO_MAX):
        raise SlugInvalido(
            f"La direccion debe tener entre {LARGO_MIN} y {LARGO_MAX} caracteres"
        )
    if not _RE_SLUG.match(s):
        raise SlugInvalido(
            "La direccion solo admite minusculas, numeros y guiones, "
            "y no puede empezar ni terminar en guion"
        )
    if "--" in s:
        # Las posiciones 3-4 estan reservadas para punycode (xn--): un doble
        # guion produce un nombre que unos resolvers leen como IDN y otros no.
        raise SlugInvalido("La direccion no puede llevar dos guiones seguidos")
    if s in RESERVADOS:
        raise SlugInvalido("Esa direccion esta reservada, elige otra")
    return s


def slugificar(nombre: str) -> str:
    """Nombre comercial -> slug candidato. Puede devolver '' si el nombre no
    deja nada utilizable; quien llama decide el respaldo."""
    s = (nombre or "").strip().lower().translate(_SIN_TILDES)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s[:LARGO_MAX].strip("-")


async def slug_esta_libre(slug: str) -> bool:
    """Si ningun inquilino ocupa ya ese subdominio.

    Va con tx_global y no con la transaccion de quien llama, y es importante:
    "quien mas tiene este slug" es una pregunta que CRUZA empresas por
    definicion. Preguntada dentro de un `tx({"company_id": ...})`, la politica
    RLS esconderia las demas empresas y la respuesta seria siempre "libre" —
    justo la respuesta equivocada.
    """
    async with db_pg.tx_global("comprobar si un subdominio ya esta ocupado") as conn:
        return not await conn.fetchval(
            "select 1 from companies where slug = $1", slug
        )


async def slug_libre(nombre: str, respaldo: str = "") -> str:
    """Un slug valido y sin usar, derivado del nombre comercial.

    Se llama ANTES de abrir la transaccion que crea la empresa, no dentro: la
    comprobacion necesita ver TODAS las empresas (ver slug_esta_libre) y la
    transaccion del alta esta acotada a la que se esta creando.

    Eso deja una ventana entre elegir el slug y usarlo, y es asumida: si dos
    altas con el mismo nombre caen a la vez, las dos eligen el mismo candidato
    y el indice unico rechaza a una. Importa que choque contra la base, no que
    gane la carrera aca arriba.
    """
    base = slugificar(nombre) or slugificar(respaldo)
    if len(base) < LARGO_MIN:
        base = "empresa"

    candidato, n = base, 1
    while (
        candidato in RESERVADOS
        or len(candidato) < LARGO_MIN
        or "--" in candidato
        or not _RE_SLUG.match(candidato)
        or not await slug_esta_libre(candidato)
    ):
        n += 1
        sufijo = f"-{n}"
        candidato = base[: LARGO_MAX - len(sufijo)].strip("-") + sufijo
    return candidato


# ---------------------------------------------------------------------------
# HOST -> SLUG
# ---------------------------------------------------------------------------
def slug_desde_host(host: Optional[str]) -> Optional[str]:
    """La etiqueta de inquilino del host, o None si ese host no es de nadie.

    None NO es un fallo: es lo que devuelven la landing, localhost, una IP y
    todos los subdominios de servicio. Ahi el inquilino se resuelve solo por el
    token, como siempre.
    """
    if not host or not DOMINIO_BASE:
        # Sin dominio base no hay subdominios por empresa: es el modo normal.
        return None

    h = host.strip().lower().rstrip(".")
    if h.startswith("["):
        return None  # IPv6 entre corchetes: no puede ser host de inquilino
    if ":" in h:
        h = h.rsplit(":", 1)[0]  # fuera el puerto

    sufijo = "." + DOMINIO_BASE
    if not h.endswith(sufijo):
        return None  # dominio raiz, localhost, IP, tunel de preview...

    etiqueta = h[: -len(sufijo)]
    if "." in etiqueta:
        # a.b.sisac.pe: el certificado comodin cubre un solo nivel, o sea que
        # esto ni siquiera llegaria por HTTPS. Se rechaza explicito igual.
        return None
    if etiqueta in RESERVADOS:
        return None
    if not _RE_SLUG.match(etiqueta) or not (LARGO_MIN <= len(etiqueta) <= LARGO_MAX):
        return None
    return etiqueta


# ---------------------------------------------------------------------------
# SLUG -> EMPRESA (con cache)
# ---------------------------------------------------------------------------
# Esta lectura ocurre en CADA peticion autenticada y en cada carga del login.
# Sin cache seria una consulta de mas por request para leer una fila que cambia
# una vez al ano.
#
# Los negativos tambien se cachean, por el motivo contrario: un host inexistente
# que alguien barra en bucle no debe convertirse en una consulta por intento. Su
# TTL es corto para que una empresa recien creada no tenga que esperar el TTL
# completo, y ademas el alta invalida a mano.
_TTL_OK = 300.0
_TTL_VACIO = 15.0
_cache: dict = {}

# Solo lo justo: identificar al inquilino y pintar su marca. La fila entera
# trae sunat_config, que lleva el token de la API de facturacion electronica, y
# esto alimenta un endpoint publico sin autenticar.
_CAMPOS = "id, name, slug, logo_url, brand_color, subscription_status, trial_ends_at"


def invalidar_cache(slug: Optional[str] = None) -> None:
    """Tras crear o renombrar una empresa. Sin argumento, vacia todo."""
    if slug is None:
        _cache.clear()
    else:
        _cache.pop(slug, None)


async def empresa_por_slug(slug: str) -> Optional[dict]:
    ahora = time.monotonic()
    entrada = _cache.get(slug)
    if entrada and entrada[0] > ahora:
        return entrada[1]

    # tx_global porque esto es, literalmente, lo que pasa antes de saber la
    # empresa: es el paso que la averigua. Caso 1 de db_pg.tx_global.
    async with db_pg.tx_global("resolver el inquilino por el subdominio del host") as conn:
        fila = await conn.fetchrow(f"select {_CAMPOS} from companies where slug = $1", slug)

    empresa = db_pg.to_api(fila) if fila else None
    _cache[slug] = (ahora + (_TTL_OK if empresa else _TTL_VACIO), empresa)
    return empresa


async def empresa_desde_host(host: Optional[str]) -> Optional[dict]:
    """Atajo: host -> empresa, o None si ese host no es de un inquilino."""
    slug = slug_desde_host(host)
    return await empresa_por_slug(slug) if slug else None
