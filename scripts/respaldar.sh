#!/usr/bin/env bash
# Copia de seguridad diaria de CargoXprez, en el VPS.
#
# QUE PROTEGE
#
#   - Postgres (transporteperu-postgres): empresas, usuarios, viajes, pagos.
#   - Mongo (transporteperu-mongo): las colecciones que aun viven alli.
#   - Los archivos subidos (volumen transporteperu_transporteperu_uploads).
#
# COMO SE PROGRAMA (cron del HOST, no dentro de compose)
#
#   0 10 * * * /opt/transporteperu/scripts/respaldar.sh /opt/transporteperu/respaldos >> /var/log/cargoxprez-respaldo.log 2>&1
#
#   10:00 UTC = 05:00 de Lima: una hora despues del de ZenStay (09:00 UTC) y
#   lejos de los de LicitaPro (cada 6 h en punto), para no volcar dos bases a la
#   vez en un VPS de dos nucleos.
#
# FUERA DEL SERVIDOR
#
#   Con RESPALDO_REMOTO en /opt/transporteperu/.env (p. ej.
#   "r2:licitapro-backups/cargoxprez") cada archivo se cifra con `age` y la clave
#   PUBLICA de RESPALDO_CLAVE_PUBLICA (por defecto la misma de LicitaPro) y se
#   sube con rclone. La clave privada NO esta en el VPS. Sin clave publica no se
#   sube nada: subir en claro datos de clientes "mientras tanto" no es opcion.
#
# COMO SE RESTAURA (probarlo ANTES de necesitarlo)
#
#   age -d -i respaldo.key cargoxprez-pg-AAAAMMDD-HHMMSS.sql.gz.age | gunzip | \
#     docker exec -i transporteperu-postgres psql -U postgres -d transporteperu
#   age -d -i respaldo.key cargoxprez-mongo-AAAAMMDD-HHMMSS.archive.gz.age | \
#     docker exec -i transporteperu-mongo mongorestore --archive --gzip --drop
#   age -d -i respaldo.key cargoxprez-uploads-AAAAMMDD-HHMMSS.tar.gz.age | \
#     tar -xz -C /var/lib/docker/volumes/transporteperu_transporteperu_uploads/_data
set -euo pipefail

DESTINO="${1:-}"
if [[ -z "$DESTINO" ]]; then
  echo "Uso: $0 <directorio-destino> [dias-a-conservar]" >&2
  exit 1
fi
DIAS_CONSERVAR="${2:-7}"

cd "$(dirname "$0")/.."

# Leer el .env sin ejecutarlo: `. ./.env` correria como root cualquier cosa
# escrita alli, y su formato es el de compose, no el de bash.
leer_env() {
  local v archivo="${2:-.env}"
  [[ -f "$archivo" ]] || return 0
  v="$(sed -n "s/^$1=//p" "$archivo" | head -1)"
  v="${v%\"}"; v="${v#\"}"
  v="${v%\'}"; v="${v#\'}"
  printf '%s' "$v"
}

: "${RESPALDO_REMOTO:=$(leer_env RESPALDO_REMOTO)}"
: "${RESPALDO_CLAVE_PUBLICA:=$(leer_env RESPALDO_CLAVE_PUBLICA)}"
RESPALDO_CLAVE_PUBLICA="${RESPALDO_CLAVE_PUBLICA:-/root/.config/licitapro/respaldo.pub}"

PG=transporteperu-postgres
MONGO=transporteperu-mongo
VOLUMEN_UPLOADS=/var/lib/docker/volumes/transporteperu_transporteperu_uploads/_data

# Un respaldo que falla en silencio es peor que no tener respaldo.
avisar_fallo() {
  local codigo=$?
  [[ $codigo -eq 0 ]] && return 0
  echo "[$(date '+%F %T')] FALLO con codigo $codigo -- NO hay copia completa de hoy" >&2
}
trap avisar_fallo EXIT

SELLO="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DESTINO"
chmod 700 "$DESTINO"
PG_DUMP="$DESTINO/cargoxprez-pg-$SELLO.sql.gz"
MONGO_DUMP="$DESTINO/cargoxprez-mongo-$SELLO.archive.gz"
UPLOADS_TAR="$DESTINO/cargoxprez-uploads-$SELLO.tar.gz"

# ─── Postgres ────────────────────────────────────────────────────────────────
# La contrasena ya esta en el entorno del contenedor; se usa alli y no viaja
# como argumento (los argumentos los ve cualquiera que liste procesos).
echo "[$(date '+%F %T')] Volcando Postgres..."
docker exec "$PG" sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges' \
  | gzip -9 > "$PG_DUMP"

