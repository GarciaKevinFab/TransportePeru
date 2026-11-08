"""El bloque "Cómo se contrata" de la portada promete cosas: que sigan siendo ciertas.

Cada frase de frontend/src/components/ComoSeContrata.jsx describe un
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
BLOQUE = os.path.join(RAIZ, "frontend", "src", "components", "ComoSeContrata.jsx")


def _leer(ruta):
    with open(ruta, encoding="utf-8") as f:
        return f.read()


def test_prueba_vencida_pasa_al_plan_gratis_con_3_vehiculos():
    """'Si no eliges plan, sigues en el plan Gratis ... hasta 3 vehiculos activos'."""
    assert suscripciones.plan_efectivo("trial", "prueba_vencida") == "gratis"
    assert suscripciones.plan_efectivo("pro", "suspendida") == "gratis"
    assert suscripciones.plan_efectivo("trial", "trial") == "trial"
    assert suscripciones.plan_efectivo("pro", "vencida") == "pro"  # en gracia
    fuente = _leer(os.path.join(BACKEND, "server.py"))
    mapa = re.search(r"LIMITE_VEHICULOS = (\{[^}]*\})", fuente).group(1)
    assert '"gratis": %d' % suscripciones.TOPE_GRATIS in mapa
    assert suscripciones.TOPE_GRATIS == 3
    texto = _leer(BLOQUE)
    assert "plan Gratis" in texto and "hasta 3 vehículos activos" in texto
    assert "solo consulta" not in texto


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
    for palabra in ("demo", "cotización", "orden de compra", "transferencia", "whatsapp"):
        assert palabra not in texto, palabra


def test_el_bloque_dice_como_se_paga():
    """Yape, banca movil y tarjeta son los medios de Checkout Pro (pago adelantado)."""
    assert "Paga con Yape, desde tu banca móvil o con tarjeta" in _leer(BLOQUE)
    assert "/checkout/preferences" in _leer(os.path.join(BACKEND, "mercadopago.py"))


def _preguntas_compra():
    fuente = _leer(os.path.join(RAIZ, "frontend", "src", "components", "landing", "Comparativa.jsx"))
    bloque = fuente[fuente.index("PREGUNTAS_COMPRA = ["):]
    bloque = bloque[:bloque.index("];")]
    return dict(re.findall(r"p: '([^']*)',\s*r: '([^']*)'", bloque))


def test_las_preguntas_de_compra_cubren_las_dudas_de_quien_paga():
    preguntas = " ".join(_preguntas_compra()).lower()
    for tema in ("tarjeta", "14 días", "pago", "factura", "cancelar", "datos"):
        assert tema in preguntas, tema


def test_la_faq_dice_que_al_terminar_la_prueba_pasa_al_plan_gratis():
    """Lo que hace suscripciones.plan_efectivo: sin pago vigente, plan Gratis
    con hasta 3 vehiculos activos; con mas, Fuera de servicio o plan Pro."""
    vistas = 0
    for pregunta, respuesta in _preguntas_compra().items():
        if "14 días" in pregunta:
            vistas += 1
            for frase in ("plan Gratis", "hasta 3 vehículos activos", "No se borra nada",
                          "Fuera de servicio", "plan Pro", "7 días"):
                assert frase in respuesta, frase
            assert "solo consulta" not in respuesta
    assert vistas == 1
    assert suscripciones.DIAS_GRACIA == 7
    todas = _leer(os.path.join(RAIZ, "frontend", "src", "components", "landing", "Comparativa.jsx"))
    assert "solo consulta" not in todas
    # Y lo mismo para los buscadores y los asistentes.
    llms = _leer(os.path.join(RAIZ, "frontend", "public", "llms.txt"))
    assert "pasa al plan Gratis" in llms and "hasta 3 vehículos activos" in llms
    assert "solo consulta" not in llms
    index = _leer(os.path.join(RAIZ, "frontend", "public", "index.html"))
    assert "solo consulta" not in index
