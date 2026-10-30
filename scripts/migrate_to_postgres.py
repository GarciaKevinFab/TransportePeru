#!/usr/bin/env python3
"""
TransportePeru - Migración de datos MongoDB -> Postgres
=======================================================
Lee TODAS las colecciones de MongoDB (solo lectura, nunca escribe en Mongo) y
las carga en las tablas equivalentes de db/schema.sql, en el Postgres
autoalojado del VPS (contenedor transporteperu-postgres). No se conecta a
nada por defecto - las URIs vienen por variables de entorno.

Es idempotente: cada insert lleva `on conflict (id) do nothing`, así que
volver a correrlo sobre una base ya cargada no duplica ni pisa filas.

Variables de entorno requeridas:
  SOURCE_MONGO_URL      ej. mongodb://transporteperu-mongo:27017
  SOURCE_DB_NAME        default: transporteperu
  TARGET_DATABASE_URL   ej. postgresql://postgres:pass@postgres:5432/transporteperu
                        (usar el superusuario `postgres`, que evade RLS -
                        NO app_backend; RLS es para el tráfico normal de la
                        app, no para esta carga masiva, que escribe filas de
                        todas las empresas a la vez)

Uso:
  python migrate_to_postgres.py            # migra todo
  python migrate_to_postgres.py --report   # solo cuenta documentos por
                                            # colección en Mongo, no escribe

Diseño (ver db/schema.sql para el contexto completo):
  - Nombres de tabla Postgres == nombres de colección Mongo (decisión de
    diseño ya tomada), así que el mapeo tabla<->colección es identidad.
  - Cada fila se inserta solo con las columnas que YA EXISTEN en el
    documento de Mongo Y en la tabla destino (introspección real de
    information_schema, no una lista a mano) - si falta un campo nuevo
    (ej. whatsapp_number en un usuario viejo), Postgres aplica su propio
    DEFAULT/NULL en vez de fallar.
  - 4 columnas con dependencia circular estructural se cargan en 2 pasadas:
    pasada 1 las deja en NULL, pasada 2 las rellena una vez que TODAS las
    tablas ya existen. Son exactamente las que en schema.sql se agregan con
    ALTER TABLE ... ADD CONSTRAINT (declaradas después de crear la tabla
    referenciada) más el único autoreferencia real (users.created_by):
      users.created_by       -> users      (autoreferencia)
      vehicles.proveedor_id  -> proveedores
      couplings.trip_id      -> trips
      work_orders.issue_id   -> issues
  - location {lat,lng} de Mongo se separa en location_lat/location_lng en
    checklists, checklist_runs, fuel_loads, issues.
  - maintenance_matrix_plans.applies_to_vehicle_ids (array en Mongo) no es
    columna en Postgres - se normaliza a la tabla puente
    maintenance_matrix_plan_vehicles después de cargar ambas tablas.
"""
import asyncio
import json
import os
import sys
import uuid
from datetime import date, datetime

import asyncpg
from motor.motor_asyncio import AsyncIOMotorClient

SOURCE_MONGO_URL = os.environ.get("SOURCE_MONGO_URL", "")
SOURCE_DB_NAME = os.environ.get("SOURCE_DB_NAME", "transporteperu")
TARGET_DATABASE_URL = os.environ.get("TARGET_DATABASE_URL", "")

# Orden de carga - respeta las dependencias de FK de supabase/schema.sql
# (mismo orden en que ese archivo crea las tablas).
TABLE_ORDER = [
    "companies", "users",
    "vehicles", "vehicle_equipment", "couplings", "units",
    "tires", "tire_mounts", "tire_inspections", "tire_life_events",
    "tire_rotations", "alignment_records",
    "document_types", "documents", "alerts", "blocks", "audit_logs",
    "routes", "trips", "trip_advances", "trip_expenses",
    "checklists", "checklist_templates", "checklist_runs", "settlements",
    "fuel_vouchers", "fuel_loads",
    "maintenance_plans", "maintenance_matrix_plans",
    "work_orders", "downtime_records", "issues",
    "suppliers", "inventory_items", "stock_moves", "purchase_orders",
    "facturas", "guias_transportista", "detracciones",
    "cash_movements",
    "notifications",
    "proveedores", "tipos_carga", "liquidaciones_flete", "liquidacion_lineas",
    "whatsapp_events", "whatsapp_unrecognized",
    "whatsapp_pending_selection", "whatsapp_documentos_pendientes",
]

