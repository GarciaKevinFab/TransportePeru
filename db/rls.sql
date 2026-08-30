-- ============================================================================
-- TransportePeru - Row Level Security
-- ============================================================================
-- Requiere db/schema.sql y db/indexes.sql ya aplicados (en ese orden).
--
-- Modelo de confianza (importante, léelo antes de tocar esto):
--
-- El backend (FastAPI) es el ÚNICO cliente que habla con Postgres. No hay
-- PostgREST ni ninguna API auto-generada sobre la base, y el contenedor de
-- Postgres no publica puerto al host — solo es alcanzable desde la red
-- interna de Docker (`transporteperu_default`). El frontend solo habla con
-- el backend.
--
-- Auth sigue siendo el JWT propio del backend (decisión ya tomada en
-- schema.sql), así que la autorización primaria la hace server.py con
-- get_current_user()/require_roles(), igual que hoy. RLS aquí es defensa en
-- profundidad contra un bug del backend — una consulta a la que se le
-- olvide el WHERE company_id = ... — NO el mecanismo primario. Mecanismo:
--
-- 1. Un rol de Postgres dedicado `app_backend` (login, sin BYPASSRLS) es con
--    el que se conecta el backend — NUNCA con `postgres` (el superusuario SÍ
--    evade RLS, y por eso es el que usa la migración de datos y nada más).
-- 2. En cada request, el backend ya validó el JWT y ya sabe
--    company_id/role del usuario (get_current_user() los deja en
--    current_user dict). Antes de correr cualquier query de ese request,
--    hace SET LOCAL app.current_company_id / app.is_superadmin dentro de
--    la misma transacción (ver ejemplo Python al final de este archivo).
-- 3. Toda tabla con company_id: RLS forzado, una sola política que exige
--    company_id = current_setting('app.current_company_id') salvo que
--    is_superadmin sea true (superadmin ve todas las empresas, igual que
--    hoy en el código Mongo — role check en require_roles()).
-- 4. Restricción más fina (ej. chofer solo ve sus propios viajes) se queda
--    a nivel de aplicación, igual que hoy — no está modelada en RLS todavía.
--    Ver nota al final si se quiere subir ese nivel de detalle a la base.
-- 5. Tablas SIN company_id (whatsapp_events, whatsapp_unrecognized — logs
--    del bot que existen justamente ANTES de saber a qué empresa pertenece
--    el remitente — y la tabla puente maintenance_matrix_plan_vehicles):
--    acceso completo para app_backend, sin filtro por fila (no hay tenant
--    que aislar).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Rol dedicado para el backend
-- ---------------------------------------------------------------------------
-- La contraseña llega como variable de psql y NUNCA vive en el repo:
--   psql -v app_backend_password="$APP_BACKEND_PASSWORD" -f db/rls.sql
--
-- Ojo con la forma rara: psql NO interpola :'variables' dentro de bloques
-- dollar-quoted ($$ ... $$), así que el "create role si no existe" no puede
-- ir en un DO block — se arma con \gexec, que ejecuta el SQL que devuelve
-- el select (cero filas si el rol ya existe = no hace nada).
select 'create role app_backend login'
where not exists (select 1 from pg_roles where rolname = 'app_backend')
\gexec

-- Idempotente y además rota la contraseña si cambió en el .env del VPS.
alter role app_backend with login password :'app_backend_password';

grant usage on schema public to app_backend;
grant select, insert, update, delete on all tables in schema public to app_backend;
grant usage, select on all sequences in schema public to app_backend;
alter default privileges in schema public grant select, insert, update, delete on tables to app_backend;

-- ---------------------------------------------------------------------------
-- Helpers — leen las variables de sesión que pone el backend en cada
-- transacción. `current_setting(..., true)` con el 2do argumento en true no
-- lanza error si la variable no está seteada (devuelve NULL) — así una
-- conexión sin contexto (ej. una migración corrida como postgres) no rompe.
-- ---------------------------------------------------------------------------
create or replace function app_current_company_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.current_company_id', true), '')::uuid
$$;

