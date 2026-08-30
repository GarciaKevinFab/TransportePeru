-- ============================================================================
-- 007 - Corte a Postgres de trips, couplings, units y routes
-- ============================================================================
-- Completa el conjunto que se midio al cortar vehicles: estas cuatro tablas
-- estan tan atadas entre si y a vehicles que separarlas obligaria a soltar
-- FKs y a partir funciones entre las dos bases.
--
-- Como vehicles, companies y users ya cruzaron, NINGUNA FK de estas cuatro
-- sale hacia Mongo: todas apuntan a companies, users, vehicles o entre ellas
-- mismas. No hay nada que quitar.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- UN ESTADO QUE EL ENUM NO TENIA
--
-- El codigo usa un quinto estado de viaje que trip_status no declara:
--
--   checklist_pendiente   lo pone start_checklist al abrir el checklist, y
--                         submit_checklist lo DEJA puesto cuando el resultado
--                         es critico (si sale ok o observado pasa a
--                         programado). start_trip lo acepta como estado de
--                         partida, y el barrido de alertas lo incluye entre
--                         los viajes vivos.
--
-- Con Mongo esto no molestaba porque acepta cualquier cadena. En Postgres la
-- columna es un enum, asi que sin este valor el UPDATE de start_checklist
-- falla con "invalid input value for enum trip_status" y el checklist queda
-- imposible de abrir. Se agrega el valor en vez de mapearlo a otro estado
-- porque es un estado real del dominio y el frontend ya lo muestra: cambiarlo
-- alteraria el comportamiento en lugar de preservarlo.
--
-- Va PRIMERO y fuera de transaccion (psql corre en autocommit): un valor nuevo
-- de enum no se puede usar en la misma transaccion en que se agrega.
-- ---------------------------------------------------------------------------
alter type trip_status add value if not exists 'checklist_pendiente';

-- ---------------------------------------------------------------------------
-- COLUMNAS QUE FALTABAN
--
-- Dos campos que el codigo escribe en trips y que el esquema no tenia
-- (checklist_id y checklist_approved si estaban):
--
--   checklist_result  ok | observado | critico. validate_trip_can_start lo
--                     comprueba para IMPEDIR que salga un viaje cuyo checklist
--                     dio critico. Sin la columna la lectura devuelve None, el
--                     bloqueo no se dispara y un viaje con checklist critico
--                     podria arrancar. Falla abriendo, que es lo peor que
--                     puede hacer un control de seguridad.
--   settlement_id     lo escribe create_or_update_settlement al liquidar.
--
-- checklists y settlements siguen en Mongo, asi que estas dos columnas de id
-- van SIN clave foranea a proposito: la fila destino no existe en Postgres.
-- Se agregan las FKs cuando esos modulos crucen.
-- ---------------------------------------------------------------------------
alter table trips add column if not exists checklist_result text;
alter table trips add column if not exists settlement_id uuid;

-- ---------------------------------------------------------------------------
-- Indices de las consultas reales
-- ---------------------------------------------------------------------------
-- El listado de viajes filtra por estado, y la app del chofer por chofer.
create index if not exists trips_company_estado_idx on trips (company_id, status);
create index if not exists trips_company_chofer_idx on trips (company_id, driver_id);
-- El enganche activo de un viaje se busca por trip_id.
create index if not exists couplings_trip_idx on couplings (trip_id);
-- Las unidades activas de la empresa.
create index if not exists units_company_activas_idx on units (company_id) where active;

-- ============================================================================
-- PENDIENTE - cuando crucen checklists y settlements:
-- alter table trips add constraint trips_checklist_id_fkey foreign key (checklist_id) references checklists(id);
-- alter table trips add constraint trips_settlement_id_fkey foreign key (settlement_id) references settlements(id);
-- ============================================================================
