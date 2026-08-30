#!/bin/bash
# ============================================
# TransportePeru - Backup completo de MongoDB (producción, VPS)
# ============================================
# Saca un dump completo (mongodump --archive --gzip) de la base real que
# corre en el contenedor transporteperu-mongo del VPS, y lo baja a tu
# máquina local en mongo_dump/ (carpeta ignorada por git).
#
# Uso:
#   bash scripts/mongodb-backup.sh
#   bash scripts/mongodb-backup.sh usuario@ip-del-vps   # override de host
# ============================================
set -euo pipefail

SSH_TARGET="${1:-root@2.24.115.75}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/hostinger_vps_ed25519}"
CONTAINER="transporteperu-mongo"
DB_NAME="transporteperu"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
OUT_DIR="$ROOT_DIR/mongo_dump"
STAMP="$(date +%Y%m%d_%H%M%S 2>/dev/null || echo latest)"
ARCHIVE_NAME="transporteperu_${STAMP}.gz"

mkdir -p "$OUT_DIR"

echo "==> Dumpeando '$DB_NAME' dentro del contenedor $CONTAINER en $SSH_TARGET..."
ssh -i "$SSH_KEY" -o BatchMode=yes "$SSH_TARGET" "
  docker exec $CONTAINER mongodump --db=$DB_NAME --archive=/tmp/${ARCHIVE_NAME} --gzip
  docker cp ${CONTAINER}:/tmp/${ARCHIVE_NAME} /tmp/${ARCHIVE_NAME}
  docker exec $CONTAINER rm -f /tmp/${ARCHIVE_NAME}
"

echo "==> Descargando el archivo a $OUT_DIR/..."
scp -i "$SSH_KEY" -o BatchMode=yes "${SSH_TARGET}:/tmp/${ARCHIVE_NAME}" "$OUT_DIR/${ARCHIVE_NAME}"

echo "==> Limpiando temporal en el servidor..."
ssh -i "$SSH_KEY" -o BatchMode=yes "$SSH_TARGET" "rm -f /tmp/${ARCHIVE_NAME}"

echo ""
echo "Backup listo: $OUT_DIR/${ARCHIVE_NAME}"
ls -la "$OUT_DIR/${ARCHIVE_NAME}"
echo ""
echo "Para restaurarlo (local o en otro servidor):"
echo "  bash scripts/mongodb-restore.sh \"$OUT_DIR/${ARCHIVE_NAME}\" mongodb://localhost:27017"
