-- ============================================================================
-- 008 - Corte a Postgres de settlements, trip_advances y trip_expenses
-- ============================================================================
-- Cierra el flujo de viaje. El corte 007 dejo trips en Postgres pero su detalle
-- -anticipos, gastos y liquidacion- en Mongo, y eso partio en dos bases una
-- operacion que tiene que ser una sola:
--
--   await db.trip_advances.insert_one(doc)                <- Mongo: el anticipo
--   update trips set total_advance = total_advance + $1    <- Postgres: el total
--
-- Dos escrituras en dos bases sin ninguna transaccion que las cubra, porque
-- entre dos bases no puede haberla. Si fallaba la segunda, el anticipo existia
-- pero el total del viaje no lo reflejaba, y nadie se enteraba hasta que
-- alguien cuadraba la liquidacion a mano. Con las tres tablas de este lado, el
-- detalle y el total se escriben en la MISMA transaccion.
--
-- Ninguna FK de estas tres sale hacia Mongo: apuntan a companies, users y
-- trips, que ya cruzaron. No hay nada que quitar.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- UNA CATEGORIA DE GASTO QUE EL ENUM NO TENIA
--
-- La app del chofer (frontend/src/pages/driver/DriverExpensesPage.jsx) ofrece
-- OCHO categorias de gasto; expense_category declara siete. La que falta es
-- 'balanza' ("Ticket Balanza"), un gasto real y corriente en transporte de
-- carga: el pesaje en balanza de la ruta.
--
-- Mongo lo aceptaba por guardar cualquier cadena. En Postgres la columna es un
-- enum, asi que sin este valor el chofer que registre un ticket de balanza
-- recibiria un error al guardar. Se agrega el valor en vez de reetiquetarlo
-- como 'otros' porque es una categoria propia que el chofer ya usa, y meterla
-- en 'otros' perderia informacion que hoy se registra.
--
-- Va PRIMERO y fuera de transaccion (psql corre en autocommit): un valor nuevo
-- de enum no se puede usar en la misma transaccion en que se agrega.
--
-- Nota: SettlementsPage.jsx, la vista de oficina, lista solo las siete
-- originales. Esa diferencia entre las dos pantallas es anterior a este corte
-- y se deja como esta; el enum ahora admite las ocho, que es lo que hace falta
-- para no perder gastos.
-- ---------------------------------------------------------------------------
alter type expense_category add value if not exists 'balanza';

-- ---------------------------------------------------------------------------
-- INDICES DE LAS CONSULTAS REALES
-- ---------------------------------------------------------------------------
-- Anticipos y gastos se leen SIEMPRE por viaje: al listarlos, al recalcular la
-- liquidacion y al armar el PDF.
create index if not exists trip_advances_trip_idx on trip_advances (trip_id);
create index if not exists trip_expenses_trip_idx on trip_expenses (trip_id);
-- El reporte de viaticos cruza gastos por empresa y viaje.
create index if not exists trip_expenses_company_trip_idx on trip_expenses (company_id, trip_id);
-- La liquidacion de un viaje se busca por trip_id, y el listado filtra por
-- estado dentro de la empresa.
create index if not exists settlements_trip_idx on settlements (trip_id);
create index if not exists settlements_company_status_idx on settlements (company_id, status);

-- ---------------------------------------------------------------------------
-- LA FK QUE LA 007 DEJO ANOTADA
--
-- trips.settlement_id se creo sin clave foranea porque settlements seguia en
-- Mongo y la fila destino no existia de este lado. Ya existe, asi que se
-- restaura.
--
-- NOT VALID + VALIDATE en dos pasos, como en los cortes anteriores: el primero
-- toma un lock corto y empieza a exigir la FK a lo que entre desde ya; el
-- segundo revisa lo que habia sin bloquear escrituras.
-- ---------------------------------------------------------------------------
alter table trips drop constraint if exists trips_settlement_id_fkey;
alter table trips add  constraint trips_settlement_id_fkey
  foreign key (settlement_id) references settlements(id) not valid;
alter table trips validate constraint trips_settlement_id_fkey;

-- ============================================================================
-- PENDIENTE - cuando cruce checklists:
-- alter table trips add constraint trips_checklist_id_fkey foreign key (checklist_id) references checklists(id);
--
-- NOTA sobre trips.settlement_status: sigue siendo text y no un enum, y mezcla
-- ingles con espanol ('pending' de default, 'pendiente' y 'cerrado' al
-- escribirlo). Es feo pero no bloquea nada, y SettlementsPage.jsx filtra por
-- 'pending', asi que normalizarlo ahora romperia esa vista. Se deja para
-- cuando se toque el frontend.
-- ============================================================================
