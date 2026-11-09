"""
Autorizacion por rol y por empresa (auditoria de seguridad del 2026-11-09).

Antes de este arreglo:
- un chofer se ponia "role": "superadmin" con PUT /api/users/<su id>;
- un admin creaba usuarios superadmin u owner;
- cualquier owner leia o borraba OTRA empresa por su id.

Son pruebas de integracion contra el backend levantado, igual que test_api.py.
"""
import http.client
import os
import uuid
from urllib.parse import urlparse

import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "http://127.0.0.1:8001").rstrip("/")


def _login(**credenciales):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=credenciales)
    assert r.status_code == 200, r.text
    datos = r.json()
    return {"Authorization": f"Bearer {datos['access_token']}"}, datos["user"]


@pytest.fixture(scope="module")
def admin():
    return _login(email="admin@transperu.com", password="admin123")


@pytest.fixture(scope="module")
def chofer():
    return _login(dni="12345678", pin="123456")


def _rol_actual(cabeceras):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=cabeceras)
    assert r.status_code == 200, r.text
    return r.json()["role"]


class TestEscaladaDePrivilegios:
    def test_chofer_no_se_vuelve_superadmin(self, chofer):
        cabeceras, usuario = chofer
        r = requests.put(
            f"{BASE_URL}/api/users/{usuario['id']}",
            headers=cabeceras,
            json={"role": "superadmin", "is_active": True, "failed_attempts": 0},
        )
        assert r.status_code == 200, r.text
        assert _rol_actual(cabeceras) == "chofer"

    def test_chofer_si_edita_sus_datos(self, chofer):
        cabeceras, usuario = chofer
        r = requests.put(
            f"{BASE_URL}/api/users/{usuario['id']}",
            headers=cabeceras,
            json={"phone": "+51 987 654 321"},
        )
        assert r.status_code == 200, r.text

    @pytest.mark.parametrize("rol", ["superadmin", "owner"])
    def test_admin_no_crea_roles_superiores(self, admin, rol):
        cabeceras, _ = admin
        r = requests.post(
            f"{BASE_URL}/api/users",
            headers=cabeceras,
            json={
                "email": f"escalada-{uuid.uuid4().hex[:8]}@ejemplo.pe",
                "name": "Prueba de escalada",
                "role": rol,
                "password": "Clave-de-prueba-123",
            },
        )
        assert r.status_code == 403, r.text

    def test_admin_no_asciende_a_superadmin(self, admin, chofer):
        cabeceras, _ = admin
        _, usuario_chofer = chofer
        r = requests.put(
            f"{BASE_URL}/api/users/{usuario_chofer['id']}",
            headers=cabeceras,
            json={"role": "superadmin"},
        )
        assert r.status_code == 403, r.text


class TestAislamientoEntreEmpresas:
    def test_no_lee_otra_empresa(self, admin):
        cabeceras, _ = admin
        r = requests.get(f"{BASE_URL}/api/companies/{uuid.uuid4()}", headers=cabeceras)
        assert r.status_code == 403, r.text

    def test_no_borra_otra_empresa(self, admin):
        cabeceras, _ = admin
        r = requests.delete(f"{BASE_URL}/api/companies/{uuid.uuid4()}", headers=cabeceras)
        assert r.status_code == 403, r.text


def test_spa_no_sirve_archivos_fuera_del_build():
    """Con '..' sin normalizar, la ruta de la SPA no debe salir del build."""
    url = urlparse(BASE_URL)
    conexion = http.client.HTTPConnection(url.hostname, url.port or 80, timeout=10)
    conexion.request("GET", "/static/../../backend/.env")
    respuesta = conexion.getresponse()
    cuerpo = respuesta.read().decode("utf-8", "replace")
    assert "JWT_SECRET" not in cuerpo and "DATABASE_URL" not in cuerpo
