-- ============================================================================
-- TransportePeru - Esquema Postgres (autoalojado en el VPS, contenedor transporteperu-postgres)
-- ============================================================================
-- Traducción 1:1 de las ~40 colecciones reales de MongoDB (extraídas
-- directamente de los modelos Pydantic en backend/server.py +
-- backend/liquidacion_flete.py + backend/whatsapp_bot.py).
-- Aplicado en la base `transporteperu` del contenedor transporteperu-postgres.
-- Orden de aplicación: schema.sql -> indexes.sql -> rls.sql.
--
-- Decisiones de diseño:
--
-- 1. IDs: se mantienen como uuid (los valores actuales ya son
--    str(uuid.uuid4()), así que castean directo sin transformación).
-- 2. Multi-tenancy: TODA tabla tiene company_id — es la base para Row Level
--    Security (política: company_id = tenant actual). Las políticas RLS
--    viven en db/rls.sql; los índices que esas políticas necesitan, en
--    db/indexes.sql.
-- 3. Auth: este esquema NO delega auth en la base ni en un proveedor
--    externo. Se mantiene el mecanismo actual (JWT propio +
--    bcrypt/pin_hash en la tabla users) para no mezclar "cambiar de base
--    de datos" con "cambiar de sistema de auth" en el mismo movimiento —
--    son dos migraciones distintas.
-- 4. Enums: los campos que en Mongo son texto libre con un comentario
--    listando valores permitidos (ej. Issue.status, WorkOrder.order_type,
--    Trip.settlement_status) se migran aquí como Postgres ENUM nativo
--    cuando el significado es claro, reutilizando el enum correspondiente
--    ya definido en el código cuando existe. Ver notas inline "-- antes: str
--    libre" donde se está limpiando una inconsistencia del modelo actual.
-- 5. entity_type/entity_id polimórficos (Document, Alert, OperationalBlock,
--    StockMove, AuditLog, Notification): se mantienen como
--    (text, uuid) sin FK real de Postgres — la validación de a qué tabla
--    apunta cada entity_id según entity_type se queda a nivel de aplicación,
--    igual que hoy en Mongo. Documentado inline en cada tabla.
-- 6. JSONB: solo para estructuras genuinamente anidadas/variables
--    (config, epp, axle_config, items de checklist/factura/OT, sunat_response,
--    intervals/sections de matriz de mantenimiento). Arrays simples y
--    homogéneos (depths, photos, tasks, alert_days) usan arrays nativos de
--    Postgres, no JSONB.
-- 7. location {lat, lng}: se separa en dos columnas double precision en vez
--    de JSONB (permite indexar/consultar directo).
-- 8. Nombres de tabla: se preservan los nombres de colección REALES de Mongo
--    (confirmados por grep en el código, no por la clase Pydantic) para que
--    el mapeo de la futura reescritura del backend sea 1:1 y no haya
--    sorpresas. Ej: CouplingHistory -> couplings (no coupling_histories),
--    OperationalBlock -> blocks (no operational_blocks), TripSettlement ->
--    settlements (no trip_settlements), GuiaTransportista ->
--    guias_transportista, CashMovement -> cash_movements.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- ENUMS
-- ============================================================================
create type user_role as enum ('superadmin', 'owner', 'admin', 'operaciones', 'flota', 'mantenimiento', 'almacen', 'contabilidad', 'chofer');
create type vehicle_type as enum ('tracto', 'carreta');
create type vehicle_status as enum ('disponible', 'en_viaje', 'en_mantenimiento', 'fuera_servicio');
create type document_status as enum ('vigente', 'por_vencer', 'vencido', 'pendiente', 'aprobado', 'observado', 'rechazado');
-- checklist_pendiente: lo pone start_checklist y lo deja submit_checklist
-- cuando el checklist da critico. Sin el, ese UPDATE falla (ver migracion 007).
create type trip_status as enum ('programado', 'en_curso', 'completado', 'cancelado', 'checklist_pendiente');
create type tire_status as enum ('nuevo', 'en_uso', 'reencauche', 'baja', 'almacen');
create type checklist_result as enum ('pending', 'ok', 'observado', 'critico');
create type work_order_status as enum ('abierta', 'en_proceso', 'completada', 'cancelada');
create type work_order_priority as enum ('baja', 'normal', 'alta', 'critica');
create type issue_type as enum ('incidente', 'multa', 'siniestro', 'checklist_critico', 'llanta_critica', 'otro');
create type issue_severity as enum ('baja', 'media', 'alta', 'critica');
create type issue_status as enum ('abierto', 'en_proceso', 'cerrado'); -- antes: str libre en Issue.status
create type expense_category as enum ('alimentacion', 'hospedaje', 'movilidad', 'peajes', 'parqueo', 'combustible', 'otros');
create type settlement_status as enum ('pendiente', 'en_revision', 'aprobado', 'cerrado');
create type stock_move_type as enum ('entrada', 'salida', 'ajuste', 'consumo_ot');
create type block_rule as enum ('bloquea_asignacion', 'bloquea_inicio', 'solo_alerta');
create type guia_transportista_status as enum ('borrador', 'emitida', 'anulada', 'error');
create type factura_status as enum ('borrador', 'emitida', 'pagada', 'anulada', 'error');
create type detraccion_status as enum ('pendiente', 'depositada', 'anulada');
create type cash_movement_type as enum ('ingreso', 'egreso');
create type cash_payment_method as enum ('efectivo', 'transferencia', 'deposito', 'yape_plin', 'otro');
create type proveedor_tipo as enum ('empresa', 'persona_natural');
create type liquidacion_flete_status as enum ('borrador', 'en_revision', 'aprobada', 'cerrada');
create type balance_type as enum ('favor_empresa', 'favor_chofer'); -- antes: str libre en TripSettlement.balance_type
create type notification_type as enum ('info', 'warning', 'alert', 'success'); -- antes: str libre

