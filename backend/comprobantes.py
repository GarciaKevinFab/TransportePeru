"""Comprobantes de los cobros de suscripcion, emitidos a mano. Como en LicitaPro.

COMO FUNCIONA

  1. Al suscribirse, la empresa elige boleta o factura y da su DNI o RUC
     (`guardar_datos`). Con RUC se completa la razon social y la direccion con
     el padron de SUNAT.
  2. Cuando un cobro pasa a 'pagado', un disparador de la base (migracion 021)
     lo marca 'pendiente' con la foto de esos datos.
  3. `avisar` (tarea de fondo cada 10 minutos) manda al dueno un correo con lo
     que tiene que copiar en BSNegocios, y le recuerda cada 24 h los que sigan
     pendientes.
  4. El dueno (el superadmin de la plataforma) registra serie, numero y PDF en
     /admin/comprobantes, y el cliente lo descarga en /suscripcion.

CargoXprez no emite nada ante SUNAT. Solo ordena el trabajo manual.

AISLAMIENTO

  Lo que pide el cliente va por db_pg.tx(usuario): RLS solo le deja ver filas
  de su empresa, Y la consulta filtra ademas por company_id. Lo que hace el
  dueno va por tx_global, porque ve todas las empresas por diseno.
"""
import logging
import os
import re
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

import db_pg
import sunat_padron

log = logging.getLogger("comprobantes")

TIPOS = ("boleta", "factura")
MAX_PDF = 5 * 1024 * 1024
RECORDAR_CADA_HORAS = 24
AVISAR_CADA_SEGUNDOS = 10 * 60

_SERIE = re.compile(r"^[FB][A-Z0-9]{3}$")
_NUMERO = re.compile(r"^[0-9]{1,8}$")


def desglose(total) -> dict:
    """Base e IGV de un precio con IGV incluido, en Decimal.

    El mismo calculo que planes.desglose (base redondeada, IGV por resta). La
    prueba test_mercadopago_comprobantes comprueba que los dos den lo mismo.
    """
    centimo = Decimal("0.01")
    total = Decimal(str(total)).quantize(centimo, rounding=ROUND_HALF_UP)
    base = (total / Decimal("1.18")).quantize(centimo, rounding=ROUND_HALF_UP)
    return {"base": base, "igv": total - base, "total": total}


# ─── Datos del cliente ───────────────────────────────────

def validar(tipo: str, documento: str) -> tuple[dict | None, str | None]:
    """Los datos limpios, o el mensaje de error para el formulario.

    Boleta: el documento es opcional. Si se escribe, DNI de 8 digitos o RUC
    valido. Factura: RUC valido, sin excepcion.
    """
    tipo = (tipo or "boleta").strip().lower()
    if tipo not in TIPOS:
        tipo = "boleta"
    documento = re.sub(r"\D", "", documento or "")
    if tipo == "factura":
        if not sunat_padron.ruc_valido(documento):
            return None, "Para factura escribe un RUC válido de 11 dígitos."
    elif documento and len(documento) != 8 and not sunat_padron.ruc_valido(documento):
        return None, "El DNI tiene 8 dígitos. Si no quieres poner documento, déjalo vacío."
    return {"tipo": tipo, "documento": documento or None}, None


async def guardar_datos(usuario: dict, datos: dict, nombre: str | None = None) -> None:
    """Guarda boleta o factura y el documento de la empresa del usuario.

    Con RUC busca la razon social en el padron. Si la consulta falla se guarda
    igual: el dueno completa la razon social al emitir. Nunca bloquea una compra.
    """
    razon, direccion = (nombre or "").strip() or None, None
    if datos["documento"] and len(datos["documento"]) == 11:
        try:
            info = await sunat_padron.consultar_ruc(datos["documento"])
        except Exception:  # noqa: BLE001
            log.warning("Consulta RUC fallida al guardar datos de facturacion")
            info = None
        if info:
            razon = info.get("razon_social") or razon
            direccion = info.get("direccion")
    async with db_pg.tx(usuario) as conn:
        await conn.execute(
            "insert into datos_facturacion (company_id, tipo, documento, nombre, direccion) "
            "values ($1, $2, $3, $4, $5) "
            "on conflict (company_id) do update set tipo = $2, documento = $3, "
            "  nombre = $4, direccion = $5, actualizado_en = now()",
            db_pg.as_uuid(usuario["company_id"]), datos["tipo"], datos["documento"],
            razon, direccion)


