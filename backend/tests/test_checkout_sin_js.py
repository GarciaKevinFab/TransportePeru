"""El checkout que se ve sin JavaScript, y lo que puede romperlo en silencio.

QUE PROTEGE

  CargoXprez es una SPA: el servidor devuelve el mismo index.html para toda
  URL y el navegador construye la pagina. Izipay rechazo la integracion porque
  su validador, que no ejecuta JavaScript, no encontraba "carrito de compras,
  proceso de checkout o boton de pago" -- y no los encontraba porque en el HTML
  no estaban.

  `checkout_sin_js.py` inyecta el checkout dentro de `<div id="root">`. Las
  tres cosas que lo dejarian inutil otra vez no dan error ninguna:

    1. Que alguien cambie el ancla en index.html. La inyeccion no encaja y la
       pagina vuelve a salir vacia, con un 200 y su HTML entero.
    2. Que el precio se toque en un solo checkout. Dos importes distintos
       segun como entre el cliente, sin que nada avise.
    3. Que los datos del proveedor discrepen entre el JS y el espejo en
       Python. Dos paginas diciendo cosas distintas sobre a quien reclamar.

Ninguna de las tres necesita base de datos para comprobarse, que es lo que
permite que estas pruebas corran en cualquier maquina.
"""
import os
import re
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import checkout_sin_js  # noqa: E402
import planes  # noqa: E402
import proveedor  # noqa: E402

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROVEEDOR_JS = os.path.join(RAIZ, "frontend", "src", "config", "proveedor.js")
INDEX_HTML = os.path.join(RAIZ, "frontend", "public", "index.html")


# ─── El ancla donde se inyecta ───────────────────────────

def test_el_ancla_de_react_sigue_estando_en_index_html():
    """Si cambia, la inyeccion no encaja y la pagina vuelve a salir vacia.

    Y no da error: `str.replace` de algo que no esta devuelve la cadena tal
    cual, asi que el servidor responde 200 con el HTML entero y sin checkout.
    Exactamente el estado del que veniamos.
    """
    with open(INDEX_HTML, encoding="utf-8") as f:
        assert checkout_sin_js.ANCLA_ROOT in f.read(), (
            f"index.html ya no contiene {checkout_sin_js.ANCLA_ROOT!r}: "
            "actualiza ANCLA_ROOT en checkout_sin_js.py")


# ─── El desglose que ve el cliente ───────────────────────

@pytest.mark.parametrize("total", [199.00, 0.01, 33.33, 1990.00, 49.00])
def test_base_mas_igv_suman_exactamente_el_total(total):
    """El centimo de descuadre aparece justo en la pantalla que el cliente
    compara con el cargo de su tarjeta."""
    d = planes.desglose(total)
    assert round(d["base"] + d["igv"], 2) == d["total"]


def test_el_igv_del_plan_pro_es_el_que_se_ensena():
    """S/199 con IGV incluido son S/168.64 de valor de venta y S/30.36 de IGV.

    Si alguien "arregla" esto multiplicando por 1.18, el total mostrado dejaria
    de ser el cobrado.
    """
    d = planes.desglose(199.00)
    assert (d["base"], d["igv"], d["total"]) == (168.64, 30.36, 199.00)


# ─── El precio, uno solo para los dos checkouts ──────────

def test_el_precio_sale_del_modulo_compartido():
    """server.py ya no define el suyo: lo importa de planes.py.

    Mientras hubiera dos diccionarios, subir el precio en uno dejaba al otro
    cobrando el viejo, y quien entrara sin JavaScript pagaria distinto.
    """
    with open(os.path.join(RAIZ, "backend", "server.py"), encoding="utf-8") as f:
        server = f.read()
    assert "from planes import PRECIOS_CHECKOUT" in server
    assert not re.search(r"^PRECIOS_CHECKOUT\s*=", server, re.M)


# ─── El espejo de los datos del proveedor ────────────────

@pytest.mark.parametrize("campo, valor", [
    ("razonSocial", proveedor.RAZON_SOCIAL),
    ("ruc",         proveedor.RUC),
    ("domicilio",   proveedor.DOMICILIO),
    ("telefono",    proveedor.TELEFONO),
    ("email",       proveedor.EMAIL),
    ("producto",    proveedor.PRODUCTO),
])
def test_el_espejo_en_python_dice_lo_mismo_que_el_javascript(campo, valor):
    """Dos copias de la misma verdad, obligadas a coincidir.

    El checkout de React lee proveedor.js; el del servidor no puede, porque se
    renderiza antes de que exista un navegador. Sin un paso de build que las
    comparta, esto es lo que impide que un dia digan cosas distintas sobre a
    quien se reclama -- que es lo que la Ley 29571 exige identificar.
    """
    with open(PROVEEDOR_JS, encoding="utf-8") as f:
        js = f.read()
    assert valor in js, f"proveedor.py y proveedor.js discrepan en {campo!r}"


def test_el_certificado_de_marca_es_el_de_cargoxprez():
    """Clase 39 (transporte), no 42 (software).

    Lo dice el propio proveedor.js, y conviene que no se cruce con el de
    LicitaPro, que es otro certificado y otra clase. Un aviso de marca que
    exagera lo que protege es peor que no ponerlo.
    """
    assert proveedor.MARCA_CLASE == 39
    with open(PROVEEDOR_JS, encoding="utf-8") as f:
        assert proveedor.MARCA_CERTIFICADO in f.read()


# ─── El telefono, marcable ───────────────────────────────

def test_el_telefono_se_marca_en_forma_internacional():
    """El 0 de "(082)" es el prefijo interurbano y solo vale dentro del pais.

    Pegado a +51 daria +51082..., que no existe -- y el fallo no avisa: el
    enlace esta, se toca y no pasa nada.
    """
    assert proveedor.telefono_uri() == "+5182573844"


# ─── Lo que se pinta ─────────────────────────────────────

def test_la_pagina_lleva_pedido_total_y_boton():
    """Las tres cosas que Izipay dijo no encontrar."""
    descripcion, monto = planes.PRECIOS_CHECKOUT["pro"]
    html = checkout_sin_js._formulario("pro", descripcion, planes.desglose(monto))
    for texto in ("Tu pedido", "Total al mes", "S/ 199.00", "Continuar al pago",
                  "IGV (18%)", 'method="post"', 'action="/comprar"'):
        assert texto in html, texto
    assert proveedor.RAZON_SOCIAL in html
    assert proveedor.RUC in html


def test_lo_que_escribe_el_cliente_se_escapa():
    """El formulario repinta lo tecleado cuando hay un error de validacion.

    Sin escapar, ese camino es un XSS reflejado: basta un enlace que lleve el
    payload en el campo. Y es un formulario PUBLICO, sin sesion.
    """
    veneno = '"><script>alert(1)</script>'
    html = checkout_sin_js._formulario(
        "pro", "Plan Pro (mensual)", planes.desglose(199.00),
        error=veneno, valores={"razon_social": veneno, "email": veneno})
    assert "<script>alert(1)</script>" not in html
    assert "&lt;script&gt;" in html
