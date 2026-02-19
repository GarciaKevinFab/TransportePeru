from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from enum import Enum
import shutil

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'transporteperu-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Upload directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Create the main app
app = FastAPI(title="TransportePeru SaaS API", version="1.0.0")

# Create router with /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

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

# ============== MODELS ==============
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
    tire_config: str = "6"  # Number of tires
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
    applies_to: str  # vehiculo, chofer, empresa
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
    entity_type: str  # vehicle, user, company
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
    severity: str = "warning"  # info, warning, critical
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

class Checklist(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    trip_id: str
    vehicle_id: str
    driver_id: str
    items: List[Dict[str, Any]] = Field(default_factory=list)
    tire_checks: List[Dict[str, Any]] = Field(default_factory=list)
    result: str = "pending"  # ok, observado, critico
    signature_url: Optional[str] = None
    location: Optional[Dict[str, float]] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    life_number: int = 1  # VN=1, R1=2, R2=3...
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
    depths: List[float] = Field(default_factory=list)  # 2-4 measurements in mm
    pressure: float
    irregular_wear: bool = False
    wear_type: Optional[str] = None
    photos: List[str] = Field(default_factory=list)
    odometer: int
    notes: Optional[str] = None
    inspection_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
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
    vehicle_id: str
    order_number: str
    order_type: str  # preventivo, correctivo
    priority: str = "normal"  # baja, normal, alta, critica
    status: str = "abierta"  # abierta, en_proceso, completada, cancelada
    description: str
    items: List[Dict[str, Any]] = Field(default_factory=list)
    total_cost: float = 0
    workshop: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None

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
    issue_type: str  # incidente, multa, siniestro, checklist_critico, llanta_critica
    severity: str = "media"  # baja, media, alta, critica
    status: str = "abierto"  # abierto, en_proceso, cerrado
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

# ============== CHECKLIST MODELS ==============
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
    result: str = "pending"  # pending, ok, observado, critico
    signature_url: Optional[str] = None
    location: Optional[Dict[str, float]] = None
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    photos: List[str] = Field(default_factory=list)
    created_by: Optional[str] = None

# ============== SETTLEMENT MODEL ==============
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

# ============== MAINTENANCE MODELS ==============
class WorkOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    order_number: str
    vehicle_id: str
    order_type: str  # preventivo, correctivo
    priority: str = "normal"  # baja, normal, alta, critica
    status: str = "abierta"  # abierta, en_proceso, completada, cancelada
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

# ============== INVENTORY MODELS ==============
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
    move_type: str  # entrada, salida, ajuste, consumo_ot
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

# ============== AUDIT LOG ==============
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

# ============== TIRE EXTENDED MODELS ==============
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

# ============== REQUEST/RESPONSE MODELS ==============
class LoginRequest(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    dni: Optional[str] = None
    pin: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class RefreshRequest(BaseModel):
    refresh_token: str

class CreateUserRequest(BaseModel):
    email: Optional[str] = None
    dni: Optional[str] = None
    name: str
    role: UserRole
    password: Optional[str] = None
    pin: Optional[str] = None
    license_number: Optional[str] = None
    license_expiry: Optional[datetime] = None
    phone: Optional[str] = None

class CreateVehicleRequest(BaseModel):
    plate: str
    vehicle_type: VehicleType
    brand: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    vin: Optional[str] = None
    color: Optional[str] = None
    fuel_capacity: Optional[float] = None
    tire_config: str = "6"

class CreateTripRequest(BaseModel):
    tracto_id: str
    carreta_id: Optional[str] = None
    driver_id: str
    route_id: Optional[str] = None
    client_name: Optional[str] = None
    cargo_description: Optional[str] = None
    cargo_weight: Optional[float] = None
    scheduled_date: datetime
    notes: Optional[str] = None

class CreateDocumentRequest(BaseModel):
    document_type_id: str
    entity_type: str
    entity_id: str
    number: Optional[str] = None
    issue_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    notes: Optional[str] = None

class CreateTireRequest(BaseModel):
    serial: str
    brand: str
    model: Optional[str] = None
    dimension: str
    purchase_cost: float = 0
    purchase_date: Optional[datetime] = None
    supplier: Optional[str] = None

class MountTireRequest(BaseModel):
    tire_id: str
    vehicle_id: str
    position_code: str
    mount_odometer: int

class CreateInspectionRequest(BaseModel):
    tire_id: str
    vehicle_id: str
    position_code: str
    depths: List[float]
    pressure: float
    irregular_wear: bool = False
    wear_type: Optional[str] = None
    odometer: int
    notes: Optional[str] = None

# ============== HELPER FUNCTIONS ==============
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Token inválido")
    
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    if not user.get("is_active"):
        raise HTTPException(status_code=401, detail="Usuario desactivado")
    return user

def serialize_doc(doc: dict) -> dict:
    """Remove MongoDB _id and convert datetimes to ISO strings"""
    if doc is None:
        return None
    result = {k: v for k, v in doc.items() if k != "_id"}
    for key, value in result.items():
        if isinstance(value, datetime):
            result[key] = value.isoformat()
    return result

async def check_entity_blocks(company_id: str, entity_type: str, entity_id: str, block_type: str = None) -> List[dict]:
    """Check for active blocks on an entity"""
    query = {
        "company_id": company_id,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "is_active": True
    }
    if block_type:
        query["block_type"] = block_type
    blocks = await db.blocks.find(query, {"_id": 0}).to_list(100)
    return blocks

async def validate_trip_can_be_assigned(company_id: str, tracto_id: str, carreta_id: str, driver_id: str) -> dict:
    """Validate that a trip can be assigned (no blocking conditions)"""
    errors = []
    
    # Check tracto blocks
    tracto_blocks = await check_entity_blocks(company_id, "vehicle", tracto_id, "bloquea_asignacion")
    if tracto_blocks:
        errors.append(f"Tracto bloqueado: {tracto_blocks[0].get('reason', 'Sin razón')}")
    
    # Check carreta blocks
    if carreta_id:
        carreta_blocks = await check_entity_blocks(company_id, "vehicle", carreta_id, "bloquea_asignacion")
        if carreta_blocks:
            errors.append(f"Carreta bloqueada: {carreta_blocks[0].get('reason', 'Sin razón')}")
    
    # Check driver blocks
    driver_blocks = await check_entity_blocks(company_id, "user", driver_id, "bloquea_asignacion")
    if driver_blocks:
        errors.append(f"Chofer bloqueado: {driver_blocks[0].get('reason', 'Sin razón')}")
    
    # Check critical work orders
    wo_query = {
        "company_id": company_id,
        "vehicle_id": {"$in": [tracto_id, carreta_id] if carreta_id else [tracto_id]},
        "status": {"$in": ["abierta", "en_proceso"]},
        "priority": "critica"
    }
    critical_wos = await db.work_orders.find(wo_query, {"_id": 0}).to_list(10)
    if critical_wos:
        errors.append(f"OT crítica pendiente: {critical_wos[0].get('description', '')[:50]}")
    
    return {"valid": len(errors) == 0, "errors": errors}

async def validate_trip_can_start(company_id: str, trip_id: str, trip: dict) -> dict:
    """Validate that a trip can be started"""
    errors = []
    
    # Check if checklist is required and approved
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    config = company.get("config", {}) if company else {}
    
    if config.get("require_checklist_for_start", True):
        if not trip.get("checklist_id"):
            errors.append("Se requiere completar el checklist pre-viaje")
        elif trip.get("checklist_result") == "critico":
            errors.append("Checklist con resultado CRÍTICO - no se puede iniciar")
    
    # Check blocks with rule "bloquea_inicio"
    tracto_blocks = await check_entity_blocks(company_id, "vehicle", trip["tracto_id"], "bloquea_inicio")
    if tracto_blocks:
        errors.append(f"Tracto bloqueado para inicio: {tracto_blocks[0].get('reason', '')}")
    
    if trip.get("carreta_id"):
        carreta_blocks = await check_entity_blocks(company_id, "vehicle", trip["carreta_id"], "bloquea_inicio")
        if carreta_blocks:
            errors.append(f"Carreta bloqueada para inicio: {carreta_blocks[0].get('reason', '')}")
    
    driver_blocks = await check_entity_blocks(company_id, "user", trip["driver_id"], "bloquea_inicio")
    if driver_blocks:
        errors.append(f"Chofer bloqueado para inicio: {driver_blocks[0].get('reason', '')}")
    
    return {"valid": len(errors) == 0, "errors": errors}

async def create_audit_log(company_id: str, user_id: str, user_name: str, action: str, 
                           entity_type: str, entity_id: str, details: dict = None):
    """Create an audit log entry"""
    log = AuditLog(
        company_id=company_id,
        user_id=user_id,
        user_name=user_name,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details or {}
    )
    doc = log.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.audit_logs.insert_one(doc)

async def create_block_for_expired_doc(company_id: str, doc_type: dict, document: dict, entity_type: str, entity_id: str):
    """Create operational block for expired document"""
    block = OperationalBlock(
        company_id=company_id,
        entity_type=entity_type,
        entity_id=entity_id,
        reason=f"Documento vencido: {doc_type.get('name', 'Desconocido')}",
        block_type=doc_type.get("block_rule", "solo_alerta"),
        document_id=document["id"]
    )
    doc = block.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.blocks.insert_one(doc)
    return block

# ============== AUTH ROUTES ==============
@api_router.post("/auth/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    user = None
    
    # Admin login (email + password)
    if request.email and request.password:
        user = await db.users.find_one({"email": request.email}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        if not user.get("password_hash"):
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        if not verify_password(request.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    # Driver login (DNI + PIN)
    elif request.dni and request.pin:
        user = await db.users.find_one({"dni": request.dni}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        
        # Check lockout
        if user.get("locked_until"):
            locked_until = user["locked_until"]
            if isinstance(locked_until, str):
                locked_until = datetime.fromisoformat(locked_until)
            if datetime.now(timezone.utc) < locked_until:
                raise HTTPException(status_code=403, detail="Cuenta bloqueada temporalmente")
        
        if not user.get("pin_hash"):
            raise HTTPException(status_code=401, detail="PIN no configurado")
        
        if not verify_password(request.pin, user["pin_hash"]):
            # Increment failed attempts
            failed_attempts = user.get("failed_attempts", 0) + 1
            update_data = {"failed_attempts": failed_attempts}
            
            if failed_attempts >= 5:
                update_data["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
            
            await db.users.update_one({"id": user["id"]}, {"$set": update_data})
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        
        # Reset failed attempts on successful login
        await db.users.update_one(
            {"id": user["id"]}, 
            {"$set": {"failed_attempts": 0, "locked_until": None}}
        )
    else:
        raise HTTPException(status_code=400, detail="Se requiere email/password o DNI/PIN")
    
    if not user.get("is_active"):
        raise HTTPException(status_code=403, detail="Usuario desactivado")
    
    # Create tokens
    token_data = {
        "user_id": user["id"],
        "company_id": user["company_id"],
        "role": user["role"]
    }
    
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    # Return user info (without sensitive data)
    user_response = {
        "id": user["id"],
        "company_id": user["company_id"],
        "name": user["name"],
        "email": user.get("email"),
        "dni": user.get("dni"),
        "role": user["role"],
        "force_password_change": user.get("force_password_change", False)
    }
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_response
    )

@api_router.post("/auth/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshRequest):
    payload = decode_token(request.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token inválido")
    
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user or not user.get("is_active"):
        raise HTTPException(status_code=401, detail="Usuario no válido")
    
    token_data = {
        "user_id": user["id"],
        "company_id": user["company_id"],
        "role": user["role"]
    }
    
    new_access_token = create_access_token(token_data)
    new_refresh_token = create_refresh_token(token_data)
    
    user_response = {
        "id": user["id"],
        "company_id": user["company_id"],
        "name": user["name"],
        "email": user.get("email"),
        "dni": user.get("dni"),
        "role": user["role"]
    }
    
    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        user=user_response
    )

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return serialize_doc(current_user)

# ============== COMPANY ROUTES ==============
@api_router.get("/companies")
async def get_companies(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    companies = await db.companies.find({}, {"_id": 0}).to_list(100)
    return [serialize_doc(c) for c in companies]

@api_router.get("/company")
async def get_current_company(current_user: dict = Depends(get_current_user)):
    company = await db.companies.find_one({"id": current_user["company_id"]}, {"_id": 0})
    return serialize_doc(company)

# ============== USER ROUTES ==============
@api_router.get("/users")
async def get_users(
    role: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"company_id": current_user["company_id"]}
    if role:
        query["role"] = role
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0, "pin_hash": 0}).to_list(1000)
    return [serialize_doc(u) for u in users]

@api_router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one(
        {"id": user_id, "company_id": current_user["company_id"]},
        {"_id": 0, "password_hash": 0, "pin_hash": 0}
    )
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return serialize_doc(user)

@api_router.post("/users")
async def create_user(request: CreateUserRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    # Check if email/dni already exists
    if request.email:
        existing = await db.users.find_one({"email": request.email})
        if existing:
            raise HTTPException(status_code=400, detail="Email ya registrado")
    if request.dni:
        existing = await db.users.find_one({"dni": request.dni})
        if existing:
            raise HTTPException(status_code=400, detail="DNI ya registrado")
    
    user = User(
        company_id=current_user["company_id"],
        email=request.email,
        dni=request.dni,
        name=request.name,
        role=request.role,
        license_number=request.license_number,
        license_expiry=request.license_expiry,
        phone=request.phone,
        created_by=current_user["id"]
    )
    
    if request.password:
        user.password_hash = hash_password(request.password)
    if request.pin:
        user.pin_hash = hash_password(request.pin)
    
    doc = user.model_dump()
    for key, value in doc.items():
        if isinstance(value, datetime):
            doc[key] = value.isoformat()
    
    await db.users.insert_one(doc)
    return {"id": user.id, "message": "Usuario creado exitosamente"}

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin"] and current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    # Remove sensitive fields from update
    request.pop("password_hash", None)
    request.pop("pin_hash", None)
    request.pop("id", None)
    request.pop("company_id", None)
    
    request["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.users.update_one(
        {"id": user_id, "company_id": current_user["company_id"]},
        {"$set": request}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return {"message": "Usuario actualizado"}

@api_router.post("/users/{user_id}/reset-pin")
async def reset_user_pin(user_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    new_pin = request.get("pin")
    if not new_pin or len(new_pin) != 6 or not new_pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN debe ser de 6 dígitos")
    
    await db.users.update_one(
        {"id": user_id, "company_id": current_user["company_id"]},
        {"$set": {
            "pin_hash": hash_password(new_pin),
            "force_password_change": True,
            "failed_attempts": 0,
            "locked_until": None
        }}
    )
    
    return {"message": "PIN reseteado. El usuario deberá cambiarlo en su próximo inicio de sesión."}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    # Cannot delete owner users or self
    target_user = await db.users.find_one({"id": user_id, "company_id": current_user["company_id"]})
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if target_user.get("role") == "owner":
        raise HTTPException(status_code=400, detail="No se puede eliminar al propietario")
    
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="No puede eliminarse a sí mismo")
    
    await db.users.delete_one({"id": user_id, "company_id": current_user["company_id"]})
    
    return {"message": "Usuario eliminado"}

# ============== VEHICLE ROUTES ==============
@api_router.get("/vehicles")
async def get_vehicles(
    vehicle_type: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"company_id": current_user["company_id"]}
    if vehicle_type:
        query["vehicle_type"] = vehicle_type
    if status:
        query["status"] = status
    
    vehicles = await db.vehicles.find(query, {"_id": 0}).to_list(1000)
    return [serialize_doc(v) for v in vehicles]

@api_router.get("/vehicles/{vehicle_id}")
async def get_vehicle(vehicle_id: str, current_user: dict = Depends(get_current_user)):
    vehicle = await db.vehicles.find_one(
        {"id": vehicle_id, "company_id": current_user["company_id"]},
        {"_id": 0}
    )
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    return serialize_doc(vehicle)

@api_router.post("/vehicles")
async def create_vehicle(request: CreateVehicleRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin", "flota"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    # Check if plate already exists
    existing = await db.vehicles.find_one({
        "plate": request.plate.upper(),
        "company_id": current_user["company_id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Placa ya registrada")
    
    vehicle = Vehicle(
        company_id=current_user["company_id"],
        plate=request.plate.upper(),
        vehicle_type=request.vehicle_type,
        brand=request.brand,
        model=request.model,
        year=request.year,
        vin=request.vin,
        color=request.color,
        fuel_capacity=request.fuel_capacity,
        tire_config=request.tire_config,
        created_by=current_user["id"]
    )
    
    doc = vehicle.model_dump()
    for key, value in doc.items():
        if isinstance(value, datetime):
            doc[key] = value.isoformat()
    
    await db.vehicles.insert_one(doc)
    return {"id": vehicle.id, "message": "Vehículo creado exitosamente"}

@api_router.put("/vehicles/{vehicle_id}")
async def update_vehicle(vehicle_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin", "flota"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    request.pop("id", None)
    request.pop("company_id", None)
    request["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if "plate" in request:
        request["plate"] = request["plate"].upper()
    
    result = await db.vehicles.update_one(
        {"id": vehicle_id, "company_id": current_user["company_id"]},
        {"$set": request}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    
    return {"message": "Vehículo actualizado"}

@api_router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    result = await db.vehicles.delete_one({
        "id": vehicle_id,
        "company_id": current_user["company_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    
    return {"message": "Vehículo eliminado"}

# ============== COUPLING ROUTES ==============
@api_router.post("/couplings")
async def create_coupling(request: dict, current_user: dict = Depends(get_current_user)):
    coupling = CouplingHistory(
        company_id=current_user["company_id"],
        tracto_id=request["tracto_id"],
        carreta_id=request["carreta_id"],
        trip_id=request.get("trip_id"),
        created_by=current_user["id"]
    )
    
    doc = coupling.model_dump()
    doc["start_date"] = doc["start_date"].isoformat()
    
    await db.couplings.insert_one(doc)
    return {"id": coupling.id, "message": "Enganche registrado"}

@api_router.get("/couplings")
async def get_couplings(
    vehicle_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"company_id": current_user["company_id"]}
    if vehicle_id:
        query["$or"] = [{"tracto_id": vehicle_id}, {"carreta_id": vehicle_id}]
    
    couplings = await db.couplings.find(query, {"_id": 0}).sort("start_date", -1).to_list(100)
    return [serialize_doc(c) for c in couplings]

# ============== DOCUMENT TYPE ROUTES ==============
@api_router.get("/document-types")
async def get_document_types(
    applies_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"company_id": current_user["company_id"]}
    if applies_to:
        query["applies_to"] = applies_to
    
    types = await db.document_types.find(query, {"_id": 0}).to_list(100)
    return [serialize_doc(t) for t in types]

@api_router.post("/document-types")
async def create_document_type(request: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    doc_type = DocumentType(
        company_id=current_user["company_id"],
        name=request["name"],
        applies_to=request["applies_to"],
        is_critical=request.get("is_critical", False),
        requires_expiry=request.get("requires_expiry", True),
        alert_days=request.get("alert_days", [60, 30, 15, 7, 3, 1]),
        block_rule=request.get("block_rule", BlockRule.SOLO_ALERTA)
    )
    
    doc = doc_type.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    
    await db.document_types.insert_one(doc)
    return {"id": doc_type.id, "message": "Tipo de documento creado"}

# ============== DOCUMENT ROUTES ==============
@api_router.get("/documents")
async def get_documents(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"company_id": current_user["company_id"]}
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    if status:
        query["status"] = status
    
    documents = await db.documents.find(query, {"_id": 0}).to_list(1000)
    return [serialize_doc(d) for d in documents]

@api_router.post("/documents")
async def create_document(request: CreateDocumentRequest, current_user: dict = Depends(get_current_user)):
    document = Document(
        company_id=current_user["company_id"],
        document_type_id=request.document_type_id,
        entity_type=request.entity_type,
        entity_id=request.entity_id,
        number=request.number,
        issue_date=request.issue_date,
        expiry_date=request.expiry_date,
        notes=request.notes,
        created_by=current_user["id"]
    )
    
    # Determine initial status based on expiry
    if request.expiry_date:
        days_until = (request.expiry_date - datetime.now(timezone.utc)).days
        if days_until < 0:
            document.status = DocumentStatus.VENCIDO
        elif days_until <= 30:
            document.status = DocumentStatus.POR_VENCER
        else:
            document.status = DocumentStatus.VIGENTE
    
    doc = document.model_dump()
    for key, value in doc.items():
        if isinstance(value, datetime):
            doc[key] = value.isoformat()
    
    await db.documents.insert_one(doc)
    return {"id": document.id, "message": "Documento creado"}

@api_router.put("/documents/{document_id}")
async def update_document(document_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    request.pop("id", None)
    request.pop("company_id", None)
    request["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.documents.update_one(
        {"id": document_id, "company_id": current_user["company_id"]},
        {"$set": request}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    
    return {"message": "Documento actualizado"}

@api_router.post("/documents/{document_id}/approve")
async def approve_document(document_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin", "flota"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    await db.documents.update_one(
        {"id": document_id, "company_id": current_user["company_id"]},
        {"$set": {
            "status": DocumentStatus.APROBADO.value,
            "approved_by": current_user["id"],
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Documento aprobado"}

@api_router.get("/documents/matrix")
async def get_documents_matrix(
    entity_type: str = "vehicle",
    current_user: dict = Depends(get_current_user)
):
    """Get document matrix for vehicles or drivers"""
    # Map entity_type to applies_to field
    applies_to_map = {"vehicle": "vehiculo", "user": "chofer"}
    applies_to = applies_to_map.get(entity_type, entity_type)
    
    # Get document types
    doc_types = await db.document_types.find(
        {"company_id": current_user["company_id"], "applies_to": applies_to},
        {"_id": 0}
    ).to_list(100)
    
    # Get entities
    if entity_type == "vehicle":
        entities = await db.vehicles.find(
            {"company_id": current_user["company_id"]},
            {"_id": 0}
        ).to_list(1000)
    else:
        entities = await db.users.find(
            {"company_id": current_user["company_id"], "role": "chofer"},
            {"_id": 0, "password_hash": 0, "pin_hash": 0}
        ).to_list(1000)
    
    # Get all documents
    documents = await db.documents.find(
        {"company_id": current_user["company_id"], "entity_type": entity_type},
        {"_id": 0}
    ).to_list(10000)
    
    # Build matrix
    doc_map = {}
    for doc in documents:
        key = f"{doc['entity_id']}_{doc['document_type_id']}"
        if key not in doc_map or doc.get("expiry_date", "") > doc_map[key].get("expiry_date", ""):
            doc_map[key] = doc
    
    matrix = []
    for entity in entities:
        row = {
            "entity": serialize_doc(entity),
            "documents": {}
        }
        for doc_type in doc_types:
            key = f"{entity['id']}_{doc_type['id']}"
            row["documents"][doc_type["id"]] = serialize_doc(doc_map.get(key))
        matrix.append(row)
    
    return {
        "document_types": [serialize_doc(dt) for dt in doc_types],
        "matrix": matrix
    }

# ============== ALERT ROUTES ==============
@api_router.get("/alerts")
async def get_alerts(
    resolved: Optional[bool] = None,
    severity: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"company_id": current_user["company_id"]}
    if resolved is not None:
        query["resolved"] = resolved
    if severity:
        query["severity"] = severity
    
    alerts = await db.alerts.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [serialize_doc(a) for a in alerts]

@api_router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, current_user: dict = Depends(get_current_user)):
    await db.alerts.update_one(
        {"id": alert_id, "company_id": current_user["company_id"]},
        {"$set": {"resolved": True, "is_read": True}}
    )
    return {"message": "Alerta resuelta"}

# ============== OPERATIONAL BLOCKS ROUTES ==============
@api_router.get("/blocks")
async def get_blocks(
    is_active: Optional[bool] = True,
    current_user: dict = Depends(get_current_user)
):
    query = {"company_id": current_user["company_id"]}
    if is_active is not None:
        query["is_active"] = is_active
    
    blocks = await db.blocks.find(query, {"_id": 0}).to_list(500)
    return [serialize_doc(b) for b in blocks]

@api_router.post("/blocks/{block_id}/resolve")
async def resolve_block(block_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin", "flota", "operaciones"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    await db.blocks.update_one(
        {"id": block_id, "company_id": current_user["company_id"]},
        {"$set": {
            "is_active": False,
            "resolved_at": datetime.now(timezone.utc).isoformat(),
            "resolved_by": current_user["id"]
        }}
    )
    return {"message": "Bloqueo resuelto"}

# ============== ROUTE ROUTES ==============
@api_router.get("/routes")
async def get_routes(current_user: dict = Depends(get_current_user)):
    routes = await db.routes.find(
        {"company_id": current_user["company_id"]},
        {"_id": 0}
    ).to_list(500)
    return [serialize_doc(r) for r in routes]

@api_router.post("/routes")
async def create_route(request: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin", "operaciones"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    route = Route(
        company_id=current_user["company_id"],
        name=request["name"],
        origin=request["origin"],
        destination=request["destination"],
        distance_km=request["distance_km"],
        estimated_hours=request.get("estimated_hours", 0),
        toll_cost=request.get("toll_cost", 0)
    )
    
    doc = route.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    
    await db.routes.insert_one(doc)
    return {"id": route.id, "message": "Ruta creada"}

# ============== TRIP ROUTES ==============
@api_router.get("/trips")
async def get_trips(
    status: Optional[str] = None,
    driver_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"company_id": current_user["company_id"]}
    if status:
        query["status"] = status
    if driver_id:
        query["driver_id"] = driver_id
    
    # If driver, only show their trips
    if current_user["role"] == "chofer":
        query["driver_id"] = current_user["id"]
    
    trips = await db.trips.find(query, {"_id": 0}).sort("scheduled_date", -1).to_list(1000)
    return [serialize_doc(t) for t in trips]

@api_router.get("/trips/{trip_id}")
async def get_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    trip = await db.trips.find_one(
        {"id": trip_id, "company_id": current_user["company_id"]},
        {"_id": 0}
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    return serialize_doc(trip)

@api_router.post("/trips")
async def create_trip(request: CreateTripRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin", "operaciones"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    # Validate all blocks using helper function
    validation = await validate_trip_can_be_assigned(
        current_user["company_id"],
        request.tracto_id,
        request.carreta_id,
        request.driver_id
    )
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail="; ".join(validation["errors"]))
    
    # Generate trip number
    count = await db.trips.count_documents({"company_id": current_user["company_id"]})
    trip_number = f"VJ-{count + 1:05d}"
    
    trip = Trip(
        company_id=current_user["company_id"],
        trip_number=trip_number,
        tracto_id=request.tracto_id,
        carreta_id=request.carreta_id,
        driver_id=request.driver_id,
        route_id=request.route_id,
        client_name=request.client_name,
        cargo_description=request.cargo_description,
        cargo_weight=request.cargo_weight,
        scheduled_date=request.scheduled_date,
        notes=request.notes,
        created_by=current_user["id"]
    )
    
    doc = trip.model_dump()
    for key, value in doc.items():
        if isinstance(value, datetime):
            doc[key] = value.isoformat()
    
    await db.trips.insert_one(doc)
    
    # Create coupling record if carreta assigned
    if request.carreta_id:
        coupling = CouplingHistory(
            company_id=current_user["company_id"],
            tracto_id=request.tracto_id,
            carreta_id=request.carreta_id,
            trip_id=trip.id,
            created_by=current_user["id"]
        )
        coupling_doc = coupling.model_dump()
        coupling_doc["start_date"] = coupling_doc["start_date"].isoformat()
        await db.couplings.insert_one(coupling_doc)
    
    return {"id": trip.id, "message": "Viaje creado"}

@api_router.put("/trips/{trip_id}")
async def update_trip(trip_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    request.pop("id", None)
    request.pop("company_id", None)
    request["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.trips.update_one(
        {"id": trip_id, "company_id": current_user["company_id"]},
        {"$set": request}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    
    return {"message": "Viaje actualizado"}

@api_router.delete("/trips/{trip_id}")
async def delete_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    # Check if trip is in progress
    trip = await db.trips.find_one({"id": trip_id, "company_id": current_user["company_id"]})
    if not trip:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    
    if trip.get("status") == "en_curso":
        raise HTTPException(status_code=400, detail="No se puede eliminar un viaje en curso")
    
    await db.trips.delete_one({"id": trip_id, "company_id": current_user["company_id"]})
    
    return {"message": "Viaje eliminado"}

@api_router.post("/trips/{trip_id}/start")
async def start_trip(trip_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id, "company_id": current_user["company_id"]})
    if not trip:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    
    if trip["status"] not in ["programado", "checklist_pendiente"]:
        raise HTTPException(status_code=400, detail="El viaje no está en estado programado")
    
    # Validate trip can start (checklist, blocks, etc)
    validation = await validate_trip_can_start(current_user["company_id"], trip_id, trip)
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail="; ".join(validation["errors"]))
    
    await db.trips.update_one(
        {"id": trip_id},
        {"$set": {
            "status": TripStatus.EN_CURSO.value,
            "start_date": datetime.now(timezone.utc).isoformat(),
            "km_start": request.get("km_start", 0)
        }}
    )
    
    # Update vehicle status
    await db.vehicles.update_one(
        {"id": trip["tracto_id"]},
        {"$set": {"status": VehicleStatus.EN_VIAJE.value}}
    )
    if trip.get("carreta_id"):
        await db.vehicles.update_one(
            {"id": trip["carreta_id"]},
            {"$set": {"status": VehicleStatus.EN_VIAJE.value}}
        )
    
    # Audit log
    await create_audit_log(
        current_user["company_id"],
        current_user["id"],
        current_user["name"],
        "start_trip",
        "trip",
        trip_id,
        {"km_start": request.get("km_start", 0)}
    )
    
    return {"message": "Viaje iniciado"}

@api_router.post("/trips/{trip_id}/complete")
async def complete_trip(trip_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id, "company_id": current_user["company_id"]})
    if not trip:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    
    await db.trips.update_one(
        {"id": trip_id},
        {"$set": {
            "status": TripStatus.COMPLETADO.value,
            "end_date": datetime.now(timezone.utc).isoformat(),
            "km_end": request.get("km_end", 0)
        }}
    )
    
    # Update vehicle status
    await db.vehicles.update_one(
        {"id": trip["tracto_id"]},
        {"$set": {"status": VehicleStatus.DISPONIBLE.value}}
    )
    if trip.get("carreta_id"):
        await db.vehicles.update_one(
            {"id": trip["carreta_id"]},
            {"$set": {"status": VehicleStatus.DISPONIBLE.value}}
        )
    
    # Close coupling
    if trip.get("carreta_id"):
        await db.couplings.update_one(
            {"trip_id": trip_id, "end_date": None},
            {"$set": {"end_date": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"message": "Viaje completado"}

# ============== TRIP ADVANCE/EXPENSE ROUTES ==============
@api_router.get("/trips/{trip_id}/advances")
async def get_trip_advances(trip_id: str, current_user: dict = Depends(get_current_user)):
    advances = await db.trip_advances.find(
        {"trip_id": trip_id, "company_id": current_user["company_id"]},
        {"_id": 0}
    ).to_list(100)
    return [serialize_doc(a) for a in advances]

@api_router.post("/trips/{trip_id}/advances")
async def create_trip_advance(trip_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin", "contabilidad"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    advance = TripAdvance(
        company_id=current_user["company_id"],
        trip_id=trip_id,
        amount=request["amount"],
        payment_method=request.get("payment_method", "efectivo"),
        delivered_by=current_user["id"],
        notes=request.get("notes")
    )
    
    doc = advance.model_dump()
    for key, value in doc.items():
        if isinstance(value, datetime):
            doc[key] = value.isoformat()
    
    await db.trip_advances.insert_one(doc)
    
    # Update trip total
    await db.trips.update_one(
        {"id": trip_id},
        {"$inc": {"total_advance": request["amount"]}}
    )
    
    return {"id": advance.id, "message": "Anticipo registrado"}

@api_router.get("/trips/{trip_id}/expenses")
async def get_trip_expenses(trip_id: str, current_user: dict = Depends(get_current_user)):
    expenses = await db.trip_expenses.find(
        {"trip_id": trip_id, "company_id": current_user["company_id"]},
        {"_id": 0}
    ).to_list(500)
    return [serialize_doc(e) for e in expenses]

@api_router.post("/trips/{trip_id}/expenses")
async def create_trip_expense(trip_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    expense = TripExpense(
        company_id=current_user["company_id"],
        trip_id=trip_id,
        category=request["category"],
        description=request.get("description"),
        amount=request["amount"],
        provider=request.get("provider"),
        ruc=request.get("ruc"),
        has_igv=request.get("has_igv", False),
        created_by=current_user["id"]
    )
    
    doc = expense.model_dump()
    for key, value in doc.items():
        if isinstance(value, datetime):
            doc[key] = value.isoformat()
    
    await db.trip_expenses.insert_one(doc)
    
    # Update trip total
    await db.trips.update_one(
        {"id": trip_id},
        {"$inc": {"total_expenses": request["amount"]}}
    )
    
    return {"id": expense.id, "message": "Gasto registrado"}

# ============== CHECKLIST ROUTES ==============
@api_router.get("/checklists")
async def get_checklists(
    trip_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"company_id": current_user["company_id"]}
    if trip_id:
        query["trip_id"] = trip_id
    
    checklists = await db.checklists.find(query, {"_id": 0}).to_list(500)
    return [serialize_doc(c) for c in checklists]

@api_router.post("/checklists")
async def create_checklist(request: dict, current_user: dict = Depends(get_current_user)):
    checklist = Checklist(
        company_id=current_user["company_id"],
        trip_id=request["trip_id"],
        vehicle_id=request["vehicle_id"],
        driver_id=current_user["id"],
        items=request.get("items", []),
        tire_checks=request.get("tire_checks", []),
        result=request.get("result", "pending"),
        location=request.get("location")
    )
    
    doc = checklist.model_dump()
    for key, value in doc.items():
        if isinstance(value, datetime):
            doc[key] = value.isoformat()
    
    await db.checklists.insert_one(doc)
    
    # If result is OK, approve checklist on trip
    if request.get("result") == "ok":
        await db.trips.update_one(
            {"id": request["trip_id"]},
            {"$set": {"checklist_id": checklist.id, "checklist_approved": True}}
        )
    
    return {"id": checklist.id, "message": "Checklist creado"}

# ============== FUEL ROUTES ==============
@api_router.get("/fuel/vouchers")
async def get_fuel_vouchers(
    vehicle_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"company_id": current_user["company_id"]}
    if vehicle_id:
        query["vehicle_id"] = vehicle_id
    
    vouchers = await db.fuel_vouchers.find(query, {"_id": 0}).to_list(500)
    return [serialize_doc(v) for v in vouchers]

@api_router.post("/fuel/vouchers")
async def create_fuel_voucher(request: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin", "operaciones"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    voucher = FuelVoucher(
        company_id=current_user["company_id"],
        vehicle_id=request["vehicle_id"],
        trip_id=request.get("trip_id"),
        voucher_number=request["voucher_number"],
        provider=request["provider"],
        limit_amount=request.get("limit_amount"),
        limit_liters=request.get("limit_liters"),
        valid_from=datetime.fromisoformat(request["valid_from"]) if isinstance(request["valid_from"], str) else request["valid_from"],
        valid_until=datetime.fromisoformat(request["valid_until"]) if isinstance(request["valid_until"], str) else request["valid_until"],
        approved_by=current_user["id"]
    )
    
    doc = voucher.model_dump()
    for key, value in doc.items():
        if isinstance(value, datetime):
            doc[key] = value.isoformat()
    
    await db.fuel_vouchers.insert_one(doc)
    return {"id": voucher.id, "message": "Vale creado"}

@api_router.get("/fuel/loads")
async def get_fuel_loads(
    vehicle_id: Optional[str] = None,
    trip_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"company_id": current_user["company_id"]}
    if vehicle_id:
        query["vehicle_id"] = vehicle_id
    if trip_id:
        query["trip_id"] = trip_id
    
    loads = await db.fuel_loads.find(query, {"_id": 0}).sort("load_date", -1).to_list(1000)
    return [serialize_doc(l) for l in loads]

@api_router.post("/fuel/loads")
async def create_fuel_load(request: dict, current_user: dict = Depends(get_current_user)):
    load = FuelLoad(
        company_id=current_user["company_id"],
        vehicle_id=request["vehicle_id"],
        voucher_id=request.get("voucher_id"),
        trip_id=request.get("trip_id"),
        liters=request["liters"],
        price_per_liter=request["price_per_liter"],
        total_amount=request["liters"] * request["price_per_liter"],
        odometer=request["odometer"],
        provider=request["provider"],
        location=request.get("location"),
        created_by=current_user["id"]
    )
    
    doc = load.model_dump()
    for key, value in doc.items():
        if isinstance(value, datetime):
            doc[key] = value.isoformat()
    
    await db.fuel_loads.insert_one(doc)
    
    # Mark voucher as used if provided
    if request.get("voucher_id"):
        await db.fuel_vouchers.update_one(
            {"id": request["voucher_id"]},
            {"$set": {"is_used": True}}
        )
    
    # Update vehicle odometer
    await db.vehicles.update_one(
        {"id": request["vehicle_id"]},
        {"$set": {"odometer": request["odometer"]}}
    )
    
    return {"id": load.id, "message": "Cargue registrado"}

@api_router.put("/fuel/vouchers/{voucher_id}")
async def update_fuel_voucher(voucher_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    """Update a fuel voucher - Admin only"""
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar vales")
    
    voucher = await db.fuel_vouchers.find_one({"id": voucher_id, "company_id": current_user["company_id"]})
    if not voucher:
        raise HTTPException(status_code=404, detail="Vale no encontrado")
    
    update_data = {}
    allowed_fields = ["voucher_number", "provider", "limit_amount", "limit_liters", "valid_from", "valid_until", "is_used", "photo_url"]
    for field in allowed_fields:
        if field in request:
            if field in ["valid_from", "valid_until"] and isinstance(request[field], str):
                update_data[field] = request[field]
            else:
                update_data[field] = request[field]
    
    if update_data:
        await db.fuel_vouchers.update_one({"id": voucher_id}, {"$set": update_data})
    
    return {"message": "Vale actualizado"}

@api_router.delete("/fuel/vouchers/{voucher_id}")
async def delete_fuel_voucher(voucher_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a fuel voucher - Admin only"""
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar vales")
    
    result = await db.fuel_vouchers.delete_one({"id": voucher_id, "company_id": current_user["company_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vale no encontrado")
    
    return {"message": "Vale eliminado"}

@api_router.put("/fuel/loads/{load_id}")
async def update_fuel_load(load_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    """Update a fuel load - Admin only"""
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar cargas")
    
    load = await db.fuel_loads.find_one({"id": load_id, "company_id": current_user["company_id"]})
    if not load:
        raise HTTPException(status_code=404, detail="Carga no encontrada")
    
    update_data = {}
    allowed_fields = ["liters", "price_per_liter", "odometer", "provider", "receipt_url", "photo_url"]
    for field in allowed_fields:
        if field in request:
            update_data[field] = request[field]
    
    # Recalculate total if liters or price changed
    if "liters" in update_data or "price_per_liter" in update_data:
        liters = update_data.get("liters", load.get("liters", 0))
        price = update_data.get("price_per_liter", load.get("price_per_liter", 0))
        update_data["total_amount"] = liters * price
    
    if update_data:
        await db.fuel_loads.update_one({"id": load_id}, {"$set": update_data})
    
    return {"message": "Carga actualizada"}

@api_router.delete("/fuel/loads/{load_id}")
async def delete_fuel_load(load_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a fuel load - Admin only"""
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar cargas")
    
    result = await db.fuel_loads.delete_one({"id": load_id, "company_id": current_user["company_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Carga no encontrada")
    
    return {"message": "Carga eliminada"}

# ============== TIRE ROUTES ==============
@api_router.get("/tires")
async def get_tires(
    vehicle_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"company_id": current_user["company_id"]}
    if vehicle_id:
        query["current_vehicle_id"] = vehicle_id
    if status:
        query["status"] = status
    
    tires = await db.tires.find(query, {"_id": 0}).to_list(1000)
    return [serialize_doc(t) for t in tires]

@api_router.get("/tires/{tire_id}")
async def get_tire(tire_id: str, current_user: dict = Depends(get_current_user)):
    tire = await db.tires.find_one(
        {"id": tire_id, "company_id": current_user["company_id"]},
        {"_id": 0}
    )
    if not tire:
        raise HTTPException(status_code=404, detail="Llanta no encontrada")
    return serialize_doc(tire)

@api_router.post("/tires")
async def create_tire(request: CreateTireRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin", "mantenimiento", "flota"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    tire = Tire(
        company_id=current_user["company_id"],
        serial=request.serial,
        brand=request.brand,
        model=request.model,
        dimension=request.dimension,
        purchase_cost=request.purchase_cost,
        purchase_date=request.purchase_date,
        supplier=request.supplier
    )
    
    doc = tire.model_dump()
    for key, value in doc.items():
        if isinstance(value, datetime):
            doc[key] = value.isoformat()
    
    await db.tires.insert_one(doc)
    return {"id": tire.id, "message": "Llanta creada"}

@api_router.post("/tires/mount")
async def mount_tire(request: MountTireRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin", "mantenimiento", "flota"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    # Check if tire exists and is available
    tire = await db.tires.find_one({"id": request.tire_id, "company_id": current_user["company_id"]})
    if not tire:
        raise HTTPException(status_code=404, detail="Llanta no encontrada")
    if tire.get("current_vehicle_id"):
        raise HTTPException(status_code=400, detail="Llanta ya está montada en otro vehículo")
    
    # Check if position is available
    existing = await db.tires.find_one({
        "current_vehicle_id": request.vehicle_id,
        "current_position": request.position_code
    })
    if existing:
        raise HTTPException(status_code=400, detail="Posición ya ocupada")
    
    # Create mount record
    mount = TireMount(
        company_id=current_user["company_id"],
        tire_id=request.tire_id,
        vehicle_id=request.vehicle_id,
        position_code=request.position_code,
        mount_odometer=request.mount_odometer,
        created_by=current_user["id"]
    )
    
    doc = mount.model_dump()
    doc["mount_date"] = doc["mount_date"].isoformat()
    
    await db.tire_mounts.insert_one(doc)
    
    # Update tire
    await db.tires.update_one(
        {"id": request.tire_id},
        {"$set": {
            "current_vehicle_id": request.vehicle_id,
            "current_position": request.position_code,
            "status": TireStatus.EN_USO.value,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"id": mount.id, "message": "Llanta montada"}

@api_router.post("/tires/{tire_id}/unmount")
async def unmount_tire(tire_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin", "mantenimiento", "flota"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    tire = await db.tires.find_one({"id": tire_id, "company_id": current_user["company_id"]})
    if not tire:
        raise HTTPException(status_code=404, detail="Llanta no encontrada")
    
    # Update mount record
    await db.tire_mounts.update_one(
        {"tire_id": tire_id, "unmount_date": None},
        {"$set": {
            "unmount_date": datetime.now(timezone.utc).isoformat(),
            "unmount_odometer": request.get("odometer", 0),
            "reason": request.get("reason")
        }}
    )
    
    # Calculate km traveled
    mount = await db.tire_mounts.find_one({"tire_id": tire_id}, sort=[("mount_date", -1)])
    km_traveled = 0
    if mount:
        km_traveled = request.get("odometer", 0) - mount.get("mount_odometer", 0)
    
    # Update tire
    await db.tires.update_one(
        {"id": tire_id},
        {"$set": {
            "current_vehicle_id": None,
            "current_position": None,
            "status": request.get("new_status", TireStatus.NUEVO.value),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        "$inc": {"total_km": km_traveled}}
    )
    
    return {"message": "Llanta desmontada", "km_traveled": km_traveled}

@api_router.get("/tires/vehicle/{vehicle_id}")
async def get_vehicle_tires(vehicle_id: str, current_user: dict = Depends(get_current_user)):
    """Get all tires mounted on a vehicle with their positions"""
    tires = await db.tires.find(
        {"current_vehicle_id": vehicle_id, "company_id": current_user["company_id"]},
        {"_id": 0}
    ).to_list(20)
    
    # Get latest inspection for each tire
    result = []
    for tire in tires:
        tire_data = serialize_doc(tire)
        inspection = await db.tire_inspections.find_one(
            {"tire_id": tire["id"]},
            {"_id": 0},
            sort=[("inspection_date", -1)]
        )
        tire_data["last_inspection"] = serialize_doc(inspection) if inspection else None
        result.append(tire_data)
    
    return result

@api_router.post("/tires/inspect")
async def create_tire_inspection(request: CreateInspectionRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin", "mantenimiento", "flota", "chofer"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    inspection = TireInspection(
        company_id=current_user["company_id"],
        tire_id=request.tire_id,
        vehicle_id=request.vehicle_id,
        position_code=request.position_code,
        depths=request.depths,
        pressure=request.pressure,
        irregular_wear=request.irregular_wear,
        wear_type=request.wear_type,
        odometer=request.odometer,
        notes=request.notes,
        created_by=current_user["id"]
    )
    
    doc = inspection.model_dump()
    doc["inspection_date"] = doc["inspection_date"].isoformat()
    
    await db.tire_inspections.insert_one(doc)
    
    # Check for alerts
    min_depth = min(request.depths) if request.depths else 0
    tire = await db.tires.find_one({"id": request.tire_id})
    
    # Alert thresholds (mm)
    critical_depth = 3  # Below this is critical
    warning_depth = 5   # Below this is warning
    
    if min_depth < critical_depth:
        alert = Alert(
            company_id=current_user["company_id"],
            alert_type="tire_critical",
            entity_type="tire",
            entity_id=request.tire_id,
            message=f"Llanta {tire.get('serial', '')} con profundidad crítica: {min_depth}mm",
            severity="critical"
        )
        alert_doc = alert.model_dump()
        alert_doc["created_at"] = alert_doc["created_at"].isoformat()
        await db.alerts.insert_one(alert_doc)
    elif min_depth < warning_depth:
        alert = Alert(
            company_id=current_user["company_id"],
            alert_type="tire_warning",
            entity_type="tire",
            entity_id=request.tire_id,
            message=f"Llanta {tire.get('serial', '')} con profundidad baja: {min_depth}mm",
            severity="warning"
        )
        alert_doc = alert.model_dump()
        alert_doc["created_at"] = alert_doc["created_at"].isoformat()
        await db.alerts.insert_one(alert_doc)
    
    if request.irregular_wear:
        alert = Alert(
            company_id=current_user["company_id"],
            alert_type="tire_irregular_wear",
            entity_type="tire",
            entity_id=request.tire_id,
            message=f"Llanta {tire.get('serial', '')} con desgaste irregular. Se recomienda alineación.",
            severity="warning"
        )
        alert_doc = alert.model_dump()
        alert_doc["created_at"] = alert_doc["created_at"].isoformat()
        await db.alerts.insert_one(alert_doc)
    
    return {"id": inspection.id, "message": "Inspección registrada"}

@api_router.get("/tires/{tire_id}/inspections")
async def get_tire_inspections(tire_id: str, current_user: dict = Depends(get_current_user)):
    inspections = await db.tire_inspections.find(
        {"tire_id": tire_id, "company_id": current_user["company_id"]},
        {"_id": 0}
    ).sort("inspection_date", -1).to_list(100)
    return [serialize_doc(i) for i in inspections]

# ============== MAINTENANCE ROUTES ==============
@api_router.get("/maintenance/plans")
async def get_maintenance_plans(current_user: dict = Depends(get_current_user)):
    plans = await db.maintenance_plans.find(
        {"company_id": current_user["company_id"]},
        {"_id": 0}
    ).to_list(100)
    return [serialize_doc(p) for p in plans]

@api_router.post("/maintenance/plans")
async def create_maintenance_plan(request: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin", "mantenimiento"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    plan = MaintenancePlan(
        company_id=current_user["company_id"],
        name=request["name"],
        vehicle_type=request["vehicle_type"],
        component=request["component"],
        interval_km=request.get("interval_km"),
        interval_days=request.get("interval_days"),
        interval_hours=request.get("interval_hours"),
        tasks=request.get("tasks", [])
    )
    
    doc = plan.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    
    await db.maintenance_plans.insert_one(doc)
    return {"id": plan.id, "message": "Plan creado"}

@api_router.get("/maintenance/work-orders")
async def get_work_orders(
    vehicle_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"company_id": current_user["company_id"]}
    if vehicle_id:
        query["vehicle_id"] = vehicle_id
    if status:
        query["status"] = status
    
    orders = await db.work_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [serialize_doc(o) for o in orders]

@api_router.post("/maintenance/work-orders")
async def create_work_order(request: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin", "mantenimiento", "flota"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    # Generate order number
    count = await db.work_orders.count_documents({"company_id": current_user["company_id"]})
    order_number = f"OT-{count + 1:05d}"
    
    order = WorkOrder(
        company_id=current_user["company_id"],
        vehicle_id=request["vehicle_id"],
        order_number=order_number,
        order_type=request["order_type"],
        priority=request.get("priority", "normal"),
        description=request["description"],
        items=request.get("items", []),
        workshop=request.get("workshop"),
        created_by=current_user["id"]
    )
    
    doc = order.model_dump()
    for key, value in doc.items():
        if isinstance(value, datetime):
            doc[key] = value.isoformat()
    
    await db.work_orders.insert_one(doc)
    
    # If critical priority, create block
    if request.get("priority") == "critica":
        block = OperationalBlock(
            company_id=current_user["company_id"],
            entity_type="vehicle",
            entity_id=request["vehicle_id"],
            reason=f"OT Crítica: {request['description'][:50]}",
            block_type="bloquea_asignacion"
        )
        block_doc = block.model_dump()
        block_doc["created_at"] = block_doc["created_at"].isoformat()
        await db.blocks.insert_one(block_doc)
        
        # Update vehicle status
        await db.vehicles.update_one(
            {"id": request["vehicle_id"]},
            {"$set": {"status": VehicleStatus.EN_MANTENIMIENTO.value}}
        )
    
    return {"id": order.id, "order_number": order_number, "message": "Orden de trabajo creada"}

@api_router.put("/maintenance/work-orders/{order_id}")
async def update_work_order(order_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    request.pop("id", None)
    request.pop("company_id", None)
    request["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # If completing order, set vehicle to available
    if request.get("status") == "completada":
        order = await db.work_orders.find_one({"id": order_id})
        if order:
            await db.vehicles.update_one(
                {"id": order["vehicle_id"]},
                {"$set": {"status": VehicleStatus.DISPONIBLE.value}}
            )
            # Resolve any blocks
            await db.blocks.update_many(
                {"entity_id": order["vehicle_id"], "is_active": True},
                {"$set": {
                    "is_active": False,
                    "resolved_at": datetime.now(timezone.utc).isoformat(),
                    "resolved_by": current_user["id"]
                }}
            )
    
    result = await db.work_orders.update_one(
        {"id": order_id, "company_id": current_user["company_id"]},
        {"$set": request}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    return {"message": "Orden actualizada"}

# ============== ISSUE ROUTES ==============
@api_router.get("/issues")
async def get_issues(
    status: Optional[str] = None,
    issue_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"company_id": current_user["company_id"]}
    if status:
        query["status"] = status
    if issue_type:
        query["issue_type"] = issue_type
    
    issues = await db.issues.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [serialize_doc(i) for i in issues]

@api_router.post("/issues")
async def create_issue(request: dict, current_user: dict = Depends(get_current_user)):
    issue = Issue(
        company_id=current_user["company_id"],
        trip_id=request.get("trip_id"),
        vehicle_id=request.get("vehicle_id"),
        driver_id=request.get("driver_id"),
        issue_type=request["issue_type"],
        severity=request.get("severity", "media"),
        description=request["description"],
        location=request.get("location"),
        photos=request.get("photos", []),
        cost=request.get("cost", 0),
        responsible=request.get("responsible"),
        created_by=current_user["id"]
    )
    
    doc = issue.model_dump()
    for key, value in doc.items():
        if isinstance(value, datetime):
            doc[key] = value.isoformat()
    
    await db.issues.insert_one(doc)
    return {"id": issue.id, "message": "Incidente registrado"}

@api_router.put("/issues/{issue_id}")
async def update_issue(issue_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    request.pop("id", None)
    request.pop("company_id", None)
    request["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.issues.update_one(
        {"id": issue_id, "company_id": current_user["company_id"]},
        {"$set": request}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Incidente no encontrado")
    
    return {"message": "Incidente actualizado"}

# ============== CHECKLIST TEMPLATE ROUTES ==============
@api_router.get("/checklist-templates")
async def get_checklist_templates(
    vehicle_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"company_id": current_user["company_id"], "is_active": True}
    if vehicle_type:
        query["vehicle_type"] = vehicle_type
    templates = await db.checklist_templates.find(query, {"_id": 0}).to_list(100)
    return [serialize_doc(t) for t in templates]

@api_router.post("/checklist-templates")
async def create_checklist_template(request: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    template = ChecklistTemplate(
        company_id=current_user["company_id"],
        name=request["name"],
        vehicle_type=request.get("vehicle_type"),
        items=request.get("items", []),
        created_by=current_user["id"]
    )
    
    doc = template.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.checklist_templates.insert_one(doc)
    return {"id": template.id, "message": "Plantilla creada"}

@api_router.put("/checklist-templates/{template_id}")
async def update_checklist_template(template_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    request.pop("id", None)
    request.pop("company_id", None)
    
    await db.checklist_templates.update_one(
        {"id": template_id, "company_id": current_user["company_id"]},
        {"$set": request}
    )
    return {"message": "Plantilla actualizada"}

# ============== CHECKLIST RUN ROUTES ==============
@api_router.get("/checklists/trip/{trip_id}")
async def get_checklist_by_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    checklist = await db.checklist_runs.find_one(
        {"trip_id": trip_id, "company_id": current_user["company_id"]},
        {"_id": 0}
    )
    return serialize_doc(checklist) if checklist else None

@api_router.post("/checklists/start")
async def start_checklist(request: dict, current_user: dict = Depends(get_current_user)):
    """Start a new checklist for a trip"""
    trip_id = request["trip_id"]
    
    # Get trip
    trip = await db.trips.find_one({"id": trip_id, "company_id": current_user["company_id"]})
    if not trip:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    
    # Check if checklist already exists
    existing = await db.checklist_runs.find_one({"trip_id": trip_id})
    if existing and existing.get("result") != "pending":
        raise HTTPException(status_code=400, detail="Ya existe un checklist completado para este viaje")
    
    # Get default template
    template_id = request.get("template_id")
    if not template_id:
        template = await db.checklist_templates.find_one({
            "company_id": current_user["company_id"],
            "is_active": True
        })
        template_id = template["id"] if template else None
    
    if not template_id:
        raise HTTPException(status_code=400, detail="No hay plantilla de checklist disponible")
    
    checklist = ChecklistRun(
        company_id=current_user["company_id"],
        template_id=template_id,
        trip_id=trip_id,
        tracto_id=trip["tracto_id"],
        carreta_id=trip.get("carreta_id"),
        driver_id=current_user["id"],
        location=request.get("location"),
        created_by=current_user["id"]
    )
    
    doc = checklist.model_dump()
    doc["started_at"] = doc["started_at"].isoformat()
    await db.checklist_runs.insert_one(doc)
    
    # Update trip
    await db.trips.update_one(
        {"id": trip_id},
        {"$set": {"checklist_id": checklist.id, "status": "checklist_pendiente"}}
    )
    
    return {"id": checklist.id, "message": "Checklist iniciado"}

@api_router.post("/checklists/{checklist_id}/submit")
async def submit_checklist(checklist_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    """Submit a completed checklist"""
    checklist = await db.checklist_runs.find_one({
        "id": checklist_id,
        "company_id": current_user["company_id"]
    })
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist no encontrado")
    
    responses = request.get("responses", [])
    tire_checks = request.get("tire_checks", [])
    signature_url = request.get("signature_url")
    photos = request.get("photos", [])
    location = request.get("location")
    
    # Calculate result based on responses
    result = "ok"
    critical_items = []
    observed_items = []
    
    for resp in responses:
        if resp.get("severity") == "critico" and resp.get("value") == False:
            result = "critico"
            critical_items.append(resp.get("label", "Item"))
        elif resp.get("severity") == "observado" and resp.get("value") == False:
            if result != "critico":
                result = "observado"
            observed_items.append(resp.get("label", "Item"))
    
    # Check tire conditions
    for tire in tire_checks:
        if tire.get("condition") == "critico":
            result = "critico"
            critical_items.append(f"Llanta {tire.get('position', '')}")
        elif tire.get("condition") == "mal" and result != "critico":
            result = "observado"
            observed_items.append(f"Llanta {tire.get('position', '')}")
    
    # Update checklist
    await db.checklist_runs.update_one(
        {"id": checklist_id},
        {"$set": {
            "responses": responses,
            "tire_checks": tire_checks,
            "signature_url": signature_url,
            "photos": photos,
            "location": location,
            "result": result,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update trip
    await db.trips.update_one(
        {"id": checklist["trip_id"]},
        {"$set": {
            "checklist_result": result,
            "status": "programado" if result != "critico" else "checklist_pendiente"
        }}
    )
    
    # Create issue if critical
    if result == "critico":
        issue_count = await db.issues.count_documents({"company_id": current_user["company_id"]})
        issue = Issue(
            company_id=current_user["company_id"],
            issue_number=f"ISS-{issue_count + 1:05d}",
            trip_id=checklist["trip_id"],
            vehicle_id=checklist["tracto_id"],
            driver_id=checklist["driver_id"],
            checklist_id=checklist_id,
            issue_type="checklist_critico",
            severity="alta",
            title="Checklist Pre-Viaje Crítico",
            description=f"Items críticos: {', '.join(critical_items)}",
            photos=photos,
            created_by=current_user["id"]
        )
        issue_doc = issue.model_dump()
        for k, v in issue_doc.items():
            if isinstance(v, datetime):
                issue_doc[k] = v.isoformat()
        await db.issues.insert_one(issue_doc)
    
    # Audit log
    await create_audit_log(
        current_user["company_id"],
        current_user["id"],
        current_user["name"],
        "submit_checklist",
        "checklist",
        checklist_id,
        {"result": result, "trip_id": checklist["trip_id"]}
    )
    
    return {
        "message": "Checklist enviado",
        "result": result,
        "critical_items": critical_items,
        "observed_items": observed_items
    }

@api_router.post("/trip/{trip_id}/checklist")
async def submit_trip_checklist(trip_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    """Submit a complete checklist for a trip (combines start and submit)"""
    # Get trip
    trip = await db.trips.find_one({"id": trip_id, "company_id": current_user["company_id"]})
    if not trip:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    
    # Check if checklist already exists and is completed
    existing = await db.checklist_runs.find_one({"trip_id": trip_id})
    if existing and existing.get("result") not in [None, "pending"]:
        raise HTTPException(status_code=400, detail="Ya existe un checklist completado para este viaje")
    
    # Get or create checklist
    if existing:
        checklist_id = existing["id"]
    else:
        # Get default template
        template = await db.checklist_templates.find_one({
            "company_id": current_user["company_id"],
            "is_active": True
        })
        template_id = template["id"] if template else "default"
        
        checklist = ChecklistRun(
            company_id=current_user["company_id"],
            template_id=template_id,
            trip_id=trip_id,
            tracto_id=trip["tracto_id"],
            carreta_id=trip.get("carreta_id"),
            driver_id=current_user["id"],
            location=request.get("location"),
            created_by=current_user["id"]
        )
        
        doc = checklist.model_dump()
        doc["started_at"] = doc["started_at"].isoformat()
        await db.checklist_runs.insert_one(doc)
        checklist_id = checklist.id
    
    # Process responses
    responses = request.get("responses", [])
    tire_checks = request.get("tire_checks", [])
    result = request.get("result", "ok")
    
    # Count critical and observed items
    critical_items = [r for r in responses if r.get("is_critical") and r.get("status") == "critico"]
    observed_items = [r for r in responses if r.get("status") in ["observado", "critico"]]
    
    # Update checklist
    await db.checklist_runs.update_one(
        {"id": checklist_id},
        {"$set": {
            "responses": responses,
            "tire_checks": tire_checks,
            "signature_url": request.get("signature_url"),
            "km_start": request.get("km_start"),
            "notes": request.get("notes"),
            "result": result,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update trip
    await db.trips.update_one(
        {"id": trip_id},
        {"$set": {
            "checklist_id": checklist_id,
            "checklist_result": result,
            "km_start": request.get("km_start"),
            "status": "programado" if result != "critico" else "checklist_pendiente"
        }}
    )
    
    # If critical, create an issue
    if result == "critico":
        issue = Issue(
            company_id=current_user["company_id"],
            trip_id=trip_id,
            vehicle_id=trip["tracto_id"],
            driver_id=trip["driver_id"],
            checklist_id=checklist_id,
            issue_type="checklist_critico",
            severity="alta",
            description=f"Checklist crítico: {len(critical_items)} items críticos detectados",
            created_by=current_user["id"]
        )
        issue_doc = issue.model_dump()
        for k, v in issue_doc.items():
            if isinstance(v, datetime):
                issue_doc[k] = v.isoformat()
        await db.issues.insert_one(issue_doc)
    
    return {
        "message": "Checklist enviado",
        "result": result,
        "critical_items": len(critical_items),
        "observed_items": len(observed_items)
    }

# ============== SETTLEMENT ROUTES ==============
@api_router.get("/settlements")
async def get_settlements(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"company_id": current_user["company_id"]}
    if status:
        query["status"] = status
    settlements = await db.settlements.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [serialize_doc(s) for s in settlements]

@api_router.get("/trips/{trip_id}/settlement")
async def get_trip_settlement(trip_id: str, current_user: dict = Depends(get_current_user)):
    settlement = await db.settlements.find_one(
        {"trip_id": trip_id, "company_id": current_user["company_id"]},
        {"_id": 0}
    )
    return serialize_doc(settlement) if settlement else None

@api_router.post("/trips/{trip_id}/settlement")
async def create_or_update_settlement(trip_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    """Create or update settlement for a trip"""
    trip = await db.trips.find_one({"id": trip_id, "company_id": current_user["company_id"]})
    if not trip:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    
    # Calculate totals
    advances = await db.trip_advances.find({"trip_id": trip_id}, {"_id": 0}).to_list(100)
    expenses = await db.trip_expenses.find({"trip_id": trip_id}, {"_id": 0}).to_list(500)
    
    total_advances = sum(a.get("amount", 0) for a in advances)
    total_expenses = sum(e.get("amount", 0) for e in expenses)
    deductions = request.get("deductions", 0)
    
    balance = total_advances - total_expenses - deductions
    balance_type = "favor_empresa" if balance >= 0 else "favor_chofer"
    
    existing = await db.settlements.find_one({"trip_id": trip_id})
    
    if existing:
        if existing.get("status") == "cerrado":
            raise HTTPException(status_code=400, detail="Liquidación ya cerrada")
        
        await db.settlements.update_one(
            {"id": existing["id"]},
            {"$set": {
                "total_advances": total_advances,
                "total_expenses": total_expenses,
                "deductions": deductions,
                "deduction_notes": request.get("deduction_notes"),
                "balance": abs(balance),
                "balance_type": balance_type,
                "notes": request.get("notes"),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"id": existing["id"], "message": "Liquidación actualizada"}
    else:
        settlement = TripSettlement(
            company_id=current_user["company_id"],
            trip_id=trip_id,
            total_advances=total_advances,
            total_expenses=total_expenses,
            deductions=deductions,
            deduction_notes=request.get("deduction_notes"),
            balance=abs(balance),
            balance_type=balance_type,
            notes=request.get("notes")
        )
        doc = settlement.model_dump()
        for k, v in doc.items():
            if isinstance(v, datetime):
                doc[k] = v.isoformat()
        await db.settlements.insert_one(doc)
        
        await db.trips.update_one(
            {"id": trip_id},
            {"$set": {"settlement_id": settlement.id, "settlement_status": "pendiente"}}
        )
        
        return {"id": settlement.id, "message": "Liquidación creada"}

@api_router.post("/settlements/{settlement_id}/close")
async def close_settlement(settlement_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    """Close a settlement"""
    if current_user["role"] not in ["owner", "admin", "contabilidad"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    settlement = await db.settlements.find_one({
        "id": settlement_id,
        "company_id": current_user["company_id"]
    })
    if not settlement:
        raise HTTPException(status_code=404, detail="Liquidación no encontrada")
    
    if settlement.get("status") == "cerrado":
        raise HTTPException(status_code=400, detail="Liquidación ya cerrada")
    
    await db.settlements.update_one(
        {"id": settlement_id},
        {"$set": {
            "status": "cerrado",
            "closed_by": current_user["id"],
            "closed_at": datetime.now(timezone.utc).isoformat(),
            "notes": request.get("notes", settlement.get("notes"))
        }}
    )
    
    # Update trip
    await db.trips.update_one(
        {"id": settlement["trip_id"]},
        {"$set": {"settlement_status": "cerrado"}}
    )
    
    # Audit log
    await create_audit_log(
        current_user["company_id"],
        current_user["id"],
        current_user["name"],
        "close_settlement",
        "settlement",
        settlement_id,
        {"trip_id": settlement["trip_id"], "balance": settlement.get("balance")}
    )
    
    return {"message": "Liquidación cerrada"}

# ============== INVENTORY ROUTES ==============
@api_router.get("/inventory/items")
async def get_inventory_items(
    category: Optional[str] = None,
    low_stock: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"company_id": current_user["company_id"], "is_active": True}
    if category:
        query["category"] = category
    
    items = await db.inventory_items.find(query, {"_id": 0}).to_list(1000)
    
    if low_stock:
        items = [i for i in items if i.get("current_stock", 0) <= i.get("min_stock", 0)]
    
    return [serialize_doc(i) for i in items]

@api_router.post("/inventory/items")
async def create_inventory_item(request: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin", "almacen"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    item = InventoryItem(
        company_id=current_user["company_id"],
        code=request["code"],
        name=request["name"],
        description=request.get("description"),
        category=request["category"],
        unit=request.get("unit", "unidad"),
        min_stock=request.get("min_stock", 0),
        max_stock=request.get("max_stock"),
        unit_cost=request.get("unit_cost", 0),
        location=request.get("location")
    )
    
    doc = item.model_dump()
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    await db.inventory_items.insert_one(doc)
    return {"id": item.id, "message": "Item creado"}

@api_router.post("/inventory/moves")
async def create_stock_move(request: dict, current_user: dict = Depends(get_current_user)):
    """Create a stock movement (entry/exit/adjustment)"""
    if current_user["role"] not in ["owner", "admin", "almacen", "mantenimiento"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    item_id = request["item_id"]
    move_type = request["move_type"]
    quantity = request["quantity"]
    
    # Get current item
    item = await db.inventory_items.find_one({"id": item_id, "company_id": current_user["company_id"]})
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    
    current_stock = item.get("current_stock", 0)
    
    if move_type in ["salida", "consumo_ot"]:
        if current_stock < quantity:
            raise HTTPException(status_code=400, detail="Stock insuficiente")
        new_stock = current_stock - quantity
    elif move_type == "entrada":
        new_stock = current_stock + quantity
    else:  # ajuste
        new_stock = quantity
    
    move = StockMove(
        company_id=current_user["company_id"],
        item_id=item_id,
        move_type=move_type,
        quantity=quantity,
        unit_cost=request.get("unit_cost", item.get("unit_cost", 0)),
        total_cost=quantity * request.get("unit_cost", item.get("unit_cost", 0)),
        reference_type=request.get("reference_type"),
        reference_id=request.get("reference_id"),
        work_order_id=request.get("work_order_id"),
        notes=request.get("notes"),
        created_by=current_user["id"]
    )
    
    doc = move.model_dump()
    doc["move_date"] = doc["move_date"].isoformat()
    await db.stock_moves.insert_one(doc)
    
    # Update item stock
    await db.inventory_items.update_one(
        {"id": item_id},
        {"$set": {"current_stock": new_stock, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Check for low stock alert
    if new_stock <= item.get("min_stock", 0):
        alert = Alert(
            company_id=current_user["company_id"],
            alert_type="low_stock",
            entity_type="inventory",
            entity_id=item_id,
            message=f"Stock bajo: {item.get('name', '')} - {new_stock} {item.get('unit', 'unidades')}",
            severity="warning"
        )
        alert_doc = alert.model_dump()
        alert_doc["created_at"] = alert_doc["created_at"].isoformat()
        await db.alerts.insert_one(alert_doc)
    
    return {"id": move.id, "new_stock": new_stock, "message": "Movimiento registrado"}

@api_router.get("/inventory/kardex/{item_id}")
async def get_kardex(item_id: str, current_user: dict = Depends(get_current_user)):
    """Get stock movement history for an item"""
    moves = await db.stock_moves.find(
        {"item_id": item_id, "company_id": current_user["company_id"]},
        {"_id": 0}
    ).sort("move_date", -1).to_list(500)
    return [serialize_doc(m) for m in moves]

# ============== SUPPLIER ROUTES ==============
@api_router.get("/suppliers")
async def get_suppliers(current_user: dict = Depends(get_current_user)):
    suppliers = await db.suppliers.find(
        {"company_id": current_user["company_id"], "is_active": True},
        {"_id": 0}
    ).to_list(500)
    return [serialize_doc(s) for s in suppliers]

@api_router.post("/suppliers")
async def create_supplier(request: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin", "almacen"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    supplier = Supplier(
        company_id=current_user["company_id"],
        name=request["name"],
        ruc=request.get("ruc"),
        address=request.get("address"),
        phone=request.get("phone"),
        email=request.get("email"),
        contact_person=request.get("contact_person"),
        category=request.get("category")
    )
    
    doc = supplier.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.suppliers.insert_one(doc)
    return {"id": supplier.id, "message": "Proveedor creado"}

# ============== PURCHASE ORDER ROUTES ==============
@api_router.get("/purchase-orders")
async def get_purchase_orders(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"company_id": current_user["company_id"]}
    if status:
        query["status"] = status
    orders = await db.purchase_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [serialize_doc(o) for o in orders]

@api_router.post("/purchase-orders")
async def create_purchase_order(request: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin", "almacen"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    count = await db.purchase_orders.count_documents({"company_id": current_user["company_id"]})
    order_number = f"OC-{count + 1:05d}"
    
    items = request.get("items", [])
    subtotal = sum(i.get("quantity", 0) * i.get("unit_price", 0) for i in items)
    tax = subtotal * 0.18  # IGV Peru
    total = subtotal + tax
    
    order = PurchaseOrder(
        company_id=current_user["company_id"],
        order_number=order_number,
        supplier_id=request["supplier_id"],
        items=items,
        subtotal=subtotal,
        tax=tax,
        total=total,
        notes=request.get("notes"),
        created_by=current_user["id"]
    )
    
    doc = order.model_dump()
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    await db.purchase_orders.insert_one(doc)
    return {"id": order.id, "order_number": order_number, "message": "Orden de compra creada"}

@api_router.post("/purchase-orders/{order_id}/receive")
async def receive_purchase_order(order_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    """Receive a purchase order and update inventory"""
    if current_user["role"] not in ["owner", "admin", "almacen"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    order = await db.purchase_orders.find_one({
        "id": order_id,
        "company_id": current_user["company_id"]
    })
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    if order.get("status") == "recibido":
        raise HTTPException(status_code=400, detail="Orden ya recibida")
    
    # Create stock entries for each item
    for item in order.get("items", []):
        if item.get("item_id"):
            move = StockMove(
                company_id=current_user["company_id"],
                item_id=item["item_id"],
                move_type="entrada",
                quantity=item.get("quantity", 0),
                unit_cost=item.get("unit_price", 0),
                total_cost=item.get("quantity", 0) * item.get("unit_price", 0),
                reference_type="purchase_order",
                reference_id=order_id,
                notes=f"Recepción OC {order.get('order_number', '')}",
                created_by=current_user["id"]
            )
            move_doc = move.model_dump()
            move_doc["move_date"] = move_doc["move_date"].isoformat()
            await db.stock_moves.insert_one(move_doc)
            
            # Update stock
            await db.inventory_items.update_one(
                {"id": item["item_id"]},
                {"$inc": {"current_stock": item.get("quantity", 0)}}
            )
    
    await db.purchase_orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "recibido",
            "received_by": current_user["id"],
            "received_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Orden recibida e inventario actualizado"}

# ============== EXTENDED WORK ORDER ROUTES ==============
@api_router.post("/maintenance/work-orders/{order_id}/start")
async def start_work_order(order_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    """Start a work order"""
    if current_user["role"] not in ["owner", "admin", "mantenimiento"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    order = await db.work_orders.find_one({
        "id": order_id,
        "company_id": current_user["company_id"]
    })
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    await db.work_orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "en_proceso",
            "start_date": datetime.now(timezone.utc).isoformat(),
            "technician": request.get("technician"),
            "odometer_at_service": request.get("odometer")
        }}
    )
    
    # Create downtime record
    downtime = DowntimeRecord(
        company_id=current_user["company_id"],
        vehicle_id=order["vehicle_id"],
        work_order_id=order_id,
        reason=order.get("description", "Mantenimiento"),
        created_by=current_user["id"]
    )
    dt_doc = downtime.model_dump()
    dt_doc["start_time"] = dt_doc["start_time"].isoformat()
    await db.downtime_records.insert_one(dt_doc)
    
    # Update vehicle status
    await db.vehicles.update_one(
        {"id": order["vehicle_id"]},
        {"$set": {"status": "en_mantenimiento"}}
    )
    
    return {"message": "Orden iniciada"}

@api_router.post("/maintenance/work-orders/{order_id}/complete")
async def complete_work_order(order_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    """Complete a work order"""
    if current_user["role"] not in ["owner", "admin", "mantenimiento"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    order = await db.work_orders.find_one({
        "id": order_id,
        "company_id": current_user["company_id"]
    })
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    labor_cost = request.get("labor_cost", 0)
    parts_cost = request.get("parts_cost", 0)
    total_cost = labor_cost + parts_cost
    
    await db.work_orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "completada",
            "end_date": datetime.now(timezone.utc).isoformat(),
            "labor_cost": labor_cost,
            "parts_cost": parts_cost,
            "total_cost": total_cost,
            "items": request.get("items", order.get("items", [])),
            "notes": request.get("notes"),
            "closed_by": current_user["id"]
        }}
    )
    
    # Consume parts from inventory
    for item in request.get("consumed_items", []):
        if item.get("item_id") and item.get("quantity"):
            move = StockMove(
                company_id=current_user["company_id"],
                item_id=item["item_id"],
                move_type="consumo_ot",
                quantity=item["quantity"],
                work_order_id=order_id,
                notes=f"Consumo OT {order.get('order_number', '')}",
                created_by=current_user["id"]
            )
            move_doc = move.model_dump()
            move_doc["move_date"] = move_doc["move_date"].isoformat()
            await db.stock_moves.insert_one(move_doc)
            
            await db.inventory_items.update_one(
                {"id": item["item_id"]},
                {"$inc": {"current_stock": -item["quantity"]}}
            )
    
    # Close downtime
    await db.downtime_records.update_one(
        {"work_order_id": order_id, "end_time": None},
        {"$set": {
            "end_time": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update vehicle
    await db.vehicles.update_one(
        {"id": order["vehicle_id"]},
        {"$set": {
            "status": "disponible",
            "last_maintenance_km": request.get("odometer", 0),
            "last_maintenance_date": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Resolve any blocks
    await db.blocks.update_many(
        {"work_order_id": order_id, "is_active": True},
        {"$set": {
            "is_active": False,
            "resolved_at": datetime.now(timezone.utc).isoformat(),
            "resolved_by": current_user["id"]
        }}
    )
    
    # Audit log
    await create_audit_log(
        current_user["company_id"],
        current_user["id"],
        current_user["name"],
        "complete_work_order",
        "work_order",
        order_id,
        {"total_cost": total_cost, "vehicle_id": order["vehicle_id"]}
    )
    
    return {"message": "Orden completada", "total_cost": total_cost}

# ============== TIRE EXTENDED ROUTES ==============
@api_router.post("/tires/rotate")
async def rotate_tires(request: dict, current_user: dict = Depends(get_current_user)):
    """Rotate tires on a vehicle"""
    if current_user["role"] not in ["owner", "admin", "mantenimiento", "flota"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    vehicle_id = request["vehicle_id"]
    changes = request.get("changes", [])  # [{from_position, to_position, tire_id}]
    odometer = request.get("odometer", 0)
    
    # Validate all tires exist and are mounted
    for change in changes:
        tire = await db.tires.find_one({
            "id": change["tire_id"],
            "current_vehicle_id": vehicle_id
        })
        if not tire:
            raise HTTPException(status_code=400, detail=f"Llanta {change['tire_id']} no está montada en este vehículo")
    
    # Perform rotation
    for change in changes:
        await db.tires.update_one(
            {"id": change["tire_id"]},
            {"$set": {"current_position": change["to_position"]}}
        )
    
    # Create rotation record
    rotation = TireRotation(
        company_id=current_user["company_id"],
        vehicle_id=vehicle_id,
        changes=changes,
        reason=request.get("reason"),
        odometer=odometer,
        created_by=current_user["id"]
    )
    doc = rotation.model_dump()
    doc["rotation_date"] = doc["rotation_date"].isoformat()
    await db.tire_rotations.insert_one(doc)
    
    return {"id": rotation.id, "message": "Rotación realizada"}

@api_router.post("/tires/align")
async def record_alignment(request: dict, current_user: dict = Depends(get_current_user)):
    """Record an alignment service"""
    if current_user["role"] not in ["owner", "admin", "mantenimiento", "flota"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    alignment = AlignmentRecord(
        company_id=current_user["company_id"],
        vehicle_id=request["vehicle_id"],
        axle=request["axle"],
        workshop=request.get("workshop"),
        cost=request.get("cost", 0),
        notes=request.get("notes"),
        created_by=current_user["id"]
    )
    doc = alignment.model_dump()
    doc["alignment_date"] = doc["alignment_date"].isoformat()
    await db.alignment_records.insert_one(doc)
    
    # Resolve any alignment alerts
    await db.alerts.update_many(
        {
            "company_id": current_user["company_id"],
            "entity_id": request["vehicle_id"],
            "alert_type": {"$in": ["tire_irregular_wear", "axle_misalignment"]},
            "resolved": False
        },
        {"$set": {"resolved": True, "resolved_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"id": alignment.id, "message": "Alineación registrada"}

@api_router.get("/tires/reports/required")
async def get_tires_required_report(current_user: dict = Depends(get_current_user)):
    """Get report of tires that need replacement/retreading"""
    company_id = current_user["company_id"]
    
    # Get company config for thresholds
    company = await db.companies.find_one({"id": company_id})
    config = company.get("config", {}) if company else {}
    critical_depth = config.get("tire_critical_depth", 3)
    warning_depth = config.get("tire_warning_depth", 5)
    
    # Get all tires in use with their latest inspection
    tires = await db.tires.find({
        "company_id": company_id,
        "status": "en_uso"
    }, {"_id": 0}).to_list(1000)
    
    replace_needed = []
    retread_needed = []
    
    for tire in tires:
        last_depth = tire.get("last_depth")
        if last_depth is not None:
            if last_depth <= critical_depth:
                if tire.get("life_number", 1) < 3:  # Can still retread
                    retread_needed.append(serialize_doc(tire))
                else:
                    replace_needed.append(serialize_doc(tire))
            elif last_depth <= warning_depth:
                retread_needed.append(serialize_doc(tire))
    
    # Group by dimension
    replace_by_dim = {}
    for t in replace_needed:
        dim = t.get("dimension", "Unknown")
        if dim not in replace_by_dim:
            replace_by_dim[dim] = []
        replace_by_dim[dim].append(t)
    
    retread_by_dim = {}
    for t in retread_needed:
        dim = t.get("dimension", "Unknown")
        if dim not in retread_by_dim:
            retread_by_dim[dim] = []
        retread_by_dim[dim].append(t)
    
    return {
        "replace_needed": replace_by_dim,
        "retread_needed": retread_by_dim,
        "total_replace": len(replace_needed),
        "total_retread": len(retread_needed)
    }

@api_router.get("/tires/{tire_id}/history")
async def get_tire_history(tire_id: str, current_user: dict = Depends(get_current_user)):
    """Get complete history of a tire"""
    tire = await db.tires.find_one({
        "id": tire_id,
        "company_id": current_user["company_id"]
    }, {"_id": 0})
    if not tire:
        raise HTTPException(status_code=404, detail="Llanta no encontrada")
    
    mounts = await db.tire_mounts.find({"tire_id": tire_id}, {"_id": 0}).sort("mount_date", -1).to_list(100)
    inspections = await db.tire_inspections.find({"tire_id": tire_id}, {"_id": 0}).sort("inspection_date", -1).to_list(100)
    life_events = await db.tire_life_events.find({"tire_id": tire_id}, {"_id": 0}).sort("event_date", -1).to_list(100)
    
    return {
        "tire": serialize_doc(tire),
        "mounts": [serialize_doc(m) for m in mounts],
        "inspections": [serialize_doc(i) for i in inspections],
        "life_events": [serialize_doc(e) for e in life_events]
    }

# ============== AUDIT LOG ROUTES ==============
@api_router.get("/audit-logs")
async def get_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    query = {"company_id": current_user["company_id"]}
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    if action:
        query["action"] = action
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return [serialize_doc(l) for l in logs]

# ============== FUEL EXTENDED ROUTES ==============
@api_router.get("/fuel/conciliation")
async def get_fuel_conciliation(
    vehicle_id: Optional[str] = None,
    trip_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get fuel conciliation report (vouchers vs actual loads)"""
    query = {"company_id": current_user["company_id"]}
    if vehicle_id:
        query["vehicle_id"] = vehicle_id
    if trip_id:
        query["trip_id"] = trip_id
    
    vouchers = await db.fuel_vouchers.find(query, {"_id": 0}).to_list(500)
    loads = await db.fuel_loads.find(query, {"_id": 0}).to_list(1000)
    
    results = []
    for voucher in vouchers:
        voucher_loads = [l for l in loads if l.get("voucher_id") == voucher["id"]]
        total_loaded = sum(l.get("liters", 0) for l in voucher_loads)
        total_amount = sum(l.get("total_amount", 0) for l in voucher_loads)
        
        limit = voucher.get("limit_liters") or voucher.get("limit_amount")
        used = total_loaded if voucher.get("limit_liters") else total_amount
        
        results.append({
            "voucher": serialize_doc(voucher),
            "loads": [serialize_doc(l) for l in voucher_loads],
            "total_loaded_liters": total_loaded,
            "total_amount": total_amount,
            "limit": limit,
            "used_percentage": (used / limit * 100) if limit else 0,
            "over_limit": used > limit if limit else False
        })
    
    # Loads without voucher
    no_voucher_loads = [l for l in loads if not l.get("voucher_id")]
    
    return {
        "voucher_conciliation": results,
        "loads_without_voucher": [serialize_doc(l) for l in no_voucher_loads],
        "total_without_voucher": len(no_voucher_loads)
    }

@api_router.get("/fuel/kpis")
async def get_fuel_kpis(
    vehicle_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get fuel KPIs (km/gal, cost/km)"""
    company_id = current_user["company_id"]
    
    query = {"company_id": company_id}
    if vehicle_id:
        query["vehicle_id"] = vehicle_id
    
    loads = await db.fuel_loads.find(query, {"_id": 0}).sort("load_date", -1).to_list(1000)
    
    if not loads:
        return {"message": "No hay datos de combustible"}
    
    # Group by vehicle
    vehicles_data = {}
    for load in loads:
        vid = load.get("vehicle_id")
        if vid not in vehicles_data:
            vehicles_data[vid] = {"loads": [], "total_liters": 0, "total_amount": 0}
        vehicles_data[vid]["loads"].append(load)
        vehicles_data[vid]["total_liters"] += load.get("liters", 0)
        vehicles_data[vid]["total_amount"] += load.get("total_amount", 0)
    
    kpis = []
    for vid, data in vehicles_data.items():
        sorted_loads = sorted(data["loads"], key=lambda x: x.get("odometer", 0))
        if len(sorted_loads) >= 2:
            km_traveled = sorted_loads[-1].get("odometer", 0) - sorted_loads[0].get("odometer", 0)
            if km_traveled > 0 and data["total_liters"] > 0:
                km_per_liter = km_traveled / data["total_liters"]
                km_per_gallon = km_per_liter * 3.78541  # Convert to gallons
                cost_per_km = data["total_amount"] / km_traveled
                
                vehicle = await db.vehicles.find_one({"id": vid}, {"_id": 0})
                kpis.append({
                    "vehicle_id": vid,
                    "plate": vehicle.get("plate") if vehicle else "Unknown",
                    "km_traveled": km_traveled,
                    "total_liters": data["total_liters"],
                    "total_amount": data["total_amount"],
                    "km_per_gallon": round(km_per_gallon, 2),
                    "cost_per_km": round(cost_per_km, 2),
                    "loads_count": len(data["loads"])
                })
    
    # Sort by km/gal efficiency
    kpis.sort(key=lambda x: x.get("km_per_gallon", 0), reverse=True)
    
    return {"vehicle_kpis": kpis}

# ============== OCR ENDPOINT FOR FUEL VOUCHERS ==============
@api_router.post("/fuel/ocr")
async def extract_fuel_voucher_data(request: dict, current_user: dict = Depends(get_current_user)):
    """
    Extract data from fuel voucher photo using AI vision
    Accepts base64 image data and returns extracted fields
    """
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        image_data = request.get("image_base64", "")
        if not image_data:
            raise HTTPException(status_code=400, detail="Se requiere imagen en base64")
        
        # Clean base64 data
        if "base64," in image_data:
            image_data = image_data.split("base64,")[1]
        
        api_key = os.environ.get("EMERGENT_LLM_KEY", "")
        if not api_key:
            raise HTTPException(status_code=500, detail="API key no configurada")
        
        # Initialize chat with Gemini for vision
        chat = LlmChat(
            api_key=api_key,
            session_id=f"ocr-{uuid.uuid4()}",
            system_message="""Eres un asistente especializado en extraer datos de vales y recibos de combustible peruanos.
Analiza la imagen del vale de combustible y extrae la siguiente información en formato JSON:
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
Devuelve SOLO el JSON sin explicaciones adicionales."""
        ).with_model("gemini", "gemini-2.5-flash")
        
        # Create image content
        image_content = ImageContent(image_base64=image_data)
        
        # Send message with image
        user_message = UserMessage(
            text="Extrae los datos del siguiente vale de combustible:",
            image_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        
        # Try to parse JSON from response
        import json
        import re
        
        # Clean response - remove markdown code blocks if present
        cleaned_response = response.strip()
        if cleaned_response.startswith("```"):
            cleaned_response = re.sub(r'^```(?:json)?\n?', '', cleaned_response)
            cleaned_response = re.sub(r'\n?```$', '', cleaned_response)
        
        try:
            extracted_data = json.loads(cleaned_response)
        except json.JSONDecodeError:
            # Try to find JSON in response
            json_match = re.search(r'\{[^{}]*\}', cleaned_response, re.DOTALL)
            if json_match:
                extracted_data = json.loads(json_match.group())
            else:
                extracted_data = {"raw_response": response, "parse_error": True}
        
        return {
            "success": True,
            "extracted_data": extracted_data
        }
        
    except ImportError:
        raise HTTPException(status_code=500, detail="Módulo de IA no disponible")
    except Exception as e:
        logging.error(f"OCR error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al procesar imagen: {str(e)}")

# ============== DASHBOARD/REPORTS ROUTES ==============
@api_router.get("/dashboard/kpis")
async def get_dashboard_kpis(current_user: dict = Depends(get_current_user)):
    company_id = current_user["company_id"]
    
    # Count vehicles by status
    total_vehicles = await db.vehicles.count_documents({"company_id": company_id})
    available_vehicles = await db.vehicles.count_documents({"company_id": company_id, "status": "disponible"})
    in_trip_vehicles = await db.vehicles.count_documents({"company_id": company_id, "status": "en_viaje"})
    in_maintenance = await db.vehicles.count_documents({"company_id": company_id, "status": "en_mantenimiento"})
    
    # Count trips by status
    total_trips = await db.trips.count_documents({"company_id": company_id})
    active_trips = await db.trips.count_documents({"company_id": company_id, "status": "en_curso"})
    completed_trips = await db.trips.count_documents({"company_id": company_id, "status": "completado"})
    
    # Count drivers
    total_drivers = await db.users.count_documents({"company_id": company_id, "role": "chofer"})
    
    # Count active alerts
    active_alerts = await db.alerts.count_documents({"company_id": company_id, "resolved": False})
    critical_alerts = await db.alerts.count_documents({"company_id": company_id, "resolved": False, "severity": "critical"})
    
    # Count active blocks
    active_blocks = await db.blocks.count_documents({"company_id": company_id, "is_active": True})
    
    # Count expiring documents (next 30 days)
    thirty_days = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    expiring_docs = await db.documents.count_documents({
        "company_id": company_id,
        "expiry_date": {"$lte": thirty_days},
        "status": {"$in": ["vigente", "por_vencer"]}
    })
    
    # Open work orders
    open_work_orders = await db.work_orders.count_documents({
        "company_id": company_id,
        "status": {"$in": ["abierta", "en_proceso"]}
    })
    
    return {
        "vehicles": {
            "total": total_vehicles,
            "available": available_vehicles,
            "in_trip": in_trip_vehicles,
            "in_maintenance": in_maintenance,
            "availability_rate": round((available_vehicles / total_vehicles * 100) if total_vehicles > 0 else 0, 1)
        },
        "trips": {
            "total": total_trips,
            "active": active_trips,
            "completed": completed_trips
        },
        "drivers": {
            "total": total_drivers
        },
        "alerts": {
            "total": active_alerts,
            "critical": critical_alerts
        },
        "blocks": {
            "active": active_blocks
        },
        "documents": {
            "expiring": expiring_docs
        },
        "maintenance": {
            "open_orders": open_work_orders
        }
    }

@api_router.get("/dashboard/recent-activity")
async def get_recent_activity(current_user: dict = Depends(get_current_user)):
    company_id = current_user["company_id"]
    
    # Get recent trips
    recent_trips = await db.trips.find(
        {"company_id": company_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    # Get recent alerts
    recent_alerts = await db.alerts.find(
        {"company_id": company_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    # Get recent work orders
    recent_orders = await db.work_orders.find(
        {"company_id": company_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    return {
        "trips": [serialize_doc(t) for t in recent_trips],
        "alerts": [serialize_doc(a) for a in recent_alerts],
        "work_orders": [serialize_doc(o) for o in recent_orders]
    }

# ============== FILE UPLOAD ROUTE ==============
import boto3
from botocore.exceptions import ClientError
import base64

def get_s3_client():
    """Get S3 client if credentials are configured"""
    access_key = os.environ.get('AWS_ACCESS_KEY_ID', '')
    secret_key = os.environ.get('AWS_SECRET_ACCESS_KEY', '')
    region = os.environ.get('AWS_REGION', 'us-east-1')
    
    if access_key and secret_key:
        return boto3.client(
            's3',
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region
        )
    return None

@api_router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    entity_type: str = Form(...),
    entity_id: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload file to S3 or local storage"""
    # Generate unique filename
    ext = Path(file.filename).suffix
    filename = f"{uuid.uuid4()}{ext}"
    file_key = f"{entity_type}/{entity_id}/{filename}"
    
    # Read file content
    file_content = await file.read()
    
    # Try S3 first
    s3_client = get_s3_client()
    bucket_name = os.environ.get('S3_BUCKET_NAME', '')
    
    if s3_client and bucket_name:
        try:
            s3_client.put_object(
                Bucket=bucket_name,
                Key=file_key,
                Body=file_content,
                ContentType=file.content_type
            )
            # Generate presigned URL for access
            url = s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket_name, 'Key': file_key},
                ExpiresIn=86400 * 7  # 7 days
            )
            return {"url": url, "filename": filename, "storage": "s3", "key": file_key}
        except ClientError as e:
            logging.error(f"S3 upload error: {e}")
    
    # Fall back to local storage
    entity_dir = UPLOAD_DIR / entity_type / entity_id
    entity_dir.mkdir(parents=True, exist_ok=True)
    file_path = entity_dir / filename
    
    with open(file_path, "wb") as buffer:
        buffer.write(file_content)
    
    relative_url = f"/uploads/{entity_type}/{entity_id}/{filename}"
    return {"url": relative_url, "filename": filename, "storage": "local"}

@api_router.post("/upload/base64")
async def upload_base64(request: dict, current_user: dict = Depends(get_current_user)):
    """Upload base64 encoded image (for camera captures)"""
    data = request.get("data", "")
    entity_type = request.get("entity_type", "general")
    entity_id = request.get("entity_id", "general")
    
    # Parse base64 data
    if "base64," in data:
        data = data.split("base64,")[1]
    
    try:
        file_content = base64.b64decode(data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 data")
    
    filename = f"{uuid.uuid4()}.jpg"
    file_key = f"{entity_type}/{entity_id}/{filename}"
    
    # Try S3 first
    s3_client = get_s3_client()
    bucket_name = os.environ.get('S3_BUCKET_NAME', '')
    
    if s3_client and bucket_name:
        try:
            s3_client.put_object(
                Bucket=bucket_name,
                Key=file_key,
                Body=file_content,
                ContentType="image/jpeg"
            )
            url = s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket_name, 'Key': file_key},
                ExpiresIn=86400 * 7
            )
            return {"url": url, "filename": filename, "storage": "s3"}
        except ClientError as e:
            logging.error(f"S3 upload error: {e}")
    
    # Fall back to local storage
    entity_dir = UPLOAD_DIR / entity_type / entity_id
    entity_dir.mkdir(parents=True, exist_ok=True)
    file_path = entity_dir / filename
    
    with open(file_path, "wb") as buffer:
        buffer.write(file_content)
    
    relative_url = f"/uploads/{entity_type}/{entity_id}/{filename}"
    return {"url": relative_url, "filename": filename, "storage": "local"}

# ============== PUSH NOTIFICATIONS ==============
@api_router.post("/notifications/subscribe")
async def subscribe_push(request: dict, current_user: dict = Depends(get_current_user)):
    """Subscribe to push notifications"""
    subscription = request.get("subscription", {})
    
    # Store subscription in user document
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"push_subscription": subscription}}
    )
    
    return {"message": "Subscripción registrada"}

@api_router.delete("/notifications/unsubscribe")
async def unsubscribe_push(current_user: dict = Depends(get_current_user)):
    """Unsubscribe from push notifications"""
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$unset": {"push_subscription": ""}}
    )
    
    return {"message": "Subscripción eliminada"}

@api_router.get("/notifications")
async def get_notifications(
    unread_only: bool = False,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get user notifications"""
    query = {"company_id": current_user["company_id"]}
    
    # Role-based filtering
    if current_user["role"] == "chofer":
        query["$or"] = [
            {"user_id": current_user["id"]},
            {"target_role": "chofer"},
            {"target_role": "all"}
        ]
    
    if unread_only:
        query["is_read"] = False
    
    notifications = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return [serialize_doc(n) for n in notifications]

@api_router.post("/notifications")
async def create_notification(request: dict, current_user: dict = Depends(get_current_user)):
    """Create a notification (admin only)"""
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    notification = {
        "id": str(uuid.uuid4()),
        "company_id": current_user["company_id"],
        "title": request.get("title", ""),
        "message": request.get("message", ""),
        "type": request.get("type", "info"),  # info, warning, alert, success
        "target_role": request.get("target_role", "all"),  # all, chofer, admin, etc.
        "user_id": request.get("user_id"),  # specific user
        "entity_type": request.get("entity_type"),
        "entity_id": request.get("entity_id"),
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.notifications.insert_one(notification)
    
    # Send push notification to subscribed users
    await send_push_notifications(
        current_user["company_id"],
        notification["title"],
        notification["message"],
        notification.get("target_role"),
        notification.get("user_id")
    )
    
    return {"id": notification["id"], "message": "Notificación creada"}

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark notification as read"""
    await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Notificación marcada como leída"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    query = {"company_id": current_user["company_id"], "is_read": False}
    if current_user["role"] == "chofer":
        query["$or"] = [
            {"user_id": current_user["id"]},
            {"target_role": "chofer"},
            {"target_role": "all"}
        ]
    
    await db.notifications.update_many(
        query,
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Todas las notificaciones marcadas como leídas"}

async def send_push_notifications(company_id: str, title: str, message: str, target_role: str = None, user_id: str = None):
    """Send push notifications to subscribed users"""
    try:
        from pywebpush import webpush, WebPushException
        
        vapid_private = os.environ.get('VAPID_PRIVATE_KEY', '')
        vapid_public = os.environ.get('VAPID_PUBLIC_KEY', '')
        
        if not vapid_private or not vapid_public:
            return
        
        # Find users with push subscriptions
        query = {"company_id": company_id, "push_subscription": {"$exists": True}}
        if user_id:
            query["id"] = user_id
        elif target_role and target_role != "all":
            query["role"] = target_role
        
        users = await db.users.find(query, {"_id": 0, "push_subscription": 1}).to_list(1000)
        
        payload = {
            "title": title,
            "body": message,
            "icon": "/logo192.png",
            "badge": "/logo192.png"
        }
        
        for user in users:
            subscription = user.get("push_subscription")
            if subscription:
                try:
                    webpush(
                        subscription,
                        data=str(payload),
                        vapid_private_key=vapid_private,
                        vapid_claims={"sub": "mailto:admin@transperu.com"}
                    )
                except WebPushException as e:
                    logging.error(f"Push notification error: {e}")
    except ImportError:
        logging.warning("pywebpush not installed, skipping push notifications")
    except Exception as e:
        logging.error(f"Push notification error: {e}")

# ============== ALERTS AUTO-GENERATION ==============
@api_router.post("/alerts/generate")
async def generate_alerts(current_user: dict = Depends(get_current_user)):
    """Generate alerts for expiring documents and other issues"""
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    company_id = current_user["company_id"]
    alerts_created = 0
    
    # Check expiring documents
    now = datetime.now(timezone.utc)
    alert_days = [60, 30, 15, 7, 3, 1, 0]
    
    documents = await db.documents.find({
        "company_id": company_id,
        "expiry_date": {"$exists": True}
    }, {"_id": 0}).to_list(1000)
    
    for doc in documents:
        if not doc.get("expiry_date"):
            continue
        
        expiry = doc["expiry_date"]
        if isinstance(expiry, str):
            expiry = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
        
        days_until = (expiry - now).days
        
        for alert_day in alert_days:
            if days_until <= alert_day:
                # Check if alert already exists
                existing = await db.alerts.find_one({
                    "entity_id": doc["id"],
                    "alert_type": "document_expiry",
                    "resolved": False
                })
                
                if not existing:
                    doc_type = await db.document_types.find_one({"id": doc["document_type_id"]})
                    entity = await db.vehicles.find_one({"id": doc["entity_id"]}) or await db.users.find_one({"id": doc["entity_id"]})
                    
                    severity = "critical" if days_until <= 0 else "warning" if days_until <= 7 else "info"
                    
                    alert = {
                        "id": str(uuid.uuid4()),
                        "company_id": company_id,
                        "alert_type": "document_expiry",
                        "entity_type": doc["entity_type"],
                        "entity_id": doc["id"],
                        "message": f"{doc_type['name'] if doc_type else 'Documento'} de {entity.get('plate') or entity.get('name', 'N/A')} {'VENCIDO' if days_until <= 0 else f'vence en {days_until} días'}",
                        "severity": severity,
                        "is_read": False,
                        "resolved": False,
                        "created_at": now.isoformat()
                    }
                    
                    await db.alerts.insert_one(alert)
                    alerts_created += 1
                    
                    # Create notification for critical alerts
                    if severity == "critical":
                        await db.notifications.insert_one({
                            "id": str(uuid.uuid4()),
                            "company_id": company_id,
                            "title": "⚠️ Documento Vencido",
                            "message": alert["message"],
                            "type": "alert",
                            "target_role": "admin",
                            "entity_type": "alert",
                            "entity_id": alert["id"],
                            "is_read": False,
                            "created_at": now.isoformat()
                        })
                break
    
    return {"message": f"{alerts_created} alertas generadas"}

# ============== SEED DATA ROUTE (FOR DEMO) ==============
@api_router.post("/seed")
async def seed_demo_data():
    """Create demo data for testing"""
    # Check if company already exists
    existing = await db.companies.find_one({"ruc": "20123456789"})
    if existing:
        return {"message": "Demo data already exists", "company_id": existing["id"]}
    
    # Create company
    company = Company(
        name="TransPeru Logistics S.A.C.",
        ruc="20123456789",
        address="Av. Industrial 123, Lima",
        phone="+51 1 555 0123",
        email="admin@transperu.com",
        config={
            "lockout_minutes": 15,
            "max_failed_attempts": 5,
            "tire_critical_depth": 3,
            "tire_warning_depth": 5
        }
    )
    company_doc = company.model_dump()
    for key, value in company_doc.items():
        if isinstance(value, datetime):
            company_doc[key] = value.isoformat()
    await db.companies.insert_one(company_doc)
    
    # Create admin user
    admin = User(
        company_id=company.id,
        email="admin@transperu.com",
        name="Administrador Principal",
        role=UserRole.ADMIN,
        password_hash=hash_password("admin123")
    )
    admin_doc = admin.model_dump()
    for key, value in admin_doc.items():
        if isinstance(value, datetime):
            admin_doc[key] = value.isoformat()
    await db.users.insert_one(admin_doc)
    
    # Create drivers
    drivers = [
        {"dni": "12345678", "name": "Juan Pérez Rodríguez", "pin": "123456", "license": "Q12345678", "phone": "+51 987 654 321"},
        {"dni": "87654321", "name": "Carlos García López", "pin": "654321", "license": "Q87654321", "phone": "+51 987 654 322"},
        {"dni": "11223344", "name": "Pedro Mendoza Silva", "pin": "112233", "license": "Q11223344", "phone": "+51 987 654 323"},
    ]
    
    driver_ids = []
    for d in drivers:
        driver = User(
            company_id=company.id,
            dni=d["dni"],
            name=d["name"],
            role=UserRole.CHOFER,
            pin_hash=hash_password(d["pin"]),
            license_number=d["license"],
            license_expiry=datetime.now(timezone.utc) + timedelta(days=365),
            phone=d["phone"]
        )
        driver_doc = driver.model_dump()
        for key, value in driver_doc.items():
            if isinstance(value, datetime):
                driver_doc[key] = value.isoformat()
        await db.users.insert_one(driver_doc)
        driver_ids.append(driver.id)
    
    # Create vehicles - Tractos
    tractos = [
        {"plate": "ABC-123", "brand": "Volvo", "model": "FH16", "year": 2022, "color": "Blanco"},
        {"plate": "DEF-456", "brand": "Scania", "model": "R500", "year": 2021, "color": "Rojo"},
        {"plate": "GHI-789", "brand": "Mercedes", "model": "Actros", "year": 2023, "color": "Azul"},
    ]
    
    tracto_ids = []
    for t in tractos:
        vehicle = Vehicle(
            company_id=company.id,
            plate=t["plate"],
            vehicle_type=VehicleType.TRACTO,
            brand=t["brand"],
            model=t["model"],
            year=t["year"],
            color=t["color"],
            fuel_capacity=400,
            tire_config="6"
        )
        vehicle_doc = vehicle.model_dump()
        for key, value in vehicle_doc.items():
            if isinstance(value, datetime):
                vehicle_doc[key] = value.isoformat()
        await db.vehicles.insert_one(vehicle_doc)
        tracto_ids.append(vehicle.id)
    
    # Create vehicles - Carretas
    carretas = [
        {"plate": "T1A-001", "brand": "Facchini", "model": "Plataforma", "year": 2021},
        {"plate": "T1B-002", "brand": "Guerra", "model": "Cisterna", "year": 2020},
        {"plate": "T1C-003", "brand": "Randon", "model": "Furgón", "year": 2022},
    ]
    
    carreta_ids = []
    for c in carretas:
        vehicle = Vehicle(
            company_id=company.id,
            plate=c["plate"],
            vehicle_type=VehicleType.CARRETA,
            brand=c["brand"],
            model=c["model"],
            year=c["year"],
            tire_config="6"
        )
        vehicle_doc = vehicle.model_dump()
        for key, value in vehicle_doc.items():
            if isinstance(value, datetime):
                vehicle_doc[key] = value.isoformat()
        await db.vehicles.insert_one(vehicle_doc)
        carreta_ids.append(vehicle.id)
    
    # Create document types
    doc_types = [
        {"name": "SOAT", "applies_to": "vehiculo", "is_critical": True, "block_rule": "bloquea_inicio"},
        {"name": "Revisión Técnica (CITV)", "applies_to": "vehiculo", "is_critical": True, "block_rule": "bloquea_inicio"},
        {"name": "Tarjeta de Propiedad", "applies_to": "vehiculo", "is_critical": True, "block_rule": "bloquea_asignacion"},
        {"name": "Póliza de Seguro", "applies_to": "vehiculo", "is_critical": False, "block_rule": "solo_alerta"},
        {"name": "Licencia de Conducir", "applies_to": "chofer", "is_critical": True, "block_rule": "bloquea_asignacion"},
        {"name": "DNI", "applies_to": "chofer", "is_critical": True, "block_rule": "bloquea_asignacion"},
        {"name": "Certificado Médico", "applies_to": "chofer", "is_critical": False, "block_rule": "solo_alerta"},
    ]
    
    doc_type_ids = {}
    for dt in doc_types:
        doc_type = DocumentType(
            company_id=company.id,
            name=dt["name"],
            applies_to=dt["applies_to"],
            is_critical=dt["is_critical"],
            block_rule=BlockRule(dt["block_rule"])
        )
        doc_type_doc = doc_type.model_dump()
        doc_type_doc["created_at"] = doc_type_doc["created_at"].isoformat()
        await db.document_types.insert_one(doc_type_doc)
        doc_type_ids[dt["name"]] = doc_type.id
    
    # Create routes
    routes = [
        {"name": "Lima - Arequipa", "origin": "Lima", "destination": "Arequipa", "distance_km": 1010, "estimated_hours": 16, "toll_cost": 180},
        {"name": "Lima - Trujillo", "origin": "Lima", "destination": "Trujillo", "distance_km": 560, "estimated_hours": 8, "toll_cost": 95},
        {"name": "Lima - Cusco", "origin": "Lima", "destination": "Cusco", "distance_km": 1105, "estimated_hours": 20, "toll_cost": 210},
    ]
    
    route_ids = []
    for r in routes:
        route = Route(
            company_id=company.id,
            name=r["name"],
            origin=r["origin"],
            destination=r["destination"],
            distance_km=r["distance_km"],
            estimated_hours=r["estimated_hours"],
            toll_cost=r["toll_cost"]
        )
        route_doc = route.model_dump()
        route_doc["created_at"] = route_doc["created_at"].isoformat()
        await db.routes.insert_one(route_doc)
        route_ids.append(route.id)
    
    # Create some tires
    tire_brands = ["Michelin", "Bridgestone", "Goodyear", "Continental"]
    tire_positions_tracto = ["T-1L", "T-1R", "T-2L1", "T-2L2", "T-2R1", "T-2R2"]
    tire_positions_carreta = ["C-A-L", "C-A-R", "C-B-L", "C-B-R", "C-C-L", "C-C-R"]
    
    for i, tracto_id in enumerate(tracto_ids):
        for j, pos in enumerate(tire_positions_tracto):
            tire = Tire(
                company_id=company.id,
                serial=f"TR{i+1}-{pos}-{j+1:03d}",
                brand=tire_brands[j % len(tire_brands)],
                model="XZA3",
                dimension="295/80R22.5",
                purchase_cost=450,
                status=TireStatus.EN_USO,
                current_vehicle_id=tracto_id,
                current_position=pos
            )
            tire_doc = tire.model_dump()
            for key, value in tire_doc.items():
                if isinstance(value, datetime):
                    tire_doc[key] = value.isoformat()
            await db.tires.insert_one(tire_doc)
    
    # Create a sample trip
    trip = Trip(
        company_id=company.id,
        tracto_id=tracto_ids[0],
        carreta_id=carreta_ids[0],
        driver_id=driver_ids[0],
        route_id=route_ids[0],
        client_name="Minera Sur S.A.",
        cargo_description="Maquinaria pesada",
        cargo_weight=25000,
        status=TripStatus.PROGRAMADO,
        scheduled_date=datetime.now(timezone.utc) + timedelta(days=1)
    )
    trip_doc = trip.model_dump()
    for key, value in trip_doc.items():
        if isinstance(value, datetime):
            trip_doc[key] = value.isoformat()
    await db.trips.insert_one(trip_doc)
    
    return {
        "message": "Demo data created successfully",
        "company_id": company.id,
        "admin_email": "admin@transperu.com",
        "admin_password": "admin123",
        "sample_driver": {
            "dni": "12345678",
            "pin": "123456"
        }
    }

# ============== REPORTS ENDPOINTS ==============
from fastapi.responses import StreamingResponse
from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill

@api_router.get("/reports/trips")
async def get_trips_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = None,
    driver_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get trips report data"""
    query = {"company_id": current_user["company_id"]}
    if start_date:
        query["scheduled_date"] = {"$gte": start_date}
    if end_date:
        query.setdefault("scheduled_date", {})["$lte"] = end_date
    if status:
        query["status"] = status
    if driver_id:
        query["driver_id"] = driver_id
    
    trips = await db.trips.find(query, {"_id": 0}).sort("scheduled_date", -1).to_list(500)
    
    # Enrich with driver and vehicle info
    for trip in trips:
        driver = await db.users.find_one({"id": trip.get("driver_id")}, {"_id": 0, "name": 1})
        tracto = await db.vehicles.find_one({"id": trip.get("tracto_id")}, {"_id": 0, "plate": 1})
        trip["driver_name"] = driver.get("name") if driver else "-"
        trip["tracto_plate"] = tracto.get("plate") if tracto else "-"
    
    # Calculate totals
    total_km = sum((t.get("km_end", 0) or 0) - (t.get("km_start", 0) or 0) for t in trips)
    total_advances = sum(t.get("total_advance", 0) or 0 for t in trips)
    total_expenses = sum(t.get("total_expenses", 0) or 0 for t in trips)
    
    return {
        "trips": [serialize_doc(t) for t in trips],
        "totals": {
            "count": len(trips),
            "total_km": total_km,
            "total_advances": total_advances,
            "total_expenses": total_expenses,
            "balance": total_advances - total_expenses
        }
    }

@api_router.get("/reports/trips/export/excel")
async def export_trips_excel(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Export trips report to Excel"""
    query = {"company_id": current_user["company_id"]}
    if start_date:
        query["scheduled_date"] = {"$gte": start_date}
    if end_date:
        query.setdefault("scheduled_date", {})["$lte"] = end_date
    
    trips = await db.trips.find(query, {"_id": 0}).sort("scheduled_date", -1).to_list(500)
    
    # Create Excel workbook
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Viajes"
    
    # Header style
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin')
    )
    
    # Headers
    headers = ["Fecha", "Tracto", "Carreta", "Chofer", "Cliente", "Carga", "Estado", "Km Inicio", "Km Fin", "Anticipo", "Gastos", "Saldo"]
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border
    
    # Data
    for row, trip in enumerate(trips, 2):
        driver = await db.users.find_one({"id": trip.get("driver_id")}, {"_id": 0, "name": 1})
        tracto = await db.vehicles.find_one({"id": trip.get("tracto_id")}, {"_id": 0, "plate": 1})
        carreta = await db.vehicles.find_one({"id": trip.get("carreta_id")}, {"_id": 0, "plate": 1}) if trip.get("carreta_id") else None
        
        data = [
            trip.get("scheduled_date", "")[:10] if trip.get("scheduled_date") else "",
            tracto.get("plate") if tracto else "-",
            carreta.get("plate") if carreta else "-",
            driver.get("name") if driver else "-",
            trip.get("client_name", "-"),
            trip.get("cargo_description", "-"),
            trip.get("status", "-"),
            trip.get("km_start", 0),
            trip.get("km_end", 0),
            trip.get("total_advance", 0),
            trip.get("total_expenses", 0),
            (trip.get("total_advance", 0) or 0) - (trip.get("total_expenses", 0) or 0)
        ]
        for col, value in enumerate(data, 1):
            cell = ws.cell(row=row, column=col, value=value)
            cell.border = thin_border
    
    # Auto-adjust column widths
    for col in range(1, len(headers) + 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(col)].width = 15
    
    # Save to bytes
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=reporte_viajes.xlsx"}
    )

@api_router.get("/reports/settlements/export/pdf/{trip_id}")
async def export_settlement_pdf(trip_id: str, current_user: dict = Depends(get_current_user)):
    """Export settlement to PDF"""
    trip = await db.trips.find_one({"id": trip_id, "company_id": current_user["company_id"]}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    
    driver = await db.users.find_one({"id": trip.get("driver_id")}, {"_id": 0})
    tracto = await db.vehicles.find_one({"id": trip.get("tracto_id")}, {"_id": 0})
    advances = await db.trip_advances.find({"trip_id": trip_id}, {"_id": 0}).to_list(100)
    expenses = await db.trip_expenses.find({"trip_id": trip_id}, {"_id": 0}).to_list(100)
    
    # Create PDF
    output = BytesIO()
    doc = SimpleDocTemplate(output, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
    styles = getSampleStyleSheet()
    elements = []
    
    # Title
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, alignment=1, spaceAfter=20)
    elements.append(Paragraph("LIQUIDACIÓN DE VIAJE", title_style))
    elements.append(Spacer(1, 12))
    
    # Trip info
    info_data = [
        ["Fecha:", trip.get("scheduled_date", "")[:10] if trip.get("scheduled_date") else "-"],
        ["Chofer:", driver.get("name") if driver else "-"],
        ["Vehículo:", tracto.get("plate") if tracto else "-"],
        ["Cliente:", trip.get("client_name", "-")],
        ["Carga:", trip.get("cargo_description", "-")],
    ]
    info_table = Table(info_data, colWidths=[100, 300])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 20))
    
    # Advances table
    elements.append(Paragraph("ANTICIPOS", styles['Heading2']))
    if advances:
        adv_data = [["Fecha", "Método", "Monto"]]
        for adv in advances:
            adv_data.append([
                adv.get("delivered_date", "")[:10] if adv.get("delivered_date") else "-",
                adv.get("payment_method", "-"),
                f"S/ {adv.get('amount', 0):.2f}"
            ])
        adv_table = Table(adv_data, colWidths=[150, 150, 100])
        adv_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        elements.append(adv_table)
    else:
        elements.append(Paragraph("Sin anticipos registrados", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Expenses table
    elements.append(Paragraph("GASTOS", styles['Heading2']))
    if expenses:
        exp_data = [["Categoría", "Descripción", "Proveedor", "Monto"]]
        for exp in expenses:
            exp_data.append([
                exp.get("category", "-"),
                exp.get("description", "-")[:30],
                exp.get("provider", "-"),
                f"S/ {exp.get('amount', 0):.2f}"
            ])
        exp_table = Table(exp_data, colWidths=[100, 150, 100, 80])
        exp_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        elements.append(exp_table)
    else:
        elements.append(Paragraph("Sin gastos registrados", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Summary
    total_advances = sum(a.get("amount", 0) for a in advances)
    total_expenses = sum(e.get("amount", 0) for e in expenses)
    balance = total_advances - total_expenses
    
    summary_data = [
        ["Total Anticipos:", f"S/ {total_advances:.2f}"],
        ["Total Gastos:", f"S/ {total_expenses:.2f}"],
        ["SALDO:", f"S/ {abs(balance):.2f} {'(A favor empresa)' if balance >= 0 else '(A favor chofer)'}"],
    ]
    summary_table = Table(summary_data, colWidths=[150, 200])
    summary_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('BACKGROUND', (0, 2), (-1, 2), colors.lightgrey),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 40))
    
    # Signatures
    sig_data = [["", ""], ["_______________________", "_______________________"], ["Chofer", "Contabilidad"]]
    sig_table = Table(sig_data, colWidths=[200, 200])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 1), (-1, 1), 40),
    ]))
    elements.append(sig_table)
    
    doc.build(elements)
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=liquidacion_{trip_id[:8]}.pdf"}
    )

@api_router.get("/reports/fuel")
async def get_fuel_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get fuel consumption report"""
    query = {"company_id": current_user["company_id"]}
    if start_date:
        query["load_date"] = {"$gte": start_date}
    if end_date:
        query.setdefault("load_date", {})["$lte"] = end_date
    if vehicle_id:
        query["vehicle_id"] = vehicle_id
    
    loads = await db.fuel_loads.find(query, {"_id": 0}).sort("load_date", -1).to_list(500)
    
    # Calculate totals and KPIs
    total_liters = sum(l.get("liters", 0) for l in loads)
    total_amount = sum(l.get("total_amount", 0) for l in loads)
    
    # Group by vehicle
    by_vehicle = {}
    for load in loads:
        vid = load.get("vehicle_id", "unknown")
        if vid not in by_vehicle:
            by_vehicle[vid] = {"liters": 0, "amount": 0, "loads": 0}
        by_vehicle[vid]["liters"] += load.get("liters", 0)
        by_vehicle[vid]["amount"] += load.get("total_amount", 0)
        by_vehicle[vid]["loads"] += 1
    
    return {
        "loads": [serialize_doc(l) for l in loads],
        "totals": {
            "total_liters": total_liters,
            "total_amount": total_amount,
            "total_loads": len(loads),
            "avg_price_per_liter": total_amount / total_liters if total_liters > 0 else 0
        },
        "by_vehicle": by_vehicle
    }

@api_router.get("/reports/maintenance")
async def get_maintenance_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get maintenance report"""
    query = {"company_id": current_user["company_id"]}
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        query.setdefault("created_at", {})["$lte"] = end_date
    if vehicle_id:
        query["vehicle_id"] = vehicle_id
    
    work_orders = await db.work_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Calculate totals
    total_cost = sum(wo.get("total_cost", 0) for wo in work_orders)
    by_status = {}
    by_type = {}
    
    for wo in work_orders:
        status = wo.get("status", "unknown")
        by_status[status] = by_status.get(status, 0) + 1
        
        order_type = wo.get("order_type", "unknown")
        by_type[order_type] = by_type.get(order_type, 0) + 1
    
    return {
        "work_orders": [serialize_doc(wo) for wo in work_orders],
        "totals": {
            "count": len(work_orders),
            "total_cost": total_cost
        },
        "by_status": by_status,
        "by_type": by_type
    }

# ============== CONFIGURATION ENDPOINTS ==============
@api_router.get("/config/document-types")
async def get_document_types_config(current_user: dict = Depends(get_current_user)):
    """Get document types configuration"""
    doc_types = await db.document_types.find(
        {"company_id": current_user["company_id"]},
        {"_id": 0}
    ).to_list(100)
    return [serialize_doc(dt) for dt in doc_types]

@api_router.post("/config/document-types")
async def create_document_type_config(request: dict, current_user: dict = Depends(get_current_user)):
    """Create new document type"""
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    doc_type = DocumentType(
        company_id=current_user["company_id"],
        name=request.get("name"),
        applies_to=request.get("applies_to", "vehiculo"),
        is_critical=request.get("is_critical", False),
        requires_expiry=request.get("requires_expiry", True),
        alert_days=request.get("alert_days", [60, 30, 15, 7, 3, 1]),
        block_rule=BlockRule(request.get("block_rule", "solo_alerta"))
    )
    
    doc = doc_type.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.document_types.insert_one(doc)
    
    return {"id": doc_type.id, "message": "Tipo de documento creado"}

@api_router.put("/config/document-types/{doc_type_id}")
async def update_document_type_config(doc_type_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    """Update document type"""
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    update_data = {}
    if "name" in request:
        update_data["name"] = request["name"]
    if "is_critical" in request:
        update_data["is_critical"] = request["is_critical"]
    if "requires_expiry" in request:
        update_data["requires_expiry"] = request["requires_expiry"]
    if "alert_days" in request:
        update_data["alert_days"] = request["alert_days"]
    if "block_rule" in request:
        update_data["block_rule"] = request["block_rule"]
    
    await db.document_types.update_one(
        {"id": doc_type_id, "company_id": current_user["company_id"]},
        {"$set": update_data}
    )
    
    return {"message": "Tipo de documento actualizado"}

@api_router.delete("/config/document-types/{doc_type_id}")
async def delete_document_type_config(doc_type_id: str, current_user: dict = Depends(get_current_user)):
    """Delete document type"""
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    # Check if any documents use this type
    docs_count = await db.documents.count_documents({
        "document_type_id": doc_type_id,
        "company_id": current_user["company_id"]
    })
    
    if docs_count > 0:
        raise HTTPException(status_code=400, detail=f"No se puede eliminar: {docs_count} documentos usan este tipo")
    
    await db.document_types.delete_one({
        "id": doc_type_id,
        "company_id": current_user["company_id"]
    })
    
    return {"message": "Tipo de documento eliminado"}

@api_router.get("/config/checklist-templates")
async def get_checklist_templates_config(current_user: dict = Depends(get_current_user)):
    """Get checklist templates"""
    templates = await db.checklist_templates.find(
        {"company_id": current_user["company_id"]},
        {"_id": 0}
    ).to_list(100)
    return [serialize_doc(t) for t in templates]

@api_router.post("/config/checklist-templates")
async def create_checklist_template_config(request: dict, current_user: dict = Depends(get_current_user)):
    """Create checklist template"""
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    template = ChecklistTemplate(
        company_id=current_user["company_id"],
        name=request.get("name"),
        vehicle_type=request.get("vehicle_type"),
        items=request.get("items", []),
        is_active=request.get("is_active", True),
        created_by=current_user["id"]
    )
    
    doc = template.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.checklist_templates.insert_one(doc)
    
    return {"id": template.id, "message": "Plantilla creada"}

@api_router.put("/config/checklist-templates/{template_id}")
async def update_checklist_template_config(template_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    """Update checklist template"""
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    update_data = {}
    if "name" in request:
        update_data["name"] = request["name"]
    if "vehicle_type" in request:
        update_data["vehicle_type"] = request["vehicle_type"]
    if "items" in request:
        update_data["items"] = request["items"]
    if "is_active" in request:
        update_data["is_active"] = request["is_active"]
    
    await db.checklist_templates.update_one(
        {"id": template_id, "company_id": current_user["company_id"]},
        {"$set": update_data}
    )
    
    return {"message": "Plantilla actualizada"}

@api_router.get("/config/company")
async def get_company_config(current_user: dict = Depends(get_current_user)):
    """Get company configuration"""
    company = await db.companies.find_one(
        {"id": current_user["company_id"]},
        {"_id": 0}
    )
    return serialize_doc(company)

@api_router.put("/config/company")
async def update_company_config(request: dict, current_user: dict = Depends(get_current_user)):
    """Update company configuration"""
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    update_data = {}
    if "name" in request:
        update_data["name"] = request["name"]
    if "address" in request:
        update_data["address"] = request["address"]
    if "phone" in request:
        update_data["phone"] = request["phone"]
    if "email" in request:
        update_data["email"] = request["email"]
    if "config" in request:
        update_data["config"] = request["config"]
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.companies.update_one(
        {"id": current_user["company_id"]},
        {"$set": update_data}
    )
    
    return {"message": "Configuración actualizada"}

# Include router
app.include_router(api_router)

# Serve uploaded files
from fastapi.staticfiles import StaticFiles
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
