-- ============================================================================
-- 013 - Corte a Postgres de llantas y mantenimiento (el ultimo)
-- ============================================================================
-- Diez tablas: tires, tire_mounts, tire_inspections, tire_life_events,
-- tire_rotations, alignment_records, maintenance_plans, work_orders,
-- downtime_records e issues.
--
-- Van todas juntas porque son UN SOLO componente conectado, no por comodidad.
-- El nudo es un ciclo: work_orders.issue_id apunta a issues y
-- issues.work_order_id apunta de vuelta a work_orders. Un incidente abre una
-- OT y la OT recuerda que incidente la origino. Cortar una sin la otra dejaria
-- una de las dos puntas apuntando a una tabla que sigue en Mongo, que es
-- justamente la FK saliente que ningun corte puede dejar viva.
--
-- Alrededor de ese ciclo cuelga el resto sin escapatoria: issues.tire_id ->
-- tires, downtime_records.work_order_id -> work_orders,
-- work_orders.maintenance_plan_id -> maintenance_plans, y las cinco tablas de
-- historial de llanta (mounts, inspections, life_events, rotations,
-- alignment_records) que apuntan a tires. Sacar cualquier subconjunto propio
-- deja al menos una FK cruzando la frontera.
--
-- Con este corte la migracion termina: las 50 tablas quedan en Postgres.
--
-- ---------------------------------------------------------------------------
-- ENUMS: no hay ninguno que ampliar
-- ---------------------------------------------------------------------------
-- Se revisaron los seis enums del bloque contra TODOS los valores que escribe
-- el codigo y que ofrece el frontend, que es donde los cortes anteriores se
-- llevaron sus sustos:
--
--   tire_status          nuevo, en_uso, reencauche, baja, almacen
--   work_order_status    abierta, en_proceso, completada, cancelada
--   work_order_priority  baja, normal, alta, critica
--   issue_type           incidente, multa, siniestro, checklist_critico,
--                        llanta_critica, otro
--   issue_severity       baja, media, alta, critica
--   issue_status         abierto, en_proceso, cerrado
--
-- Los literales del backend caben (issue_type=checklist_critico y
-- severity=alta que pone el checklist critico, status=en_proceso y completada
-- de la OT, priority=critica, tire status=en_uso). Y los selects del frontend
-- tambien: IssuesPage ofrece exactamente los seis tipos, las cuatro
-- severidades y los tres estados, y DriverIssuesPage traduce sus etiquetas de
-- la UI (averia, accidente, robo, neumatico...) a los valores del enum antes
-- de mandarlas -- el mapeo esta en su constante ISSUE_TYPES.
--
-- Ojo con lo que NO es enum, para no confundirse buscando: alerts.severity
-- (critical/warning/info) es texto libre y ya cruzo en la 012;
-- work_orders.order_type (preventivo/correctivo), tire_life_events.event_type,
-- alignment_records.axle, downtime_records.reason y tires.position_type
-- tambien son texto. maintenance_plans.vehicle_type SI es enum, pero lo valida
-- Pydantic antes de llegar a la base (VehicleType), asi que solo pasan tracto
-- y carreta.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- SIETE COLUMNAS QUE EL CODIGO ESCRIBE Y EL ESQUEMA NO TENIA
-- ---------------------------------------------------------------------------
-- Todas se escribian en Mongo, donde una clave nueva aparece sola. En Postgres
-- la lista blanca de build_insert las habria descartado SIN ERROR, que es la
-- forma cara de perder un dato: la pantalla sigue guardando y el campo vuelve
-- vacio para siempre. Se agregan antes de que el codigo empiece a hablarle a
-- Postgres, no despues.
--
-- Cinco de las seis de tires las lee alguien hoy mismo:
--
--   last_depth      la profundidad minima de la ultima inspeccion. La escriben
--                   la inspeccion, su edicion y el reencauche; la leen
--                   compute_tire_projection (km restantes y fecha estimada de
--                   cambio), el barrido de /tires/reports/required -- que solo
--                   alerta "if last_depth is not None", asi que sin la columna
--                   se apagaria en silencio -- y dos reportes del frontend
--                   (ReportsPage y TireDimensionReportPage).
--   band_brand      marca y modelo de la banda del reencauche. Los manda
--   band_model      TireLifecyclePage en el formulario de reencauche.
--   scrap_reason    motivo y fecha de la baja. Los lee el reporte de scrap-pile
--   scrap_date      (agrupa por motivo) y la tabla de bajas del frontend.
--   scrap_odometer  el odometro al dar de baja. Hoy no lo lee nadie, pero es
--                   hermano de los dos anteriores y se guarda en el mismo
--                   $set: dejarlo afuera partiria el registro de la baja.
--
-- Y una en tire_life_events:
--
--   odometer        el odometro del evento (reencauche y baja lo escriben
--                   despues del model_dump, fuera del modelo TireLifeEvent).
--                   Tampoco lo lee nadie todavia; se conserva por lo mismo.
--
-- Ninguna lleva NOT NULL: todas nacen vacias en las filas que ya existen.
-- ---------------------------------------------------------------------------
alter table tires add column if not exists last_depth     double precision;
alter table tires add column if not exists band_brand     text;
alter table tires add column if not exists band_model     text;
alter table tires add column if not exists scrap_reason   text;
alter table tires add column if not exists scrap_date     timestamptz;
alter table tires add column if not exists scrap_odometer int;