async def datos_de(usuario: dict) -> dict | None:
    async with db_pg.tx(usuario) as conn:
        fila = await conn.fetchrow(
            "select tipo, documento, nombre, direccion from datos_facturacion "
            "where company_id = $1", db_pg.as_uuid(usuario["company_id"]))
    return dict(fila) if fila else None


async def pagos_de(usuario: dict, limite: int = 24) -> list[dict]:
    """Los cobros de la empresa, para su pantalla. Sin el PDF: solo si existe."""
    async with db_pg.tx(usuario) as conn:
        filas = await conn.fetch(
            "select id, numero, plan, monto, moneda, estado, metodo, confirmado_en, "
            "       created_at, comp_estado, comp_tipo, comp_serie, comp_numero, "
            "       comp_emitido_en, comp_pdf is not null as tiene_pdf, origen, meses "
            "  from pagos_suscripcion where company_id = $1 "
            " order by created_at desc limit $2",
            db_pg.as_uuid(usuario["company_id"]), limite)
    return db_pg.rows_to_api(filas)


async def pdf_de_la_empresa(pago_id: str, usuario: dict) -> tuple[bytes, str] | None:
    """El PDF y su nombre, solo si el cobro es de la empresa de ese usuario."""
    try:
        pid = db_pg.as_uuid(pago_id)
    except Exception:  # noqa: BLE001
        return None
    async with db_pg.tx(usuario) as conn:
        fila = await conn.fetchrow(
            "select comp_pdf, comp_serie, comp_numero from pagos_suscripcion "
            " where id = $1 and company_id = $2 and comp_estado = 'emitido' "
            "   and comp_pdf is not null",
            pid, db_pg.as_uuid(usuario["company_id"]))
    if not fila:
        return None
    return bytes(fila["comp_pdf"]), f"{fila['comp_serie']}-{fila['comp_numero']}.pdf"


# ─── Panel del dueno ─────────────────────────────────────

_COLUMNAS = """ps.id, ps.numero, ps.plan, ps.monto, ps.estado, ps.metodo,
               ps.created_at, ps.confirmado_en, ps.mp_payment_id, ps.mp_cobro_id,
               ps.comp_estado, ps.comp_tipo, ps.comp_documento, ps.comp_nombre,
               ps.comp_direccion, ps.comp_serie, ps.comp_numero,
               ps.comp_pdf is not null as tiene_pdf, ps.comp_nota, ps.comp_emitido_en,
               ps.origen, ps.meses,
               c.id as company_id, c.name as empresa, c.email as empresa_email,
               (select u.email from users u where u.company_id = c.id
                  and u.role = 'owner' order by u.created_at limit 1) as email"""
_DESDE = "from pagos_suscripcion ps join companies c on c.id = ps.company_id"


def _con_desglose(fila) -> dict:
    p = dict(fila)
    partes = desglose(p["monto"])
    p["base"], p["igv"] = partes["base"], partes["igv"]
    p["referencia"] = p.get("mp_payment_id") or "—"
    p["email"] = p.get("email") or p.get("empresa_email")
    return p


async def pendientes() -> list[dict]:
    async with db_pg.tx_global("panel del dueno: comprobantes pendientes de todas las empresas") as conn:
        filas = await conn.fetch(
            f"select {_COLUMNAS} {_DESDE} where ps.comp_estado = 'pendiente' "
            "order by coalesce(ps.confirmado_en, ps.created_at)")
    return [_con_desglose(f) for f in filas]


async def recientes(limite: int = 30) -> list[dict]:
    async with db_pg.tx_global("panel del dueno: comprobantes ya resueltos") as conn:
        filas = await conn.fetch(
            f"select {_COLUMNAS} {_DESDE} where ps.comp_estado in ('emitido', 'no_aplica') "
            "order by coalesce(ps.comp_emitido_en, ps.created_at) desc limit $1", limite)
    return [_con_desglose(f) for f in filas]