# gzip comprime la nada sin protestar: un .gz valido puede venir vacio, y una
# base vacia tambien pesa mas de unos KB. Se exige la tabla users.
# `grep -c` y no `grep -q`: -q corta la tuberia y con pipefail daria 141.
if [[ "$(gunzip -c "$PG_DUMP" | grep -c 'CREATE TABLE public.users' || true)" -eq 0 ]]; then
  echo "ERROR: el volcado de Postgres no trae la tabla users. Se borra." >&2
  rm -f "$PG_DUMP"
  exit 1
fi
echo "[$(date '+%F %T')] Postgres OK ($(du -h "$PG_DUMP" | cut -f1))"

# ─── Mongo ───────────────────────────────────────────────────────────────────
echo "[$(date '+%F %T')] Volcando Mongo..."
docker exec "$MONGO" mongodump --db=transporteperu --archive --gzip --quiet > "$MONGO_DUMP"
if [[ "$(wc -c < "$MONGO_DUMP")" -lt 1024 ]]; then
  echo "ERROR: el volcado de Mongo pesa menos de 1 KB. Se borra." >&2
  rm -f "$MONGO_DUMP"
  exit 1
fi
echo "[$(date '+%F %T')] Mongo OK ($(du -h "$MONGO_DUMP" | cut -f1))"

# ─── Archivos subidos ────────────────────────────────────────────────────────
echo "[$(date '+%F %T')] Empaquetando archivos subidos..."
tar -czf "$UPLOADS_TAR" -C "$VOLUMEN_UPLOADS" .
echo "[$(date '+%F %T')] Archivos OK ($(du -h "$UPLOADS_TAR" | cut -f1))"

# ─── Fuera del servidor ──────────────────────────────────────────────────────
cifrar_y_subir() {
  local archivo="$1" salida="$1.age" cabecera
  age -R "$RESPALDO_CLAVE_PUBLICA" -o "$salida" "$archivo"
  cabecera="$(head -c 21 "$salida")"
  if [[ "$cabecera" != "age-encryption.org/v1" ]]; then
    echo "ERROR: $salida no parece un archivo de age. No se sube." >&2
    rm -f "$salida"
    return 1
  fi
  rclone copy "$salida" "$RESPALDO_REMOTO" --no-traverse
  # Comprobar que llego entero: una subida que nadie verifica es una suposicion.
  local nombre bytes_local bytes_remoto
  nombre="$(basename "$salida")"
  bytes_local="$(wc -c < "$salida")"
  bytes_remoto="$(rclone lsjson "$RESPALDO_REMOTO/$nombre" 2>/dev/null | grep -o '"Size":[0-9]*' | head -1 | cut -d: -f2)"
  rm -f "$salida"
  if [[ "$bytes_remoto" != "$bytes_local" ]]; then
    echo "ERROR: $nombre pesa $bytes_local en disco y ${bytes_remoto:-0} en el destino." >&2
    return 1
  fi
}

if [[ -n "${RESPALDO_REMOTO:-}" ]]; then
  command -v rclone >/dev/null || { echo "ERROR: falta rclone." >&2; exit 1; }
  command -v age >/dev/null || { echo "ERROR: falta age (apt install age)." >&2; exit 1; }
  if [[ ! -s "$RESPALDO_CLAVE_PUBLICA" ]] || ! grep -q '^age1' "$RESPALDO_CLAVE_PUBLICA"; then
    echo "ERROR: no hay clave publica de age en $RESPALDO_CLAVE_PUBLICA. No se sube nada en claro." >&2
    exit 1
  fi
  echo "[$(date '+%F %T')] Cifrando y subiendo a $RESPALDO_REMOTO..."
  for f in "$PG_DUMP" "$MONGO_DUMP" "$UPLOADS_TAR"; do
    cifrar_y_subir "$f"
  done
  echo "[$(date '+%F %T')] Subida OK y verificada"
else
  echo "AVISO: RESPALDO_REMOTO sin definir. La copia queda SOLO en este disco." >&2
fi

# ─── Rotacion local ──────────────────────────────────────────────────────────
# El remoto no se toca desde aqui: borrar en remoto desde el mismo script que
# sube es como se pierden todos los respaldos de golpe cuando hay un bug.
find "$DESTINO" -name 'cargoxprez-*' -mtime "+$DIAS_CONSERVAR" -delete
find "$DESTINO" -name '*.age' -mmin +60 -delete
echo "[$(date '+%F %T')] Listo. Copias locales: $(find "$DESTINO" -name 'cargoxprez-pg-*' | wc -l) dias"
