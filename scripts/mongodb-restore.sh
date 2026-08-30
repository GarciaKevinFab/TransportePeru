#!/bin/bash
# ============================================
# TransportePeru - Restaurar un backup de MongoDB
# ============================================
# Restaura un archivo generado por scripts/mongodb-backup.sh (o cualquier
# mongodump --archive --gzip) en cualquier instancia de Mongo, local o remota.
# SIEMPRE usa --drop: las colecciones destino se reemplazan por completo.
#
# Uso:
#   bash scripts/mongodb-restore.sh mongo_dump/transporteperu_20260829.gz mongodb://localhost:27017
#   bash scripts/mongodb-restore.sh mongo_dump/transporteperu_20260829.gz mongodb://127.0.0.1:27017
#
# Para restaurar DENTRO del contenedor del VPS en vez de una instancia local,
# copia el archivo con `docker cp` y corre mongorestore dentro del contenedor
# (mismo patrón que se usó para la migración inicial) - este script asume
# que el mongod destino es alcanzable directamente desde donde lo ejecutas.
# ============================================
set -euo pipefail

ARCHIVE_PATH="${1:?Uso: mongodb-restore.sh <archivo.gz> <mongo-uri>}"
MONGO_URI="${2:?Uso: mongodb-restore.sh <archivo.gz> <mongo-uri>}"

if [ ! -f "$ARCHIVE_PATH" ]; then
  echo "ERROR: no existe el archivo $ARCHIVE_PATH"
  exit 1
fi

echo "==> Restaurando $ARCHIVE_PATH en $MONGO_URI (--drop, reemplaza colecciones existentes)"
read -p "¿Confirmas? Esto BORRA los datos actuales de las colecciones incluidas en el backup [y/N]: " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Cancelado."
  exit 0
fi

mongorestore --uri="$MONGO_URI" --archive="$ARCHIVE_PATH" --gzip --drop

echo ""
echo "Restauración completa."
