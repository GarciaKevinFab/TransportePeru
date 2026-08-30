"""
Capa de acceso a Postgres — infraestructura del corte incremental Mongo -> PG.
=============================================================================
El backend está migrando de Mongo a Postgres **por conjuntos de tablas**, no de
golpe. Mientras dure la transición conviven las dos bases: cada tabla tiene UNA
sola fuente de verdad, y este módulo es la puerta de entrada a las que ya
cortaron.

Reglas que hacen que la convivencia no se vuelva un problema:

1. La unidad de corte es el CONJUNTO DE TABLAS, no el archivo. Si dos módulos
   escriben la misma tabla (pasa con liquidacion_lineas, que escriben tanto
   liquidacion_flete.py como whatsapp_bot.py), los dos se migran juntos o
   ninguno — si no, esa tabla queda con dos fuentes de verdad y los datos
   divergen en silencio.

2. Se conecta como `app_backend`, NUNCA como `postgres`. Ese rol no puede
   evadir RLS, así que una consulta a la que se le olvide el filtro por
   empresa devuelve cero filas en vez de datos de otro tenant. Es una red de
   seguridad, no el mecanismo principal: el filtro explícito por company_id se
   sigue escribiendo en cada query, igual que en la época de Mongo.

3. Cada request abre UNA transacción y fija el contexto de empresa con
   SET LOCAL (via set_config(..., true)). Al cerrar la transacción el valor
   desaparece solo, así que una conexión reciclada por el pool para otro
   request —de otra empresa— nunca hereda el contexto viejo.
"""
import asyncio
import json
import os
import uuid as _uuid
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone

import asyncpg

DATABASE_URL = os.environ.get("DATABASE_URL", "")

_pool = None
_pool_lock = asyncio.Lock()


async def _init_connection(conn):
    await conn.set_type_codec(
        "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog"
    )


async def get_pool():
    """Pool perezoso. Se crea en el primer uso en vez de en un evento startup
    para no depender del orden de importación de server.py (este módulo lo
    importan routers que se registran al final del archivo, ya con la app
    a medio construir)."""
    global _pool
    if _pool is None:
        async with _pool_lock:
            if _pool is None:  # otra corrutina pudo crearlo mientras esperábamos el lock
                if not DATABASE_URL:
                    raise RuntimeError(
                        "DATABASE_URL no está configurada — el módulo que la necesita "
                        "ya migró a Postgres y no puede funcionar sin ella."
                    )
                _pool = await asyncpg.create_pool(
                    dsn=DATABASE_URL, min_size=1, max_size=10, init=_init_connection
                )
    return _pool


async def close_pool():
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