-- ============================================================================
-- TENANCY RAÍZ
-- ============================================================================
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ruc text not null,
  address text,
  phone text,
  email text,
  logo_url text,
  brand_color text not null default '#f97316',
  config jsonb not null default '{}'::jsonb, -- freeform (detraccion_rate, tire_critical_depth, etc.)
  sunat_config jsonb not null default '{}'::jsonb, -- token y URL de la API de facturacion electronica
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  email text,
  dni text,
  name text not null,
  role user_role not null,
  password_hash text,
  pin_hash text,
  is_active boolean not null default true,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  force_password_change boolean not null default false,
  license_number text,
  license_expiry timestamptz,
  phone text,
  whatsapp_number text, -- E.164, único global (el bot de WhatsApp resuelve por este campo sin JWT)
  epp jsonb not null default '{}'::jsonb,
  push_subscription jsonb, -- suscripcion Web Push del navegador de este usuario -- {"casco": {"assigned":true,"date":"...","condition":"bueno","size":"M"}, ...}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id)
);
-- Parcial: varios choferes de la misma empresa comparten email='' (login por
-- DNI+PIN, no todos usan correo) - un único estricto sobre (company_id,email)
-- rechazaría esos duplicados legítimos.
create unique index users_company_email_idx on users(company_id, email) where email is not null and email <> '';
create index users_dni_idx on users(dni);
create unique index users_whatsapp_number_idx on users(whatsapp_number) where whatsapp_number is not null;

