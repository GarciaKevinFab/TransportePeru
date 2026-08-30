#!/bin/bash
# ============================================================================
# TransportePeru - Corte de un modulo de Mongo a Postgres
# ============================================================================
# Pasa un conjunto de tablas a tener Postgres como fuente de verdad, y sube el
# codigo del backend que ya les habla a Postgres. Pensado para repetirse tal
# cual en cada modulo que cruce.
#
# Uso:
#   bash scripts/cutover-modulo.sh <archivo-migracion.sql> <tabla1,tabla2,...>
#
# Ejemplo (el primero, Liquidacion de Flete):
#   bash scripts/cutover-modulo.sh db/migrations/001_corte_liquidacion_flete.sql \
#        proveedores,tipos_carga,liquidaciones_flete,liquidacion_lineas
#
# Orden de los pasos, y por que ese orden:
#   1. Respaldo de las dos bases. Es lo unico que hace reversible el resto.
#   2. Migracion SQL (quita las FKs que cruzan la frontera del corte).
#   3. Recarga de esas tablas desde Mongo: Postgres queda identico a Mongo.
#   4. Codigo nuevo + reinicio. Recien aca el backend deja de escribir en Mongo.
#
# El paso 3 va ANTES del 4 a proposito: si fuera al reves, todo lo que se
# escriba entre el despliegue y la recarga se perderia al vaciar las tablas.
# ============================================================================
set -euo pipefail

MIGRACION="${1:?Uso: cutover-modulo.sh <archivo-migracion.sql> <tabla1,tabla2,...>}"
TABLAS="${2:?Uso: cutover-modulo.sh <archivo-migracion.sql> <tabla1,tabla2,...>}"
SSH_TARGET="${SSH_TARGET:-root@2.24.115.75}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/hostinger_vps_ed25519}"
REMOTE_DIR="/opt/transporteperu"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

ssh_run() { ssh -i "$SSH_KEY" -o BatchMode=yes "$SSH_TARGET" "$@"; }
scp_put() { scp -i "$SSH_KEY" -o BatchMode=yes "$1" "$SSH_TARGET:$2"; }

[ -f "$ROOT_DIR/$MIGRACION" ] || { echo "ERROR: no existe $ROOT_DIR/$MIGRACION"; exit 1; }

echo "==> Subiendo codigo y migracion"
ssh_run "mkdir -p $REMOTE_DIR/db/migrations $REMOTE_DIR/scripts"
scp_put "$ROOT_DIR/$MIGRACION"                     "$REMOTE_DIR/$MIGRACION"
scp_put "$ROOT_DIR/db/verificar_frontera.sql"      "$REMOTE_DIR/db/verificar_frontera.sql"
scp_put "$ROOT_DIR/db/tablas_en_postgres.txt"    "$REMOTE_DIR/db/tablas_en_postgres.txt"
scp_put "$ROOT_DIR/scripts/migrate_to_postgres.py" "$REMOTE_DIR/scripts/migrate_to_postgres.py"
scp_put "$ROOT_DIR/scripts/verify_migration.py"    "$REMOTE_DIR/scripts/verify_migration.py"
scp_put "$ROOT_DIR/backend/db_pg.py"               "$REMOTE_DIR/backend/db_pg.py"
scp_put "$ROOT_DIR/backend/liquidacion_flete.py"   "$REMOTE_DIR/backend/liquidacion_flete.py"
scp_put "$ROOT_DIR/backend/whatsapp_bot.py"        "$REMOTE_DIR/backend/whatsapp_bot.py"
scp_put "$ROOT_DIR/backend/server.py"              "$REMOTE_DIR/backend/server.py"
scp_put "$ROOT_DIR/backend/requirements.txt"       "$REMOTE_DIR/backend/requirements.txt"

