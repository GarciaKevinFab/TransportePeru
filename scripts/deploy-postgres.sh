#!/bin/bash
# ============================================================================
# TransportePeru - Despliegue de Postgres en el VPS + migración desde Mongo
# ============================================================================
# Levanta el contenedor transporteperu-postgres junto al stack que ya corre,
# aplica el esquema, y carga en él los datos que hoy viven en Mongo.
#
# NO toca el backend en producción: Mongo sigue siendo la fuente de verdad y
# el backend le sigue hablando a Mongo. Esto deja Postgres listo y cargado
# para el cambio de capa de datos, que es un paso aparte.
#
# Es idempotente — se puede correr las veces que haga falta:
#   - el esquema solo se aplica si la base está vacía (create table no lleva
#     IF NOT EXISTS: correrlo dos veces daría error, por eso la guarda)
#   - índices y RLS usan IF NOT EXISTS / CREATE OR REPLACE
#   - la carga de datos usa ON CONFLICT (id) DO NOTHING
#
# Uso:
#   bash scripts/deploy-postgres.sh
#   bash scripts/deploy-postgres.sh usuario@ip-del-vps
# ============================================================================
set -euo pipefail

SSH_TARGET="${1:-root@2.24.115.75}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/hostinger_vps_ed25519}"
REMOTE_DIR="/opt/transporteperu"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Funciones, no variables-comando: la ruta de la clave puede tener espacios
# ("C:/Users/KEVIN GARCIA/.ssh/...") y un $SSH sin comillas se parte en dos.
ssh_run()  { ssh -i "$SSH_KEY" -o BatchMode=yes "$SSH_TARGET" "$@"; }
scp_put()  { scp -i "$SSH_KEY" -o BatchMode=yes "$1" "$SSH_TARGET:$2"; }

echo "==> 1/6 Copiando archivos a $SSH_TARGET:$REMOTE_DIR"
ssh_run "mkdir -p $REMOTE_DIR/db $REMOTE_DIR/scripts"
scp_put "$ROOT_DIR/docker-compose.yml"             "$REMOTE_DIR/docker-compose.yml"
scp_put "$ROOT_DIR/db/schema.sql"                  "$REMOTE_DIR/db/schema.sql"
scp_put "$ROOT_DIR/db/indexes.sql"                 "$REMOTE_DIR/db/indexes.sql"
scp_put "$ROOT_DIR/db/rls.sql"                     "$REMOTE_DIR/db/rls.sql"
scp_put "$ROOT_DIR/scripts/migrate_to_postgres.py" "$REMOTE_DIR/scripts/migrate_to_postgres.py"
scp_put "$ROOT_DIR/scripts/verify_migration.py"    "$REMOTE_DIR/scripts/verify_migration.py"

ssh_run bash -s <<'ENDSSH'
set -euo pipefail
cd /opt/transporteperu

# ---------------------------------------------------------------------------
# 2. Contraseñas. Se generan UNA vez y viven solo en el .env del VPS (600).
#    Si ya existen se respetan — regenerarlas dejaría a Postgres con la vieja
#    (la contraseña de POSTGRES_PASSWORD solo se aplica al inicializar el
#    volumen) y romperíamos la conexión sin darnos cuenta.
# ---------------------------------------------------------------------------
echo "==> 2/6 Contraseñas en /opt/transporteperu/.env"
touch .env && chmod 600 .env
for VAR in POSTGRES_PASSWORD APP_BACKEND_PASSWORD; do
  if grep -q "^${VAR}=" .env; then
    echo "    $VAR ya existía — se conserva"
  else
    echo "${VAR}=$(openssl rand -base64 32 | tr -d '/+=' | cut -c1-32)" >> .env
    echo "    $VAR generada"
  fi
done
set -a; . ./.env; set +a

# ---------------------------------------------------------------------------
# 3. Levantar Postgres (sin tocar mongo ni backend)
# ---------------------------------------------------------------------------
echo "==> 3/6 Levantando transporteperu-postgres"
docker compose up -d postgres

