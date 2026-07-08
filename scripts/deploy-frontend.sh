#!/bin/bash
# ============================================
# TransportePeru - Deploy Frontend to Vercel
# ============================================
# Usage: bash scripts/deploy-frontend.sh [ngrok-domain]
#
# Si tienes dominio estático de ngrok, pásalo como argumento:
#   bash scripts/deploy-frontend.sh mi-app.ngrok-free.app
#
# Si no, se usará la URL actual de ngrok automáticamente.
# ============================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$ROOT_DIR/frontend"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  TransportePeru - Deploy Frontend${NC}"
echo -e "${GREEN}========================================${NC}"

# Determine backend URL
if [ -n "$1" ]; then
    BACKEND_URL="https://$1"
    echo -e "${GREEN}Usando dominio: $BACKEND_URL${NC}"
else
    # Try to get current ngrok URL
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python -c "import sys,json; tunnels=json.load(sys.stdin)['tunnels']; print([t['public_url'] for t in tunnels if t['public_url'].startswith('https')][0])" 2>/dev/null)

    if [ -n "$NGROK_URL" ]; then
        BACKEND_URL="$NGROK_URL"
        echo -e "${GREEN}Detectado ngrok: $BACKEND_URL${NC}"
    else
        echo -e "${RED}Error: No se encontró ngrok activo ni se proporcionó dominio.${NC}"
        echo -e "${YELLOW}Uso: bash scripts/deploy-frontend.sh mi-app.ngrok-free.app${NC}"
        exit 1
    fi
fi

# Update .env
echo -e "${YELLOW}Actualizando .env...${NC}"
cat > "$FRONTEND_DIR/.env" << EOF
REACT_APP_BACKEND_URL=$BACKEND_URL
CI=false
EOF

echo -e "${GREEN}REACT_APP_BACKEND_URL=$BACKEND_URL${NC}"

# Deploy to Vercel
echo -e "${YELLOW}Desplegando a Vercel...${NC}"
cd "$FRONTEND_DIR"
vercel deploy --prod --yes

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deploy completado!${NC}"
echo -e "${GREEN}  Backend: $BACKEND_URL${NC}"
echo -e "${GREEN}========================================${NC}"