create or replace function app_is_superadmin() returns boolean
language sql stable as $$
  select coalesce(nullif(current_setting('app.is_superadmin', true), '')::boolean, false)
$$;

-- ---------------------------------------------------------------------------
-- Política estándar multi-tenant — se aplica a TODA tabla con columna
-- company_id, vía un bloque dinámico (evita repetir la misma política 47
-- veces a mano y equivocarse en una). Revisa el resultado final con
-- \d+ <tabla> o pg_policies si quieres ver el SQL generado por tabla.
-- ---------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'company_id'
  loop
    execute format('alter table %I enable row level security', t.table_name);
    execute format('alter table %I force row level security', t.table_name);
    execute format(
      'drop policy if exists tenant_isolation on %I',
      t.table_name
    );
    execute format(
      'create policy tenant_isolation on %I
         for all
         to app_backend
         using (app_is_superadmin() or company_id = app_current_company_id())
         with check (app_is_superadmin() or company_id = app_current_company_id())',
      t.table_name
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- companies: el caso especial. Es la ÚNICA tabla cuyo tenant es su propio
-- `id` en vez de una columna company_id, así que el bloque dinámico de
-- arriba (que busca la columna company_id) la salta — y sin esto quedaría
-- como la única tabla del esquema sin RLS, justo la que lista todas las
-- empresas del sistema. La política es la misma idea, cambiando la columna.
-- ---------------------------------------------------------------------------
alter table companies enable row level security;
alter table companies force row level security;
drop policy if exists tenant_isolation on companies;
create policy tenant_isolation on companies
  for all
  to app_backend
  using (app_is_superadmin() or id = app_current_company_id())
  with check (app_is_superadmin() or id = app_current_company_id());

-- ---------------------------------------------------------------------------
-- Tablas sin company_id: acceso completo para app_backend (no hay tenant que
-- aislar en estas tres).
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['whatsapp_events', 'whatsapp_unrecognized', 'maintenance_matrix_plan_vehicles']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists backend_full_access on %I', t);
    execute format(
      'create policy backend_full_access on %I for all to app_backend using (true) with check (true)',
      t
    );
  end loop;
end
$$;

-- ============================================================================
-- Cómo lo usa el backend (referencia, no se ejecuta desde aquí) — cada
-- request abre una transacción, fija el contexto, corre las queries de ese
-- request, y confirma. Con asyncpg sería algo así:
--
--   async with pool.acquire() as conn:
--       async with conn.transaction():
--           await conn.execute(
--               "select set_config('app.current_company_id', $1, true), "
--               "       set_config('app.is_superadmin', $2, true)",
--               current_user["company_id"],
--               str(current_user["role"] == "superadmin").lower(),
--           )
--           ... resto de las queries de este request, ya filtradas por RLS ...
--
-- set_config(..., true) con is_local=true equivale a SET LOCAL: el valor
-- desaparece solo al terminar la transacción, así que una conexión reciclada
-- por el pool para OTRO request/otra empresa nunca hereda el contexto viejo.
-- ============================================================================

-- ============================================================================
-- Pendiente a futuro (fuera de alcance de esta fase): restricción por chofer
-- (que un chofer solo pueda leer sus propios trips/checklist_runs/fuel_loads)
-- hoy vive en server.py (filtro manual cuando role == "chofer"). Subir esto a
-- RLS requeriría una variable de sesión app.current_user_id + una política
-- adicional por tabla que además compare driver_id, lo cual varía de nombre
-- de columna por tabla (trips.driver_id, checklist_runs.driver_id, etc.) y
-- no es tan uniforme como el filtro por company_id — se deja para una
-- iteración posterior si se decide que vale la pena el esfuerzo.
-- ============================================================================
