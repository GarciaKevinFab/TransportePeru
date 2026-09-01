"""Quien presta el servicio, en Python.

ESTO ES UN ESPEJO DE frontend/src/config/proveedor.js, NO UNA SEGUNDA VERDAD

  El checkout de React lee el fichero JS; el checkout del servidor
  (`checkout_sin_js.py`) no puede, porque vive en otro lenguaje y se renderiza
  antes de que exista un navegador. Los mismos datos hacen falta en los dos.

  Sin un paso de build que los comparta, la unica forma honesta de tener dos
  copias es OBLIGARLAS A COINCIDIR: `tests/test_proveedor_espejo.py` lee el JS
  y comprueba valor por valor. Si alguien corrige el telefono en uno solo, la
  prueba se cae, en vez de dejar dos paginas diciendo cosas distintas sobre a
  quien reclamar.

  Estos datos no son decorativos: la Ley 29571 obliga a identificar al
  proveedor -- razon social, RUC y domicilio -- y son los que mira quien valida
  el comercio antes de habilitar la pasarela.
"""

RAZON_SOCIAL = "SOLUCIONES INFORMÁTICAS MDD S.A.C."
RUC = "20490042068"
DOMICILIO = ("Av. Madre de Dios N° 1087, Dpto. 201, A.H. Huerto Familiar, "
             "Tambopata, Madre de Dios, Perú")
TELEFONO = "(082) 573844"
EMAIL = "soporte@sisac.pe"
PRODUCTO = "CargoXprez"

# El aviso de marca, con los datos del Certificado N° 00165238 de INDECOPI.
#
# OJO CON LA REDACCION, y la advertencia viene del propio proveedor.js: la
# titularidad es de TRES PERSONAS NATURALES, no de la empresa. Por eso el aviso
# dice "marca registrada ante INDECOPI" y NUNCA "marca de SOLUCIONES
# INFORMATICAS MDD S.A.C.", que seria afirmar algo que el registro no respalda.
MARCA_CERTIFICADO = "N° 00165238"
MARCA_CLASE = 39


def en_una_linea() -> str:
    """El mismo texto que compone `proveedorEnUnaLinea()` en el JS."""
    return f"{PRODUCTO}, servicio de {RAZON_SOCIAL} (RUC {RUC})"


def telefono_uri() -> str:
    """El numero en forma internacional, para que un movil pueda marcarlo.

    El "0" de "(082)" es el prefijo interurbano peruano y solo vale marcando
    dentro del pais: pegado a +51 daria +51082..., que no existe. Se descarta.
    """
    digitos = "".join(c for c in TELEFONO if c.isdigit())
    return "+51" + digitos.lstrip("0")
