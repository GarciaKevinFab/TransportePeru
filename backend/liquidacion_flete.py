"""
Módulo "Liquidación de Flete" — proveedores de transporte, tipos de carga,
liquidaciones por periodo y sus líneas (una línea = un viaje).

Reutiliza server.py como módulo (import server as srv) en vez de duplicar
db/auth/helpers — server.py ya está mid-ejecución cuando este archivo se
importa (al final de server.py, justo antes de app.include_router), así que
todo lo que se referencia acá vía srv.* ya existe.

Fórmulas verificadas directamente contra un Excel real de liquidación de
flete de cemento (ver plan): utilidad_neta SIEMPRE resta viáticos.
"""
import base64
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

import db_pg
import server as srv

router = APIRouter(prefix="/api")


# ============== TABLAS EN POSTGRES ==============
# Estas 4 tablas ya cortaron a Postgres: son la fuente de verdad y NO se
# escriben más en Mongo (ver db/migrations/001_corte_liquidacion_flete.sql).
# El resto de lo que este módulo consulta —companies, vehicles, fuel_loads—
# sigue en Mongo y se lee vía srv.db, que es correcto: son lecturas cruzadas
# de tablas que todavía no cortaron.
#
# El mapa {columna: tipo} cumple dos funciones: es la lista blanca de columnas
# que se pueden escribir (nada que venga del request puede agregar una) y le
# dice a db_pg cómo convertir cada valor y cuándo hace falta un cast SQL.

PROVEEDOR_COLS = {
    "id": "uuid", "company_id": "uuid", "tipo": "enum:proveedor_tipo",
    "is_tenant_self": "bool", "ruc": "text", "dni": "text", "razon_social": "text",
    "nombre_comercial": "text", "direccion": "text", "celular": "text", "email": "text",
    "banco": "text", "cuenta_corriente": "text", "cuenta_cci": "text",
    "is_active": "bool", "notes": "text",
    "created_at": "ts", "updated_at": "ts", "created_by": "uuid",
}

TIPO_CARGA_COLS = {
    "id": "uuid", "company_id": "uuid", "code": "text", "label": "text",
    "unidad_medida": "text", "is_active": "bool", "created_at": "ts",
}

LIQUIDACION_COLS = {
    "id": "uuid", "company_id": "uuid", "liquidacion_number": "text",
    "proveedor_id": "uuid", "periodo_inicio": "date", "periodo_fin": "date",
    "tipo_carga": "text", "cliente_nombre": "text",
    "status": "enum:liquidacion_flete_status",
    "total_a_cobrar": "float", "total_combustible": "float", "total_detraccion": "float",
    "total_viaticos": "float", "total_utilidad_neta": "float", "lineas_count": "int",
    "notes": "text", "reviewed_by": "uuid", "reviewed_at": "ts",
    "closed_by": "uuid", "closed_at": "ts",
    "created_at": "ts", "updated_at": "ts", "created_by": "uuid",
}

LINEA_COLS = {
    "id": "uuid", "company_id": "uuid", "liquidacion_id": "uuid",
    "trip_id": "uuid", "guia_transportista_id": "uuid", "factura_id": "uuid",
    "fuel_load_id": "uuid", "detraccion_id": "uuid",
    "guia_remitente_numero": "text", "guia_remitente_fecha": "date",
    "cantidad_bolsas": "float", "peso_total_carga": "float",
    "conductor_nombre": "text", "placa": "text", "precio_unitario": "float",
    "fecha_vale_combustible": "date", "vale_combustible_numero": "text",
    "liters": "float", "price_per_liter": "float", "pago_realizo": "text",
    "doc_guia_remitente_url": "text", "doc_ticket_unacem_url": "text",
    "doc_vale_combustible_url": "text", "doc_factura_combustible_url": "text",
    "doc_vale_entrega_url": "text",
    "total_a_cobrar": "float", "total_combustible": "float",
    "detraccion_amount": "float", "viaticos": "float", "utilidad_neta": "float",
    "notes": "text", "created_at": "ts", "updated_at": "ts", "created_by": "uuid",
}


# ============== MODELOS ==============

class ProveedorTipo(str, Enum):
    EMPRESA = "empresa"
    PERSONA_NATURAL = "persona_natural"


class Proveedor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    tipo: ProveedorTipo = ProveedorTipo.EMPRESA
    is_tenant_self: bool = False  # fila sembrada que representa a la empresa misma
    ruc: Optional[str] = None
    dni: Optional[str] = None
    razon_social: str
    nombre_comercial: Optional[str] = None
    direccion: Optional[str] = None
    celular: Optional[str] = None
    email: Optional[str] = None
    banco: Optional[str] = None
    cuenta_corriente: Optional[str] = None
    cuenta_cci: Optional[str] = None
    is_active: bool = True
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class TipoCargaConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    code: str            # "bolsa", "tonelada", futuro: "mixto", "kg", ...
    label: str
    unidad_medida: str    # "bolsa" | "tonelada" | ... — decide qué campo de cantidad usar
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LiquidacionFleteStatus(str, Enum):
    BORRADOR = "borrador"
    EN_REVISION = "en_revision"
    APROBADA = "aprobada"
    CERRADA = "cerrada"


