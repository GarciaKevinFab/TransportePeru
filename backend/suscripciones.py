"""Maquina de estados de la suscripcion de una empresa, y lo que la mueve.

Estados guardados en companies.subscription_status y como se pasa de uno a otro:

    trial      -> activa      primer cobro aprobado
    trial      -> (Gratis)    se acabaron los dias de prueba sin pagar
    activa     -> vencida     paso subscription_ends_at sin cobro nuevo
    vencida    -> activa      cobro aprobado (Mercado Pago reintenta solo)
    vencida    -> suspendida  pasaron los DIAS_GRACIA
    activa     -> suspendida  MAX_INTENTOS cobros rechazados seguidos
    cualquiera -> cancelada   la empresa cancela (conserva hasta subscription_ends_at)
    cualquiera -> activa      pago adelantado aprobado (1, 3, 6 o 12 meses)

EL PAGO ADELANTADO NO TRAE ESTADOS NUEVOS

  Es un cobro aprobado como cualquier otro: extiende `subscription_ends_at`
  desde lo que quedaba (o desde hoy) y deja la empresa `activa`. Al acabarse
  lo pagado sin renovar, pasa lo mismo que con la tarjeta: `vencida` con su
  gracia y despues `suspendida`, que pasa la cuenta al plan Gratis. Nada
  se borra.

SIN PAGO VIGENTE, PLAN GRATIS (NO SOLO CONSULTA)

  `prueba_vencida`, `suspendida` y `cancelada_vencida` ya no dejan la cuenta en
  solo consulta: la dejan en el plan Gratis (`plan_efectivo`), que sigue
  operando con hasta TOPE_GRATIS vehiculos activos (los que no estan "fuera de
  servicio") y sin las funciones del plan Pro (SUNAT, detracciones, bot de
  WhatsApp, lectura automatica de facturas y reportes). No se escribe nada en
  companies: es lo que resulta de leer el estado con las fechas, igual que
  `vencida`. Por eso no hizo falta migracion, y un pago (adelantado o con
  tarjeta) la saca de Gratis por el mismo camino de siempre: estado `activa`
  con fecha por delante.

  Con mas de TOPE_GRATIS vehiculos activos no se borra ni se oculta nada: se
  consulta todo, y para registrar algo nuevo hay que dejar solo 3 activos
  (marcar los demas "fuera de servicio" o eliminarlos) o pagar. El corte lo
  aplica server.py (`_exigir_suscripcion_al_dia`).

`vencida` no se escribe casi nunca: es lo que resulta de leer `activa` con una
fecha pasada. `estado_efectivo` es la unica definicion de las dos cosas, y la
usan el corte de server.py, la pantalla del cliente y las pruebas.

POR QUE GRACIA Y NO CORTE INMEDIATO

  Una tarjeta rebota por mil motivos (limite, vencimiento, el banco), y
  cortarle el servicio a quien si quiere pagar es la forma mas cara de perder
  un cliente. Durante la gracia se sigue escribiendo con el plan pagado;
  despues, el plan Gratis.

LA PRUEBA NO TIENE GRACIA, Y ES A PROPOSITO

  En LicitaPro la prueba vencida tambien recibe los 7 dias. Aqui no: al dia
  siguiente de la prueba la cuenta ya esta en el plan Gratis. La gracia es para
  quien ya pago una vez.

LAS EMPRESAS QUE YA ESTABAN

  Las dos que operaban antes de los planes quedaron `activa` sin fecha
  (migracion 015). Sin `subscription_ends_at` no vencen nunca, como hasta hoy.

HORAS

  Todo es timestamptz y `now()` de Postgres. LicitaPro guarda hora de pared de
  Lima en columnas sin zona y necesita su AHORA_SQL; aqui no hace falta.
"""
import json
import logging
from datetime import datetime, timedelta, timezone

import db_pg