@asynccontextmanager
async def tx(current_user: dict, superadmin: bool = False):
    """Transacción con el contexto de empresa ya fijado para RLS.

        async with db_pg.tx(current_user) as conn:
            rows = await conn.fetch("select * from proveedores where company_id = $1", cid)

    `superadmin` queda en False incluso cuando el usuario ES superadmin, y eso
    es deliberado: hoy este módulo filtra siempre por current_user["company_id"]
    (un superadmin ve solo su propia empresa acá, igual que con Mongo), así que
    abrir RLS no cambiaría ningún resultado — solo apagaría la red de seguridad
    que atrapa un WHERE olvidado. Se pasa True únicamente en el código que de
    verdad necesite cruzar empresas.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "select set_config('app.current_company_id', $1, true), "
                "       set_config('app.is_superadmin', $2, true)",
                str(current_user["company_id"]),
                "true" if superadmin else "false",
            )
            yield conn


# ---------------------------------------------------------------------------
# Conversión de tipos
# ---------------------------------------------------------------------------
# Postgres devuelve UUID/datetime/date como objetos Python; Mongo devolvía
# strings. El frontend ya está escrito contra la forma vieja, así que la
# respuesta de la API tiene que seguir siendo exactamente la misma: ids como
# string y fechas en ISO. Esto reemplaza a srv.serialize_doc.

def to_api(record):
    """Un asyncpg.Record -> dict con la misma forma que devolvía Mongo."""
    if record is None:
        return None
    out = {}
    for key, value in dict(record).items():
        if isinstance(value, _uuid.UUID):
            out[key] = str(value)
        elif isinstance(value, datetime):
            out[key] = value.isoformat()
        elif isinstance(value, date):
            out[key] = value.isoformat()
        else:
            out[key] = value
    return out


def rows_to_api(records):
    return [to_api(r) for r in records]


def as_uuid(value):
    """None para valores vacíos o que no son uuid — así una FK opcional que
    llega como cadena vacía no revienta el insert."""
    if value is None or value == "":
        return None
    if isinstance(value, _uuid.UUID):
        return value
    try:
        return _uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        return None


def as_date(value):
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def as_ts(value):
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def as_float(value, default=None):
    if value is None or value == "":
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def as_int(value, default=None):
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def as_bool(value):
    if isinstance(value, bool):
        return value
    if value is None or value == "":
        return None
    return str(value).lower() in ("true", "1", "yes", "si")


# Cómo se declara una tabla: {columna: kind}. El kind decide la conversión al
# escribir y el cast SQL cuando Postgres no puede inferir el tipo (enums).
#   'uuid' 'text' 'bool' 'float' 'int' 'date' 'ts' 'json'  |  'enum:<nombre>'
_COERCERS = {
    "uuid": as_uuid,
    "text": lambda v: None if v is None else str(v),
    "bool": as_bool,
    "float": as_float,
    "int": as_int,
    "date": as_date,
    "ts": as_ts,
    # jsonb: el codec de la conexion ya hace json.dumps, asi que el dict o
    # la lista de Python viajan tal cual. Convertirlos a string aca los
    # codificaria dos veces.
    "json": lambda v: v,
}


def _coerce(kind, value):
    if kind.startswith("enum:"):
        return None if value is None else str(value)
    return _COERCERS[kind](value)


def _cast(kind, placeholder):
    # asyncpg no sabe encodear un str a un enum de Postgres sin ayuda; el cast
    # explícito en el SQL se lo dice. El resto de tipos los infiere solo.
    return placeholder + "::" + kind[5:] if kind.startswith("enum:") else placeholder


def _q(col):
    return '"' + col + '"'


class Filtros:
    """Arma el WHERE de una consulta con filtros opcionales.

    Los endpoints de lista repiten siempre la misma forma: un filtro fijo por
    empresa y varios opcionales que dependen de lo que mande el cliente. En
    Mongo eso era un dict que se iba llenando; en SQL hay que llevar ademas la
    numeracion de los parametros ($1, $2, ...), que es justo donde es facil
    equivocarse al agregar un filtro en el medio.

    Las condiciones se escriben con $? y la clase pone el numero que toca:

        f = Filtros('company_id = $?', as_uuid(cid))
        f.si(trip_id, 'trip_id = $?', as_uuid(trip_id))
        rows = await conn.fetch('select * from facturas where ' + f.where, *f.values)

    Los valores SIEMPRE van como parametros, nunca interpolados en el SQL.
    """

    def __init__(self, plantilla=None, valor=None):
        self._conds = []
        self._values = []
        if plantilla is not None:
            self.agregar(plantilla, valor)

    def agregar(self, plantilla, valor):
        self._values.append(valor)
        self._conds.append(plantilla.replace("?", str(len(self._values))))
        return self

    def crudo(self, condicion):
        """Condicion sin parametro, ej. 'not deleted'.

        Solo para texto escrito en el codigo: nunca se le pasa nada que
        venga de un request, porque esto va directo al SQL.
        """
        self._conds.append(condicion)
        return self

    def si(self, condicion, plantilla, valor):
        """Agrega el filtro solo si `condicion` es verdadera."""
        if condicion:
            self.agregar(plantilla, valor)
        return self

    @property
    def where(self):
        return " and ".join(self._conds) if self._conds else "true"

    @property
    def values(self):
        return self._values


def build_insert(table, cols, data):
    """(sql, valores) para insertar `data`, tomando SOLO las columnas
    declaradas en `cols`. Los nombres de columna nunca vienen del request —
    salen de `cols`, que es código — así que no hay superficie de inyección."""
    used = [c for c in cols if c in data]
    placeholders = [_cast(cols[c], "$" + str(i + 1)) for i, c in enumerate(used)]
    sql = (
        "insert into " + _q(table) + " (" + ", ".join(_q(c) for c in used) + ") "
        "values (" + ", ".join(placeholders) + ")"
    )
    return sql, [_coerce(cols[c], data[c]) for c in used]


def build_update(table, cols, data, where_cols):
    """(sql, valores) para un UPDATE ... WHERE <where_cols>. `data` debe traer
    también los valores de where_cols. Devuelve (None, None) si no hay nada
    que actualizar."""
    sets = [c for c in cols if c in data and c not in where_cols]
    if not sets:
        return None, None
    assigns, values, n = [], [], 0
    for c in sets:
        n += 1
        assigns.append(_q(c) + " = " + _cast(cols[c], "$" + str(n)))
        values.append(_coerce(cols[c], data[c]))
    conds = []
    for c in where_cols:
        n += 1
        conds.append(_q(c) + " = " + _cast(cols[c], "$" + str(n)))
        values.append(_coerce(cols[c], data[c]))
    sql = (
        "update " + _q(table) + " set " + ", ".join(assigns)
        + " where " + " and ".join(conds)
    )
    return sql, values