class LiquidacionFlete(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    liquidacion_number: Optional[str] = None
    proveedor_id: str
    periodo_inicio: str
    periodo_fin: str
    tipo_carga: str
    cliente_nombre: str = "DISTRIBUIDORA CINSA"
    status: LiquidacionFleteStatus = LiquidacionFleteStatus.BORRADOR
    # Totales — siempre recalculados server-side desde las líneas
    total_a_cobrar: float = 0
    total_combustible: float = 0
    total_detraccion: float = 0
    total_viaticos: float = 0
    total_utilidad_neta: float = 0
    lineas_count: int = 0
    notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    closed_by: Optional[str] = None
    closed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class LiquidacionLinea(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    liquidacion_id: str
    trip_id: Optional[str] = None
    guia_transportista_id: Optional[str] = None
    factura_id: Optional[str] = None
    fuel_load_id: Optional[str] = None
    detraccion_id: Optional[str] = None

    guia_remitente_numero: Optional[str] = None
    guia_remitente_fecha: Optional[str] = None
    cantidad_bolsas: Optional[float] = None
    peso_total_carga: Optional[float] = None
    conductor_nombre: Optional[str] = None
    placa: Optional[str] = None
    precio_unitario: float = 0
    fecha_vale_combustible: Optional[str] = None
    vale_combustible_numero: Optional[str] = None
    liters: Optional[float] = None
    price_per_liter: Optional[float] = None
    pago_realizo: Optional[str] = None

    doc_guia_remitente_url: Optional[str] = None
    doc_ticket_unacem_url: Optional[str] = None
    doc_vale_combustible_url: Optional[str] = None
    doc_factura_combustible_url: Optional[str] = None
    doc_vale_entrega_url: Optional[str] = None

    total_a_cobrar: float = 0
    total_combustible: float = 0
    detraccion_amount: float = 0
    viaticos: float = 0
    utilidad_neta: float = 0

    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


DOCUMENTO_KINDS = {
    "guia_remitente": "doc_guia_remitente_url",
    "ticket_unacem": "doc_ticket_unacem_url",
    "vale_combustible": "doc_vale_combustible_url",
    "factura_combustible": "doc_factura_combustible_url",
    "vale_entrega": "doc_vale_entrega_url",
}


# ============== CÁLCULO (siempre server-side) ==============

def _calc_linea_total_a_cobrar(tipo_carga_code: str, cantidad_bolsas, peso_total_carga, precio_unitario) -> float:
    precio = srv._to_float(precio_unitario)
    if tipo_carga_code == "tonelada":
        return round(srv._to_float(peso_total_carga) * precio, 2)
    return round(srv._to_float(cantidad_bolsas) * precio, 2)  # default "bolsa"


def _calc_linea_total_combustible(liters, price_per_liter) -> float:
    return round(srv._to_float(liters) * srv._to_float(price_per_liter), 2)


def _calc_linea_utilidad_neta(total_a_cobrar, total_combustible, detraccion_amount, viaticos) -> float:
    # Verificado contra el Excel real: los viáticos SIEMPRE se restan.
    return round(
        srv._to_float(total_a_cobrar)
        - srv._to_float(total_combustible)
        - srv._to_float(detraccion_amount)
        - srv._to_float(viaticos),
        2,
    )


async def _recalc_linea_totales(conn, company_id: str, linea: dict) -> dict:
    """Recalcula los 5 totales de una línea a partir de sus campos base.

    `conn` es la conexión Postgres del request en curso (la liquidación ya
    cortó). fuel_loads y vehicles se siguen leyendo de Mongo porque esas
    tablas todavía no cortaron."""
    tipo_carga = await conn.fetchval(
        "select tipo_carga from liquidaciones_flete where id = $1 and company_id = $2",
        db_pg.as_uuid(linea["liquidacion_id"]), db_pg.as_uuid(company_id),
    ) or "bolsa"

    total_a_cobrar = _calc_linea_total_a_cobrar(
        tipo_carga, linea.get("cantidad_bolsas"), linea.get("peso_total_carga"), linea.get("precio_unitario")
    )

    if linea.get("fuel_load_id"):
        # Reusa la conexion que ya trae la funcion, y filtra por empresa: la
        # consulta de Mongo buscaba solo por id, sin tenant.
        total = await conn.fetchval(
            "select total_amount from fuel_loads where id = $1 and company_id = $2",
            db_pg.as_uuid(linea["fuel_load_id"]), db_pg.as_uuid(company_id),
        )
        total_combustible = srv._to_float(total) if total is not None else 0
    else:
        total_combustible = _calc_linea_total_combustible(linea.get("liters"), linea.get("price_per_liter"))

    defaults = await srv._detraccion_defaults(company_id)
    detraccion_amount = srv._calc_detraccion_amount(total_a_cobrar, defaults["rate"])

    viaticos = srv._to_float(linea.get("viaticos"))
    if not viaticos and linea.get("placa"):
        # vehicles ya corto a Postgres (migracion 006).
        async with db_pg.tx({"company_id": company_id}) as conn2:
            vehicle = db_pg.to_api(await conn2.fetchrow(
                "select viatico_fijo from vehicles where plate = $1 and company_id = $2",
                linea["placa"], db_pg.as_uuid(company_id),
            ))
        if vehicle and vehicle.get("viatico_fijo"):
            viaticos = srv._to_float(vehicle["viatico_fijo"])

    utilidad_neta = _calc_linea_utilidad_neta(total_a_cobrar, total_combustible, detraccion_amount, viaticos)

    return {
        "total_a_cobrar": total_a_cobrar,
        "total_combustible": total_combustible,
        "detraccion_amount": detraccion_amount,
        "viaticos": viaticos,
        "utilidad_neta": utilidad_neta,
    }


async def _recalc_liquidacion_totales(conn, company_id: str, liquidacion_id: str) -> None:
    """Re-suma los totales del header desde CERO a partir de todas sus líneas.

    En Mongo esto traía las 2000 líneas al proceso para sumarlas en Python;
    acá la suma la hace la base y solo viaja el resultado. El redondeo a 2
    decimales se hace en numeric y no en double precision, para que dé el
    mismo resultado que daba round() de Python y no aparezcan centavos de
    diferencia contra los datos ya migrados."""
    await conn.execute(
        """
        update liquidaciones_flete lf set
            total_a_cobrar      = t.a_cobrar,
            total_combustible   = t.combustible,
            total_detraccion    = t.detraccion,
            total_viaticos      = t.viaticos,
            total_utilidad_neta = t.utilidad,
            lineas_count        = t.n,
            updated_at          = now()
        from (
            select
                round(coalesce(sum(total_a_cobrar), 0)::numeric, 2)::double precision    as a_cobrar,
                round(coalesce(sum(total_combustible), 0)::numeric, 2)::double precision as combustible,
                round(coalesce(sum(detraccion_amount), 0)::numeric, 2)::double precision as detraccion,
                round(coalesce(sum(viaticos), 0)::numeric, 2)::double precision          as viaticos,
                round(coalesce(sum(utilidad_neta), 0)::numeric, 2)::double precision     as utilidad,
                count(*)::int                                                            as n
            from liquidacion_lineas
            where liquidacion_id = $1 and company_id = $2
        ) t
        where lf.id = $1 and lf.company_id = $2
        """,
        db_pg.as_uuid(liquidacion_id), db_pg.as_uuid(company_id),
    )


async def _next_liquidacion_number(conn, company_id: str) -> str:
    """Correlativo por empresa (LIQ-00001), mismo idioma que _next_movement_number.

    Mantiene la misma carrera que ya tenía con Mongo: dos creaciones
    simultáneas pueden calcular el mismo número. No se arregla acá para no
    mezclar el cambio de base con un cambio de comportamiento; cuando toque,
    el arreglo natural es una secuencia de Postgres por empresa."""
    last = await conn.fetchval(
        """
        select liquidacion_number from liquidaciones_flete
        where company_id = $1 and liquidacion_number is not null
        order by liquidacion_number desc limit 1
        """,
        db_pg.as_uuid(company_id),
    )
    next_num = 1
    if last:
        try:
            next_num = int(str(last).split("-")[-1]) + 1
        except (ValueError, IndexError):
            total = await conn.fetchval(
                "select count(*) from liquidaciones_flete where company_id = $1",
                db_pg.as_uuid(company_id),
            )
            next_num = total + 1
    return f"LIQ-{next_num:05d}"


def _model_to_row(model_instance) -> dict:
    """Modelo Pydantic -> dict listo para db_pg.build_insert.

    A diferencia de la versión que escribía en Mongo, los datetime se dejan
    como datetime: Postgres los quiere así, y pasarlos a string solo para
    que db_pg los vuelva a parsear sería trabajo de ida y vuelta."""
    doc = model_instance.model_dump()
    for k, v in doc.items():
        if isinstance(v, Enum):
            doc[k] = v.value
    return doc


async def _require_liquidacion_editable(conn, company_id: str, liquidacion_id: str) -> dict:
    row = await conn.fetchrow(
        "select * from liquidaciones_flete where id = $1 and company_id = $2",
        db_pg.as_uuid(liquidacion_id), db_pg.as_uuid(company_id),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Liquidación no encontrada")
    liquidacion = db_pg.to_api(row)
    if liquidacion.get("status") == LiquidacionFleteStatus.CERRADA.value:
        raise HTTPException(status_code=400, detail="Liquidación ya cerrada")
    return liquidacion


# ============== PROVEEDORES ==============

@router.get("/proveedores")
async def get_proveedores(current_user: dict = Depends(srv.get_current_user)):
    async with db_pg.tx(current_user) as conn:
        rows = await conn.fetch(
            "select * from proveedores where company_id = $1 order by razon_social limit 500",
            db_pg.as_uuid(current_user["company_id"]),
        )
    return db_pg.rows_to_api(rows)


@router.get("/proveedores/{proveedor_id}")
async def get_proveedor(proveedor_id: str, current_user: dict = Depends(srv.get_current_user)):
    async with db_pg.tx(current_user) as conn:
        row = await conn.fetchrow(
            "select * from proveedores where id = $1 and company_id = $2",
            db_pg.as_uuid(proveedor_id), db_pg.as_uuid(current_user["company_id"]),
        )
    if not row:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return db_pg.to_api(row)


@router.post("/proveedores")
async def create_proveedor(
    request: dict = Body(...),
    current_user: dict = Depends(srv.require_roles("owner", "admin", "contabilidad")),
):
    proveedor = Proveedor(company_id=current_user["company_id"], created_by=current_user["id"], **request)
    sql, values = db_pg.build_insert("proveedores", PROVEEDOR_COLS, _model_to_row(proveedor))
    async with db_pg.tx(current_user) as conn:
        await conn.execute(sql, *values)
    return {"id": proveedor.id, "message": "Proveedor creado"}


@router.put("/proveedores/{proveedor_id}")
async def update_proveedor(
    proveedor_id: str,
    request: dict = Body(...),
    current_user: dict = Depends(srv.require_roles("owner", "admin", "contabilidad")),
):
    update_data = {k: v for k, v in request.items() if k not in ("id", "company_id", "created_at", "created_by")}
    update_data["updated_at"] = datetime.now(timezone.utc)
    update_data["id"] = proveedor_id
    update_data["company_id"] = current_user["company_id"]
    async with db_pg.tx(current_user) as conn:
        existe = await conn.fetchval(
            "select 1 from proveedores where id = $1 and company_id = $2",
            db_pg.as_uuid(proveedor_id), db_pg.as_uuid(current_user["company_id"]),
        )
        if not existe:
            raise HTTPException(status_code=404, detail="Proveedor no encontrado")
        sql, values = db_pg.build_update("proveedores", PROVEEDOR_COLS, update_data, ["id", "company_id"])
        if sql:
            await conn.execute(sql, *values)
    return {"message": "Proveedor actualizado"}


@router.delete("/proveedores/{proveedor_id}")
async def deactivate_proveedor(
    proveedor_id: str, current_user: dict = Depends(srv.require_roles("owner", "admin"))
):
    async with db_pg.tx(current_user) as conn:
        row = await conn.fetchrow(
            "select is_tenant_self from proveedores where id = $1 and company_id = $2",
            db_pg.as_uuid(proveedor_id), db_pg.as_uuid(current_user["company_id"]),
        )
        if not row:
            raise HTTPException(status_code=404, detail="Proveedor no encontrado")
        if row["is_tenant_self"]:
            raise HTTPException(status_code=400, detail="No se puede desactivar el proveedor de la empresa misma")
        await conn.execute(
            "update proveedores set is_active = false, updated_at = now() where id = $1 and company_id = $2",
            db_pg.as_uuid(proveedor_id), db_pg.as_uuid(current_user["company_id"]),
        )
    return {"message": "Proveedor desactivado"}


# ============== TIPOS DE CARGA ==============

@router.get("/tipos-carga")
async def get_tipos_carga(current_user: dict = Depends(srv.get_current_user)):
    # order by created_at: con Mongo el orden era el natural de la colección
    # (no garantizado). Fijarlo evita que la lista se reordene sola entre
    # llamadas y el <select> del frontend baile.
    async with db_pg.tx(current_user) as conn:
        rows = await conn.fetch(
            "select * from tipos_carga where company_id = $1 and is_active order by created_at limit 50",
            db_pg.as_uuid(current_user["company_id"]),
        )
    return db_pg.rows_to_api(rows)


@router.post("/tipos-carga")
async def create_tipo_carga(
    request: dict = Body(...), current_user: dict = Depends(srv.require_roles("owner", "admin"))
):
    tipo = TipoCargaConfig(company_id=current_user["company_id"], **request)
    sql, values = db_pg.build_insert("tipos_carga", TIPO_CARGA_COLS, _model_to_row(tipo))
    async with db_pg.tx(current_user) as conn:
        await conn.execute(sql, *values)
    return {"id": tipo.id, "message": "Tipo de carga creado"}


@router.put("/tipos-carga/{tipo_id}")
async def update_tipo_carga(
    tipo_id: str, request: dict = Body(...), current_user: dict = Depends(srv.require_roles("owner", "admin"))
):
    update_data = {k: v for k, v in request.items() if k not in ("id", "company_id", "created_at")}
    update_data["id"] = tipo_id
    update_data["company_id"] = current_user["company_id"]
    async with db_pg.tx(current_user) as conn:
        existe = await conn.fetchval(
            "select 1 from tipos_carga where id = $1 and company_id = $2",
            db_pg.as_uuid(tipo_id), db_pg.as_uuid(current_user["company_id"]),
        )
        if not existe:
            raise HTTPException(status_code=404, detail="Tipo de carga no encontrado")
        sql, values = db_pg.build_update("tipos_carga", TIPO_CARGA_COLS, update_data, ["id", "company_id"])
        if sql:
            await conn.execute(sql, *values)
    return {"message": "Tipo de carga actualizado"}

# ============== LIQUIDACIONES DE FLETE ==============

async def _validar_referencias_liquidacion(conn, company_id: str, proveedor_id, tipo_carga):
    """Comprueba proveedor y tipo de carga ANTES del insert.

    Las dos FK que siguen vivas tras el corte son (proveedor_id) y la
    compuesta (company_id, tipo_carga). Sin este chequeo, un valor inválido
    lo atajaría Postgres con un error de FK, que el cliente vería como un 500
    en vez del 400 con mensaje que veía hasta ahora."""
    if not await conn.fetchval(
        "select 1 from proveedores where id = $1 and company_id = $2",
        db_pg.as_uuid(proveedor_id), db_pg.as_uuid(company_id),
    ):
        raise HTTPException(status_code=400, detail="Proveedor no encontrado")
    if not await conn.fetchval(
        "select 1 from tipos_carga where company_id = $1 and code = $2",
        db_pg.as_uuid(company_id), str(tipo_carga or ""),
    ):
        raise HTTPException(status_code=400, detail="Tipo de carga no encontrado")


@router.get("/liquidaciones-flete")
async def get_liquidaciones_flete(
    proveedor_id: Optional[str] = None,
    status: Optional[str] = None,
    tipo_carga: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(srv.get_current_user),
):
    conds = ["company_id = $1"]
    values = [db_pg.as_uuid(current_user["company_id"])]

    def agregar(plantilla: str, valor):
        values.append(valor)
        conds.append(plantilla.replace("?", str(len(values))))

    if proveedor_id:
        agregar("proveedor_id = $?", db_pg.as_uuid(proveedor_id))
    if status:
        # Un status fuera del enum reventaría el cast en Postgres; con Mongo
        # simplemente no casaba con nada. Se conserva esa forma: lista vacía.
        if status not in [e.value for e in LiquidacionFleteStatus]:
            return []
        agregar("status = $?::liquidacion_flete_status", status)
    if tipo_carga:
        agregar("tipo_carga = $?", tipo_carga)
    # periodo_inicio ya es una columna date, así que el rango se compara como
    # fecha. Se cae el truco de pegarle T23:59:59 al límite superior, que
    # existía solo porque en Mongo se comparaban strings ISO.
    if date_from:
        agregar("periodo_inicio >= $?", db_pg.as_date(date_from))
    if date_to:
        agregar("periodo_inicio <= $?", db_pg.as_date(date_to))

    sql = (
        "select * from liquidaciones_flete where " + " and ".join(conds)
        + " order by created_at desc limit 500"
    )
    async with db_pg.tx(current_user) as conn:
        rows = await conn.fetch(sql, *values)
    return db_pg.rows_to_api(rows)


@router.get("/liquidaciones-flete/{liquidacion_id}")
async def get_liquidacion_flete(liquidacion_id: str, current_user: dict = Depends(srv.get_current_user)):
    async with db_pg.tx(current_user) as conn:
        row = await conn.fetchrow(
            "select * from liquidaciones_flete where id = $1 and company_id = $2",
            db_pg.as_uuid(liquidacion_id), db_pg.as_uuid(current_user["company_id"]),
        )
    if not row:
        raise HTTPException(status_code=404, detail="Liquidación no encontrada")
    return db_pg.to_api(row)


@router.get("/liquidaciones-flete/{liquidacion_id}/lineas")
async def get_liquidacion_lineas(liquidacion_id: str, current_user: dict = Depends(srv.get_current_user)):
    async with db_pg.tx(current_user) as conn:
        rows = await conn.fetch(
            "select * from liquidacion_lineas where liquidacion_id = $1 and company_id = $2 order by created_at limit 2000",
            db_pg.as_uuid(liquidacion_id), db_pg.as_uuid(current_user["company_id"]),
        )
    return db_pg.rows_to_api(rows)

@router.post("/liquidaciones-flete")
async def create_liquidacion_flete(
    request: dict = Body(...),
    current_user: dict = Depends(srv.require_roles("owner", "admin", "contabilidad")),
):
    company_id = current_user["company_id"]
    async with db_pg.tx(current_user) as conn:
        await _validar_referencias_liquidacion(
            conn, company_id, request.get("proveedor_id"), request.get("tipo_carga")
        )
        liquidacion = LiquidacionFlete(
            company_id=company_id,
            liquidacion_number=await _next_liquidacion_number(conn, company_id),
            created_by=current_user["id"],
            **{k: v for k, v in request.items() if k not in ("company_id", "liquidacion_number", "created_by")},
        )
        data = _model_to_row(liquidacion)
        # periodo_inicio/fin son NOT NULL date: una fecha ilegible terminaría
        # en un error de NOT NULL (500). Se atrapa acá para devolver 400.
        for campo in ("periodo_inicio", "periodo_fin"):
            if db_pg.as_date(data.get(campo)) is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"{campo} inválida (formato esperado YYYY-MM-DD)",
                )
        sql, values = db_pg.build_insert("liquidaciones_flete", LIQUIDACION_COLS, data)
        await conn.execute(sql, *values)
    return {
        "id": liquidacion.id,
        "liquidacion_number": liquidacion.liquidacion_number,
        "message": "Liquidación creada",
    }


@router.put("/liquidaciones-flete/{liquidacion_id}")
async def update_liquidacion_flete(
    liquidacion_id: str,
    request: dict = Body(...),
    current_user: dict = Depends(srv.require_roles("owner", "admin", "contabilidad")),
):
    company_id = current_user["company_id"]
    editable_fields = (
        "proveedor_id", "periodo_inicio", "periodo_fin", "tipo_carga",
        "cliente_nombre", "notes", "status",
    )
    update_data = {k: v for k, v in request.items() if k in editable_fields}
    update_data["updated_at"] = datetime.now(timezone.utc)
    update_data["id"] = liquidacion_id
    update_data["company_id"] = company_id
    async with db_pg.tx(current_user) as conn:
        actual = await _require_liquidacion_editable(conn, company_id, liquidacion_id)
        if "proveedor_id" in update_data or "tipo_carga" in update_data:
            await _validar_referencias_liquidacion(
                conn, company_id,
                update_data.get("proveedor_id", actual["proveedor_id"]),
                update_data.get("tipo_carga", actual["tipo_carga"]),
            )
        sql, values = db_pg.build_update(
            "liquidaciones_flete", LIQUIDACION_COLS, update_data, ["id", "company_id"]
        )
        if sql:
            await conn.execute(sql, *values)
    return {"message": "Liquidación actualizada"}


@router.post("/liquidaciones-flete/{liquidacion_id}/close")
async def close_liquidacion_flete(
    liquidacion_id: str,
    current_user: dict = Depends(srv.require_roles("owner", "admin", "contabilidad")),
):
    async with db_pg.tx(current_user) as conn:
        await _require_liquidacion_editable(conn, current_user["company_id"], liquidacion_id)
        await conn.execute(
            "update liquidaciones_flete set status = $1::liquidacion_flete_status, "
            "closed_by = $2, closed_at = now(), updated_at = now() "
            "where id = $3 and company_id = $4",
            LiquidacionFleteStatus.CERRADA.value,
            db_pg.as_uuid(current_user["id"]),
            db_pg.as_uuid(liquidacion_id),
            db_pg.as_uuid(current_user["company_id"]),
        )
    return {"message": "Liquidación cerrada"}


@router.delete("/liquidaciones-flete/{liquidacion_id}")
async def delete_liquidacion_flete(
    liquidacion_id: str, current_user: dict = Depends(srv.require_roles("owner", "admin"))
):
    async with db_pg.tx(current_user) as conn:
        row = await conn.fetchrow(
            "select status, lineas_count from liquidaciones_flete where id = $1 and company_id = $2",
            db_pg.as_uuid(liquidacion_id), db_pg.as_uuid(current_user["company_id"]),
        )
        if not row:
            raise HTTPException(status_code=404, detail="Liquidación no encontrada")
        if row["status"] != LiquidacionFleteStatus.BORRADOR.value or (row["lineas_count"] or 0) > 0:
            raise HTTPException(
                status_code=400,
                detail="Solo se puede eliminar una liquidación en borrador y sin líneas",
            )
        await conn.execute(
            "delete from liquidaciones_flete where id = $1 and company_id = $2",
            db_pg.as_uuid(liquidacion_id), db_pg.as_uuid(current_user["company_id"]),
        )
    return {"message": "Liquidación eliminada"}

# ============== LÍNEAS DE LIQUIDACIÓN ==============

@router.get("/liquidacion-lineas/{linea_id}")
async def get_liquidacion_linea(linea_id: str, current_user: dict = Depends(srv.get_current_user)):
    async with db_pg.tx(current_user) as conn:
        row = await conn.fetchrow(
            "select * from liquidacion_lineas where id = $1 and company_id = $2",
            db_pg.as_uuid(linea_id), db_pg.as_uuid(current_user["company_id"]),
        )
    if not row:
        raise HTTPException(status_code=404, detail="Línea no encontrada")
    return db_pg.to_api(row)


@router.post("/liquidaciones-flete/{liquidacion_id}/lineas")
async def create_liquidacion_linea(
    liquidacion_id: str,
    request: dict = Body(...),
    current_user: dict = Depends(srv.require_roles("owner", "admin", "contabilidad", "operaciones")),
):
    company_id = current_user["company_id"]
    # Todo en UNA transacción: si el recálculo de los totales del header
    # fallara después de insertar la línea, con Mongo quedaba una línea
    # huérfana y un header desincronizado. Acá o entran las dos cosas o
    # ninguna.
    async with db_pg.tx(current_user) as conn:
        await _require_liquidacion_editable(conn, company_id, liquidacion_id)
        linea = LiquidacionLinea(
            company_id=company_id,
            liquidacion_id=liquidacion_id,
            created_by=current_user["id"],
            **{k: v for k, v in request.items() if k not in ("company_id", "liquidacion_id", "created_by")},
        )
        data = _model_to_row(linea)
        data.update(await _recalc_linea_totales(conn, company_id, data))
        sql, values = db_pg.build_insert("liquidacion_lineas", LINEA_COLS, data)
        await conn.execute(sql, *values)
        await _recalc_liquidacion_totales(conn, company_id, liquidacion_id)
    return {"id": linea.id, "message": "Línea creada"}


@router.put("/liquidacion-lineas/{linea_id}")
async def update_liquidacion_linea(
    linea_id: str,
    request: dict = Body(...),
    current_user: dict = Depends(srv.require_roles("owner", "admin", "contabilidad", "operaciones")),
):
    company_id = current_user["company_id"]
    async with db_pg.tx(current_user) as conn:
        row = await conn.fetchrow(
            "select * from liquidacion_lineas where id = $1 and company_id = $2",
            db_pg.as_uuid(linea_id), db_pg.as_uuid(company_id),
        )
        if not row:
            raise HTTPException(status_code=404, detail="Línea no encontrada")
        existing = db_pg.to_api(row)
        await _require_liquidacion_editable(conn, company_id, existing["liquidacion_id"])

        update_data = {
            k: v
            for k, v in request.items()
            if k not in ("id", "company_id", "liquidacion_id", "created_at", "created_by")
        }
        merged = {**existing, **update_data}
        merged.update(await _recalc_linea_totales(conn, company_id, merged))
        merged["updated_at"] = datetime.now(timezone.utc)
        # created_at/created_by salen del dict: vienen de `existing` y
        # reescribirlos con su mismo valor solo ensucia el UPDATE.
        merged.pop("created_at", None)
        merged.pop("created_by", None)
        sql, values = db_pg.build_update(
            "liquidacion_lineas", LINEA_COLS, merged, ["id", "company_id"]
        )
        if sql:
            await conn.execute(sql, *values)
        await _recalc_liquidacion_totales(conn, company_id, existing["liquidacion_id"])
    return {"message": "Línea actualizada"}

@router.delete("/liquidacion-lineas/{linea_id}")
async def delete_liquidacion_linea(
    linea_id: str, current_user: dict = Depends(srv.require_roles("owner", "admin"))
):
    company_id = current_user["company_id"]
    async with db_pg.tx(current_user) as conn:
        liquidacion_id = await conn.fetchval(
            "select liquidacion_id from liquidacion_lineas where id = $1 and company_id = $2",
            db_pg.as_uuid(linea_id), db_pg.as_uuid(company_id),
        )
        if not liquidacion_id:
            raise HTTPException(status_code=404, detail="Línea no encontrada")
        await _require_liquidacion_editable(conn, company_id, str(liquidacion_id))
        await conn.execute(
            "delete from liquidacion_lineas where id = $1 and company_id = $2",
            db_pg.as_uuid(linea_id), db_pg.as_uuid(company_id),
        )
        await _recalc_liquidacion_totales(conn, company_id, str(liquidacion_id))
    return {"message": "Línea eliminada"}


@router.post("/liquidacion-lineas/{linea_id}/documento")
async def attach_documento(
    linea_id: str,
    request: dict = Body(...),
    current_user: dict = Depends(srv.require_roles("owner", "admin", "contabilidad", "operaciones")),
):
    """Adjunta un documento (guía remitente, ticket UNACEM, vale/factura de
    combustible, vale de entrega) a una línea, vía el mismo contrato base64
    que /upload/base64."""
    company_id = current_user["company_id"]

    kind = request.get("kind")
    field = DOCUMENTO_KINDS.get(kind)
    if not field:
        raise HTTPException(
            status_code=400, detail=f"kind inválido. Debe ser uno de: {chr(44).join(DOCUMENTO_KINDS)}"
        )

    data = request.get("data", "")
    if "base64," in data:
        data = data.split("base64,")[1]

    try:
        file_content = base64.b64decode(data)
    except Exception:
        raise HTTPException(status_code=400, detail="Datos base64 inválidos")

    ext = "pdf" if kind == "guia_remitente" else "jpg"
    content_type = "application/pdf" if ext == "pdf" else "image/jpeg"

    async with db_pg.tx(current_user) as conn:
        liquidacion_id = await conn.fetchval(
            "select liquidacion_id from liquidacion_lineas where id = $1 and company_id = $2",
            db_pg.as_uuid(linea_id), db_pg.as_uuid(company_id),
        )
        if not liquidacion_id:
            raise HTTPException(status_code=404, detail="Línea no encontrada")
        await _require_liquidacion_editable(conn, company_id, str(liquidacion_id))

        # La subida va DENTRO de la transacción a propósito: si falla, no se
        # guarda una URL que apunte a un archivo que nunca se escribió.
        result = await srv.save_uploaded_content(
            file_content, "liquidacion_linea", linea_id, content_type, ext
        )

        # `field` sale de DOCUMENTO_KINDS (código), no del request, y además
        # pasa por la lista blanca LINEA_COLS.
        sql, values = db_pg.build_update(
            "liquidacion_lineas",
            LINEA_COLS,
            {
                field: result["url"],
                "updated_at": datetime.now(timezone.utc),
                "id": linea_id,
                "company_id": company_id,
            },
            ["id", "company_id"],
        )
        await conn.execute(sql, *values)
    return {"url": result["url"], "message": "Documento adjuntado"}

# ============== OCR GENERALIZADO (Fase 2) ==============
# Mismo patrón que POST /fuel/ocr (server.py:5108) pero multi-documento y con
# clasificación automática. No toca /fuel/ocr — endpoint independiente.

_OCR_PROMPTS = {
    "guia_remitente": """Eres un asistente especializado en leer guías de remisión electrónica peruanas
(remitente). Extrae la siguiente información en formato JSON:
{
    "numero": "número de la guía, ej. EG07-00015087",
    "fecha_emision": "fecha en formato YYYY-MM-DD si es visible",
    "remitente_razon_social": "razón social del remitente",
    "destinatario_razon_social": "razón social del destinatario/transportista",
    "punto_partida": "dirección o lugar de partida",
    "punto_llegada": "dirección o lugar de llegada",
    "descripcion_carga": "descripción de la carga",
    "peso_bruto": número si es visible (solo número),
    "cantidad_bultos": número de bultos/bolsas si es visible (solo número)
}
Si algún campo no es legible o no aparece, devuelve null para ese campo.
Devuelve SOLO el JSON sin explicaciones adicionales.""",
    "ticket_unacem": """Eres un asistente especializado en leer tickets de pesaje/despacho de planta
cementera (UNACEM) peruanos. Extrae la siguiente información en formato JSON:
{
    "ticket_numero": "número de ticket o de salida",
    "fecha": "fecha en formato YYYY-MM-DD si es visible",
    "turno": "turno de despacho si aparece",
    "placa": "placa del vehículo",
    "conductor_nombre": "nombre del conductor",
    "producto": "producto despachado (ej. cemento embolsado, tipo)",
    "peso_neto_kg": número (solo número) si es visible,
    "cantidad_bolsas": número de bolsas si es visible (solo número)
}
Si algún campo no es legible o no aparece, devuelve null para ese campo.
Devuelve SOLO el JSON sin explicaciones adicionales.""",
    "vale_combustible": """Eres un asistente especializado en extraer datos de vales y recibos de
combustible peruanos. Analiza la imagen y extrae la siguiente información en formato JSON:
{
    "voucher_number": "número del vale o comprobante",
    "provider": "nombre del grifo/estación de servicio",
    "liters": número de litros (solo número),
    "price_per_liter": precio por litro (solo número),
    "total_amount": monto total (solo número),
    "date": "fecha en formato YYYY-MM-DD si es visible",
    "vehicle_plate": "placa del vehículo si aparece",
    "odometer": número del odómetro si aparece (solo número),
    "fuel_type": "tipo de combustible (diesel, gasolina, etc)"
}
Si algún campo no es legible o no aparece, devuelve null para ese campo.
Devuelve SOLO el JSON sin explicaciones adicionales.""",
    "factura_combustible": """Eres un asistente especializado en leer facturas/boletas electrónicas
peruanas de grifos (venta de combustible). Extrae la siguiente información en formato JSON:
{
    "numero": "serie-número, ej. F112-00091904",
    "fecha_emision": "fecha en formato YYYY-MM-DD si es visible",
    "emisor_razon_social": "razón social del grifo/emisor",
    "emisor_ruc": "RUC del emisor si aparece",
    "subtotal": número (solo número) si es visible,
    "igv": número (solo número) si es visible,
    "total": número (solo número),
    "forma_pago": "efectivo, tarjeta, etc si aparece"
}
Si algún campo no es legible o no aparece, devuelve null para ese campo.
Devuelve SOLO el JSON sin explicaciones adicionales.""",
    "vale_entrega": """Eres un asistente especializado en leer vales de entrega manuscritos peruanos.
Extrae la siguiente información en formato JSON:
{
    "numero": "número del vale si aparece",
    "descripcion": "descripción del gasto/entrega",
    "importe": número (solo número),
    "fecha": "fecha en formato YYYY-MM-DD si es visible"
}
Algunos campos pueden ser manuscritos y difíciles de leer — si no estás seguro, devuelve null
en vez de adivinar. Devuelve SOLO el JSON sin explicaciones adicionales.""",
}

_OCR_CLASSIFY_PROMPT = """¿Qué tipo de documento de transporte de carga peruano es esta imagen?
Responde SOLO con un JSON: {"detected_kind": "guia_remitente"|"ticket_unacem"|"vale_combustible"|"factura_combustible"|"vale_entrega"|"unknown", "confidence": "alta"|"media"|"baja"}
Guía: guia_remitente = guía de remisión electrónica (con QR y datos de traslado);
ticket_unacem = ticket de pesaje/despacho de una planta cementera; vale_combustible = vale/recibo
de un grifo con litros y precio por litro; factura_combustible = factura/boleta electrónica de un
grifo con IGV/total; vale_entrega = nota manuscrita de entrega. Si no calza claramente en ninguno,
usa "unknown" con confidence "baja"."""


def _clean_json_response(response_text: str) -> dict:
    """Limpia fences ```json``` y parsea — mismo idioma que /fuel/ocr (server.py:5160-5179)."""
    import json
    import re as _re

    cleaned = (response_text or "").strip()
    if cleaned.startswith("```"):
        cleaned = _re.sub(r'^```(?:json)?\n?', '', cleaned)
        cleaned = _re.sub(r'\n?```$', '', cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = _re.search(r'\{.*\}', cleaned, _re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return {"raw_response": response_text, "parse_error": True}


async def extract_document_fields(file_bytes: bytes, mime_type: str, document_kind: str) -> dict:
    """Clasifica (si document_kind == "auto") y extrae campos de un documento de
    liquidación de flete usando Gemini Vision — mismo patrón que /fuel/ocr
    (server.py:5108-5190), generalizado a mime_type variable (soporta PDF para
    guía remitente) y a múltiples tipos de documento.

    Retorna {"detected_kind": str, "confidence": "alta"|"media"|"baja"|None, "extracted_data": dict}
    """
    from google import genai

    api_key = srv.os.environ.get("GOOGLE_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="API key no configurada")

    client = genai.Client(api_key=api_key)
    encoded = base64.b64encode(file_bytes).decode()
    detected_kind = document_kind
    confidence = None

    if document_kind == "auto" or document_kind not in _OCR_PROMPTS:
        classify_result = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                {"role": "user", "parts": [
                    {"text": _OCR_CLASSIFY_PROMPT},
                    {"inline_data": {"mime_type": mime_type, "data": encoded}},
                ]}
            ],
        )
        classification = _clean_json_response(classify_result.text)
        detected_kind = classification.get("detected_kind", "unknown")
        confidence = classification.get("confidence", "baja")

        if detected_kind not in _OCR_PROMPTS:
            return {"detected_kind": detected_kind, "confidence": confidence, "extracted_data": {}}

    prompt = _OCR_PROMPTS[detected_kind]
    result = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            {"role": "user", "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": mime_type, "data": encoded}},
            ]}
        ],
    )
    extracted_data = _clean_json_response(result.text)

    return {"detected_kind": detected_kind, "confidence": confidence, "extracted_data": extracted_data}