def _para_jsonb(factura: dict | None):
    """El JSON de Mercado Pago listo para una columna jsonb.

    La conexion ya trae un codec jsonb que hace json.dumps: pasarle una cadena
    la serializa dos veces y queda guardado un string en vez de un objeto (el
    cast ::jsonb no lo evita). Se pasa el dict, pasado antes por default=str
    para que nada raro (fechas, Decimal) rompa al codec.
    """
    return json.loads(json.dumps(factura, default=str)) if factura else None


log = logging.getLogger("suscripciones")

DIAS_GRACIA = 7
DIAS_POR_PERIODO = {"mensual": 30}
MAX_INTENTOS = 4

#: Estados efectivos que dejan escribir.
CON_ESCRITURA = ("trial", "activa", "vencida")


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def estado_efectivo(estado: str | None, trial_ends_at=None, vence=None,
                    ahora: datetime | None = None) -> str:
    """El estado que de verdad aplica hoy, a partir del guardado y las fechas.

    Devuelve uno de: trial, prueba_vencida, activa, vencida, suspendida,
    cancelada (con acceso hasta `vence`) o cancelada_vencida.
    """
    ahora = ahora or _ahora()
    estado = (estado or "").strip().lower()

    if estado == "trial":
        if trial_ends_at is not None and trial_ends_at < ahora:
            return "prueba_vencida"
        return "trial"

    if estado == "cancelada":
        if vence is not None and vence >= ahora:
            return "cancelada"
        return "cancelada_vencida"

    if estado == "suspendida":
        return "suspendida"

    if estado in ("activa", "vencida"):
        if vence is None:
            # 'activa' sin fecha: las empresas de antes de los planes.
            # 'vencida' sin fecha: el corte manual de siempre.
            return "activa" if estado == "activa" else "suspendida"
        if vence >= ahora:
            return "activa"
        if vence + timedelta(days=DIAS_GRACIA) >= ahora:
            return "vencida"
        return "suspendida"

    # Estado desconocido: se deja pasar, igual que el corte falla abierto.
    return estado or "activa"


def puede_escribir(efectivo: str) -> bool:
    """Si un estado ya resuelto esta AL DIA con el plan que eligio.

    `cancelada` con fecha por delante sigue dentro: cancelar promete conservar
    el acceso hasta el fin del periodo pagado. Lo desconocido pasa. Lo que no
    esta al dia no queda en solo consulta: pasa al plan Gratis (ver
    `plan_efectivo`), que tiene sus propios limites.
    """
    return efectivo not in CAEN_A_GRATIS


#: Estados sin pago vigente: la empresa sigue, pero en el plan Gratis.
CAEN_A_GRATIS = ("prueba_vencida", "suspendida", "cancelada_vencida")
#: Vehiculos activos (no "fuera de servicio") que admite el plan Gratis.
TOPE_GRATIS = 3
#: El estado de vehiculo que no cuenta como activo.
VEHICULO_INACTIVO = "fuera_servicio"


def plan_efectivo(plan: str | None, efectivo: str) -> str:
    """El plan que de verdad aplica hoy: el guardado, o 'gratis' si no hay pago vigente."""
    if efectivo in CAEN_A_GRATIS:
        return "gratis"
    return (plan or "").strip().lower()


# ─── Consultas ───────────────────────────────────────────

async def estado_de(company_id: str) -> dict | None:
    async with db_pg.tx_global("suscripcion: leer el estado de una empresa") as conn:
        fila = await conn.fetchrow(
            "select id, plan, subscription_status, trial_ends_at, subscription_ends_at, "
            "       mp_preapproval_id, mp_intentos_fallidos "
            "  from companies where id = $1",
            db_pg.as_uuid(company_id))
    if not fila:
        return None
    d = dict(fila)
    d["efectivo"] = estado_efectivo(d["subscription_status"], d["trial_ends_at"],
                                    d["subscription_ends_at"])
    d["plan_efectivo"] = plan_efectivo(d["plan"], d["efectivo"])
    return d