echo -n "    esperando healthcheck"
for i in $(seq 1 30); do
  if [ "$(docker inspect -f '{{.State.Health.Status}}' transporteperu-postgres 2>/dev/null)" = "healthy" ]; then
    echo " -> healthy"; break
  fi
  echo -n "."; sleep 2
  if [ "$i" = "30" ]; then echo " -> TIMEOUT"; docker logs --tail 30 transporteperu-postgres; exit 1; fi
done

# Dos formas del mismo comando, y la diferencia importa:
#   psql_q   consultas sueltas (-c). SIN `docker exec -i`: este script llega
#            al servidor por stdin, y un `docker exec -i` dentro de una
#            sustitucion de comandos $(...) se traga el resto del script.
#   psql_f   aplicar un archivo .sql. Ahi si hace falta -i, pero como se le
#            redirige el archivo, nunca toca el stdin del script.
psql_q() { docker exec transporteperu-postgres psql -v ON_ERROR_STOP=1 -U postgres -d transporteperu "$@"; }
psql_f() { docker exec -i transporteperu-postgres psql -v ON_ERROR_STOP=1 -U postgres -d transporteperu "$@"; }

# ---------------------------------------------------------------------------
# 4. Esquema + índices + RLS
# ---------------------------------------------------------------------------
echo "==> 4/6 Aplicando esquema"
YA_APLICADO=$(psql_q -tAc "select to_regclass('public.companies') is not null")
if [ "$YA_APLICADO" = "t" ]; then
  echo "    schema.sql: ya aplicado (existe la tabla companies) — se omite"
else
  psql_f < db/schema.sql > /dev/null
  echo "    schema.sql: aplicado"
fi

psql_f < db/indexes.sql > /dev/null
echo "    indexes.sql: aplicado"

psql_f -v app_backend_password="$APP_BACKEND_PASSWORD" < db/rls.sql > /dev/null
echo "    rls.sql: aplicado"

echo "    tablas: $(psql_q -tAc "select count(*) from information_schema.tables where table_schema='public'")  |  con RLS forzado: $(psql_q -tAc "select count(*) from pg_class where relrowsecurity and relforcerowsecurity")  |  políticas: $(psql_q -tAc "select count(*) from pg_policies where schemaname='public'")  |  índices: $(psql_q -tAc "select count(*) from pg_indexes where schemaname='public'")"

# ---------------------------------------------------------------------------
# 5/6. Migración y verificación. Corren en un contenedor de un solo uso en la
#      red interna, en vez de en la imagen del backend, para no reconstruir
#      ni reiniciar el backend que está sirviendo producción ahora mismo.
# ---------------------------------------------------------------------------
RUNNER="docker run --rm --network transporteperu_default \
  -v /opt/transporteperu/scripts:/w -w /w \
  -e SOURCE_MONGO_URL=mongodb://transporteperu-mongo:27017 \
  -e SOURCE_DB_NAME=transporteperu \
  -e TARGET_DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@transporteperu-postgres:5432/transporteperu \
  python:3.11-slim"

echo "==> 5/6 Migrando datos de Mongo a Postgres"
$RUNNER sh -c "pip install --quiet --disable-pip-version-check asyncpg motor && python migrate_to_postgres.py"

echo "==> 6/6 Verificando que Postgres tenga exactamente lo que tiene Mongo"
$RUNNER sh -c "pip install --quiet --disable-pip-version-check asyncpg motor && python verify_migration.py"

echo ""
echo "Listo. Postgres corriendo y cargado en transporteperu-postgres."
echo "  - No publica puerto al host: solo alcanzable desde la red docker interna."
echo "  - Mongo sigue siendo la fuente de verdad; el backend no fue tocado."
echo "  - Cadena para el backend cuando se haga el cambio de capa de datos:"
echo "      postgresql://app_backend:\$APP_BACKEND_PASSWORD@postgres:5432/transporteperu"
ENDSSH
