"""Razon social y direccion de un RUC, para el comprobante. Copia de LicitaPro.

POR QUE NO SE PREGUNTA A SUNAT DIRECTAMENTE

  La consulta RUC de SUNAT exige resolver un captcha, y saltarse un control
  anti-bot de un sistema del Estado no es una opcion. Se usan dos servicios que
  republican el padron (informacion publica) en JSON, en orden:

    1. OpenRUC (openruc.com/api/ruc/{ruc}), sin clave.
    2. apis.net.pe (api.apis.net.pe/v1/ruc?numero=), sin clave y con limite por
       IP: por eso es el respaldo.

NO ES VERDAD ABSOLUTA

  Es un dato de terceros sobre un padron que cambia. Solo rellena lo que el
  dueno va a copiar en BSNegocios, y el dueno lo ve antes de emitir. Si las dos
  fuentes fallan se devuelve None y nada se bloquea.
"""
from __future__ import annotations

import logging
import re
import time

import httpx

log = logging.getLogger("sunat_padron")

OPENRUC = "https://openruc.com/api/ruc/{ruc}"
APISNET = "https://api.apis.net.pe/v1/ruc"
TIEMPO_MAXIMO = 8.0
HEADERS = {"User-Agent": "CargoXprez/1.0 (+https://cargoxprez.sisac.pe)",
           "Accept": "application/json"}

_TTL = 24 * 3600
_cache: dict[str, tuple[float, dict | None]] = {}

_RE_RUC = re.compile(r"^(10|15|16|17|20)\d{9}$")


def ruc_valido(ruc: str | None) -> bool:
    """11 digitos con prefijo de SUNAT y digito verificador correcto."""
    if not ruc or not _RE_RUC.match(ruc):
        return False
    pesos = (5, 4, 3, 2, 7, 6, 5, 4, 3, 2)
    suma = sum(int(d) * p for d, p in zip(ruc[:10], pesos))
    verificador = (11 - suma % 11) % 10
    return verificador == int(ruc[10])


def _limpiar(valor) -> str | None:
    if valor is None:
        return None
    texto = re.sub(r"\s+", " ", str(valor)).strip(" -")
    return texto or None


async def _openruc(cliente: httpx.AsyncClient, ruc: str) -> dict | None:
    r = await cliente.get(OPENRUC.format(ruc=ruc))
    if r.status_code == 404:
        return None
    r.raise_for_status()
    d = r.json()
    if not d.get("razon_social"):
        return None
    return {"razon_social": _limpiar(d.get("razon_social")),
            "direccion": _limpiar(d.get("direccion"))}


async def _apisnet(cliente: httpx.AsyncClient, ruc: str) -> dict | None:
    r = await cliente.get(APISNET, params={"numero": ruc})
    if r.status_code == 404:
        return None
    r.raise_for_status()
    d = r.json()
    if not d.get("nombre"):
        return None
    return {"razon_social": _limpiar(d.get("nombre")),
            "direccion": _limpiar(d.get("direccion"))}


async def consultar_ruc(ruc: str) -> dict | None:
    """{'razon_social', 'direccion'} del RUC, o None si no se pudo saber."""
    ruc = (ruc or "").strip()
    if not ruc_valido(ruc):
        return None
    ahora = time.monotonic()
    guardado = _cache.get(ruc)
    if guardado and ahora - guardado[0] < _TTL:
        return guardado[1]

    resultado = None
    async with httpx.AsyncClient(timeout=TIEMPO_MAXIMO, headers=HEADERS) as cliente:
        for fuente in (_openruc, _apisnet):
            try:
                resultado = await fuente(cliente, ruc)
                break
            except Exception as e:  # noqa: BLE001
                log.warning("Consulta RUC por %s fallo: %s", fuente.__name__, type(e).__name__)
    if resultado is not None or guardado is None:
        _cache[ruc] = (ahora, resultado)
    return resultado