@router.post("/documentos/ocr")
async def ocr_documento(request: dict = Body(...), current_user: dict = Depends(srv.get_current_user)):
    """Extrae campos de un documento (foto o PDF) sin escribir nada — mismo contrato
    de solo-lectura que /fuel/ocr. El caller (frontend/admin) decide si aplica los
    datos a una LiquidacionLinea."""
    data = request.get("data", "")
    kind = request.get("kind", "auto")

    mime_type = "image/jpeg"
    if "data:" in data and ";base64," in data:
        mime_type = data.split("data:")[1].split(";base64,")[0] or mime_type
    if "base64," in data:
        data = data.split("base64,")[1]

    try:
        file_bytes = base64.b64decode(data)
    except Exception:
        raise HTTPException(status_code=400, detail="Datos base64 inválidos")

    if len(file_bytes) > srv.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="Archivo demasiado grande")

    try:
        result = await extract_document_fields(file_bytes, mime_type, kind)
    except ImportError:
        raise HTTPException(status_code=500, detail="Módulo de IA no disponible")
    except HTTPException:
        raise
    except Exception as e:
        srv.logging.error(f"OCR liquidación error: {e}")
        raise HTTPException(status_code=500, detail=f"Error al procesar documento: {e}")

    return {"success": True, **result}