-- ============================================================================
-- FLOTA
-- ============================================================================
create table vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  plate text not null,
  vehicle_type vehicle_type not null,
  brand text,
  model text,
  year int,
  vin text,
  color text,
  status vehicle_status not null default 'disponible',
  odometer int not null default 0,
  fuel_capacity double precision,
  tire_config text not null default '6',
  axle_config jsonb, -- [{"name","type":"direccional|traccion|muerto|levantable","dual":bool,"is_spare":bool}]
  axle_config_history jsonb,
  assigned_driver_id uuid references users(id),
  photo_url text,
  proveedor_id uuid, -- FK -> proveedores, agregada después de crear esa tabla (ver ALTER al final del bloque Liquidación)
  viatico_fijo double precision,
  -- Los escribe complete_work_order al cerrar una OT y los lee
  -- check_maintenance_due para saber cuando toca el proximo servicio
  last_maintenance_km int,
  last_maintenance_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id)
);
create unique index vehicles_company_plate_idx on vehicles(company_id, plate);

create table vehicle_equipment (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  vehicle_id uuid not null references vehicles(id),
  items jsonb not null default '[]'::jsonb, -- [{name, quantity, condition, expiry_date}]
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id)
);

create table couplings ( -- CouplingHistory
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  tracto_id uuid not null references vehicles(id),
  carreta_id uuid not null references vehicles(id),
  trip_id uuid, -- FK -> trips, agregada tras crear esa tabla
  start_date timestamptz not null default now(),
  end_date timestamptz,
  created_by uuid references users(id)
);

create table units ( -- combinación tracto+carreta+chofer como unidad operativa
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  tracto_id uuid not null references vehicles(id),
  carreta_id uuid references vehicles(id),
  driver_id uuid references users(id),
  status text not null default 'activa', -- sin Enum definido en el código actual
  epp_items jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id)
);

-- ============================================================================
-- LLANTAS
-- ============================================================================
create table tires (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  serial text not null,
  brand text not null,
  model text,
  dimension text not null,
  position_type text default 'toda_posicion', -- direccional|traccion|toda_posicion|mixto
  purchase_cost double precision not null default 0,
  purchase_date timestamptz,
  supplier text, -- texto libre, no FK a suppliers
  status tire_status not null default 'nuevo',
  life_number int not null default 1, -- VN=1, R1=2, R2=3...
  initial_depth double precision, -- baseline mm de la vida actual
  current_vehicle_id uuid references vehicles(id),
  current_position text,
  total_km int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tires_company_current_vehicle_idx on tires(company_id, current_vehicle_id);

create table tire_mounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  tire_id uuid not null references tires(id),
  vehicle_id uuid not null references vehicles(id),
  position_code text not null,
  mount_date timestamptz not null default now(),
  mount_odometer int not null,
  unmount_date timestamptz,
  unmount_odometer int,
  reason text,
  created_by uuid references users(id)
);

create table tire_inspections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  tire_id uuid not null references tires(id),
  vehicle_id uuid not null references vehicles(id),
  position_code text not null,
  depths double precision[] not null default '{}', -- 2-4 mediciones en mm
  pressure double precision not null,
  irregular_wear boolean not null default false,
  wear_type text,
  photos text[] not null default '{}',
  odometer int not null,
  notes text,
  inspection_date timestamptz not null default now(),
  created_by uuid references users(id)
);

create table tire_life_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  tire_id uuid not null references tires(id),
  life_number int not null,
  event_type text not null, -- reencauche, baja, compra...
  cost double precision not null default 0,
  supplier text,
  notes text,
  event_date timestamptz not null default now(),
  created_by uuid references users(id)
);

create table tire_rotations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  vehicle_id uuid not null references vehicles(id),
  changes jsonb not null default '[]'::jsonb, -- [{tire_id, from_position, to_position}]
  reason text,
  odometer int not null default 0,
  rotation_date timestamptz not null default now(),
  created_by uuid references users(id)
);

create table alignment_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  vehicle_id uuid not null references vehicles(id),
  axle text not null,
  workshop text,
  cost double precision not null default 0,
  notes text,
  alignment_date timestamptz not null default now(),
  created_by uuid references users(id)
);