# Tablas que YA cortaron: Postgres es su fuente de verdad y el backend no las
# escribe mas en Mongo. Las copias que quedaron en Mongo son una foto vieja y
# congelada.
#
# Por eso se saltan por defecto. Sin esto, una corrida completa del migrador
# volveria a insertar esas filas viejas y, peor, resucitaria en Postgres filas
# que la aplicacion ya habia borrado — el ON CONFLICT DO NOTHING no protege de
# eso, porque para una fila borrada no hay conflicto que evitar.
#
# Se migran igual si se las nombra a mano en --tables, que es exactamente lo
# que se hace UNA vez, en el momento del corte, para dejar Postgres identico a
# Mongo justo antes de cambiar el codigo.
def _leer_tablas_en_postgres():
    """Lee db/tablas_en_postgres.txt (misma carpeta padre que este script).

    Si el archivo no esta, devuelve un conjunto vacio en vez de fallar: eso
    solo puede pasar en una copia incompleta, y en ese caso lo peor que hace
    el migrador es tratar todas las tablas como no cortadas, que es
    exactamente como se comportaba antes de que existiera el corte."""
    ruta = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        "db", "tablas_en_postgres.txt")
    if not os.path.exists(ruta):
        return set()
    with open(ruta, encoding="utf-8") as fh:
        return {
            linea.strip()
            for linea in fh
            if linea.strip() and not linea.strip().startswith("#")
        }


CUT_OVER_TABLES = _leer_tablas_en_postgres()

# {tabla: [(columna, tabla_referenciada), ...]} - se dejan en NULL en la
# pasada 1 y se rellenan en la pasada 2.
DEFERRED_FKS = {
    "users": [("created_by", "users")],
    "vehicles": [("proveedor_id", "proveedores")],
    "couplings": [("trip_id", "trips")],
    "work_orders": [("issue_id", "issues")],
}

LOCATION_SPLIT_TABLES = {"checklists", "checklist_runs", "fuel_loads", "issues"}

UUID_LIKE_SUFFIXES = ("_id",)


def _is_uuid_column(col_name: str) -> bool:
    return col_name == "id" or col_name.endswith(UUID_LIKE_SUFFIXES)


def _coerce_uuid(value):
    if value is None or value == "":
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError):
        return None  # valor no es un UUID válido - se deja NULL, se reporta aparte


def _coerce_date(value):
    """Para columnas `date` (periodo_inicio, guia_remitente_fecha, etc.) que
    en Mongo pueden venir como datetime completo o como string 'YYYY-MM-DD'."""
    if value is None:
        return None
    if isinstance(value, (date, datetime)):
        return value.date() if isinstance(value, datetime) else value
    if isinstance(value, str) and len(value) >= 10:
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d").date()
        except ValueError:
            return None
    return None


TIMESTAMP_PG_TYPES = {"timestamp with time zone", "timestamp without time zone"}