async def devueltos_con_comprobante() -> list[dict]:
    """Cobros devueltos cuyo comprobante ya se emitio: piden nota de credito."""
    async with db_pg.tx_global("panel del dueno: devoluciones con comprobante emitido") as conn:
        filas = await conn.fetch(
            f"select {_COLUMNAS} {_DESDE} where ps.estado = 'devuelto' "
            "and ps.comp_estado = 'emitido' order by ps.confirmado_en desc")
    return [_con_desglose(f) for f in filas]


def numero_valido(serie: str, numero: str) -> tuple[str, str] | None:
    serie, numero = (serie or "").strip().upper(), (numero or "").strip()
    if not _SERIE.match(serie) or not _NUMERO.match(numero):
        return None
    return serie, str(int(numero))


def es_pdf(contenido: bytes) -> bool:
    return contenido[:5] == b"%PDF-"


async def registrar(pago_id: str, serie: str, numero: str, emitido: date | None,
                    pdf: bytes | None) -> str | None:
    """Anota el comprobante emitido. None si salio bien; si no, el motivo."""
    limpio = numero_valido(serie, numero)
    if not limpio:
        return ("Serie de 4 caracteres que empiece por F o B (por ejemplo F002) "
                "y número de hasta 8 dígitos.")
    serie, numero = limpio
    if pdf is not None:
        if len(pdf) > MAX_PDF:
            return "El PDF pesa más de 5 MB."
        if not es_pdf(pdf):
            return "El archivo no es un PDF."
    try:
        pid = db_pg.as_uuid(pago_id)
    except Exception:  # noqa: BLE001
        return "Ese cobro no tiene un comprobante pendiente."

    async with db_pg.tx_global("panel del dueno: registrar un comprobante emitido") as conn:
        fila = await conn.fetchrow(
            "select comp_estado, comp_tipo from pagos_suscripcion where id = $1 for update",
            pid)
        if not fila or fila["comp_estado"] != "pendiente":
            return "Ese cobro no tiene un comprobante pendiente."
        if (fila["comp_tipo"] == "factura") != serie.startswith("F"):
            return ("La serie no corresponde: las facturas van con serie F y las "
                    "boletas con serie B.")
        ya = await conn.fetchval(
            "select id from pagos_suscripcion where comp_serie = $1 and comp_numero = $2",
            serie, numero)
        if ya:
            return f"{serie}-{numero} ya está registrado en otro cobro."
        await conn.execute(
            "update pagos_suscripcion set comp_estado = 'emitido', comp_serie = $2, "
            "  comp_numero = $3, comp_pdf = $4, "
            "  comp_emitido_en = coalesce($5::date::timestamptz, now()) "
            "where id = $1",
            pid, serie, numero, pdf, emitido)
    log.info("Comprobante %s-%s registrado para el cobro %s", serie, numero, pago_id)
    return None


async def no_aplica(pago_id: str, nota: str) -> str | None:
    nota = (nota or "").strip()
    if not nota:
        return "Escribe por qué no lleva comprobante."
    try:
        pid = db_pg.as_uuid(pago_id)
    except Exception:  # noqa: BLE001
        return "Ese cobro no tiene un comprobante pendiente."
    async with db_pg.tx_global("panel del dueno: cobro sin comprobante") as conn:
        hecho = await conn.fetchval(
            "update pagos_suscripcion set comp_estado = 'no_aplica', comp_nota = $2 "
            " where id = $1 and comp_estado = 'pendiente' returning id",
            pid, nota[:300])
    return None if hecho else "Ese cobro no tiene un comprobante pendiente."


# ─── Avisos al dueno ─────────────────────────────────────

def concepto(p: dict) -> str:
    """Lo que se vendio, para el comprobante: el mes de la suscripcion o los
    meses pagados por adelantado."""
    if p.get("origen") == "adelantado":
        meses = int(p.get("meses") or 1)
        return (f"CargoXprez plan {p['plan']}: {meses} {'mes' if meses == 1 else 'meses'} "
                f"pagados por adelantado")
    return f"Suscripción CargoXprez plan {p['plan']} (mensual)"


