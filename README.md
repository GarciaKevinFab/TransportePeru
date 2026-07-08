# TransportePeru

Sistema de gestión de flota de transporte para empresas del Perú. Centraliza la
operación diaria de la flota en una sola plataforma:

- **Vehículos** y equipos (remolques, cisternas, etc.)
- **Viajes** y liquidaciones (settlements)
- **Combustible** y viáticos
- **Mantenimiento** preventivo/correctivo y planes de mantenimiento
- **Llantas** (montaje, rotación, desgaste)
- **Checklists** de inspección (wizard para choferes)
- **Choferes** con vistas móviles dedicadas y soporte **offline**
- **Documentos**, inventario, incidencias y reportes
- **SUNAT**: guías de transportista y facturas electrónicas

## Stack

- **Backend**: FastAPI + MongoDB (async con Motor). JWT para autenticación,
  bcrypt para contraseñas.
- **Frontend**: React (Create React App vía CRACO) + shadcn/ui + Tailwind CSS.
- **Almacenamiento de archivos**: disco local (`backend/uploads/`) o AWS S3.
- **OCR** (opcional): Google Gemini (`google-genai`) para escaneo de facturas/guías.

## Requisitos previos

- **Python 3.11+**
- **Node.js 18+** (el frontend usa **yarn**; hay `yarn.lock`)
- **MongoDB** (local o remoto)

## Backend

```bash
cd backend

# 1. Crear y activar entorno virtual
python -m venv .venv
# Windows (PowerShell)
.venv\Scripts\Activate.ps1
# Linux / macOS
source .venv/bin/activate

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Configurar variables de entorno
cp .env.example .env   # y edita los valores (MONGO_URL, DB_NAME, JWT_SECRET, ...)

# 4. Levantar el servidor (recarga en caliente)
uvicorn server:app --reload --port 8001
```

La API queda en `http://localhost:8001` y la documentación interactiva en
`http://localhost:8001/docs`.

### Variables de entorno del backend

Ver `backend/.env.example`. Las principales:

| Variable | Requerida | Descripción |
| --- | --- | --- |
| `MONGO_URL` | Sí | URL de conexión a MongoDB |
| `DB_NAME` | Sí | Nombre de la base de datos |
| `JWT_SECRET` | Recomendada | Clave para firmar los JWT |
| `CORS_ORIGINS` | No | Orígenes permitidos separados por comas (`*` en dev) |
| `INSTALL_TOKEN` | Bootstrap | Token del bootstrap inicial (ver más abajo) |
| `GOOGLE_API_KEY` | Opcional | OCR con Google Gemini |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `S3_BUCKET_NAME` | Opcional | Almacenamiento en S3 |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Opcional | Notificaciones web push |

## Frontend

```bash
cd frontend

# 1. Instalar dependencias
yarn install

# 2. Configurar variables de entorno
cp .env.example .env   # ajusta REACT_APP_BACKEND_URL

# 3. Levantar en desarrollo
yarn start
```

El frontend queda en `http://localhost:3000`. La única variable relevante es
`REACT_APP_BACKEND_URL` (URL base del backend, sin slash final).

## Bootstrap inicial

El primer usuario **superadmin** se crea vía un endpoint protegido que exige el
header `X-Install-Token`. Para habilitarlo:

1. Define `INSTALL_TOKEN` en el `.env` del backend con un valor secreto.
2. Llama al endpoint de instalación enviando ese mismo valor en el header
   `X-Install-Token`.

Una vez creado el superadmin, se recomienda rotar/retirar el `INSTALL_TOKEN`.

> El endpoint de bootstrap lo implementa otro módulo del backend; esta sección
> documenta únicamente la configuración de entorno necesaria.

## Deploy

- **Frontend**: build estático (`yarn build`) desplegado a **cPanel** vía FTP.
- **Backend**: se ejecuta en un **Windows Server**.

> **TODO (infra)**: `scripts/start-backend.sh` tiene un dominio de **ngrok
> hardcodeado** (`NGROK_DOMAIN`). Debería parametrizarse (variable de entorno o
> argumento) en lugar de estar fijo en el script.

## Calidad de código (pre-commit)

El repo incluye `.pre-commit-config.yaml` con **ruff** (lint + format del
backend) y **prettier** (formato de `frontend/src`). Para activarlo:

```bash
pip install pre-commit
pre-commit install
# opcional: correr sobre todo el repo
pre-commit run --all-files
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) corre en cada `push` y `pull_request`
a `main`:

- **Backend**: Python 3.11, instala `backend/requirements.txt`, levanta un
  servicio MongoDB y ejecuta `pytest backend/tests/`.
- **Frontend**: Node 18, `yarn install` y `CI=false yarn build`.
