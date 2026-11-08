"""Recordatorio de renovacion para quien pago por adelantado.

Quien paga con la tarjeta no necesita aviso: Mercado Pago cobra solo cada mes.
Quien pago 1, 3, 6 o 12 meses con Yape o desde su banca movil, si: nada se
cobra solo, y sin aviso la cuenta pasaria al plan Gratis (hasta 3 vehiculos
activos, sin lo del plan Pro) sin que nadie se entere. Por eso se le escribe al dueno a 7 dias y a 1 dia del vencimiento.

A QUIEN

  Empresas con fecha de vencimiento dentro de los proximos 7 dias, sin
  suscripcion con tarjeta viva (`mp_preapproval_id` vacio) y cuyo ULTIMO pago
  confirmado fue adelantado. A sus usuarios owner y admin con correo.

UNA SOLA VEZ CADA AVISO

  La tabla recordatorios_renovacion (migracion 022) tiene clave (empresa,
  vencimiento, dias). Se inserta ANTES de mandar: si dos backends corren a la
  vez, solo uno consigue la fila y solo uno escribe. Si el correo no sale, se
  borra la fila y se reintenta en la siguiente pasada. Si la empresa paga otro
  periodo, su vencimiento cambia y los dos avisos del periodo nuevo salen una
  vez cada uno.

  Si el backend estuvo apagado justo a los 7 dias, el aviso de 7 dias sale en
  cuanto vuelve (con los dias que de verdad faltan). Dentro del ultimo dia
  sale solo el de 1 dia.

EL ENLACE

  Va a la pagina de pago de la cuenta (/suscripcion), donde el cliente elige
  el periodo. No se genera una preferencia de Mercado Pago por adelantado: el
  precio se calcula cuando paga, y un enlace de pago viejo en un correo es lo
  primero que copia un phishing.

LO PROGRAMA server.py

  Un bucle asyncio que arranca con el backend (como los avisos de
  comprobantes) y corre cada RECORDAR_CADA_SEGUNDOS. DISABLE_SCHEDULER=1 lo
  apaga.
"""
import logging
import os
from datetime import timezone

import db_pg

log = logging.getLogger("recordatorios")

#: Cada cuanto se revisa quien tiene que renovar.
RECORDAR_CADA_SEGUNDOS = 3600
#: Avisos, en dias antes del vencimiento. El orden importa: del mas cercano al mas lejano.
UMBRALES = (1, 7)

_CANDIDATAS = """
    select c.id, c.name, c.slug, c.subscription_ends_at as vence,
           c.subscription_ends_at - now() as falta
      from companies c
     where c.mp_preapproval_id is null
       and c.subscription_ends_at is not null
       and c.subscription_ends_at > now()
       and c.subscription_ends_at <= now() + make_interval(days => $1)
       and c.subscription_status in ('activa', 'vencida')
       and (select ps.origen from pagos_suscripcion ps
             where ps.company_id = c.id and ps.estado = 'pagado'
             order by coalesce(ps.confirmado_en, ps.created_at) desc
             limit 1) = 'adelantado'
"""


def _umbral(falta_segundos: float) -> int:
    """El aviso que toca: el umbral mas chico que ya se alcanzo."""
    for dias in UMBRALES:
        if falta_segundos <= dias * 86400:
            return dias
    return UMBRALES[-1]


def _enlace(slug: str | None) -> str:
    import tenant_host
    base = tenant_host.DOMINIO_BASE
    if slug and base:
        return f"https://{slug}.{base}/suscripcion"
    publica = os.getenv("CARGOXPREZ_URL_PUBLICA", "https://cargoxprez.sisac.pe").rstrip("/")
    return f"{publica}/suscripcion"


def _texto_falta(falta_segundos: float) -> str:
    dias = int(falta_segundos // 86400)
    if dias >= 2:
        return f"en {dias} días"
    if dias == 1:
        return "mañana"
    return "hoy"


async def _destinos(conn, company_id) -> list[str]:
    filas = await conn.fetch(
        "select distinct lower(email) as email from users "
        " where company_id = $1 and role in ('owner', 'admin') and is_active "
        "   and email is not null and email <> ''",
        company_id)
    return [f["email"] for f in filas]


async def recordar() -> int:
    """Manda los avisos que tocan. Devuelve cuantos correos salieron."""
    import correo
    import plantillas_correo

    async with db_pg.tx_global("recordatorio de renovacion: empresas por vencer") as conn:
        candidatas = await conn.fetch(_CANDIDATAS, max(UMBRALES))

    enviados = 0
    for c in candidatas:
        falta = c["falta"].total_seconds()
        dias = _umbral(falta)
        async with db_pg.tx_global("recordatorio de renovacion: reservar el aviso") as conn:
            reservado = await conn.fetchval(
                "insert into recordatorios_renovacion (company_id, vence, dias) "
                "values ($1, $2, $3) on conflict do nothing returning company_id",
                c["id"], c["vence"], dias)
            destinos = await _destinos(conn, c["id"]) if reservado else []
        if not reservado:
            continue

        vence = c["vence"].astimezone(timezone.utc)
        cuando = _texto_falta(falta)
        texto, html = plantillas_correo.componer(
            titulo=f"Tu plan de CargoXprez vence {cuando}",
            preencabezado="Renueva con Yape, desde tu banca móvil o con tarjeta",
            intro=[f"Lo que pagaste por adelantado para {c['name']} se acaba {cuando}. "
                   "Para seguir con el plan Pro sin cortes, paga el siguiente periodo.",
                   "Paga con Yape, desde tu banca móvil (BCP, BBVA y otros) o con "
                   "tarjeta. Si no renuevas, a los 7 días la cuenta pasa al plan "
                   "Gratis, con hasta 3 vehículos activos: no se borra nada."],
            filas=[("Empresa", c["name"]),
                   ("Pagado hasta", vence.strftime("%d/%m/%Y"))],
            boton={"texto": "Renovar mi plan", "url": _enlace(c["slug"])},
        )
        asunto = f"Tu plan de CargoXprez vence {cuando}"
        salio = False
        for destino in destinos:
            if await correo.enviar(destino, asunto, texto, html):
                salio = True
                enviados += 1
        if not salio:
            # Nadie lo recibio: se suelta la reserva para reintentar en la
            # siguiente pasada.
            log.warning("No salio el recordatorio de renovacion de la empresa %s", c["id"])
            async with db_pg.tx_global("recordatorio de renovacion: soltar la reserva") as conn:
                await conn.execute(
                    "delete from recordatorios_renovacion "
                    " where company_id = $1 and vence = $2 and dias = $3",
                    c["id"], c["vence"], dias)
    return enviados