-- ============================================================================
-- CUMPLIMIENTO (documentos, alertas, bloqueos, auditoría)
-- ============================================================================
create table document_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  applies_to text not null, -- vehiculo, chofer, empresa
  is_critical boolean not null default false,
  requires_expiry boolean not null default true,
  alert_days int[] not null default '{60,30,15,7,3,1}',
  block_rule block_rule not null default 'solo_alerta',
  created_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  document_type_id uuid not null references document_types(id),
  entity_type text not null, -- vehicle | user | company (polimórfico, sin FK real)
  entity_id uuid not null,
  number text,
  issue_date timestamptz,
  expiry_date timestamptz,
  status document_status not null default 'pendiente',
  file_url text,
  notes text,
  approved_by uuid references users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id)
);
create index documents_company_entity_idx on documents(company_id, entity_id);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  alert_type text not null,
  entity_type text not null, -- polimórfico, sin FK real
  entity_id uuid not null,
  message text not null,
  severity text not null default 'warning', -- info, warning, critical
  is_read boolean not null default false,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table blocks ( -- OperationalBlock
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  entity_type text not null, -- polimórfico, sin FK real
  entity_id uuid not null,
  reason text not null,
  block_type text not null, -- valores de block_rule en la práctica
  document_id uuid references documents(id),
  document_type_id uuid references document_types(id),
  is_active boolean not null default true,
  resolved_at timestamptz,
  resolved_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  user_id uuid not null references users(id),
  user_name text not null, -- denormalizado al momento de la acción
  action text not null,
  entity_type text not null, -- polimórfico, sin FK real
  entity_id uuid not null,
  details jsonb not null default '{}'::jsonb, -- payload libre, varía por tipo de acción
  ip_address text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- OPERACIÓN (rutas, viajes, viáticos, checklists, liquidación de viaje)
-- ============================================================================
create table routes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  origin text not null,
  destination text not null,
  distance_km double precision not null,
  estimated_hours double precision not null,
  toll_cost double precision not null default 0,
  created_at timestamptz not null default now()
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  trip_number text,
  tracto_id uuid not null references vehicles(id),
  carreta_id uuid references vehicles(id),
  driver_id uuid not null references users(id),
  route_id uuid references routes(id),
  client_name text,
  cargo_description text,
  cargo_weight double precision,
  status trip_status not null default 'programado',
  is_round_trip boolean not null default true,
  scheduled_date timestamptz not null,
  start_date timestamptz,
  end_date timestamptz,
  km_start int,
  km_end int,
  checklist_id uuid, -- FK -> checklists o checklist_runs (referencia libre, ver nota en Document)
  checklist_approved boolean not null default false,
  total_advance double precision not null default 0,
  total_expenses double precision not null default 0,
  -- Los escribe el flujo de checklist y liquidacion. Sin FK: checklists y
  -- settlements siguen en Mongo (ver migracion 007)
  checklist_result text,
  settlement_id uuid,
  settlement_status text not null default 'pending', -- inconsistente con SettlementStatus (usa "pending" en inglés) - limpiar en la migración
  viatico_budget double precision,
  viatico_days int,
  viatico_daily double precision,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id)
);
create index trips_company_status_idx on trips(company_id, status);

alter table couplings add constraint couplings_trip_fk foreign key (trip_id) references trips(id);

create table trip_advances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  trip_id uuid not null references trips(id),
  amount double precision not null,
  payment_method text not null,
  delivered_date timestamptz not null default now(),
  delivered_by uuid references users(id),
  notes text,
  created_at timestamptz not null default now()
);

create table trip_expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  trip_id uuid not null references trips(id),
  category expense_category not null,
  description text,
  amount double precision not null,
  provider text,
  ruc text,
  has_igv boolean not null default false,
  receipt_url text,
  expense_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references users(id)
);