alter table tire_life_events add column if not exists odometer int;

-- ---------------------------------------------------------------------------
-- INDICES DE LAS CONSULTAS REALES
-- ---------------------------------------------------------------------------

-- El listado de llantas filtra por vehiculo o por estado, nunca por otra cosa.
-- El primero reemplaza al indice que server.py creaba a mano en Mongo sobre
-- (company_id, current_vehicle_id) al arrancar.
create index if not exists tires_company_vehiculo_idx on tires (company_id, current_vehicle_id);
create index if not exists tires_company_estado_idx   on tires (company_id, status);
-- El montaje busca la llanta por serie para no montar dos veces la misma.
create index if not exists tires_company_serie_idx    on tires (company_id, serial);

-- El historial de una llanta se lee siempre por llanta y de lo mas nuevo a lo
-- mas viejo. Son tres consultas identicas en forma sobre tres tablas.
create index if not exists tire_mounts_llanta_fecha_idx
  on tire_mounts (tire_id, mount_date desc);
create index if not exists tire_inspections_llanta_fecha_idx
  on tire_inspections (tire_id, inspection_date desc);
create index if not exists tire_life_events_llanta_fecha_idx
  on tire_life_events (tire_id, event_date desc);

-- El montaje vigente de una posicion: el que todavia no se desmonto. El indice
-- parcial cubre solo esos, que son los unicos que se buscan y una fraccion
-- minima de la tabla (una llanta acumula montajes cerrados para siempre).
create index if not exists tire_mounts_vigentes_idx
  on tire_mounts (company_id, vehicle_id, position_code) where unmount_date is null;

-- El reporte de costo por vehiculo suma los montajes del periodo.
create index if not exists tire_mounts_company_vehiculo_fecha_idx
  on tire_mounts (company_id, vehicle_id, mount_date);

-- El esquema de llantas de una unidad y el tablero de inspecciones.
create index if not exists tire_inspections_company_vehiculo_fecha_idx
  on tire_inspections (company_id, vehicle_id, inspection_date desc);

-- Rotaciones y alineamientos se consultan por vehiculo.
create index if not exists tire_rotations_company_vehiculo_idx
  on tire_rotations (company_id, vehicle_id, rotation_date desc);
create index if not exists alignment_records_company_vehiculo_idx
  on alignment_records (company_id, vehicle_id, alignment_date desc);

-- Los planes se buscan por tipo de unidad para decidir el proximo servicio.
create index if not exists maintenance_plans_company_tipo_idx
  on maintenance_plans (company_id, vehicle_type);

