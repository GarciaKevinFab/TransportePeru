# Models package
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from enum import Enum
import uuid

# ============== ENUMS ==============
class UserRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    OPERACIONES = "operaciones"
    FLOTA = "flota"
    MANTENIMIENTO = "mantenimiento"
    ALMACEN = "almacen"
    CONTABILIDAD = "contabilidad"
    CHOFER = "chofer"

class VehicleType(str, Enum):
    TRACTO = "tracto"
    CARRETA = "carreta"

class VehicleStatus(str, Enum):
    DISPONIBLE = "disponible"
    EN_VIAJE = "en_viaje"
    EN_MANTENIMIENTO = "en_mantenimiento"
    FUERA_SERVICIO = "fuera_servicio"

class DocumentStatus(str, Enum):
    VIGENTE = "vigente"
    POR_VENCER = "por_vencer"
    VENCIDO = "vencido"
    PENDIENTE = "pendiente"
    APROBADO = "aprobado"
    OBSERVADO = "observado"
    RECHAZADO = "rechazado"

class TripStatus(str, Enum):
    PROGRAMADO = "programado"
    CHECKLIST_PENDIENTE = "checklist_pendiente"
    EN_CURSO = "en_curso"
    COMPLETADO = "completado"
    CANCELADO = "cancelado"
    LIQUIDACION_PENDIENTE = "liquidacion_pendiente"

class TireStatus(str, Enum):
    NUEVO = "nuevo"
    EN_USO = "en_uso"
    REENCAUCHE = "reencauche"
    BAJA = "baja"
    ALMACEN = "almacen"

class BlockRule(str, Enum):
    BLOQUEA_ASIGNACION = "bloquea_asignacion"
    BLOQUEA_INICIO = "bloquea_inicio"
    SOLO_ALERTA = "solo_alerta"

class ChecklistResult(str, Enum):
    PENDING = "pending"
    OK = "ok"
    OBSERVADO = "observado"
    CRITICO = "critico"

class WorkOrderType(str, Enum):
    PREVENTIVO = "preventivo"
    CORRECTIVO = "correctivo"

class WorkOrderStatus(str, Enum):
    ABIERTA = "abierta"
    EN_PROCESO = "en_proceso"
    COMPLETADA = "completada"
    CANCELADA = "cancelada"

class WorkOrderPriority(str, Enum):
    BAJA = "baja"
    NORMAL = "normal"
    ALTA = "alta"
    CRITICA = "critica"

class IssueType(str, Enum):
    INCIDENTE = "incidente"
    MULTA = "multa"
    SINIESTRO = "siniestro"
    CHECKLIST_CRITICO = "checklist_critico"
    LLANTA_CRITICA = "llanta_critica"
    OTRO = "otro"

class IssueSeverity(str, Enum):
    BAJA = "baja"
    MEDIA = "media"
    ALTA = "alta"
    CRITICA = "critica"

class IssueStatus(str, Enum):
    ABIERTO = "abierto"
    EN_PROCESO = "en_proceso"
    CERRADO = "cerrado"

class ExpenseCategory(str, Enum):
    ALIMENTACION = "alimentacion"
    HOSPEDAJE = "hospedaje"
    MOVILIDAD = "movilidad"
    PEAJES = "peajes"
    PARQUEO = "parqueo"
    COMBUSTIBLE = "combustible"
    OTROS = "otros"

class SettlementStatus(str, Enum):
    PENDIENTE = "pendiente"
    EN_REVISION = "en_revision"
    APROBADO = "aprobado"
    CERRADO = "cerrado"

class StockMoveType(str, Enum):
    ENTRADA = "entrada"
    SALIDA = "salida"
    AJUSTE = "ajuste"
    CONSUMO_OT = "consumo_ot"

# ============== BASE MODELS ==============
def gen_id():
    return str(uuid.uuid4())

def now_utc():
    return datetime.now(timezone.utc)