create table checklists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  trip_id uuid not null references trips(id),
  vehicle_id uuid not null references vehicles(id),
  driver_id uuid not null references users(id),
  items jsonb not null default '[]'::jsonb, -- [{item, result, notes, photo_url}]
  tire_checks jsonb not null default '[]'::jsonb,
  result checklist_result not null default 'pending',
  signature_url text,
  location_lat double precision,
  location_lng double precision,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table checklist_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  vehicle_type text, -- texto libre (no usa el enum vehicle_type aquí en el modelo actual)
  items jsonb not null default '[]'::jsonb, -- [{label, category, requires_photo, critical}]
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references users(id)
);

create table checklist_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  template_id uuid not null references checklist_templates(id),
  trip_id uuid not null references trips(id),
  tracto_id uuid not null references vehicles(id),
  carreta_id uuid references vehicles(id),
  driver_id uuid not null references users(id),
  responses jsonb not null default '[]'::jsonb,
  tire_checks jsonb not null default '[]'::jsonb,
  result checklist_result not null default 'pending',
  signature_url text,
  location_lat double precision,
  location_lng double precision,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  photos text[] not null default '{}',
  created_by uuid references users(id)
);

create table settlements ( -- TripSettlement
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  trip_id uuid not null references trips(id),
  total_advances double precision not null default 0,
  total_expenses double precision not null default 0,
  deductions double precision not null default 0,
  deduction_notes text,
  balance double precision not null default 0,
  balance_type balance_type not null default 'favor_empresa',
  status settlement_status not null default 'pendiente',
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  closed_by uuid references users(id),
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- COMBUSTIBLE
-- ============================================================================
create table fuel_vouchers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  vehicle_id uuid not null references vehicles(id),
  trip_id uuid references trips(id),
  voucher_number text not null,
  provider text not null,
  limit_amount double precision,
  limit_liters double precision,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  is_used boolean not null default false,
  approved_by uuid references users(id),
  voucher_photo_url text,
  invoice_photo_url text,
  invoice_number text,
  created_at timestamptz not null default now()
);

create table fuel_loads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  vehicle_id uuid not null references vehicles(id),
  voucher_id uuid references fuel_vouchers(id),
  trip_id uuid references trips(id),
  voucher_number text,
  invoice_number text,
  liters double precision not null,
  price_per_liter double precision not null,
  total_amount double precision not null,
  odometer int not null,
  provider text not null,
  receipt_url text,
  voucher_photo_url text,
  invoice_photo_url text,
  location_lat double precision,
  location_lng double precision,
  load_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references users(id)
);

-- ============================================================================
-- MANTENIMIENTO
-- ============================================================================
create table maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  vehicle_type vehicle_type not null,
  component text not null,
  interval_km int,
  interval_days int,
  interval_hours int,
  tasks text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table maintenance_matrix_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null, -- ej. "E MAX 540 MT"
  vehicle_model text,
  intervals jsonb not null default '[]'::jsonb, -- [{code:"M1", hours, km, labor_hours}]
  sections jsonb not null default '[]'::jsonb,  -- [{code,name,tasks:[{n,description,component_type,quantity,actions:{M1:"C",...}}]}] - anidado, no se normaliza en esta fase
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id)
);

create table maintenance_matrix_plan_vehicles ( -- normaliza Vehicle.applies_to_vehicle_ids (M:N)
  plan_id uuid not null references maintenance_matrix_plans(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  primary key (plan_id, vehicle_id)
);

create table work_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  order_number text not null,
  vehicle_id uuid not null references vehicles(id),
  order_type text not null, -- preventivo, correctivo
  priority work_order_priority not null default 'normal',
  status work_order_status not null default 'abierta',
  description text not null,
  maintenance_plan_id uuid references maintenance_plans(id),
  issue_id uuid, -- FK -> issues, agregada tras crear esa tabla
  items jsonb not null default '[]'::jsonb, -- [{description, part_id/code, quantity, unit_cost}]
  labor_cost double precision not null default 0,
  parts_cost double precision not null default 0,
  total_cost double precision not null default 0,
  workshop text,
  technician text,
  scheduled_date timestamptz,
  start_date timestamptz,
  end_date timestamptz,
  odometer_at_service int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id),
  closed_by uuid references users(id)
);

