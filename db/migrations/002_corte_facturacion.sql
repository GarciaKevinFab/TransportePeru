-- ============================================================================
-- 002 - Corte a Postgres del modulo Facturacion / SUNAT / Caja
-- ============================================================================
-- Tablas que pasan a tener Postgres como fuente de verdad:
--   facturas, guias_transportista, detracciones, cash_movements
--
-- Se eligio este grupo porque es el unico del sistema sin acoplamiento de
-- ESCRITURA hacia afuera: ninguna de las 24 funciones que escriben estas
-- cuatro tablas escribe ademas otra tabla. Asi el corte no arrastra a ningun
-- otro modulo.
--
-- Tres partes, en este orden:
--   A. Columnas que el codigo escribe y el esquema no tenia.
--   B. FKs que cruzan la frontera Mongo/Postgres: se quitan.
--   C. FKs del corte 001 que ahora SI se pueden restaurar.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. COLUMNAS QUE FALTABAN
--
-- El esquema se dedujo de los modelos Pydantic, pero varios endpoints escriben
-- campos que NO estan en el modelo. Mongo los aceptaba sin chistar por ser
-- schemaless; Postgres no. Sin estas columnas el corte rompe cosas de verdad:
--
--   cash_movements.deleted     DELETE /cashbox/movements/{id} es un soft-delete
--                              y _cashbox_base_query() filtra por ese campo.
--                              Sin la columna, borrar un movimiento no haria
--                              nada y el saldo de caja quedaria mal.
--   detracciones.anulada_at/by DELETE /detracciones/{id} tambien es soft-delete
--                              y ahi guarda la trazabilidad contable.
--   *.updated_at               lo escriben los emit_* de SUNAT y los PUT.
--
-- Son ADD COLUMN IF NOT EXISTS, asi que reaplicar el archivo no molesta.
-- ---------------------------------------------------------------------------
alter table facturas            add column if not exists updated_at timestamptz;
alter table guias_transportista add column if not exists updated_at timestamptz;

alter table detracciones add column if not exists updated_at timestamptz;
alter table detracciones add column if not exists anulada_at timestamptz;
alter table detracciones add column if not exists anulada_by uuid;

alter table cash_movements add column if not exists updated_at timestamptz;
alter table cash_movements add column if not exists deleted boolean not null default false;
alter table cash_movements add column if not exists deleted_at timestamptz;
alter table cash_movements add column if not exists deleted_by uuid;

-- Toda consulta de caja arranca por (company_id, deleted): sin este indice, el
-- soft-delete obliga a recorrer la tabla entera en cada listado, saldo y kardex.
create index if not exists cash_movements_company_activos_idx
  on cash_movements (company_id, deleted);

-- ---------------------------------------------------------------------------
-- B. FKs QUE CRUZAN LA FRONTERA (companies, users, trips y vehicles siguen en
--    Mongo, asi que sus filas nuevas no existen en Postgres). Mismo criterio
--    que en 001; cada una vuelve cuando su tabla destino cruce.
-- ---------------------------------------------------------------------------
alter table facturas            drop constraint if exists facturas_company_id_fkey;
alter table facturas            drop constraint if exists facturas_trip_id_fkey;
alter table facturas            drop constraint if exists facturas_created_by_fkey;

alter table guias_transportista drop constraint if exists guias_transportista_company_id_fkey;
alter table guias_transportista drop constraint if exists guias_transportista_trip_id_fkey;
alter table guias_transportista drop constraint if exists guias_transportista_created_by_fkey;

alter table detracciones        drop constraint if exists detracciones_company_id_fkey;
alter table detracciones        drop constraint if exists detracciones_trip_id_fkey;
alter table detracciones        drop constraint if exists detracciones_created_by_fkey;

alter table cash_movements      drop constraint if exists cash_movements_company_id_fkey;
alter table cash_movements      drop constraint if exists cash_movements_trip_id_fkey;
alter table cash_movements      drop constraint if exists cash_movements_vehicle_id_fkey;
alter table cash_movements      drop constraint if exists cash_movements_created_by_fkey;

-- detracciones.factura_id -> facturas NO se toca: las dos puntas cortan en
-- este mismo movimiento, o sea que Postgres si puede garantizar esa integridad.

