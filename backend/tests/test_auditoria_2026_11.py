"""
Huecos de autenticacion y archivos (auditoria del 2026-11-09).

Pruebas de integracion contra el backend levantado, como test_api.py. Las que
cambian contrasenas o desactivan usuarios lo hacen en una empresa recien
creada con /auth/signup, nunca con admin@transperu.com: las demas suites
entran con esa cuenta y su clave fija.

Cubre:
  - require_roles: 403 a un chofer en una ruta de administracion;
  - usuario desactivado con un token todavia vigente -> 401;
  - un token con el company_id de otra empresa no mueve a un no-superadmin;
  - switch de empresa: 403 a quien no es superadmin;
  - refresh con un token invalido -> 401, y tras cambiar la contrasena -> 401;
  - signup con RUC o correo repetidos -> 400;
  - /auth/olvide responde lo mismo exista o no el correo;
  - /api/suscripcion/mercadopago: 403 a un chofer;
  - checkout sin JS con RUC de 10 digitos: vuelve con el error y no crea orden;
  - /uploads: sin sesion 401, de otra empresa 404, de la suya 200 (Bearer y
    la cookie que deja el login, que es lo que usa un <img>).
"""
import asyncio
import os
import random
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "http://127.0.0.1:8001").rstrip("/")
JWT_SECRET = os.environ.get("JWT_SECRET") or "dev-only-insecure-secret"
CLAVE = "Clave-de-prueba-123"
# Un JPEG minimo: lo justo para que /api/upload lo acepte por tipo y extension.
JPEG = bytes.fromhex("ffd8ffe000104a46494600010100000100010000ffd9")


def _login(**credenciales):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=credenciales)
    assert r.status_code == 200, r.text
    return r


def _cabeceras(token):
    return {"Authorization": f"Bearer {token}"}


def _ruc():
    return "20" + "".join(random.choice("0123456789") for _ in range(9))


def _alta():
    """Una empresa nueva con su dueno. Devuelve (respuesta json, correo)."""
    correo = f"auditoria-{uuid.uuid4().hex[:10]}@ejemplo.pe"
    r = requests.post(f"{BASE_URL}/api/auth/signup", json={
        "company_name": f"Transportes Prueba {uuid.uuid4().hex[:6]}",
        "ruc": _ruc(), "name": "Duena de prueba", "email": correo, "password": CLAVE,
    })
    assert r.status_code == 200, r.text
    return r.json(), correo


@pytest.fixture(scope="module")
def admin():
    datos = _login(email="admin@transperu.com", password="admin123").json()
    return _cabeceras(datos["access_token"]), datos["user"]


@pytest.fixture(scope="module")
def chofer():
    datos = _login(dni="12345678", pin="123456").json()
    return _cabeceras(datos["access_token"]), datos["user"]


@pytest.fixture(scope="module")
def otra_empresa():
    datos, correo = _alta()
    return {"cabeceras": _cabeceras(datos["access_token"]), "user": datos["user"],
            "refresh": datos["refresh_token"], "correo": correo}


# ─── Roles y empresa ─────────────────────────────────────

def test_require_roles_responde_403_a_un_chofer(chofer):
    cabeceras, _ = chofer
    # /api/companies exige superadmin, owner o admin (require_roles).
    assert requests.get(f"{BASE_URL}/api/companies", headers=cabeceras).status_code == 403
    r = requests.post(f"{BASE_URL}/api/users", headers=cabeceras, json={
        "email": f"x-{uuid.uuid4().hex[:6]}@ejemplo.pe", "name": "X", "role": "admin",
        "password": CLAVE})
    assert r.status_code == 403, r.text


def test_usuario_desactivado_con_token_vigente_recibe_401():
    duena, _ = _alta()
    cab_duena = _cabeceras(duena["access_token"])
    correo = f"desactivar-{uuid.uuid4().hex[:8]}@ejemplo.pe"
    r = requests.post(f"{BASE_URL}/api/users", headers=cab_duena, json={
        "email": correo, "name": "Por desactivar", "role": "admin", "password": CLAVE})
    assert r.status_code == 200, r.text
    usuario_id = r.json()["id"]
    token = _login(email=correo, password=CLAVE).json()["access_token"]
    assert requests.get(f"{BASE_URL}/api/auth/me", headers=_cabeceras(token)).status_code == 200

    r = requests.put(f"{BASE_URL}/api/users/{usuario_id}", headers=cab_duena,
                     json={"is_active": False})
    assert r.status_code == 200, r.text
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=_cabeceras(token))
    assert r.status_code == 401, r.text