async def plan_de(company_id: str) -> dict | None:
    """Plan vigente y vehiculos activos de una empresa. Para el aviso en pantalla
    y para el bot de WhatsApp; el corte de server.py hace la misma cuenta en su
    propia consulta."""
    async with db_pg.tx_global("suscripcion: plan vigente de una empresa") as conn:
        fila = await conn.fetchrow(
            "select c.plan, c.subscription_status, c.trial_ends_at, c.subscription_ends_at, "
            "       (select count(*) from vehicles v where v.company_id = c.id "
            "          and v.status::text <> $2) as activos "
            "  from companies c where c.id = $1",
            db_pg.as_uuid(company_id), VEHICULO_INACTIVO)
    if not fila:
        return None
    efectivo = estado_efectivo(fila["subscription_status"], fila["trial_ends_at"],
                               fila["subscription_ends_at"])
    plan = plan_efectivo(fila["plan"], efectivo)
    gratis = plan == "gratis"
    return {
        "plan": fila["plan"], "plan_efectivo": plan, "efectivo": efectivo,
        "gratis": gratis, "activos": int(fila["activos"]), "tope_gratis": TOPE_GRATIS,
        "excedido": gratis and int(fila["activos"]) > TOPE_GRATIS,
    }


# ─── Lo que mueve el webhook ─────────────────────────────
# Solo se llama con lo que confirmo la API. El periodo se concede con cada pago
# aprobado, el primero incluido; `vincular_preapproval` no concede nada.

async def vincular_preapproval(company_id: str, preapproval_id: str) -> bool:
    """Ata la suscripcion a la empresa. False si la empresa ya tiene otra.

    La condicion va en el UPDATE y no en un SELECT previo: dos suscripciones
    pagadas casi a la vez no pueden pasar las dos.
    """
    async with db_pg.tx_global("webhook mercado pago: vincular la suscripcion") as conn:
        fila = await conn.fetchval(
            "update companies set mp_preapproval_id = $2 "
            " where id = $1 and (mp_preapproval_id is null or mp_preapproval_id = $2) "
            "returning id",
            db_pg.as_uuid(company_id), preapproval_id)
    return fila is not None


async def olvidar_preapproval(preapproval_id: str) -> str | None:
    """Suelta una suscripcion cancelada. Devuelve la empresa, si era de alguna."""
    async with db_pg.tx_global("webhook mercado pago: soltar una suscripcion cancelada") as conn:
        cid = await conn.fetchval(
            "update companies set mp_preapproval_id = null "
            " where mp_preapproval_id = $1 returning id",
            preapproval_id)
    return str(cid) if cid else None