create table downtime_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  vehicle_id uuid not null references vehicles(id),
  work_order_id uuid references work_orders(id),
  reason text not null,
  start_time timestamptz not null,
  end_time timestamptz,
  duration_hours double precision not null default 0,
  created_by uuid references users(id)
);

-- ============================================================================
-- INCIDENTES (depende de work_orders para issue.work_order_id)
-- ============================================================================
create table issues (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  issue_number text,
  trip_id uuid references trips(id),
  vehicle_id uuid references vehicles(id),
  driver_id uuid references users(id),
  checklist_id uuid, -- referencia libre a checklists/checklist_runs
  tire_id uuid references tires(id),
  issue_type issue_type not null,
  severity issue_severity not null default 'media',
  status issue_status not null default 'abierto',
  title text not null default '',
  description text not null,
  location_lat double precision,
  location_lng double precision,
  photos text[] not null default '{}',
  cost double precision not null default 0,
  responsible text, -- texto libre, no FK
  resolution text,
  work_order_id uuid references work_orders(id),
  resolved_by uuid references users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id)
);

alter table work_orders add constraint work_orders_issue_fk foreign key (issue_id) references issues(id);

-- ============================================================================
-- INVENTARIO Y COMPRAS
-- ============================================================================
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  ruc text,
  address text,
  phone text,
  email text,
  contact_person text,
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  code text not null,
  name text not null,
  description text,
  category text not null,
  unit text not null default 'unidad',
  min_stock int not null default 0,
  max_stock int,
  current_stock int not null default 0,
  unit_cost double precision not null default 0,
  location text, -- ubicación en almacén (texto libre), no confundir con lat/lng
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table stock_moves (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  item_id uuid not null references inventory_items(id),
  move_type stock_move_type not null,
  quantity int not null,
  unit_cost double precision not null default 0,
  total_cost double precision not null default 0,
  reference_type text, -- polimórfico: "work_order" | "purchase_order" | ...
  reference_id uuid,
  work_order_id uuid references work_orders(id),
  notes text,
  move_date timestamptz not null default now(),
  created_by uuid references users(id)
);

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  order_number text not null,
  supplier_id uuid not null references suppliers(id),
  status text not null default 'borrador', -- borrador, aprobada, recibida...
  items jsonb not null default '[]'::jsonb, -- [{item_id, description, quantity, unit_cost}]
  subtotal double precision not null default 0,
  tax double precision not null default 0,
  total double precision not null default 0,
  notes text,
  approved_by uuid references users(id),
  approved_at timestamptz,
  received_by uuid references users(id),
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id)
);

-- ============================================================================
-- FACTURACIÓN / SUNAT / DETRACCIONES
-- ============================================================================
create table facturas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  trip_id uuid references trips(id),
  serie text not null default 'F001',
  numero int,
  fecha_emision text,
  cliente_ruc text,
  cliente_razon_social text,
  cliente_direccion text,
  items jsonb not null default '[]'::jsonb, -- [{descripcion, cantidad, precio_unitario, igv, total}]
  subtotal double precision not null default 0,
  igv double precision not null default 0,
  total double precision not null default 0,
  moneda text not null default 'PEN',
  sunat_response jsonb,
  sunat_ticket text,
  sunat_cdr text,
  pdf_url text,
  status factura_status not null default 'borrador',
  created_at timestamptz not null default now(),
  updated_at timestamptz, -- lo escribe /facturas/{id}/emit
  created_by uuid references users(id)
);

