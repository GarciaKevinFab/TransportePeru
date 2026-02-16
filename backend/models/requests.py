"""Request/Response models for API endpoints"""
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime


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
    role: str
    password: Optional[str] = None
    pin: Optional[str] = None
    license_number: Optional[str] = None
    license_expiry: Optional[datetime] = None
    phone: Optional[str] = None


class CreateVehicleRequest(BaseModel):
    plate: str
    vehicle_type: str
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


class CreateIssueRequest(BaseModel):
    trip_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    driver_id: Optional[str] = None
    issue_type: str
    severity: str = "media"
    title: str
    description: str
    location: Optional[Dict[str, float]] = None
    photos: List[str] = []
    cost: float = 0


class UpdateIssueRequest(BaseModel):
    status: Optional[str] = None
    severity: Optional[str] = None
    resolution: Optional[str] = None
    responsible: Optional[str] = None
    cost: Optional[float] = None
    work_order_id: Optional[str] = None