class Company(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    name: str
    ruc: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=lambda: {
        "lockout_minutes": 15,
        "max_failed_attempts": 5,
        "tire_critical_depth": 3,
        "tire_warning_depth": 5,
        "tire_eje_diff_threshold": 2,
        "require_checklist_for_start": True,
        "require_settlement_for_close": True,
        "allow_fuel_without_voucher": False,
        "auto_block_on_expired_docs": True,
        "auto_create_issue_on_critical_checklist": True,
        "auto_create_ot_on_critical_tire": False,
    })
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    email: Optional[str] = None
    dni: Optional[str] = None
    name: str
    role: UserRole
    password_hash: Optional[str] = None
    pin_hash: Optional[str] = None
    is_active: bool = True
    failed_attempts: int = 0
    locked_until: Optional[datetime] = None
    force_password_change: bool = False
    license_number: Optional[str] = None
    license_expiry: Optional[datetime] = None
    phone: Optional[str] = None
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
    created_by: Optional[str] = None

class Vehicle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    plate: str
    vehicle_type: VehicleType
    brand: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    vin: Optional[str] = None
    color: Optional[str] = None
    status: VehicleStatus = VehicleStatus.DISPONIBLE
    odometer: int = 0
    fuel_capacity: Optional[float] = None
    tire_config: str = "6"
    photo_url: Optional[str] = None
    hours_meter: int = 0
    last_maintenance_km: int = 0
    last_maintenance_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
    created_by: Optional[str] = None

class CouplingHistory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    tracto_id: str
    carreta_id: str
    trip_id: Optional[str] = None
    start_date: datetime = Field(default_factory=now_utc)
    end_date: Optional[datetime] = None
    created_by: Optional[str] = None