def test_un_token_con_otra_empresa_no_mueve_a_un_no_superadmin(admin, otra_empresa):
    """_aplicar_empresa_del_token solo hace caso al company_id del token si la
    FILA del usuario es superadmin. Un admin con un token que diga otra empresa
    (firmado con el secreto: el peor caso) sigue viendo la suya."""
    _, usuario = admin
    ajena = otra_empresa["user"]["company_id"]
    falso = jwt.encode({
        "user_id": usuario["id"], "company_id": ajena, "role": "superadmin", "tv": 0,
        "type": "access", "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }, JWT_SECRET, algorithm="HS256")
    r = requests.get(f"{BASE_URL}/api/company", headers=_cabeceras(falso))
    assert r.status_code == 200, r.text
    assert r.json()["id"] == usuario["company_id"] != ajena


def test_switch_de_empresa_es_403_para_quien_no_es_superadmin(admin, otra_empresa):
    cabeceras, _ = admin
    ajena = otra_empresa["user"]["company_id"]
    r = requests.post(f"{BASE_URL}/api/companies/{ajena}/switch", headers=cabeceras)
    assert r.status_code == 403, r.text


# ─── Tokens ──────────────────────────────────────────────

@pytest.mark.parametrize("token", ["basura", "a.b.c", ""])
def test_refresh_con_token_invalido_es_401(token):
    r = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": token})
    assert r.status_code == 401, r.text


def test_un_access_token_no_sirve_como_refresh(otra_empresa):
    token = otra_empresa["cabeceras"]["Authorization"].split(" ", 1)[1]
    r = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": token})
    assert r.status_code == 401, r.text


def test_cambiar_la_contrasena_invalida_los_refresh_anteriores():
    datos, correo = _alta()
    viejo_refresh = datos["refresh_token"]
    viejo_access = datos["access_token"]
    # El refresh vale antes del cambio.
    r = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": viejo_refresh})
    assert r.status_code == 200, r.text

    r = requests.post(f"{BASE_URL}/api/auth/cambiar-password", headers=_cabeceras(viejo_access),
                      json={"password_actual": CLAVE, "password_nueva": CLAVE + "-nueva"})
    assert r.status_code == 200, r.text
    nuevos = r.json()

    # Los de antes, muertos; los que devuelve el cambio, vivos.
    r = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": viejo_refresh})
    assert r.status_code == 401, r.text
    assert requests.get(f"{BASE_URL}/api/auth/me", headers=_cabeceras(viejo_access)).status_code == 401
    assert requests.get(f"{BASE_URL}/api/auth/me",
                        headers=_cabeceras(nuevos["access_token"])).status_code == 200
    r = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": nuevos["refresh_token"]})
    assert r.status_code == 200, r.text
    # Y la clave nueva entra.
    _login(email=correo, password=CLAVE + "-nueva")


# ─── Alta y recuperacion ─────────────────────────────────

def test_signup_con_correo_repetido_es_400(otra_empresa):
    r = requests.post(f"{BASE_URL}/api/auth/signup", json={
        "company_name": "Otra", "ruc": _ruc(), "name": "Otra persona",
        "email": otra_empresa["correo"], "password": CLAVE})
    assert r.status_code == 400, r.text


def test_signup_con_ruc_repetido_es_400():
    ruc = _ruc()
    base = {"company_name": "Primera", "name": "Una", "password": CLAVE}
    r = requests.post(f"{BASE_URL}/api/auth/signup",
                      json={**base, "ruc": ruc, "email": f"a-{uuid.uuid4().hex[:8]}@ejemplo.pe"})
    assert r.status_code == 200, r.text
    r = requests.post(f"{BASE_URL}/api/auth/signup",
                      json={**base, "ruc": ruc, "email": f"b-{uuid.uuid4().hex[:8]}@ejemplo.pe"})
    assert r.status_code == 400, r.text


def test_olvide_mi_password_no_revela_si_el_correo_existe(otra_empresa):
    existe = requests.post(f"{BASE_URL}/api/auth/olvide", json={"email": otra_empresa["correo"]})
    no_existe = requests.post(f"{BASE_URL}/api/auth/olvide",
                              json={"email": f"nadie-{uuid.uuid4().hex[:8]}@ejemplo.pe"})
    assert existe.status_code == no_existe.status_code == 200
    assert existe.json() == no_existe.json()


# ─── Suscripcion y checkout ──────────────────────────────

def test_un_chofer_no_puede_suscribir_a_la_empresa(chofer):
    cabeceras, _ = chofer
    r = requests.post(f"{BASE_URL}/api/suscripcion/mercadopago", headers=cabeceras,
                      json={"plan": "pro"})
    assert r.status_code == 403, r.text


def _ordenes_de_checkout(ruc):
    import asyncpg

    async def contar():
        c = await asyncpg.connect(os.environ["POSTGRES_ADMIN_URL"])
        try:
            return await c.fetchval("select count(*) from checkout_orders where ruc = $1", ruc)
        finally:
            await c.close()
    return asyncio.run(contar())


@pytest.mark.skipif(not os.environ.get("POSTGRES_ADMIN_URL"), reason="hace falta POSTGRES_ADMIN_URL")
def test_checkout_sin_js_con_ruc_de_10_digitos_no_crea_cobro():
    ruc = "2049004206"  # diez digitos
    r = requests.post(f"{BASE_URL}/comprar", data={
        "plan": "pro", "razon_social": "Transportes Diez", "email": "diez@ejemplo.pe",
        "ruc": ruc, "comprobante": "factura", "documento": ruc,
    }, allow_redirects=False)
    assert r.status_code == 200, r.text
    assert "El RUC debe tener 11 dígitos." in r.text
    assert "Pedido registrado" not in r.text
    assert _ordenes_de_checkout(ruc) == 0


# ─── /uploads ────────────────────────────────────────────

@pytest.fixture(scope="module")
def archivo_del_admin(admin):
    cabeceras, _ = admin
    r = requests.post(f"{BASE_URL}/api/upload", headers=cabeceras,
                      files={"file": ("vale.jpg", JPEG, "image/jpeg")},
                      data={"entity_type": "fuel", "entity_id": str(uuid.uuid4())})
    assert r.status_code == 200, r.text
    url = r.json()["url"]
    assert url.startswith("/uploads/")
    return url


def test_uploads_sin_sesion_es_401(archivo_del_admin):
    assert requests.get(f"{BASE_URL}{archivo_del_admin}").status_code == 401


def test_uploads_de_otra_empresa_es_404(archivo_del_admin, otra_empresa):
    r = requests.get(f"{BASE_URL}{archivo_del_admin}", headers=otra_empresa["cabeceras"])
    assert r.status_code == 404


def test_uploads_de_la_misma_empresa_con_bearer(archivo_del_admin, admin):
    cabeceras, _ = admin
    r = requests.get(f"{BASE_URL}{archivo_del_admin}", headers=cabeceras)
    assert r.status_code == 200
    assert r.content == JPEG
    assert "private" in r.headers.get("cache-control", "")


def test_uploads_con_la_cookie_del_login(archivo_del_admin):
    """Un <img src> no manda Authorization: entra con la cookie cx_archivos."""
    sesion = requests.Session()
    r = sesion.post(f"{BASE_URL}/api/auth/login",
                    json={"email": "admin@transperu.com", "password": "admin123"})
    assert r.status_code == 200
    galleta = r.headers.get("set-cookie", "")
    assert "cx_archivos=" in galleta and "HttpOnly" in galleta and "Path=/uploads" in galleta
    assert sesion.get(f"{BASE_URL}{archivo_del_admin}").status_code == 200
    # Con la de otra empresa, no.
    otra = requests.Session()
    datos, _ = _alta()
    assert otra.post(f"{BASE_URL}/api/auth/refresh",
                     json={"refresh_token": datos["refresh_token"]}).status_code == 200
    assert otra.get(f"{BASE_URL}{archivo_del_admin}").status_code == 404


def test_uploads_no_sale_del_directorio(admin):
    cabeceras, _ = admin
    r = requests.get(f"{BASE_URL}/uploads/..%2F..%2Fserver.py", headers=cabeceras)
    assert r.status_code == 404