# ============== SEED (proveedor propio de la empresa + tipos de carga por defecto) ==============

@srv.app.on_event("startup")
async def ensure_default_liquidacion_flete_config():
    """Siembra, por cada empresa existente, un Proveedor is_tenant_self y los
    TipoCargaConfig por defecto (bolsa, tonelada) — idempotente, mismo patrón
    que ensure_default_document_types en server.py.

    Las empresas se leen de Mongo (companies no ha cortado todavía) y los
    proveedores/tipos de carga se escriben en Postgres (esos sí cortaron).
    Una transacción por empresa: si una falla, no arrastra a las demás."""
    try:
        companies = await srv.db.companies.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(length=None)
        for comp in companies:
            cid = comp.get("id")
            if not cid:
                continue

            # Usuario sintético: en el arranque no hay request ni JWT, pero el
            # contexto de empresa igual hay que fijarlo o RLS no deja ver nada.
            ctx = {"company_id": cid}
            async with db_pg.tx(ctx) as conn:
                tiene_tenant = await conn.fetchval(
                    "select 1 from proveedores where company_id = $1 and is_tenant_self",
                    db_pg.as_uuid(cid),
                )
                if not tiene_tenant:
                    proveedor = Proveedor(
                        company_id=cid,
                        tipo=ProveedorTipo.EMPRESA,
                        is_tenant_self=True,
                        razon_social=comp.get("name") or "Empresa",
                    )
                    sql, values = db_pg.build_insert(
                        "proveedores", PROVEEDOR_COLS, _model_to_row(proveedor)
                    )
                    await conn.execute(sql, *values)

                for code, label, unidad in (
                    ("bolsa", "Embolsado (por bolsa)", "bolsa"),
                    ("tonelada", "Big Bag (por tonelada)", "tonelada"),
                ):
                    existe = await conn.fetchval(
                        "select 1 from tipos_carga where company_id = $1 and code = $2",
                        db_pg.as_uuid(cid), code,
                    )
                    if existe:
                        continue
                    tipo = TipoCargaConfig(
                        company_id=cid, code=code, label=label, unidad_medida=unidad
                    )
                    sql, values = db_pg.build_insert(
                        "tipos_carga", TIPO_CARGA_COLS, _model_to_row(tipo)
                    )
                    await conn.execute(sql, *values)

        srv.logger.info("Proveedores/tipos de carga por defecto verificados/creados")
    except Exception as e:
        srv.logger.error(f"Error sembrando config de liquidación de flete: {e}")