def _filas(p: dict) -> list[tuple[str, str]]:
    partes = desglose(p["monto"])
    tipo = "Factura" if p["comp_tipo"] == "factura" else "Boleta"
    doc = p["comp_documento"] or "sin documento"
    fecha = p["confirmado_en"] or p["created_at"]
    return [
        ("Cobro", f"#{p['numero']} · {p['referencia']} ({p['metodo']})"),
        ("Fecha del pago", fecha.strftime("%d/%m/%Y %H:%M UTC") if fecha else "—"),
        ("Comprobante", f"{tipo} · {doc}"),
        ("Cliente", p["comp_nombre"] or p["empresa"]),
        ("Dirección", p["comp_direccion"] or "—"),
        ("Correo", p["email"] or "—"),
        ("Concepto", concepto(p)),
        ("Valor de venta", f"S/ {partes['base']:.2f}"),
        ("IGV 18%", f"S/ {partes['igv']:.2f}"),
        ("Total", f"S/ {partes['total']:.2f}"),
    ]


async def avisar() -> int:
    """Avisa de los cobros nuevos y recuerda los atrasados. Devuelve cuantos.

    Un correo por cobro nuevo, con todo lo que hay que copiar. Despues, uno al
    dia mientras siga pendiente. Si el correo no sale, no se marca: se
    reintenta en la siguiente pasada.
    """
    import correo
    import plantillas_correo

    destino = (os.getenv("COMPROBANTES_AVISO_EMAIL") or "").strip()
    if not destino:
        log.warning("Sin COMPROBANTES_AVISO_EMAIL: no se avisa de comprobantes pendientes")
        return 0
    panel = os.getenv("CARGOXPREZ_URL_PUBLICA", "https://cargoxprez.sisac.pe").rstrip("/")
    async with db_pg.tx_global("aviso al dueno: comprobantes pendientes") as conn:
        filas = await conn.fetch(
            f"""select {_COLUMNAS}, ps.comp_avisado_en is null as nuevo {_DESDE}
                 where ps.comp_estado = 'pendiente'
                   and (ps.comp_avisado_en is null
                        or coalesce(ps.comp_recordado_en, ps.comp_avisado_en)
                           < now() - make_interval(hours => $1))
                 order by ps.numero""", RECORDAR_CADA_HORAS)
    enviados = 0
    for f in filas:
        p = _con_desglose(f)
        nuevo = p.pop("nuevo")
        tipo = "factura" if p["comp_tipo"] == "factura" else "boleta"
        asunto = (f"Emitir {tipo}: S/ {p['monto']:.2f} de {p['empresa']}" if nuevo
                  else f"Recordatorio: {tipo} pendiente del cobro #{p['numero']}")
        texto, cuerpo = plantillas_correo.componer(
            titulo=f"Emitir {tipo} en BSNegocios" if nuevo else f"Sigue pendiente la {tipo}",
            preencabezado=f"Cobro #{p['numero']} de S/ {p['monto']:.2f}",
            intro=["Entró un pago de CargoXprez. Estos son los datos para emitir "
                   "el comprobante:" if nuevo else
                   "Este cobro todavía no tiene comprobante registrado:"],
            filas=_filas(p),
            boton={"texto": "Registrar el comprobante", "url": f"{panel}/admin/comprobantes"},
            aviso="Después de emitirlo, registra la serie, el número y el PDF para "
                  "que el cliente lo vea en su cuenta.",
        )
        if not await correo.enviar(destino, asunto, texto, cuerpo):
            log.warning("No salio el aviso del comprobante del cobro %s", p["numero"])
            continue
        columna = "comp_avisado_en" if nuevo else "comp_recordado_en"
        async with db_pg.tx_global("aviso al dueno: marcar el aviso enviado") as conn:
            await conn.execute(
                f"update pagos_suscripcion set {columna} = now() where id = $1", p["id"])
        enviados += 1
    return enviados
