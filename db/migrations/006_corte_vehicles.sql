-- ============================================================================
-- 006 - Corte a Postgres de vehicles
-- ============================================================================
-- Una sola tabla, pero es la mas referenciada del modelo operativo: llantas,
-- viajes, enganches, unidades, checklists, ordenes de trabajo y caja apuntan
-- todos a ella.
--
-- Se corta sola, sin trips, por una razon de alcance: el conjunto coherente
-- (vehicles, trips, couplings, units, routes) son 109 puntos de acceso, y
-- partirlo permite entregar y verificar un modulo entero de una vez. vehicles
-- se sostiene por si misma: sus cuatro FKs apuntan a companies, users y
-- proveedores, y las tres tablas ya estan en Postgres. Cero FKs salientes.
--
-- Las FKs que apuntan HACIA vehicles desde tablas todavia en Mongo (tires,
-- couplings, units, trips...) se conservan: nadie escribe esas copias en
-- Postgres, asi que no pueden fallar, y quedan listas para cuando esas tablas
-- crucen. Lo unico que impiden es vaciar vehicles, y por eso este corte se
-- despliega con RECARGA=no, tras comprobar que las 6 filas coinciden campo por
-- campo en las dos bases.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. COLUMNAS QUE FALTABAN
--
-- complete_work_order escribe estos dos campos al cerrar una orden de trabajo,
-- y check_maintenance_due los lee para decidir cuando toca el proximo
-- mantenimiento. No estaban en el esquema porque no estan en el modelo
-- Pydantic; Mongo los aceptaba por ser schemaless.
--
-- Sin ellos el corte no falla ruidosamente: la lectura devuelve 0 y el
-- calculo de kilometros desde el ultimo mantenimiento queda mal en silencio,
-- que es peor.
--
-- Hoy ningun vehiculo los tiene cargados (se comprobo contra Mongo antes de
-- migrar), asi que no hay nada que rellenar: solo tienen que existir.
-- ---------------------------------------------------------------------------
alter table vehicles add column if not exists last_maintenance_km int;
alter table vehicles add column if not exists last_maintenance_date timestamptz;

-- ---------------------------------------------------------------------------
-- B. DEVOLUCION DE LA FK DEL CORTE 001
--
-- vehicles.proveedor_id -> proveedores se quito en 001 porque vehicles seguia
-- en Mongo. Ahora las dos puntas viven en Postgres. NOT VALID + VALIDATE, el
-- par de siempre: queda vigente sin tomar el lock que bloquea escrituras.
-- ---------------------------------------------------------------------------
alter table vehicles drop constraint if exists vehicles_proveedor_fk;
alter table vehicles add  constraint vehicles_proveedor_fk
  foreign key (proveedor_id) references proveedores(id) not valid;
alter table vehicles validate constraint vehicles_proveedor_fk;

-- ---------------------------------------------------------------------------
-- C. Indices de las consultas reales
-- ---------------------------------------------------------------------------
-- El listado filtra por estado y por tipo de unidad dentro de la empresa.
create index if not exists vehicles_company_estado_idx
  on vehicles (company_id, status);

-- La asignacion de choferes y los reportes buscan por chofer asignado.
create index if not exists vehicles_company_chofer_idx
  on vehicles (company_id, assigned_driver_id) where assigned_driver_id is not null;
