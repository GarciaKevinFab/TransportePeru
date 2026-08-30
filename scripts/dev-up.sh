#!/bin/bash
# ============================================================================
# TransportePeru - Postgres de desarrollo en local
# ============================================================================
# Desde el corte 013 el backend habla SOLO con Postgres: las 50 tablas cruzaron
# y no queda un acceso a Mongo. Sin una base local, arrancar el backend en tu
# maquina revienta en el primer endpoint que toques -- que ahora son todos.
#
# Esto levanta esa base, le aplica el esquema y las migraciones, y crea el rol
# app_backend con el que se conecta el backend.
#
# Uso:
#   bash scripts/dev-up.sh              # crea o reutiliza
#   bash scripts/dev-up.sh --recrear    # tira la base y la rehace desde cero
#
# Es idempotente: correrlo dos veces no rompe nada. El esquema solo se aplica
# si la base esta vacia (schema.sql usa CREATE TABLE sin IF NOT EXISTS, asi que
# repetirlo daria error); indices, RLS y migraciones ya son repetibles de suyo.
#
# POR QUE app_backend Y NO postgres
#
#   app_backend no puede evadir RLS. Si a una consulta se le olvida el filtro
#   por empresa, devuelve cero filas en vez de datos de otro inquilino. En
#   desarrollo importa MAS que en produccion: es donde escribes la consulta, y
#   es donde quieres que el error aparezca.
# ============================================================================
set -euo pipefail

CONTENEDOR="${CONTENEDOR:-transporteperu-dev-pg}"
PUERTO="${PUERTO:-55432}"
BASE="${BASE:-transporteperu}"
PASS_POSTGRES="${PASS_POSTGRES:-devpostgres}"
PASS_APP="${PASS_APP:-devapp}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

psql_f() { docker exec -i "$CONTENEDOR" psql -q -v ON_ERROR_STOP=1 -U postgres -d "$BASE" "$@"; }
psql_q() { docker exec -i "$CONTENEDOR" psql -tA -U postgres -d "$BASE" -c "$1"; }

if [ "${1:-}" = "--recrear" ]; then
  echo "==> Tirando el contenedor anterior"
  docker rm -f "$CONTENEDOR" >/dev/null 2>&1 || true
fi

# ---------------------------------------------------------------------------
echo "==> 1/4 Contenedor Postgres"
# ---------------------------------------------------------------------------
if docker ps -a --format '{{.Names}}' | grep -qx "$CONTENEDOR"; then
  docker start "$CONTENEDOR" >/dev/null
  echo "    reutilizando $CONTENEDOR"
else
  docker run -d --name "$CONTENEDOR" \
    -e POSTGRES_PASSWORD="$PASS_POSTGRES" \
    -e POSTGRES_DB="$BASE" \
    -p "127.0.0.1:$PUERTO:5432" \
    postgres:16-alpine >/dev/null
  echo "    creado $CONTENEDOR en 127.0.0.1:$PUERTO"
fi

# pg_isready se pone en verde durante el arranque temporal que hace la imagen
# al inicializarse, y justo despues el servidor se reinicia -- por eso se
# espera con una consulta de verdad y no con pg_isready.
for _ in $(seq 1 60); do
  docker exec "$CONTENEDOR" psql -U postgres -d "$BASE" -c "select 1" >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$CONTENEDOR" psql -U postgres -d "$BASE" -c "select 1" >/dev/null 2>&1 \
  || { echo "ERROR: la base no arranco"; docker logs --tail 20 "$CONTENEDOR"; exit 1; }

# ---------------------------------------------------------------------------
echo "==> 2/4 Esquema"
# ---------------------------------------------------------------------------
if [ "$(psql_q "select count(*) from information_schema.tables where table_name = 'companies'")" = "0" ]; then
  psql_f -f - < db/schema.sql
  echo "    schema.sql aplicado"
else
  echo "    ya estaba aplicado — se omite"
fi
psql_f -f - < db/indexes.sql
psql_f -v app_backend_password="$PASS_APP" -f - < db/rls.sql >/dev/null
echo "    indexes.sql y rls.sql aplicados"

# ---------------------------------------------------------------------------
echo "==> 3/4 Migraciones de los cortes"
# ---------------------------------------------------------------------------
# Con `psql -f`, o sea en autocommit: la 007 trae un `alter type ... add value`
# que Postgres no deja usar en la misma transaccion en que se agrega.
for M in db/migrations/*.sql; do
  psql_f -f - < "$M" >/dev/null
done
echo "    $(ls db/migrations/*.sql | wc -l) migraciones aplicadas"

# ---------------------------------------------------------------------------
echo "==> 4/4 Comprobacion"
# ---------------------------------------------------------------------------
printf "    tablas:    %s\n" "$(psql_q "select count(*) from information_schema.tables where table_schema='public'")"
printf "    con RLS:   %s\n" "$(psql_q "select count(*) from pg_class where relrowsecurity and relforcerowsecurity")"
printf "    politicas: %s\n" "$(psql_q "select count(*) from pg_policies where schemaname='public'")"

URL="postgresql://app_backend:$PASS_APP@localhost:$PUERTO/$BASE"
echo ""
if grep -q "^DATABASE_URL=" backend/.env 2>/dev/null; then
  echo "backend/.env ya tiene DATABASE_URL. Si apunta a otro sitio, la de aqui es:"
  echo "  DATABASE_URL=$URL"
else
  echo "Anade esto a backend/.env:"
  echo "  DATABASE_URL=$URL"
fi
echo ""
echo "Backend:  cd backend && uvicorn server:app --reload --port 8001"
echo "Semilla:  curl -X POST localhost:8001/api/seed -H \"X-Install-Token: \$INSTALL_TOKEN\""