create table guias_transportista (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  trip_id uuid references trips(id),
  serie text not null default 'T001',
  numero int,
  fecha_emision text,
  remitente_ruc text,
  remitente_razon_social text,
  destinatario_ruc text,
  destinatario_razon_social text,
  transportista_ruc text,
  transportista_razon_social text,
  punto_partida text,
  punto_partida_ubigeo text,
  punto_llegada text,
  punto_llegada_ubigeo text,
  vehiculo_placa text,
  conductor_dni text,
  conductor_nombre text,
  conductor_licencia text,
  descripcion_carga text,
  peso_bruto double precision,
  unidad_peso text not null default 'KGM',
  num_bultos int,
  sunat_response jsonb,
  sunat_ticket text,
  sunat_cdr text,
  pdf_url text,
  status guia_transportista_status not null default 'borrador',
  created_at timestamptz not null default now(),
  updated_at timestamptz, -- lo escribe /guias/{id}/emit
  created_by uuid references users(id)
);

create table detracciones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  factura_id uuid references facturas(id),
  trip_id uuid references trips(id),
  client_ruc text,
  client_name text,
  comprobante_serie text,
  comprobante_numero text,
  fecha_emision text,
  base_amount double precision not null default 0,
  rate double precision not null default 4.0,
  amount double precision not null default 0,
  codigo_bien_servicio text not null default '027',
  constancia_number text,
  deposit_date text,
  status detraccion_status not null default 'pendiente',
  notes text,
  -- DELETE /detracciones/{id} es soft-delete: anula y deja la trazabilidad
  anulada_at timestamptz,
  anulada_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid references users(id)
);

-- ============================================================================
-- CAJA
-- ============================================================================
create table cash_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  movement_number text, -- correlativo por empresa, ej. MOV-00001
  date text,
  type cash_movement_type not null default 'egreso',
  concept text,
  category text not null default 'otros', -- sugeridas: combustible, peajes, viaticos, mantenimiento, planilla, cobranza, aporte, retiro, otros
  amount double precision not null default 0,
  payment_method cash_payment_method not null default 'efectivo',
  reference text,
  trip_id uuid references trips(id),
  vehicle_id uuid references vehicles(id),
  client_ruc text,
  supplier text,
  receipt_url text,
  notes text,
  -- DELETE /cashbox/movements/{id} es soft-delete: el movimiento se marca y
  -- toda consulta de caja filtra por `deleted` para no descuadrar el saldo
  deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid references users(id)
);

-- ============================================================================
-- NOTIFICACIONES (hoy sin modelo Pydantic - 3 formas de insertar en el código
-- que se unifican aquí en una sola tabla con columnas nullable donde
-- corresponde)
-- ============================================================================
create table notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  title text not null,
  message text not null,
  type notification_type not null default 'info',
  target_role text, -- "all" | "admin" | "chofer" | ... (texto libre, no todos los roles)
  user_id uuid references users(id),
  entity_type text, -- polimórfico, sin FK real
  entity_id uuid,
  is_read boolean not null default false,
  read_at timestamptz,
  created_by uuid references users(id), -- solo presente en notificaciones creadas manualmente vía POST /notifications
  created_at timestamptz not null default now()
);

-- ============================================================================
-- LIQUIDACIÓN DE FLETE (módulo nuevo, ya construido sobre Mongo hoy)
-- ============================================================================
create table proveedores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  tipo proveedor_tipo not null default 'empresa',
  is_tenant_self boolean not null default false,
  ruc text,
  dni text,
  razon_social text not null,
  nombre_comercial text,
  direccion text,
  celular text,
  email text,
  banco text,
  cuenta_corriente text,
  cuenta_cci text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id)
);

alter table vehicles add constraint vehicles_proveedor_fk foreign key (proveedor_id) references proveedores(id);

create table tipos_carga (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  code text not null, -- "bolsa" | "tonelada" | ... (registro abierto, no Postgres enum - se agregan tipos sin migración)
  label text not null,
  unidad_medida text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, code) -- code no es único global (cada empresa tiene su propio "bolsa"), necesario para el FK compuesto de abajo
);

