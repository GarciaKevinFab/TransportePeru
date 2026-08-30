-- ============================================================================
-- 011 - Corte a Postgres de fuel_vouchers y fuel_loads
-- ============================================================================
-- Los vales de combustible y las cargas reales. Van juntas porque fuel_loads
-- apunta a fuel_vouchers: una carga descuenta del vale que la autorizo.
--
-- Las dos colecciones estan VACIAS en produccion, asi que no hay datos que
-- migrar ni valores raros que descubrir. Tampoco hay enums en estas tablas.
-- Todas sus FKs apuntan a companies, users, vehicles, trips o entre ellas
-- mismas, y todas ya cruzaron: no hay nada que quitar.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- INDICES DE LAS CONSULTAS REALES
-- ---------------------------------------------------------------------------
-- El consumo se consulta siempre por vehiculo, y los reportes por rango de
-- fechas de carga.
create index if not exists fuel_loads_company_vehiculo_idx on fuel_loads (company_id, vehicle_id);
create index if not exists fuel_loads_company_fecha_idx    on fuel_loads (company_id, load_date);
-- El reporte de combustible por chofer resuelve el chofer via el viaje.
create index if not exists fuel_loads_company_viaje_idx    on fuel_loads (company_id, trip_id);
-- Los vales de un vehiculo, para la conciliacion.
create index if not exists fuel_vouchers_company_vehiculo_idx on fuel_vouchers (company_id, vehicle_id);

-- ---------------------------------------------------------------------------
-- DOS FKs QUE VUELVEN
--
-- La primera es de este corte y la dejo anotada la migracion 001: cuando
-- liquidacion_flete cruzo, fuel_loads seguia en Mongo, asi que una linea de
-- liquidacion que apuntara a una carga de combustible no habria encontrado la
-- fila de este lado. Ya la encuentra.
--
-- La segunda es deuda del corte 007: trips cruzo entonces y esta FK se quedo
-- sin restaurar. Se cierra aca, que es cuando se noto, en vez de dejarla para
-- otro corte que quiza tampoco la mire.
--
-- Las dos se comprobaron antes contra los datos reales: cero filas huerfanas
-- en las dos columnas, asi que VALIDATE no puede fallar.
--
-- NOT VALID + VALIDATE en dos pasos, como en los cortes anteriores: el primero
-- toma un lock corto y empieza a exigir la FK a lo que entre desde ya; el
-- segundo revisa lo que habia sin bloquear escrituras.
-- ---------------------------------------------------------------------------
alter table liquidacion_lineas drop constraint if exists liquidacion_lineas_fuel_load_id_fkey;
alter table liquidacion_lineas add  constraint liquidacion_lineas_fuel_load_id_fkey
  foreign key (fuel_load_id) references fuel_loads(id) not valid;
alter table liquidacion_lineas validate constraint liquidacion_lineas_fuel_load_id_fkey;

alter table liquidacion_lineas drop constraint if exists liquidacion_lineas_trip_id_fkey;
alter table liquidacion_lineas add  constraint liquidacion_lineas_trip_id_fkey
  foreign key (trip_id) references trips(id) not valid;
alter table liquidacion_lineas validate constraint liquidacion_lineas_trip_id_fkey;

-- ============================================================================
-- NOTA - la ubicacion, otra vez en dos columnas
--
-- fuel_loads tiene location_lat y location_lng mientras que el modelo FuelLoad
-- lleva un unico location = {lat, lng}. Se traduce con los mismos helpers que
-- se escribieron para los checklists en la migracion 010
-- (_fila_con_ubicacion / _api_con_ubicacion). Sin ellos el dict no coincide
-- con ninguna columna declarada y se descartaria en silencio.
--
-- Queda una sola tabla con este par de columnas sin cruzar: issues.
-- ============================================================================
