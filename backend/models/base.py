"""Base models and enums for TransportePeru SaaS"""
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
    EN_CURSO = "en_curso"
    COMPLETADO = "completado"
    CANCELADO = "cancelado"


class TireStatus(str, Enum):
    NUEVO = "nuevo"
    EN_USO = "en_uso"
    REENCAUCHE = "reencauche"
    BAJA = "baja"
    ALMACEN = "almacen"


class ChecklistResult(str, Enum):
    PENDING = "pending"
    OK = "ok"
    OBSERVADO = "observado"
    CRITICO = "critico"


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


class BlockRule(str, Enum):
    BLOQUEA_ASIGNACION = "bloquea_asignacion"
    BLOQUEA_INICIO = "bloquea_inicio"
    SOLO_ALERTA = "solo_alerta"


# ============== BASE MODELS ==============
class Company(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    ruc: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class Vehicle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class CouplingHistory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    tracto_id: str
    carreta_id: str
    trip_id: Optional[str] = None
    start_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    end_date: Optional[datetime] = None
    created_by: Optional[str] = None


class DocumentType(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    name: str
    applies_to: str
    is_critical: bool = False
    requires_expiry: bool = True
    alert_days: List[int] = Field(default_factory=lambda: [60, 30, 15, 7, 3, 1])
    block_rule: BlockRule = BlockRule.SOLO_ALERTA
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Document(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class Alert(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    alert_type: str
    entity_type: str
    entity_id: str
    message: str
    severity: str = "warning"
    is_read: bool = False
    resolved: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OperationalBlock(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    entity_type: str
    entity_id: str
    reason: str
    block_type: str
    document_id: Optional[str] = None
    is_active: bool = True
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Route(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    name: str
    origin: str
    destination: str
    distance_km: float
    estimated_hours: float
    toll_cost: float = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Trip(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
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
    checklist_approved: bool = False
    total_advance: float = 0
    total_expenses: float = 0
    settlement_status: str = "pending"
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class TripAdvance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    trip_id: str
    amount: float
    payment_method: str
    delivered_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    delivered_by: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TripExpense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    trip_id: str
    category: str
    description: Optional[str] = None
    amount: float
    provider: Optional[str] = None
    ruc: Optional[str] = None
    has_igv: bool = False
    receipt_url: Optional[str] = None
    expense_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class Tire(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    serial: str
    brand: str
    model: Optional[str] = None
    dimension: str
    purchase_cost: float = 0
    purchase_date: Optional[datetime] = None
    supplier: Optional[str] = None
    status: TireStatus = TireStatus.NUEVO
    life_number: int = 1
    current_vehicle_id: Optional[str] = None
    current_position: Optional[str] = None
    total_km: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TireMount(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    tire_id: str
    vehicle_id: str
    position_code: str
    mount_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    mount_odometer: int
    unmount_date: Optional[datetime] = None
    unmount_odometer: Optional[int] = None
    reason: Optional[str] = None
    created_by: Optional[str] = None


class TireInspection(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    tire_id: str
    vehicle_id: str
    position_code: str
    depths: List[float] = Field(default_factory=list)
    pressure: float
    irregular_wear: bool = False
    wear_type: Optional[str] = None
    photos: List[str] = Field(default_factory=list)
    odometer: int
    notes: Optional[str] = None
    inspection_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class FuelVoucher(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    vehicle_id: str
    trip_id: Optional[str] = None
    voucher_number: str
    provider: str
    limit_amount: Optional[float] = None
    limit_liters: Optional[float] = None
    valid_from: datetime
    valid_until: datetime
    is_used: bool = False
    approved_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FuelLoad(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    vehicle_id: str
    voucher_id: Optional[str] = None
    trip_id: Optional[str] = None
    liters: float
    price_per_liter: float
    total_amount: float
    odometer: int
    provider: str
    receipt_url: Optional[str] = None
    location: Optional[Dict[str, float]] = None
    load_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class MaintenancePlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    name: str
    vehicle_type: VehicleType
    component: str
    interval_km: Optional[int] = None
    interval_days: Optional[int] = None
    interval_hours: Optional[int] = None
    tasks: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class WorkOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    order_number: str
    vehicle_id: str
    order_type: str
    priority: str = "normal"
    status: str = "abierta"
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    closed_by: Optional[str] = None


class Issue(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    issue_number: Optional[str] = None
    trip_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    driver_id: Optional[str] = None
    checklist_id: Optional[str] = None
    tire_id: Optional[str] = None
    issue_type: str
    severity: str = "media"
    status: str = "abierto"
    title: str = ""
    description: str
    location: Optional[Dict[str, float]] = None
    photos: List[str] = Field(default_factory=list)
    cost: float = 0
    responsible: Optional[str] = None
    resolution: Optional[str] = None
    work_order_id: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class ChecklistTemplate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    name: str
    vehicle_type: Optional[str] = None
    items: List[Dict[str, Any]] = Field(default_factory=list)
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class ChecklistRun(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    template_id: str
    trip_id: str
    tracto_id: str
    carreta_id: Optional[str] = None
    driver_id: str
    responses: List[Dict[str, Any]] = Field(default_factory=list)
    tire_checks: List[Dict[str, Any]] = Field(default_factory=list)
    result: str = "pending"
    signature_url: Optional[str] = None
    location: Optional[Dict[str, float]] = None
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    photos: List[str] = Field(default_factory=list)
    created_by: Optional[str] = None


class TripSettlement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    trip_id: str
    total_advances: float = 0
    total_expenses: float = 0
    deductions: float = 0
    deduction_notes: Optional[str] = None
    balance: float = 0
    balance_type: str = "favor_empresa"
    status: str = "pendiente"
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    closed_by: Optional[str] = None
    closed_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InventoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StockMove(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    item_id: str
    move_type: str
    quantity: int
    unit_cost: float = 0
    total_cost: float = 0
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    work_order_id: Optional[str] = None
    notes: Optional[str] = None
    move_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class Supplier(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    name: str
    ruc: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    contact_person: Optional[str] = None
    category: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PurchaseOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    user_id: str
    user_name: str
    action: str
    entity_type: str
    entity_id: str
    details: Dict[str, Any] = Field(default_factory=dict)
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TireLifeEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    tire_id: str
    life_number: int
    event_type: str
    cost: float = 0
    supplier: Optional[str] = None
    notes: Optional[str] = None
    event_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class TireRotation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    vehicle_id: str
    changes: List[Dict[str, str]] = Field(default_factory=list)
    reason: Optional[str] = None
    odometer: int = 0
    rotation_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class AlignmentRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    vehicle_id: str
    axle: str
    workshop: Optional[str] = None
    cost: float = 0
    notes: Optional[str] = None
    alignment_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class DowntimeRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    vehicle_id: str
    work_order_id: Optional[str] = None
    reason: str
    start_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    end_time: Optional[datetime] = None
    duration_hours: float = 0
    created_by: Optional[str] = None