def _coerce_timestamp(value):
    """server.py guarda fechas de dos formas distintas según el endpoint:
    a veces un datetime nativo (BSON date), a veces ya como string ISO
    (varios `insert_one` hacen v.isoformat() antes de guardar). asyncpg no
    auto-convierte string -> timestamptz como sí lo hace psycopg2/SQL en
    modo texto - hay que parsear explícitamente."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None  # string no parseable - se reporta en warnings vía insert_row
    return None


async def get_table_columns(pg: asyncpg.Connection, table: str) -> dict:
    """{columna: (data_type, udt_name)}. Hace falta udt_name además de
    data_type porque information_schema reporta TODA columna array como
    data_type='ARRAY' sin decir de qué - el tipo del elemento solo está en
    udt_name ('_uuid' vs '_text' vs '_float8')."""
    rows = await pg.fetch(
        """
        select column_name, data_type, udt_name
        from information_schema.columns
        where table_schema = 'public' and table_name = $1
        """,
        table,
    )
    return {r["column_name"]: (r["data_type"], r["udt_name"]) for r in rows}


def build_row(
    doc: dict,
    columns: dict,
    deferred_names: set,
    split_location: bool,
    table: str = "",
    warnings: list = None,
) -> dict:
    """Arma {columna: valor} SOLO con columnas presentes en el doc de Mongo
    Y en la tabla destino - deja que Postgres aplique su DEFAULT si falta."""
    row = {}
    for col, (pg_type, udt_name) in columns.items():
        if col in deferred_names:
            continue  # se rellena en la pasada 2
        if col in ("location_lat", "location_lng"):
            continue  # se maneja abajo, no viene directo del doc con ese nombre
        if col not in doc:
            continue
        value = doc[col]
        if value is None:
            row[col] = None
            continue
        if _is_uuid_column(col):
            coerced = _coerce_uuid(value)
            if coerced is None and warnings is not None:
                # No lo dejamos pasar en silencio: un id que no castea a uuid
                # se guardaría como NULL y perderíamos la referencia sin que
                # nadie se entere hasta que algo falle en producción.
                warnings.append(
                    f"  [{table}.{col}] id={doc.get('id')}: valor no es un uuid válido ({value!r}) -> NULL"
                )
            row[col] = coerced
        elif pg_type == "ARRAY" and udt_name == "_uuid":
            # asyncpg no acepta list[str] para uuid[] - hay que castear cada
            # elemento. Hoy solo aplica a whatsapp_pending_selection.trip_options.
            row[col] = [u for u in (_coerce_uuid(v) for v in value or []) if u is not None]
        elif pg_type == "date":
            row[col] = _coerce_date(value)
        elif pg_type in TIMESTAMP_PG_TYPES:
            row[col] = _coerce_timestamp(value)
        else:
            row[col] = value

    if split_location:
        loc = doc.get("location")
        if isinstance(loc, dict):
            row["location_lat"] = loc.get("lat")
            row["location_lng"] = loc.get("lng")

    return row


async def insert_row(pg: asyncpg.Connection, table: str, row: dict, warnings: list, doc_id):
    if not row:
        return
    cols = list(row.keys())
    values = [row[c] for c in cols]
    placeholders = ", ".join(f"${i+1}" for i in range(len(cols)))
    col_list = ", ".join(f'"{c}"' for c in cols)
    sql = f'insert into "{table}" ({col_list}) values ({placeholders}) on conflict (id) do nothing'
    try:
        await pg.execute(sql, *values)
    except Exception as e:
        warnings.append(f"  [{table}] id={doc_id}: {e}")


async def migrate(report_only: bool = False, only_tables=None, vaciar: bool = False):
    if not SOURCE_MONGO_URL:
        sys.exit("ERROR: falta SOURCE_MONGO_URL")
    mongo = AsyncIOMotorClient(SOURCE_MONGO_URL)[SOURCE_DB_NAME]

    tables = [t for t in TABLE_ORDER if t not in CUT_OVER_TABLES]
    if only_tables:
        desconocidas = [t for t in only_tables if t not in TABLE_ORDER]
        if desconocidas:
            sys.exit("ERROR: tablas desconocidas: " + ", ".join(desconocidas))
        # Se respeta el orden de TABLE_ORDER, no el que haya escrito quien
        # llama: las FKs no perdonan que las lineas entren antes que su
        # liquidacion.
        # Nombradas a mano: se permiten aunque ya hayan cortado.
        tables = [t for t in TABLE_ORDER if t in only_tables]
        ya_cortadas = [t for t in tables if t in CUT_OVER_TABLES]
        if ya_cortadas:
            print(
                "AVISO: " + ", ".join(ya_cortadas) + " ya cortaron a Postgres. "
                "Recargarlas desde Mongo solo tiene sentido durante el corte."
            )

    if report_only:
        print(f"Reporte de conteo de documentos en '{SOURCE_DB_NAME}':\n")
        for table in tables:
            count = await mongo[table].count_documents({})
            print(f"  {table:<40} {count}")
        return

    if not TARGET_DATABASE_URL:
        sys.exit("ERROR: falta TARGET_DATABASE_URL")

    pg = await asyncpg.connect(TARGET_DATABASE_URL)
    await pg.set_type_codec(
        "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog"
    )

    warnings = []
    totals = {}

    if vaciar:
        # DELETE y no TRUNCATE, por dos motivos:
        #
        # 1. TRUNCATE no se puede usar sobre una tabla referenciada por una FK
        #    salvo con CASCADE, y CASCADE vaciaria tambien la tabla que
        #    referencia. Si liquidacion_lineas apunta a facturas, un CASCADE
        #    se llevaria por delante las lineas de liquidacion reales.
        # 2. DELETE respeta las FKs: si alguna fila esta referenciada de
        #    verdad, falla en vez de dejar referencias huerfanas. Eso es
        #    exactamente lo que se quiere en un corte: que avise en lugar de
        #    romper en silencio.
        #
        # El costo de DELETE frente a TRUNCATE no importa aca: son tablas
        # chicas y esto corre una sola vez por modulo.
        print('=== Vaciando ' + str(len(tables)) + ' tabla(s) antes de recargar ===')
        for t in reversed(tables):  # hijas primero, padres despues
            borradas = await pg.execute('delete from "' + t + '"')
            print('  ' + t.ljust(40) + ' ' + str(borradas))

    print("=== Pasada 1: carga de tablas (FKs circulares en NULL) ===")
    for table in tables:
        columns = await get_table_columns(pg, table)
        if not columns:
            warnings.append(f"  [{table}] la tabla no existe en destino - se omite")
            continue
        deferred_names = {c for c, _ in DEFERRED_FKS.get(table, [])}
        docs = await mongo[table].find({}).to_list(length=None)
        for doc in docs:
            row = build_row(
                doc, columns, deferred_names, table in LOCATION_SPLIT_TABLES,
                table=table, warnings=warnings,
            )
            await insert_row(pg, table, row, warnings, doc.get("id"))
        totals[table] = len(docs)
        print(f"  {table:<40} {len(docs)} documentos procesados")

    print("\n=== Pasada 2: relleno de FKs circulares ===")
    for table, fks in ((t, f) for t, f in DEFERRED_FKS.items() if t in tables):
        docs = await mongo[table].find({}).to_list(length=None)
        updated = 0
        for doc in docs:
            row_id = _coerce_uuid(doc.get("id"))
            if not row_id:
                continue
            for col, _target in fks:
                val = _coerce_uuid(doc.get(col))
                if val is None:
                    continue
                try:
                    await pg.execute(
                        f'update "{table}" set "{col}" = $1 where id = $2', val, row_id
                    )
                    updated += 1
                except Exception as e:
                    warnings.append(f"  [{table}.{col}] id={doc.get('id')}: {e}")
        print(f"  {table:<40} {updated} referencias rellenadas")

    plans = []
    if "maintenance_matrix_plans" in tables:
        print(chr(10) + "=== Tabla puente: maintenance_matrix_plan_vehicles ===")
        plans = await mongo["maintenance_matrix_plans"].find({}).to_list(length=None)

    junction_count = 0
    for p in plans:
        plan_id = _coerce_uuid(p.get("id"))
        for vid in p.get("applies_to_vehicle_ids", []) or []:
            vehicle_id = _coerce_uuid(vid)
            if plan_id and vehicle_id:
                try:
                    await pg.execute(
                        "insert into maintenance_matrix_plan_vehicles (plan_id, vehicle_id) "
                        "values ($1, $2) on conflict do nothing",
                        plan_id, vehicle_id,
                    )
                    junction_count += 1
                except Exception as e:
                    warnings.append(f"  [maintenance_matrix_plan_vehicles] plan={p.get('id')}: {e}")
    if plans:
        print(f"  {junction_count} relaciones plan-vehículo migradas")

    await pg.close()

    print(f"\n=== Resumen: {sum(totals.values())} documentos migrados en {len(totals)} tablas ===")
    if warnings:
        print(f"\n!!! {len(warnings)} advertencias (revisar antes de confiar en el resultado) !!!")
        for w in warnings:
            print(w)
    else:
        print("Sin advertencias.")


def _arg(nombre):
    """Lee --nombre=valor o --nombre valor de la linea de comandos."""
    for i, a in enumerate(sys.argv):
        if a.startswith(nombre + "="):
            return a.split("=", 1)[1]
        if a == nombre and i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return None


if __name__ == "__main__":
    _tables = _arg("--tables")
    _only = [t.strip() for t in _tables.split(",") if t.strip()] if _tables else None
    _vaciar = "--truncate" in sys.argv
    if _vaciar and not _only:
        sys.exit(
            "ERROR: --truncate exige --tables "
            "(vaciar las 49 tablas de una nunca es lo que se quiso)"
        )
    asyncio.run(
        migrate(
            report_only="--report" in sys.argv,
            only_tables=_only,
            vaciar=_vaciar,
        )
    )