async def aplicar_pago_mp(company_id: str, plan: str, pago_id: str, monto,
                          factura: dict | None = None, preapproval_id: str | None = None,
                          periodo: str = "mensual") -> str:
    """Asienta una factura aprobada. 'aplicado', 'repetido' o 'sin_fila'.

    La idempotencia la da el indice unico de `mp_payment_id`. Una factura que
    antes entro rechazada y ahora viene aprobada es la misma fila: Mercado Pago
    reintenta el cobro sobre la misma factura.
    """
    cuerpo = _para_jsonb(factura)
    cobro_id = str(((factura or {}).get("payment") or {}).get("id") or "") or None
    dias = DIAS_POR_PERIODO[periodo]
    async with db_pg.tx_global("webhook mercado pago: asentar un cobro aprobado") as conn:
        cid = await conn.fetchval(
            "select id from companies where id = $1 for update", db_pg.as_uuid(company_id))
        if not cid:
            return "sin_fila"
        previo = await conn.fetchrow(
            "select id, estado from pagos_suscripcion where mp_payment_id = $1", pago_id)
        if previo and previo["estado"] in ("pagado", "devuelto"):
            return "repetido"
        if previo:
            await conn.execute(
                "update pagos_suscripcion set estado = 'pagado', monto = $2, "
                "  respuesta = $3::jsonb, mp_cobro_id = $4, confirmado_en = now() "
                "where id = $1",
                previo["id"], monto, cuerpo, cobro_id)
        else:
            nuevo = await conn.fetchval(
                "insert into pagos_suscripcion "
                "  (company_id, plan, monto, moneda, estado, metodo, mp_payment_id, "
                "   mp_cobro_id, mp_preapproval_id, respuesta, confirmado_en) "
                "values ($1, $2, $3, 'PEN', 'pagado', 'mercadopago', $4, $5, $6, $7::jsonb, now()) "
                "on conflict (mp_payment_id) where mp_payment_id is not null do nothing "
                "returning id",
                cid, plan, monto, pago_id, cobro_id, preapproval_id, cuerpo)
            if not nuevo:
                return "repetido"

        # Desde el vencimiento si aun no paso: lo que quedaba de prueba o del
        # periodo anterior no se pierde.
        await conn.execute(
            "update companies set plan = $2, subscription_status = 'activa', "
            "  mp_intentos_fallidos = 0, "
            "  subscription_ends_at = greatest(coalesce(subscription_ends_at, "
            "      case when subscription_status = 'trial' then trial_ends_at end, now()), now()) "
            "      + make_interval(days => $3), "
            "  updated_at = now() "
            "where id = $1",
            cid, plan, dias)
    log.info("Factura %s de Mercado Pago aplicada a la empresa %s", pago_id, company_id)
    return "aplicado"


async def aplicar_pago_adelantado(company_id: str, plan: str, pago_id: str, monto,
                                  meses: int, pago: dict | None = None) -> str:
    """Asienta un pago adelantado aprobado. 'aplicado', 'repetido' o 'sin_fila'.

    `pago_id` es el id del pago de Checkout Pro: va en mp_payment_id (el indice
    unico que da la idempotencia) y en mp_cobro_id (por donde llega una
    devolucion). Extiende `meses` meses de calendario desde lo que quedaba
    pagado, o desde hoy si ya vencio: hasta = max(ahora, hasta_actual) + meses.
    Lo que quedaba de la prueba tambien se respeta, igual que con la tarjeta.
    """
    cuerpo = _para_jsonb(pago)
    async with db_pg.tx_global("webhook mercado pago: asentar un pago adelantado") as conn:
        cid = await conn.fetchval(
            "select id from companies where id = $1 for update", db_pg.as_uuid(company_id))
        if not cid:
            return "sin_fila"
        nuevo = await conn.fetchval(
            "insert into pagos_suscripcion "
            "  (company_id, plan, monto, moneda, estado, metodo, origen, meses, "
            "   mp_payment_id, mp_cobro_id, respuesta, confirmado_en) "
            "values ($1, $2, $3, 'PEN', 'pagado', 'mercadopago', 'adelantado', $4, "
            "        $5, $5, $6::jsonb, now()) "
            "on conflict (mp_payment_id) where mp_payment_id is not null do nothing "
            "returning id",
            cid, plan, monto, meses, pago_id, cuerpo)
        if not nuevo:
            return "repetido"
        await conn.execute(
            "update companies set plan = $2, subscription_status = 'activa', "
            "  mp_intentos_fallidos = 0, "
            "  subscription_ends_at = greatest(coalesce(subscription_ends_at, "
            "      case when subscription_status = 'trial' then trial_ends_at end, now()), now()) "
            "      + make_interval(months => $3), "
            "  updated_at = now() "
            "where id = $1",
            cid, plan, meses)
    log.info("Pago adelantado %s (%s meses) aplicado a la empresa %s", pago_id, meses, company_id)
    return "aplicado"


