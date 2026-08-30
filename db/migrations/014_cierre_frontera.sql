-- ============================================================================
-- 014 - Cierre de la frontera Mongo/Postgres
-- ============================================================================
-- No es un corte: es el remate del 013. Se corre DESPUES de que la recarga
-- termino, y devuelve la ultima FK que la migracion habia tenido que quitar.
--
-- Por que no va dentro de la 013: cutover-modulo.sh aplica el SQL del corte
-- ANTES de recargar las tablas desde Mongo. Una FK que apunte a work_orders
-- desde fuera del corte impide vaciarla, y el script aborta a proposito antes
-- de intentarlo. Restaurarla aca, con las diez tablas ya cargadas, es el unico
-- orden que funciona.
--
--   docker exec -i transporteperu-postgres psql -v ON_ERROR_STOP=1 \
--        -U postgres -d transporteperu < db/migrations/014_cierre_frontera.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- LA FK QUE VUELVE, DEUDA DEL CORTE 005
--
-- Cuando Inventario cruzo, work_orders seguia en Mongo: un consumo de
-- repuestos cargado contra una OT no habria encontrado la fila de este lado,
-- asi que la 005 quito stock_moves.work_order_id -> work_orders y lo dejo
-- anotado. Ahora las dos puntas viven en Postgres.
--
-- NOT VALID + VALIDATE en dos pasos, como en todos los cortes anteriores: el
-- ADD toma un lock corto y empieza a exigir la FK a lo que entre desde ya; el
-- VALIDATE revisa lo que ya habia sin bloquear escrituras.
--
-- El VALIDATE puede fallar si quedaron consumos apuntando a OTs que ya no
-- existen. Para verlos antes de correr esto:
--
--   select sm.id, sm.work_order_id
--     from stock_moves sm
--    where sm.work_order_id is not null
--      and not exists (select 1 from work_orders wo where wo.id = sm.work_order_id);
--
-- Si aparece alguno, es un huerfano real que la FK ausente venia tapando: hay
-- que decidir a mano si se le pone NULL el work_order_id o si falta cargar esa
-- OT. No se resuelve aca en silencio.
-- ---------------------------------------------------------------------------
alter table stock_moves drop constraint if exists stock_moves_work_order_id_fkey;
alter table stock_moves add  constraint stock_moves_work_order_id_fkey
  foreign key (work_order_id) references work_orders(id) not valid;
alter table stock_moves validate constraint stock_moves_work_order_id_fkey;

-- ============================================================================
-- COMPROBACION FINAL: no puede quedar NINGUNA FK sin restaurar
--
-- Con las 50 tablas en Postgres ya no hay frontera que cruzar, asi que toda FK
-- que el schema declara tiene que estar puesta. Lo que sigue lo verifica y
-- falla ruidosamente si falta alguna, en vez de dejar el dato suelto.
--
-- Las columnas de abajo son las que los cortes fueron quitando y devolviendo
-- por el camino (couplings.trip_id en la 007, vehicles.proveedor_id cuando
-- cruzo Inventario, liquidacion_lineas.* en la 002 y la 011), mas las dos
-- puntas del ciclo que cierra este corte. Se comprueban de nuevo porque el
-- costo es cero y el olvido es barato de cometer.
-- ============================================================================
do $$
declare
  faltan text;
begin
  select string_agg(t.tabla || '.' || t.columna, ', ')
    into faltan
    from (values
      ('stock_moves',        'work_order_id'),
      ('couplings',          'trip_id'),
      ('vehicles',           'proveedor_id'),
      ('liquidacion_lineas', 'trip_id'),
      ('liquidacion_lineas', 'factura_id'),
      ('liquidacion_lineas', 'fuel_load_id'),
      ('liquidacion_lineas', 'detraccion_id'),
      ('liquidacion_lineas', 'guia_transportista_id'),
      ('work_orders',        'issue_id'),
      ('issues',             'work_order_id')
    ) as t(tabla, columna)
   where not exists (
     select 1
       from pg_constraint c
       join pg_attribute a
         on a.attrelid = c.conrelid
        and a.attnum = any(c.conkey)
      where c.contype = 'f'
        and c.conrelid = t.tabla::regclass
        and a.attname = t.columna
   );

  if faltan is not null then
    raise exception 'FKs sin restaurar tras el ultimo corte: %', faltan;
  end if;

  raise notice 'Frontera cerrada: las FKs que los cortes fueron quitando estan todas de vuelta.';
end
$$;
