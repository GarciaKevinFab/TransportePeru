"""GET /api/config/publica: el WhatsApp de ventas sale de la variable de entorno.

QUE PROTEGE

  El numero de ventas no vive en el codigo: lo pone WHATSAPP_VENTAS en el
  backend y la web lo pide aqui. Si la variable no esta, la respuesta tiene que
  ser null -- la web no pinta ningun boton --, y un valor mal escrito tampoco
  puede llegar al navegador: un wa.me a un numero que no existe es un chat con
  nadie.

Se monta solo el router, sin server.py: no hace falta base de datos.
"""
import os
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config_publica  # noqa: E402

RAIZ_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Un numero con forma de celular peruano que no es de nadie en concreto.
NUMERO_DE_PRUEBA = "51900000000"


@pytest.fixture
def cliente():
    app = FastAPI()
    app.include_router(config_publica.router)
    return TestClient(app)


def test_sin_variable_no_hay_numero(cliente, monkeypatch):
    monkeypatch.delenv("WHATSAPP_VENTAS", raising=False)
    r = cliente.get("/api/config/publica")
    assert r.status_code == 200
    assert r.json() == {"whatsapp_ventas": None}


def test_variable_vacia_no_hay_numero(cliente, monkeypatch):
    monkeypatch.setenv("WHATSAPP_VENTAS", "   ")
    assert cliente.get("/api/config/publica").json()["whatsapp_ventas"] is None


def test_con_variable_devuelve_el_numero(cliente, monkeypatch):
    monkeypatch.setenv("WHATSAPP_VENTAS", NUMERO_DE_PRUEBA)
    assert cliente.get("/api/config/publica").json()["whatsapp_ventas"] == NUMERO_DE_PRUEBA


def test_se_aceptan_espacios_y_el_mas_inicial(cliente, monkeypatch):
    """Es como se copia un numero desde el telefono; wa.me quiere solo digitos."""
    monkeypatch.setenv("WHATSAPP_VENTAS", "+51 900 000 000")
    assert cliente.get("/api/config/publica").json()["whatsapp_ventas"] == NUMERO_DE_PRUEBA


@pytest.mark.parametrize("valor", [
    "900000000",        # sin codigo de pais
    "5190000000",       # le falta un digito
    "519000000000",     # le sobra uno
    "56900000000",      # otro pais
    "51-abc-000-000",   # no es un numero
])
def test_formato_invalido_no_llega_a_la_web(cliente, monkeypatch, valor):
    monkeypatch.setenv("WHATSAPP_VENTAS", valor)
    assert cliente.get("/api/config/publica").json()["whatsapp_ventas"] is None


def test_no_expone_nada_mas(cliente, monkeypatch):
    """Es publico: cualquier clave nueva aqui la lee quien no tiene cuenta."""
    monkeypatch.setenv("WHATSAPP_VENTAS", NUMERO_DE_PRUEBA)
    assert set(cliente.get("/api/config/publica").json()) == {"whatsapp_ventas"}


def test_el_router_esta_montado_antes_del_catch_all_de_la_spa():
    """Registrado despues de serve_react, /api/config/publica no llegaria aqui."""
    with open(os.path.join(RAIZ_BACKEND, "server.py"), encoding="utf-8") as f:
        fuente = f.read()
    montaje = fuente.find("app.include_router(config_publica_router)")
    catch_all = fuente.find('@app.get("/{full_path:path}")')
    assert montaje != -1, "server.py no monta el router de config_publica"
    assert catch_all == -1 or montaje < catch_all