async def devolver_pago_mp(cobro_id: str) -> str:
    """Deshace un cobro devuelto. 'devuelto' o 'sin_efecto'.

    `cobro_id` es el id del pago, no el de la factura. El estado `devuelto` hace
    que un aviso repetido no quite el periodo dos veces. Se quita lo que ese
    pago concedio: 30 dias el de la tarjeta, sus meses el adelantado.
    """
    async with db_pg.tx_global("webhook mercado pago: deshacer un cobro devuelto") as conn:
        fila = await conn.fetchrow(
            "update pagos_suscripcion set estado = 'devuelto', confirmado_en = now() "
            " where metodo = 'mercadopago' and estado = 'pagado' and mp_cobro_id = $1 "
            "returning company_id, origen, meses",
            cobro_id)
        if not fila:
            return "sin_efecto"
        if fila["origen"] == "adelantado":
            quitar = ("make_interval(months => $2)", fila["meses"])
        else:
            quitar = ("make_interval(days => $2)", DIAS_POR_PERIODO["mensual"])
        # Nunca antes de hoy: la empresa pasa a vencida (con su gracia), no a
        # una fecha pasada que le quitaria tambien esos dias.
        await conn.execute(
            "update companies set subscription_ends_at = "
            f"   greatest(subscription_ends_at - {quitar[0]}, now()), "
            "   updated_at = now() "
            " where id = $1 and subscription_ends_at is not null",
            fila["company_id"], quitar[1])
    log.info("Cobro %s de Mercado Pago devuelto: se quita su periodo a la empresa %s",
             cobro_id, fila["company_id"])
    return "devuelto"


async def registrar_rechazo_mp(company_id: str, plan: str, pago_id: str, monto,
                               factura: dict | None = None,
                               preapproval_id: str | None = None) -> bool:
    """Asienta un cobro rechazado una sola vez por factura.

    Solo suma intentos a quien ya paga. En la prueba cada vez que alguien pulsa
    Pagar es una suscripcion y una factura nuevas: si contaran, cuatro tarjetas
    rechazadas suspenderian a quien todavia no debe nada.
    """
    async with db_pg.tx_global("webhook mercado pago: asentar un cobro rechazado") as conn:
        nuevo = await conn.fetchval(
            "insert into pagos_suscripcion "
            "  (company_id, plan, monto, moneda, estado, metodo, mp_payment_id, "
            "   mp_preapproval_id, respuesta, confirmado_en) "
            "select c.id, $2, $3, 'PEN', 'fallido', 'mercadopago', $4, $5, $6::jsonb, now() "
            "  from companies c where c.id = $1 "
            "on conflict (mp_payment_id) where mp_payment_id is not null do nothing "
            "returning id",
            db_pg.as_uuid(company_id), plan, monto if monto is not None else 0, pago_id,
            preapproval_id, _para_jsonb(factura))
        if not nuevo:
            return False
        await conn.execute(
            "update companies set mp_intentos_fallidos = mp_intentos_fallidos + 1, "
            "  subscription_status = case when mp_intentos_fallidos + 1 >= $2 "
            "                             then 'suspendida' else subscription_status end, "
            "  updated_at = now() "
            " where id = $1 and subscription_status not in ('trial', 'cancelada')",
            db_pg.as_uuid(company_id), MAX_INTENTOS)
    return True


async def cancelar(company_id: str) -> None:
    """Cancela sin cortar el acceso: se conserva hasta el fin del periodo pagado.

    `subscription_ends_at` NO se toca. Se suelta la suscripcion de Mercado Pago
    para que nada la vuelva a cobrar. Una prueba que cancela no tiene periodo
    pagado: queda como estaba (trial), que ya tiene su propio vencimiento.
    """
    async with db_pg.tx_global("suscripcion: cancelar") as conn:
        await conn.execute(
            "update companies set mp_preapproval_id = null, "
            "  subscription_status = case when subscription_status = 'trial' "
            "                             then 'trial' else 'cancelada' end, "
            "  updated_at = now() "
            " where id = $1",
            db_pg.as_uuid(company_id))