-- ---------------------------------------------------------------------------
-- C. DEVOLUCION DE FKs DEL CORTE 001
--
-- En 001 hubo que quitar estas tres porque liquidacion_lineas ya estaba en
-- Postgres pero facturas/detracciones/guias seguian en Mongo. Ahora las dos
-- puntas viven en Postgres, asi que la base vuelve a hacerse cargo.
--
-- Van con NOT VALID a proposito: la restriccion rige para todo lo que se
-- escriba de aca en adelante, sin frenar el despliegue revisando las filas
-- viejas. Para exigirla tambien sobre lo ya existente, despues y sin bloquear
-- escrituras:  alter table liquidacion_lineas validate constraint <nombre>;
-- ---------------------------------------------------------------------------
alter table liquidacion_lineas drop constraint if exists liquidacion_lineas_factura_id_fkey;
alter table liquidacion_lineas add  constraint liquidacion_lineas_factura_id_fkey
  foreign key (factura_id) references facturas(id) not valid;

alter table liquidacion_lineas drop constraint if exists liquidacion_lineas_detraccion_id_fkey;
alter table liquidacion_lineas add  constraint liquidacion_lineas_detraccion_id_fkey
  foreign key (detraccion_id) references detracciones(id) not valid;

alter table liquidacion_lineas drop constraint if exists liquidacion_lineas_guia_transportista_id_fkey;
alter table liquidacion_lineas add  constraint liquidacion_lineas_guia_transportista_id_fkey
  foreign key (guia_transportista_id) references guias_transportista(id) not valid;

-- Y ahora si se validan. El par ADD NOT VALID + VALIDATE existe justamente
-- para esto: un ADD CONSTRAINT normal toma un lock que bloquea escrituras
-- mientras revisa la tabla entera, mientras que VALIDATE toma uno mas suave
-- que deja seguir leyendo y escribiendo. Con las dos sentencias la restriccion
-- queda plenamente vigente y el despliegue nunca frena la aplicacion.
alter table liquidacion_lineas validate constraint liquidacion_lineas_factura_id_fkey;
alter table liquidacion_lineas validate constraint liquidacion_lineas_detraccion_id_fkey;
alter table liquidacion_lineas validate constraint liquidacion_lineas_guia_transportista_id_fkey;

-- ============================================================================
-- RESTAURACION PENDIENTE - correr el bloque de cada tabla cuando ESA tabla
-- cruce a Postgres, no antes. Buscar huerfanos antes de restaurar, ej.:
--   select count(*) from cash_movements c where c.trip_id is not null
--     and not exists (select 1 from trips t where t.id = c.trip_id);
--
-- --- cuando cruce companies ---
-- alter table facturas            add constraint facturas_company_id_fkey            foreign key (company_id) references companies(id);
-- alter table guias_transportista add constraint guias_transportista_company_id_fkey foreign key (company_id) references companies(id);
-- alter table detracciones        add constraint detracciones_company_id_fkey        foreign key (company_id) references companies(id);
-- alter table cash_movements      add constraint cash_movements_company_id_fkey      foreign key (company_id) references companies(id);
--
-- --- cuando crucen users ---
-- alter table facturas            add constraint facturas_created_by_fkey            foreign key (created_by) references users(id);
-- alter table guias_transportista add constraint guias_transportista_created_by_fkey foreign key (created_by) references users(id);
-- alter table detracciones        add constraint detracciones_created_by_fkey        foreign key (created_by) references users(id);
-- alter table cash_movements      add constraint cash_movements_created_by_fkey      foreign key (created_by) references users(id);
-- alter table detracciones        add constraint detracciones_anulada_by_fkey        foreign key (anulada_by) references users(id);
-- alter table cash_movements      add constraint cash_movements_deleted_by_fkey      foreign key (deleted_by) references users(id);
--
-- --- cuando crucen trips ---
-- alter table facturas            add constraint facturas_trip_id_fkey            foreign key (trip_id) references trips(id);
-- alter table guias_transportista add constraint guias_transportista_trip_id_fkey foreign key (trip_id) references trips(id);
-- alter table detracciones        add constraint detracciones_trip_id_fkey        foreign key (trip_id) references trips(id);
-- alter table cash_movements      add constraint cash_movements_trip_id_fkey      foreign key (trip_id) references trips(id);
--
-- --- cuando crucen vehicles ---
-- alter table cash_movements add constraint cash_movements_vehicle_id_fkey foreign key (vehicle_id) references vehicles(id);
-- ============================================================================
