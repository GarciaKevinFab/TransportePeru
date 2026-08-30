-- ============================================================================
-- TransportePeru - Índices de soporte para Row Level Security
-- ============================================================================
-- Requiere db/schema.sql aplicado. Se aplica ANTES de db/rls.sql.
--
-- Por qué existe este archivo: la política RLS de db/rls.sql agrega
-- `company_id = app_current_company_id()` a TODA consulta de TODA tabla. Sin
-- un índice que empiece por company_id, esa condición se resuelve con seq
-- scan en cada query — el costo crece con el total de filas de todas las
-- empresas juntas, no con las de la empresa que consulta, que es justo lo
-- que un sistema multi-tenant no puede permitirse.
--
-- Se generan dinámicamente (no una lista a mano de 47 tablas que se
-- desincroniza al agregar la 48ª) y se SALTAN las tablas que ya tienen un
-- índice cuya primera columna es company_id — un índice compuesto
-- (company_id, X) ya sirve para filtrar solo por company_id, así que uno
-- adicional de una sola columna sería peso muerto en cada INSERT/UPDATE.
-- Hoy eso aplica a: users, vehicles, tires, documents, trips.
-- ============================================================================

do $$
declare
  t record;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'company_id'
      and tb.table_type = 'BASE TABLE'
    order by c.table_name
  loop
    -- ¿ya hay un índice cuya PRIMERA columna sea company_id?
    if exists (
      select 1
      from pg_index i
      join pg_class tc on tc.oid = i.indrelid
      join pg_namespace n on n.oid = tc.relnamespace
      join pg_attribute a on a.attrelid = tc.oid and a.attnum = i.indkey[0]
      where n.nspname = 'public'
        and tc.relname = t.table_name
        and a.attname = 'company_id'
    ) then
      continue;
    end if;

    execute format(
      'create index if not exists %I on %I (company_id)',
      t.table_name || '_company_id_idx',
      t.table_name
    );
  end loop;
end
$$;
