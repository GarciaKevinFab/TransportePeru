-- ============================================================================
-- 023 - Dueno de cada archivo subido y version de token por usuario
-- ============================================================================
-- DOS COSAS, LAS DOS DE LA AUDITORIA DEL 2026-11-09
--
--   1. /uploads era un StaticFiles sin autenticacion: cualquiera con la URL de
--      un vale de combustible, una factura o un DNI escaneado lo descargaba.
--      Ahora lo sirve un endpoint que exige sesion de la MISMA empresa, y para
--      saber de que empresa es un archivo hace falta apuntarlo:
--
--        archivos_subidos (ruta, company_id)
--
--      `ruta` es exactamente la URL que devuelve /api/upload y que se guarda
--      en las filas ("/uploads/fuel/<id>/<uuid>.jpg"). La tabla lleva RLS como
--      todas: la consulta del endpoint ya filtra por empresa, y si un dia se
--      olvida, la politica devuelve cero filas en vez del archivo de otro.
--
--   2. El refresh token seguia valiendo despues de cambiar la contrasena: quien
--      se hubiera llevado una sesion la conservaba siete dias. Cada token lleva
--      ahora la version del usuario (`tv`) y cambiar o restablecer la clave la
--      sube; los tokens con la version anterior dejan de valer al instante.
--
-- LOS ARCHIVOS QUE YA EXISTEN
--
--   Se apuntan aqui mismo recorriendo todas las columnas de texto y jsonb de
--   las tablas con company_id, mas companies.logo_url: cualquier cadena que
--   empiece por /uploads/ en una fila de la empresa X es un archivo de X. Un
--   archivo que no aparezca en ninguna fila (subido y nunca guardado) queda sin
--   dueno y el endpoint responde 404: nadie lo estaba usando.
--
-- SE PUEDE APLICAR CON LA APLICACION CORRIENDO, Y ANTES DEL BACKEND NUEVO
--
--   Una columna con valor por defecto y una tabla que el backend viejo no usa.
--   Reaplicarla solo agrega lo que falte (IF NOT EXISTS / ON CONFLICT).
-- ============================================================================

alter table users add column if not exists token_version integer not null default 0;

create table if not exists archivos_subidos (
  ruta        text        primary key,
  company_id  uuid        not null references companies (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists archivos_subidos_company_idx on archivos_subidos (company_id);

do $$
begin
  execute 'alter table archivos_subidos enable row level security';
  execute 'alter table archivos_subidos force row level security';
  execute 'drop policy if exists tenant_isolation on archivos_subidos';
  execute 'create policy tenant_isolation on archivos_subidos for all to app_backend
             using (app_is_superadmin() or company_id = app_current_company_id())
             with check (app_is_superadmin() or company_id = app_current_company_id())';
  if exists (select 1 from pg_roles where rolname = 'app_backend') then
    grant select, insert, update, delete on archivos_subidos to app_backend;
  end if;
end
$$;

-- Los que ya existen. Corre como postgres (sin RLS), que es como se aplican las
-- migraciones.
do $$
declare
  c record;
begin
  for c in
    select col.table_name, col.column_name
      from information_schema.columns col
      join information_schema.columns emp
        on emp.table_schema = col.table_schema
       and emp.table_name = col.table_name
       and emp.column_name = 'company_id'
      join information_schema.tables t
        on t.table_schema = col.table_schema
       and t.table_name = col.table_name
       and t.table_type = 'BASE TABLE'
     where col.table_schema = 'public'
       and col.table_name <> 'archivos_subidos'
       and col.data_type in ('text', 'character varying', 'jsonb', 'json', 'ARRAY')
  loop
    execute format(
      'insert into archivos_subidos (ruta, company_id)
       select distinct m[1], company_id
         from %I, lateral regexp_matches(%I::text, ''(/uploads/[A-Za-z0-9_./-]+)'', ''g'') as m
        where company_id is not null and %I::text like ''%%/uploads/%%''
       on conflict (ruta) do nothing',
      c.table_name, c.column_name, c.column_name);
  end loop;

  insert into archivos_subidos (ruta, company_id)
  select distinct m[1], id
    from companies, lateral regexp_matches(coalesce(logo_url, ''), '(/uploads/[A-Za-z0-9_./-]+)', 'g') as m
  on conflict (ruta) do nothing;
end
$$;
