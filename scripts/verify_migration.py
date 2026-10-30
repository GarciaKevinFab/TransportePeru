#!/usr/bin/env python3
"""
TransportePeru - Verificación de la migración MongoDB -> Postgres
=================================================================
Se corre DESPUÉS de scripts/migrate_to_postgres.py y responde una sola
pregunta: ¿está en Postgres exactamente lo que hay en Mongo?

No compara solo conteos — dos conteos iguales pueden esconder una fila
perdida y otra duplicada. Compara los CONJUNTOS de ids documento por
documento y reporta, por tabla:

  faltantes  ids que están en Mongo y no llegaron a Postgres  (pérdida real)
  sobrantes  ids que están en Postgres y no están en Mongo    (basura de una
             corrida anterior, o datos escritos directo en PG)

Sale con código 1 si encuentra cualquiera de las dos cosas, para que el
script de despliegue se detenga en vez de reportar éxito.

Variables de entorno (las mismas que el migrador):
  SOURCE_MONGO_URL, SOURCE_DB_NAME, TARGET_DATABASE_URL
"""
import asyncio
import os
import sys
import uuid

import asyncpg
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from migrate_to_postgres import CUT_OVER_TABLES, TABLE_ORDER  # noqa: E402  (una sola fuente para ambas listas)

SOURCE_MONGO_URL = os.environ.get("SOURCE_MONGO_URL", "")
SOURCE_DB_NAME = os.environ.get("SOURCE_DB_NAME", "transporteperu")
TARGET_DATABASE_URL = os.environ.get("TARGET_DATABASE_URL", "")


def _as_uuid(value):
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        return None


async def main():
    if not SOURCE_MONGO_URL or not TARGET_DATABASE_URL:
        sys.exit("ERROR: faltan SOURCE_MONGO_URL y/o TARGET_DATABASE_URL")

    mongo = AsyncIOMotorClient(SOURCE_MONGO_URL)[SOURCE_DB_NAME]
    pg = await asyncpg.connect(TARGET_DATABASE_URL)

    problemas = []
    total_mongo = 0
    total_pg = 0

    print(f"{'tabla':<40} {'mongo':>7} {'postgres':>9}  estado")
    print("-" * 72)

    # Las tablas que ya cortaron divergen A PROPOSITO: Postgres es su fuente
    # de verdad y lo que quedo en Mongo es una foto congelada del dia del
    # corte. Compararlas reportaria diferencias que son lo esperado, asi que
    # se listan aparte y no cuentan como problema.
    cortadas = []

    for table in TABLE_ORDER:
        if table in CUT_OVER_TABLES:
            cortadas.append(table)
            continue
        existe = await pg.fetchval(
            "select to_regclass($1) is not null", f"public.{table}"
        )
        if not existe:
            problemas.append(f"[{table}] la tabla no existe en Postgres")
            print(f"{table:<40} {'-':>7} {'-':>9}  NO EXISTE EN PG")
            continue

        docs = await mongo[table].find({}, {"id": 1}).to_list(length=None)
        ids_mongo_raw = [d.get("id") for d in docs]
        ids_mongo = {u for u in (_as_uuid(i) for i in ids_mongo_raw) if u is not None}
        no_uuid = len(ids_mongo_raw) - len(ids_mongo)

        ids_pg = {r["id"] for r in await pg.fetch(f'select id from "{table}"')}

        faltantes = ids_mongo - ids_pg
        sobrantes = ids_pg - ids_mongo

        total_mongo += len(docs)
        total_pg += len(ids_pg)

        estado = "ok"
        if faltantes:
            estado = f"FALTAN {len(faltantes)}"
            problemas.append(
                f"[{table}] {len(faltantes)} ids en Mongo que no llegaron a PG: "
                + ", ".join(str(i) for i in list(faltantes)[:5])
                + (" ..." if len(faltantes) > 5 else "")
            )
        if sobrantes:
            estado = (estado + " / " if estado != "ok" else "") + f"SOBRAN {len(sobrantes)}"
            problemas.append(
                f"[{table}] {len(sobrantes)} ids en PG que no están en Mongo: "
                + ", ".join(str(i) for i in list(sobrantes)[:5])
                + (" ..." if len(sobrantes) > 5 else "")
            )
        if no_uuid:
            estado = (estado + " / " if estado != "ok" else "") + f"{no_uuid} ids no-uuid en Mongo"
            problemas.append(
                f"[{table}] {no_uuid} documentos en Mongo con un id que no es uuid "
                "(no se pueden comparar ni migrar tal cual)"
            )

        print(f"{table:<40} {len(docs):>7} {len(ids_pg):>9}  {estado}")

    await pg.close()

    print("-" * 72)
    print(f"{'TOTAL':<40} {total_mongo:>7} {total_pg:>9}")

    if cortadas:
        print("")
        print(
            "No comparadas (ya cortaron a Postgres, divergencia esperada): "
            + ", ".join(cortadas)
        )

    if problemas:
        print(f"\n!!! {len(problemas)} problema(s) — la migración NO está completa !!!")
        for p in problemas:
            print("  " + p)
        sys.exit(1)

    print("\nVerificación OK: todos los ids de Mongo están en Postgres y no hay sobrantes.")


if __name__ == "__main__":
    asyncio.run(main())