# Las variables viajan como prefijo del comando remoto: el heredoc ocupa el
# stdin de ssh, asi que no hay otro canal por donde pasarlas.
ssh_run "MIGRACION='$MIGRACION' TABLAS='$TABLAS' bash -s" <<'ENDSSH'
set -euo pipefail
cd /opt/transporteperu
set -a; . ./.env; set +a

SELLO="$(date +%Y%m%d_%H%M%S)"
mkdir -p backups

psql_q() { docker exec transporteperu-postgres psql -v ON_ERROR_STOP=1 -U postgres -d transporteperu "$@"; }
psql_f() { docker exec -i transporteperu-postgres psql -v ON_ERROR_STOP=1 -U postgres -d transporteperu "$@"; }

echo "==> 1/5 Respaldo de las dos bases (backups/, sello $SELLO)"
docker exec transporteperu-mongo mongodump --db=transporteperu --archive=/tmp/pre_corte.gz --gzip
docker cp transporteperu-mongo:/tmp/pre_corte.gz "backups/mongo_pre_corte_${SELLO}.gz"
docker exec transporteperu-mongo rm -f /tmp/pre_corte.gz
docker exec transporteperu-postgres pg_dump -U postgres -d transporteperu -Fc -f /tmp/pre_corte.dump
docker cp transporteperu-postgres:/tmp/pre_corte.dump "backups/pg_pre_corte_${SELLO}.dump"
docker exec transporteperu-postgres rm -f /tmp/pre_corte.dump
ls -la backups/ | tail -3

echo "==> 2/5 Aplicando $MIGRACION"
psql_f < "$MIGRACION" > /dev/null
echo "    FKs restantes en las tablas del corte:"
psql_q -tAc "select conrelid::regclass::text || ' -> ' || confrelid::regclass::text from pg_constraint where contype = 'f' and conrelid::regclass::text = any(string_to_array('$TABLAS', ','))"

echo "    verificando que no quede ninguna FK cruzando la frontera Mongo/Postgres..."
# La frontera NO son solo las tablas de este corte: son TODAS las que ya
# viven en Postgres. Si se usara solo $TABLAS, una FK legitima entre dos
# tablas ya migradas (por ejemplo liquidacion_lineas -> facturas, que este
# mismo corte restaura) se reportaria como problema.
FRONTERA=$(grep -v "^#" db/tablas_en_postgres.txt | grep -v "^$" | paste -sd, -)
echo "    tablas en Postgres: $FRONTERA"
CRUZADAS=$(psql_f -tA -v tablas="$FRONTERA" < db/verificar_frontera.sql)
if [ -n "$CRUZADAS" ]; then
  echo "ERROR: estas FKs cruzan la frontera. Agregalas a la migracion del corte:"
  echo "$CRUZADAS"
  exit 1
fi
echo "    ok, ninguna"

echo "==> 3/5 Recargando $TABLAS desde Mongo (foto exacta previa al corte)"
RUNNER="docker run --rm --network transporteperu_default -v /opt/transporteperu/scripts:/w -w /w -e SOURCE_MONGO_URL=mongodb://transporteperu-mongo:27017 -e SOURCE_DB_NAME=transporteperu -e TARGET_DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@transporteperu-postgres:5432/transporteperu python:3.11-slim"
$RUNNER sh -c "pip install --quiet --disable-pip-version-check asyncpg motor && python migrate_to_postgres.py --tables $TABLAS --truncate"

echo "==> 4/5 DATABASE_URL en backend/.env.production"
if grep -q '^DATABASE_URL=' backend/.env.production; then
  echo "    ya existia — se conserva"
else
  echo "DATABASE_URL=postgresql://app_backend:${APP_BACKEND_PASSWORD}@postgres:5432/transporteperu" >> backend/.env.production
  echo "    agregada (rol app_backend, con RLS activo)"
fi

echo "==> 5/5 Reconstruyendo y reiniciando el backend"
docker compose up -d --build backend
sleep 8
docker compose ps backend
ENDSSH
