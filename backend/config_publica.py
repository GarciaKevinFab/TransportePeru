"""Configuracion publica: lo que la web necesita saber antes de tener sesion.

    GET /api/config/publica  ->  {"whatsapp_ventas": "51XXXXXXXXX" | null}

POR QUE EL NUMERO NO ESTA EN EL CODIGO

  El WhatsApp de ventas es un dato de operacion, no de producto: cambia el dia
  que cambia quien atiende, y no puede obligar a recompilar el frontend ni a
  abrir un PR. Vive en la variable de entorno WHATSAPP_VENTAS del backend y la
  web lo pide aqui.

SIN VARIABLE NO HAY BOTON

  Si WHATSAPP_VENTAS falta, esta vacia o no tiene el formato 51 + 9 digitos, la
  respuesta es `null` y la web no pinta ningun boton de WhatsApp. Un enlace a
  wa.me con un numero mal escrito abre un chat con nadie: es peor que no tener
  boton, porque el cliente cree que escribio y nadie le contesta.

  Se aceptan espacios, guiones y el "+" inicial porque es como la gente copia
  un numero desde el telefono ("+51 987 654 321"); se devuelven solo digitos,
  que es lo que pide wa.me.

ES PUBLICO A PROPOSITO

  Sin sesion y sin secretos: un numero de ventas existe para que lo vea quien
  todavia no es cliente. No devuelve nada mas que no deba ver cualquiera.
"""
import logging
import os
import re

from fastapi import APIRouter

log = logging.getLogger("config_publica")

router = APIRouter()

#: 51 (Peru) + 9 digitos. Es el formato que wa.me espera: sin "+", sin ceros.
_FORMATO = re.compile(r"^51\d{9}$")


def whatsapp_ventas() -> str | None:
    """El numero de ventas normalizado, o None si no hay uno valido."""
    crudo = os.environ.get("WHATSAPP_VENTAS", "")
    numero = re.sub(r"[\s\-+()]", "", crudo)
    if not numero:
        return None
    if not _FORMATO.match(numero):
        # Se avisa en el log y no se muestra: mejor sin boton que con uno roto.
        log.warning("WHATSAPP_VENTAS no tiene el formato 51XXXXXXXXX; "
                    "no se mostrara el boton de WhatsApp")
        return None
    return numero


@router.get("/api/config/publica")
async def config_publica():
    """Configuracion que la web publica lee sin sesion."""
    return {"whatsapp_ventas": whatsapp_ventas()}
