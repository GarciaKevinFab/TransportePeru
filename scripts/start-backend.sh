#!/bin/bash
# ============================================
# TransportePeru - Start Backend + ngrok
# ============================================
# Usage: bash scripts/start-backend.sh
#
# SETUP (solo una vez):
# 1. Ve a https://dashboard.ngrok.com/domains
# 2. Reclama tu dominio estático gratis (ej: tu-app.ngrok-free.app)
# 3. Copia el dominio y ponlo en NGROK_DOMAIN abajo
# ============================================

NGROK_DOMAIN="noncancelable-antrorsely-jeanene.ngrok-free.dev"
BACKEND_PORT=8001
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  TransportePeru - Backend Server${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if ngrok domain is configured
if [ -z "$NGROK_DOMAIN" ]; then
    echo -e "${YELLOW}⚠ NGROK_DOMAIN no configurado.${NC}"
    echo -e "${YELLOW}  Ve a https://dashboard.ngrok.com/domains${NC}"
    echo -e "${YELLOW}  Reclama tu dominio gratis y ponlo en este script.${NC}"
    echo -e "${YELLOW}  Mientras tanto, se usará URL random de ngrok.${NC}"
    echo ""
    NGROK_CMD="ngrok http $BACKEND_PORT"
else
    echo -e "${GREEN}Dominio ngrok: $NGROK_DOMAIN${NC}"
    NGROK_CMD="ngrok http --domain=$NGROK_DOMAIN $BACKEND_PORT"
fi

# Start backend
echo -e "${GREEN}Iniciando backend en puerto $BACKEND_PORT...${NC}"
cd "$ROOT_DIR/backend"
uvicorn server:app --host 0.0.0.0 --port $BACKEND_PORT --reload &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start ngrok
echo -e "${GREEN}Iniciando ngrok...${NC}"
$NGROK_CMD &
NGROK_PID=$!

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Backend: http://localhost:$BACKEND_PORT${NC}"
if [ -n "$NGROK_DOMAIN" ]; then
    echo -e "${GREEN}  Public:  https://$NGROK_DOMAIN${NC}"
fi
echo -e "${GREEN}========================================${NC}"
echo -e "${YELLOW}  Ctrl+C para detener todo${NC}"

# Cleanup on exit
cleanup() {
    echo -e "\n${RED}Deteniendo servicios...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $NGROK_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

wait
