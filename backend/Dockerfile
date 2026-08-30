# El contexto de build es la RAIZ del repo, no backend/ (ver docker-compose.yml).
# Hace falta para copiar frontend/build dentro de la imagen: el backend sirve la
# SPA ademas de la API, igual que licitapro y vueloradar sirven sus plantillas
# desde su propio contenedor. Asi el dominio del tunel apunta a un solo puerto y
# no hace falta ningun proxy delante.
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libjpeg62-turbo-dev \
    zlib1g-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# La SPA compilada. server.py la busca en ROOT_DIR.parent/frontend/build, y
# ROOT_DIR es /app, asi que el destino es /frontend/build. Si ese directorio no
# existe, el `if FRONTEND_BUILD.exists()` de server.py no monta nada y la raiz
# del dominio devuelve el 404 de FastAPI -- que es justo lo que pasaba antes de
# este cambio.
#
# El build llega ya compilado desde fuera (lo genera y lo sube
# scripts/deploy-app.sh). No se compila aca para no pedirle un build de CRA a un
# VPS de dos nucleos que ademas corre otros dos proyectos en produccion.
COPY frontend/build /frontend/build

EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