class DocumentType(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    name: str
    applies_to: str  # vehiculo, chofer, empresa
    is_critical: bool = False
    requires_expiry: bool = True
    alert_days: List[int] = Field(default_factory=lambda: [60, 30, 15, 7, 3, 1])
    block_rule: BlockRule = BlockRule.SOLO_ALERTA
    created_at: datetime = Field(default_factory=now_utc)

class Document(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    document_type_id: str
    entity_type: str
    entity_id: str
    number: Optional[str] = None
    issue_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    status: DocumentStatus = DocumentStatus.PENDIENTE
    file_url: Optional[str] = None
    notes: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
    created_by: Optional[str] = None

class Alert(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    alert_type: str
    entity_type: str
    entity_id: str
    message: str
    severity: str = "warning"
    is_read: bool = False
    resolved: bool = False
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now_utc)

class OperationalBlock(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    entity_type: str
    entity_id: str
    reason: str
    block_type: str
    document_id: Optional[str] = None
    work_order_id: Optional[str] = None
    is_active: bool = True
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolution_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=now_utc)

class Route(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    name: str
    origin: str
    destination: str
    distance_km: float
    estimated_hours: float
    toll_cost: float = 0
    fuel_estimated: Optional[float] = None
    created_at: datetime = Field(default_factory=now_utc)

class Trip(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    trip_number: Optional[str] = None
    tracto_id: str
    carreta_id: Optional[str] = None
    driver_id: str
    route_id: Optional[str] = None
    client_name: Optional[str] = None
    cargo_description: Optional[str] = None
    cargo_weight: Optional[float] = None
    status: TripStatus = TripStatus.PROGRAMADO
    scheduled_date: datetime
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    km_start: Optional[int] = None
    km_end: Optional[int] = None
    checklist_id: Optional[str] = None
    checklist_result: Optional[str] = None
    total_advance: float = 0
    total_expenses: float = 0
    settlement_id: Optional[str] = None
    settlement_status: SettlementStatus = SettlementStatus.PENDIENTE
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
    created_by: Optional[str] = None

# ============== CHECKLIST MODELS ==============
class ChecklistTemplateItem(BaseModel):
    id: str = Field(default_factory=gen_id)
    section: str  # tracto, carreta, llantas_tracto, llantas_carreta, general
    label: str
    item_type: str  # yes_no, text, photo, number
    required: bool = True
    photo_required_on_fail: bool = False
    severity: str = "normal"  # normal, observado, critico

class ChecklistTemplate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    name: str
    vehicle_type: Optional[VehicleType] = None
    items: List[ChecklistTemplateItem] = Field(default_factory=list)
    is_active: bool = True
    created_at: datetime = Field(default_factory=now_utc)
    created_by: Optional[str] = None

class ChecklistResponse(BaseModel):
    item_id: str
    value: Any
    photo_url: Optional[str] = None
    notes: Optional[str] = None

class ChecklistRun(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    template_id: str
    trip_id: str
    tracto_id: str
    carreta_id: Optional[str] = None
    driver_id: str
    responses: List[Dict[str, Any]] = Field(default_factory=list)
    tire_checks: List[Dict[str, Any]] = Field(default_factory=list)
    result: ChecklistResult = ChecklistResult.PENDING
    signature_url: Optional[str] = None
    location: Optional[Dict[str, float]] = None
    started_at: datetime = Field(default_factory=now_utc)
    completed_at: Optional[datetime] = None
    created_by: Optional[str] = None

# ============== VIATICOS MODELS ==============
class TripAdvance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    trip_id: str
    amount: float
    payment_method: str = "efectivo"
    delivered_date: datetime = Field(default_factory=now_utc)
    delivered_by: Optional[str] = None
    received_by: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=now_utc)

class TripExpense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    trip_id: str
    category: ExpenseCategory
    description: Optional[str] = None
    amount: float
    provider: Optional[str] = None
    ruc: Optional[str] = None
    has_igv: bool = False
    receipt_url: Optional[str] = None
    expense_date: datetime = Field(default_factory=now_utc)
    location: Optional[Dict[str, float]] = None
    created_at: datetime = Field(default_factory=now_utc)
    created_by: Optional[str] = None

class TripSettlement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    trip_id: str
    total_advances: float = 0
    total_expenses: float = 0
    deductions: float = 0
    deduction_notes: Optional[str] = None
    balance: float = 0
    balance_type: str = "favor_empresa"  # favor_empresa, favor_chofer
    status: SettlementStatus = SettlementStatus.PENDIENTE
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    closed_by: Optional[str] = None
    closed_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)

# ============== FUEL MODELS ==============
class FuelVoucher(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    voucher_number: str
    vehicle_id: str
    trip_id: Optional[str] = None
    driver_id: Optional[str] = None
    provider: str
    limit_amount: Optional[float] = None
    limit_liters: Optional[float] = None
    used_amount: float = 0
    used_liters: float = 0
    valid_from: datetime
    valid_until: datetime
    is_used: bool = False
    is_cancelled: bool = False
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now_utc)
    created_by: Optional[str] = None

class FuelLoad(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    vehicle_id: str
    voucher_id: Optional[str] = None
    trip_id: Optional[str] = None
    driver_id: Optional[str] = None
    liters: float
    price_per_liter: float
    total_amount: float
    odometer: int
    provider: str
    station_name: Optional[str] = None
    receipt_url: Optional[str] = None
    location: Optional[Dict[str, float]] = None
    load_date: datetime = Field(default_factory=now_utc)
    created_at: datetime = Field(default_factory=now_utc)
    created_by: Optional[str] = None

# ============== TIRE MODELS ==============
class Tire(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    serial: str
    brand: str
    model: Optional[str] = None
    dimension: str
    dot: Optional[str] = None
    purchase_cost: float = 0
    purchase_date: Optional[datetime] = None
    supplier: Optional[str] = None
    status: TireStatus = TireStatus.NUEVO
    life_number: int = 1
    current_vehicle_id: Optional[str] = None
    current_position: Optional[str] = None
    total_km: int = 0
    last_depth: Optional[float] = None
    last_pressure: Optional[float] = None
    last_inspection_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
    created_by: Optional[str] = None

class TireLifeEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    tire_id: str
    life_number: int
    event_type: str  # nueva, reencauche, reparacion, baja
    cost: float = 0
    supplier: Optional[str] = None
    notes: Optional[str] = None
    event_date: datetime = Field(default_factory=now_utc)
    created_by: Optional[str] = None

class TireMount(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    tire_id: str
    vehicle_id: str
    position_code: str
    mount_date: datetime = Field(default_factory=now_utc)
    mount_odometer: int
    unmount_date: Optional[datetime] = None
    unmount_odometer: Optional[int] = None
    unmount_reason: Optional[str] = None
    km_traveled: int = 0
    created_by: Optional[str] = None

class TireInspection(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    tire_id: str
    vehicle_id: str
    position_code: str
    depths: List[float] = Field(default_factory=list)
    avg_depth: float = 0
    min_depth: float = 0
    pressure: float = 0
    irregular_wear: bool = False
    wear_type: Optional[str] = None
    condition: str = "ok"  # ok, observado, critico
    photos: List[str] = Field(default_factory=list)
    odometer: int = 0
    notes: Optional[str] = None
    inspection_date: datetime = Field(default_factory=now_utc)
    created_by: Optional[str] = None

class TireRotation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    vehicle_id: str
    changes: List[Dict[str, str]] = Field(default_factory=list)
    reason: Optional[str] = None
    odometer: int = 0
    rotation_date: datetime = Field(default_factory=now_utc)
    created_by: Optional[str] = None

class AlignmentRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    vehicle_id: str
    axle: str
    workshop: Optional[str] = None
    cost: float = 0
    notes: Optional[str] = None
    alignment_date: datetime = Field(default_factory=now_utc)
    created_by: Optional[str] = None

# ============== MAINTENANCE MODELS ==============
class MaintenancePlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    name: str
    vehicle_type: Optional[VehicleType] = None
    component: str
    interval_km: Optional[int] = None
    interval_days: Optional[int] = None
    interval_hours: Optional[int] = None
    tasks: List[str] = Field(default_factory=list)
    estimated_cost: float = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=now_utc)

class WorkOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    order_number: str
    vehicle_id: str
    order_type: WorkOrderType
    priority: WorkOrderPriority = WorkOrderPriority.NORMAL
    status: WorkOrderStatus = WorkOrderStatus.ABIERTA
    description: str
    maintenance_plan_id: Optional[str] = None
    issue_id: Optional[str] = None
    items: List[Dict[str, Any]] = Field(default_factory=list)
    labor_cost: float = 0
    parts_cost: float = 0
    total_cost: float = 0
    workshop: Optional[str] = None
    technician: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    odometer_at_service: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
    created_by: Optional[str] = None
    closed_by: Optional[str] = None

class DowntimeRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    vehicle_id: str
    work_order_id: Optional[str] = None
    reason: str
    start_time: datetime = Field(default_factory=now_utc)
    end_time: Optional[datetime] = None
    duration_hours: float = 0
    created_by: Optional[str] = None

# ============== INVENTORY MODELS ==============
class InventoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    code: str
    name: str
    description: Optional[str] = None
    category: str
    unit: str = "unidad"
    min_stock: int = 0
    max_stock: Optional[int] = None
    current_stock: int = 0
    unit_cost: float = 0
    location: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)

class Warehouse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    name: str
    address: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=now_utc)

class StockMove(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    item_id: str
    warehouse_id: Optional[str] = None
    move_type: StockMoveType
    quantity: int
    unit_cost: float = 0
    total_cost: float = 0
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    work_order_id: Optional[str] = None
    purchase_order_id: Optional[str] = None
    notes: Optional[str] = None
    move_date: datetime = Field(default_factory=now_utc)
    created_by: Optional[str] = None

class Supplier(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    name: str
    ruc: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    contact_person: Optional[str] = None
    category: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=now_utc)

class PurchaseOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    order_number: str
    supplier_id: str
    status: str = "borrador"
    items: List[Dict[str, Any]] = Field(default_factory=list)
    subtotal: float = 0
    tax: float = 0
    total: float = 0
    notes: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    received_by: Optional[str] = None
    received_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
    created_by: Optional[str] = None

# ============== ISSUE MODEL ==============
class Issue(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    issue_number: Optional[str] = None
    trip_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    driver_id: Optional[str] = None
    checklist_id: Optional[str] = None
    tire_id: Optional[str] = None
    issue_type: IssueType
    severity: IssueSeverity = IssueSeverity.MEDIA
    status: IssueStatus = IssueStatus.ABIERTO
    title: str
    description: str
    location: Optional[Dict[str, float]] = None
    photos: List[str] = Field(default_factory=list)
    cost: float = 0
    responsible: Optional[str] = None
    resolution: Optional[str] = None
    work_order_id: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
    created_by: Optional[str] = None

# ============== AUDIT LOG ==============
class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    company_id: str
    user_id: str
    user_name: str
    action: str
    entity_type: str
    entity_id: str
    details: Dict[str, Any] = Field(default_factory=dict)
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=now_utc)