create table liquidaciones_flete (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  liquidacion_number text, -- correlativo, ej. LIQ-00001
  proveedor_id uuid not null references proveedores(id),
  periodo_inicio date not null,
  periodo_fin date not null,
  tipo_carga text not null, -- code de tipos_carga; FK compuesta (company_id, tipo_carga) abajo, porque code no es único global
  cliente_nombre text not null default 'DISTRIBUIDORA CINSA',
  status liquidacion_flete_status not null default 'borrador',
  total_a_cobrar double precision not null default 0,
  total_combustible double precision not null default 0,
  total_detraccion double precision not null default 0,
  total_viaticos double precision not null default 0,
  total_utilidad_neta double precision not null default 0,
  lineas_count int not null default 0,
  notes text,
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  closed_by uuid references users(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id),
  foreign key (company_id, tipo_carga) references tipos_carga(company_id, code)
);

create table liquidacion_lineas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  liquidacion_id uuid not null references liquidaciones_flete(id),
  trip_id uuid references trips(id),
  guia_transportista_id uuid references guias_transportista(id),
  factura_id uuid references facturas(id),
  fuel_load_id uuid references fuel_loads(id),
  detraccion_id uuid references detracciones(id),
  guia_remitente_numero text, -- N° del CLIENTE, no nuestra guía
  guia_remitente_fecha date,
  cantidad_bolsas double precision,
  peso_total_carga double precision,
  conductor_nombre text,
  placa text,
  precio_unitario double precision not null default 0,
  fecha_vale_combustible date,
  vale_combustible_numero text,
  liters double precision,
  price_per_liter double precision,
  pago_realizo text,
  doc_guia_remitente_url text,
  doc_ticket_unacem_url text,
  doc_vale_combustible_url text,
  doc_factura_combustible_url text,
  doc_vale_entrega_url text,
  total_a_cobrar double precision not null default 0,
  total_combustible double precision not null default 0,
  detraccion_amount double precision not null default 0,
  viaticos double precision not null default 0,
  utilidad_neta double precision not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id)
);

-- ============================================================================
-- BOT DE WHATSAPP (hoy colecciones de dicts sueltos, no modelos Pydantic)
-- ============================================================================
create table whatsapp_events (
  id uuid primary key default gen_random_uuid(),
  wa_id text not null,
  msg_type text,
  media_id text,
  created_at timestamptz not null default now()
);

create table whatsapp_unrecognized (
  id uuid primary key default gen_random_uuid(),
  wa_id text not null,
  created_at timestamptz not null default now()
);

create table whatsapp_pending_selection (
  id uuid primary key default gen_random_uuid(),
  wa_id text not null,
  company_id uuid not null references companies(id),
  driver_id uuid not null references users(id),
  media_id text not null,
  msg_type text not null,
  trip_options uuid[] not null default '{}',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table whatsapp_documentos_pendientes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  trip_id uuid references trips(id),
  driver_id uuid not null references users(id),
  whatsapp_number text not null,
  detected_kind text,
  confidence text,
  extracted_data jsonb not null default '{}'::jsonb,
  file_url text,
  status text not null default 'pendiente', -- pendiente | asignado | descartado
  linea_id uuid references liquidacion_lineas(id),
  assigned_by uuid references users(id),
  assigned_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Fin del esquema. Lo que va aparte, y por qué:
--
--   db/indexes.sql  Índice por company_id en cada tabla que la tiene — es lo
--                   que necesita la política RLS para no degradar a seq scan.
--   db/rls.sql      Row Level Security + el rol `app_backend` con el que se
--                   conecta el backend.
--
-- Triggers de updated_at: NO se agregan a propósito. Hoy el backend fija
-- updated_at explícitamente en cada write (mismo comportamiento que tenía
-- contra Mongo), y un trigger BEFORE UPDATE pisaría el valor real traído por
-- la migración de datos. Si en algún momento el backend deja de fijarlo, ese
-- es el momento de agregar el trigger, no antes.
-- ============================================================================
