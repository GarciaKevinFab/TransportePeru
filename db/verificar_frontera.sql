-- ============================================================================
-- Verificacion previa a un corte de modulo: ninguna FK puede cruzar la frontera
-- ============================================================================
-- Se corre con la lista de tablas que estan cortando:
--   psql -tA -v tablas="proveedores,tipos_carga" -f db/verificar_frontera.sql
--
-- Devuelve UNA FILA POR PROBLEMA (cero filas = todo bien). Busca en los dos
-- sentidos, porque cada direccion rompe algo distinto:
--
--   saliente  (tabla que corta  ->  tabla que sigue en Mongo)
--             imposible de cumplir: la fila destino nace en Mongo y no existe
--             en Postgres, asi que el INSERT falla en produccion.
--
--   entrante  (tabla que sigue en Mongo  ->  tabla que corta)
--             ademas de imposible, impide vaciar la tabla apuntada durante la
--             recarga, y el error que devuelve Postgres ahi no explica nada
--             del corte.
--
-- Lo que aparezca aca va a la migracion del corte, para quitarlo.
-- ============================================================================
select conrelid::regclass::text || '.' || conname
       || '  ->  ' || confrelid::regclass::text as fk_que_cruza
from pg_constraint
where contype = 'f'
  and (
        (    conrelid::regclass::text  =  any(string_to_array(:'tablas', ','))
         and confrelid::regclass::text <> all(string_to_array(:'tablas', ',')))
     or (    confrelid::regclass::text =  any(string_to_array(:'tablas', ','))
         and conrelid::regclass::text  <> all(string_to_array(:'tablas', ',')))
      )
order by 1;
