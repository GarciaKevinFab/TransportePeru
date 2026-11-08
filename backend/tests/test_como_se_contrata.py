"""El bloque "Cómo se contrata" de la portada promete cosas: que sigan siendo ciertas.

Cada frase de frontend/src/components/ContactoVentas.jsx describe un
comportamiento del backend. Si el backend cambia y el texto no, la portada
miente a quien esta decidiendo si paga. Aqui se ata cada promesa a su codigo.

No necesita base de datos: lee el codigo fuente y llama funciones puras.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import suscripciones  # noqa: E402

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAIZ = os.path.dirname(BACKEND)
BLOQUE = os.path.join(RAIZ, "frontend", "src", "components", "ContactoVentas.jsx")


def _leer(ruta):
    with open(ruta, encoding="utf-8") as f:
        return f.read()


def test_prueba_vencida_es_solo_consulta_y_no_plan_gratis():
    """'Si no eliges plan, tus datos se quedan ... solo consulta'."""
    assert suscripciones.puede_escribir("prueba_vencida") is False
    # Leer sigue permitido: el corte solo mira metodos de escritura.
    fuente = _leer(os.path.join(BACKEND, "server.py"))
    assert "if request.method in _METODOS_DE_LECTURA:" in fuente


def test_la_prueba_no_tiene_limite_de_vehiculos():
    """'cargas tu flota completa, sin limite de vehiculos durante la prueba'."""
    fuente = _leer(os.path.join(BACKEND, "server.py"))
    mapa = re.search(r"LIMITE_VEHICULOS = (\{[^}]*\})", fuente).group(1)
    assert "trial" not in mapa


def test_se_cancela_desde_la_cuenta():
    """'Sin contrato: cancelas cuando quieras desde tu cuenta'."""
    assert '@router.post("/api/suscripcion/cancelar")' in _leer(os.path.join(BACKEND, "suscripcion_api.py"))
    assert "cancelar-suscripcion-btn" in _leer(os.path.join(RAIZ, "frontend", "src", "pages", "SuscripcionPage.jsx"))


def test_con_ruc_se_completa_la_razon_social_del_padron():
    """'Escribes tu RUC y completamos la razon social con el padron de SUNAT'."""
    fuente = _leer(os.path.join(BACKEND, "comprobantes.py"))
    assert "sunat_padron.consultar_ruc" in fuente


def test_sin_procesos_manuales_en_el_bloque():
    """Ni demo agendada ni cotizacion a mano: la compra es autoservicio."""
    texto = _leer(BLOQUE).lower()
    for palabra in ("demo", "cotización", "orden de compra", "transferencia", "yape"):
        assert palabra not in texto, palabra