-- El listado de OTs va siempre ordenado por fecha descendente, y filtra por
-- vehiculo o por estado.
create index if not exists work_orders_company_fecha_idx    on work_orders (company_id, created_at desc);
create index if not exists work_orders_company_vehiculo_idx on work_orders (company_id, vehicle_id);
-- La validacion previa a un viaje pregunta si la unidad tiene una OT critica
-- sin cerrar, y el tablero cuenta las abiertas. Las dos miran solo las vivas:
-- el indice parcial es chico y no crece con el historial.
create index if not exists work_orders_abiertas_idx
  on work_orders (company_id, vehicle_id, priority)
  where status in ('abierta', 'en_proceso');

-- Los incidentes se listan por fecha descendente y se filtran por estado o
-- por tipo.
create index if not exists issues_company_fecha_idx  on issues (company_id, created_at desc);
create index if not exists issues_company_estado_idx on issues (company_id, status);
create index if not exists issues_company_tipo_idx   on issues (company_id, issue_type);

-- La indisponibilidad se reporta por vehiculo; y al cerrar una OT hay que
-- encontrar el registro abierto que dejo su inicio.
create index if not exists downtime_records_company_vehiculo_idx
  on downtime_records (company_id, vehicle_id, start_time desc);
create index if not exists downtime_records_abiertos_idx
  on downtime_records (work_order_id) where end_time is null;

-- ============================================================================
-- LA FK QUE FALTA, Y POR QUE NO ESTA EN ESTE ARCHIVO
--
-- El corte 005 (Inventario) tuvo que quitar stock_moves.work_order_id ->
-- work_orders: stock_moves cruzaba a Postgres y work_orders se quedaba en
-- Mongo, asi que el consumo de repuestos de una OT habria apuntado a una fila
-- inexistente. Ahora las dos puntas viven aca y la FK tiene que volver.
--
-- Pero NO se puede restaurar en esta migracion. cutover-modulo.sh aplica el
-- SQL en el paso 2 y recien recarga las tablas desde Mongo en el paso 3; una
-- FK que apunte a work_orders desde fuera del corte impide vaciarla, y el
-- propio script lo detecta y aborta ("estas FKs apuntan a las tablas del corte
-- y no dejan vaciarlas").
--
-- Por eso va en un archivo aparte que se corre DESPUES de la recarga:
--
--   bash scripts/cutover-modulo.sh \
--        db/migrations/013_corte_llantas_mantenimiento.sql \
--        tires,tire_mounts,tire_inspections,tire_life_events,tire_rotations,alignment_records,maintenance_plans,work_orders,downtime_records,issues
--
--   docker exec -i transporteperu-postgres psql -v ON_ERROR_STOP=1 \
--        -U postgres -d transporteperu < db/migrations/014_cierre_frontera.sql
--
-- El orden de la lista de tablas no importa: migrate_to_postgres.py reordena
-- segun TABLE_ORDER, que ya pone maintenance_plans antes que work_orders y
-- work_orders antes que downtime_records e issues.
--
-- NOTA - el ciclo work_orders <-> issues en la recarga
--
-- Ninguna de las dos puede insertarse primero con la otra ya referenciada. El
-- migrador ya lo resuelve y no hace falta tocarlo: DEFERRED_FKS declara
-- work_orders.issue_id, que se deja en NULL en la pasada 1 y se rellena en la
-- pasada 2, cuando issues ya existe.
--
-- NOTA - la ubicacion, por ultima vez
--
-- issues guarda la ubicacion en location_lat/location_lng mientras que el
-- modelo Issue lleva un unico location = {lat, lng}. Se traduce con los mismos
-- helpers de la 010 (_fila_con_ubicacion / _api_con_ubicacion). Era la ultima
-- tabla con ese par de columnas sin cruzar, como anotaba la 011.
-- migrate_to_postgres.py ya la tiene en LOCATION_SPLIT_TABLES.
-- ============================================================================
