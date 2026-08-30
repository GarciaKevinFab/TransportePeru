-- ============================================================================
-- Verificacion previa a un corte de modulo: ninguna FK puede cruzar la frontera
-- ============================================================================
-- Se corre con la lista de tablas que estan cortando:
--   psql -tA -v tablas="proveedores,tipos_carga" -f db/verificar_frontera.sql
--
-- Devuelve una fila por FK que cruza, marcada con su direccion, porque cada
-- una tiene consecuencias muy distintas:
--
--   SALIENTE  (tabla que corta  ->  tabla que sigue en Mongo)
--             SIEMPRE hay que quitarla. Es imposible de cumplir: la fila
--             destino nace en Mongo y no existe en Postgres, asi que el
--             INSERT falla en produccion.
--
--   entrante  (tabla que sigue en Mongo  ->  tabla que corta)
--             normalmente se puede DEJAR. Nadie escribe la copia congelada
--             que quedo en Postgres de la tabla de origen, asi que la FK no
--             puede fallar; y cuando esa tabla cruce, ya estara puesta.
--             El unico problema es que impide VACIAR la tabla apuntada, o
--             sea que solo estorba si el corte necesita recargar datos.
--
-- Regla: toda SALIENTE va a la migracion del corte para quitarla. Las
-- entrantes solo si el corte va a recargar (ver RECARGA en cutover-modulo.sh).
-- ============================================================================
select case
         when conrelid::regclass::text = any(string_to_array(:'tablas', ','))
         then 'SALIENTE'
         else 'entrante'
       end
       || '  ' || conrelid::regclass::text || '.' || conname
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
