#!/bin/bash
# ============================================================================
# TransportePeru - Despliegue de la aplicacion (backend + SPA) al VPS
# ============================================================================
# Un solo contenedor sirve las dos cosas: la API bajo /api y la SPA de React en
# todo lo demas. Es el mismo patron que licitapro y vueloradar en este VPS --
# cada proyecto publica UN puerto en 127.0.0.1 y el tunel de Cloudflare mapea su
# dominio contra el. Sin proxy inverso delante, sin segundo dominio, y sin
# tocar la configuracion del tunel.
#
# Que hace que esto funcione: server.py ya traia el servido de la SPA
# (`if FRONTEND_BUILD.exists()`), pero busca el build en
# ROOT_DIR.parent/frontend/build -- o sea /frontend/build dentro de la imagen.
# Ese directorio no existia, el bloque se saltaba, y la raiz del dominio
# devolvia el 404 de FastAPI. Ahora el Dockerfile lo copia.
#
# Uso:
#   bash scripts/deploy-app.sh
#   bash scripts/deploy-app.sh usuario@ip-del-vps
#
#   SIN_BUILD=1 bash scripts/deploy-app.sh   # reusa frontend/build tal cual
#
# POR QUE EL FRONTEND SE COMPILA AQUI Y NO EN EL VPS
#
#   El VPS tiene dos nucleos y corre otros dos proyectos en produccion. Un
#   build de CRA deja los dos pegados varios minutos, y eso lo pagan los
#   vecinos en latencia. Se compila fuera y viaja el artefacto, que son 9 MB.
# ============================================================================
set -euo pipefail

SSH_TARGET="${1:-root@2.24.115.75}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/hostinger_vps_ed25519}"
REMOTE_DIR="/opt/transporteperu"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Funciones y no variables-comando: la ruta de la clave puede llevar espacios
# ("C:/Users/KEVIN GARCIA/.ssh/...") y un $SSH sin comillas se parte en dos.
ssh_run() { ssh -i "$SSH_KEY" -o BatchMode=yes "$SSH_TARGET" "$@"; }
scp_put() { scp -i "$SSH_KEY" -o BatchMode=yes "$1" "$SSH_TARGET:$2"; }

cd "$ROOT_DIR"

# ---------------------------------------------------------------------------
echo "==> 1/5 Compilando la SPA (mismo origen)"
# ---------------------------------------------------------------------------
# REACT_APP_BACKEND_URL vacia a proposito: la SPA y la API comparten dominio,
# asi que axios pide /api y no un host aparte. Se pasa por entorno y no por un
# .env porque .gitignore filtra *.env.* -- un fichero asi no llegaria ni al VPS
# ni a CI, y el build saldria apuntando a donde no debe.
if [ "${SIN_BUILD:-0}" = "1" ]; then
  echo "    omitido (SIN_BUILD=1); se reusa frontend/build"
  [ -d frontend/build ] || { echo "ERROR: no existe frontend/build"; exit 1; }
else
  ( cd frontend && REACT_APP_BACKEND_URL= CI=false yarn build >/dev/null )
  echo "    listo"
fi

# Red de seguridad: sin el respaldo de services/api.js el bundle sale con
# baseURL "undefined/api" y TODAS las llamadas fallan en el navegador, con el
# backend perfectamente sano. Mejor romper el despliegue aqui.
#
# Se busca la firma del codigo EMITIDO (`baseURL:"undefined`), no la cadena
# suelta, y solo en los .js: los .map llevan el fuente original con sus
# comentarios, y el comentario que explica este mismo fallo en api.js menciona
# "undefined/api" -- una comprobacion mas amplia se denunciaba a si misma.
if grep -rqs --include='*.js' 'baseURL:"undefined' frontend/build/static/js/; then
  echo "ERROR: el bundle quedo con baseURL 'undefined/api' — falta el respaldo en services/api.js"
  exit 1
fi
echo "    build verificado: $(du -sh frontend/build | cut -f1)"

# ---------------------------------------------------------------------------
echo "==> 2/5 Subiendo codigo"
# ---------------------------------------------------------------------------
ssh_run "mkdir -p $REMOTE_DIR/frontend $REMOTE_DIR/backend"

# backend/ SIN los .env: los de produccion viven solo en el VPS (DATABASE_URL,
# secretos) y no estan en el repo. Pisarlos dejaria el backend sin arrancar.
tar czf - --exclude='.env*' --exclude='venv' --exclude='__pycache__' \
          --exclude='*.pyc' --exclude='tests' backend \
  | ssh_run "tar xzf - -C $REMOTE_DIR"

# La SPA compilada. Se borra la anterior antes de extraer para que no se
# acumulen bundles viejos con otro hash ocupando espacio para siempre.
ssh_run "rm -rf $REMOTE_DIR/frontend/build"
tar czf - frontend/build | ssh_run "tar xzf - -C $REMOTE_DIR"

scp_put "$ROOT_DIR/docker-compose.yml" "$REMOTE_DIR/docker-compose.yml"
scp_put "$ROOT_DIR/.dockerignore"      "$REMOTE_DIR/.dockerignore"
echo "    backend, frontend/build, compose y .dockerignore"

# ---------------------------------------------------------------------------
echo "==> 3/5 Reconstruyendo y reiniciando"
# ---------------------------------------------------------------------------
ssh_run "cd $REMOTE_DIR && docker compose up -d --build backend" 2>&1 | tail -5

# ---------------------------------------------------------------------------
echo "==> 4/5 Esperando a que responda"
# ---------------------------------------------------------------------------
ssh_run "for i in \$(seq 1 30); do curl -sf -o /dev/null http://127.0.0.1:8001/docs && exit 0; sleep 2; done; echo 'el backend no respondio'; docker logs --tail 30 transporteperu-backend; exit 1"

# ---------------------------------------------------------------------------
echo "==> 5/5 Comprobaciones"
# ---------------------------------------------------------------------------
# Las dos que importan: que la raiz sirva la SPA, y que la API NO haya quedado
# tapada por el catch-all que la sirve. Un 404 en /api/tires seria justo eso.
ssh_run "
  printf '    /            %s  %s\n' \"\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8001/)\" \"\$(curl -s -o /dev/null -w '%{content_type}' http://127.0.0.1:8001/)\"
  printf '    /api/tires   %s  (401/403 = viva; 404 = TAPADA)\n' \"\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8001/api/tires)\"
  printf '    /docs        %s\n' \"\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8001/docs)\"
"

echo ""
echo "Listo. El dominio del tunel ya apunta a este puerto, asi que no hay nada"
echo "que cambiar en Cloudflare."
