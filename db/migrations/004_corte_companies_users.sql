-- ============================================================================
-- 004 - Corte a Postgres de companies y users
-- ============================================================================
-- Son solo dos tablas, pero es el corte con mas consecuencias del proyecto:
-- TODAS las demas apuntan a ellas. Cortarlas devuelve 24 FKs que los tres
-- cortes anteriores tuvieron que quitar, o sea que el esquema recupera casi
-- toda su integridad referencial de una vez.
--
-- Van juntas y no por separado porque users.company_id -> companies es la
-- unica FK que sale de este par, y separarlas la volveria una FK cruzada mas.
--
-- Nota sobre autenticacion: la consulta que resuelve la identidad del usuario
-- no puede filtrar por empresa (la empresa es justo lo que todavia no se
-- sabe), asi que corre con db_pg.tx_global(). Ver el docstring de esa funcion
-- para el detalle, incluido el caso del superadmin que cambia de contexto.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. COLUMNAS QUE FALTABAN
--
-- Igual que en el corte 002: campos que el codigo escribe y el esquema no
-- tenia, porque se dedujo de los modelos Pydantic y estos dos no estan en el
-- modelo. Mongo los aceptaba por ser schemaless.
--
--   users.push_subscription   lo escribe POST /notifications/subscribe y lo
--                             lee el envio de notificaciones push. Sin la
--                             columna, suscribirse no haria nada y ningun
--                             navegador recibiria avisos.
--   companies.sunat_config    guarda el token de la API de SUNAT. Sin ella,
--                             emitir guias y facturas responderia siempre
--                             "configuracion SUNAT no encontrada".
-- ---------------------------------------------------------------------------
alter table users     add column if not exists push_subscription jsonb;
alter table companies add column if not exists sunat_config jsonb not null default '{}'::jsonb;

-- El envio de push busca los usuarios de una empresa que tengan suscripcion.
create index if not exists users_company_push_idx
  on users (company_id) where push_subscription is not null;

-- ---------------------------------------------------------------------------
-- B. DEVOLUCION DE LAS FKs DE LOS CORTES 001, 002 y 003
--
-- Todas apuntaban a companies o a users y hubo que quitarlas porque esas dos
-- tablas seguian en Mongo: una fila creada alli no existia en Postgres y el
-- INSERT fallaba. Ahora las dos puntas viven en Postgres.
--
-- NOT VALID + VALIDATE, el mismo par de siempre: la restriccion queda vigente
-- sin tomar en ningun momento el lock que bloquea escrituras.
-- ---------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select * from (values
      -- corte 001
      ('proveedores',                    'company_id',  'companies'),
      ('proveedores',                    'created_by',  'users'),
      ('tipos_carga',                    'company_id',  'companies'),
      ('liquidaciones_flete',            'company_id',  'companies'),
      ('liquidaciones_flete',            'created_by',  'users'),
      ('liquidaciones_flete',            'closed_by',   'users'),
      ('liquidaciones_flete',            'reviewed_by', 'users'),
      ('liquidacion_lineas',             'company_id',  'companies'),
      ('liquidacion_lineas',             'created_by',  'users'),
      -- corte 002
      ('facturas',                       'company_id',  'companies'),
      ('facturas',                       'created_by',  'users'),
      ('guias_transportista',            'company_id',  'companies'),
      ('guias_transportista',            'created_by',  'users'),
      ('detracciones',                   'company_id',  'companies'),
      ('detracciones',                   'created_by',  'users'),
      ('detracciones',                   'anulada_by',  'users'),
      ('cash_movements',                 'company_id',  'companies'),
      ('cash_movements',                 'created_by',  'users'),
      ('cash_movements',                 'deleted_by',  'users'),
      -- corte 003
      ('whatsapp_pending_selection',     'company_id',  'companies'),
      ('whatsapp_pending_selection',     'driver_id',   'users'),
      ('whatsapp_documentos_pendientes', 'company_id',  'companies'),
      ('whatsapp_documentos_pendientes', 'driver_id',   'users'),
      ('whatsapp_documentos_pendientes', 'assigned_by', 'users')
    ) as t(tabla, columna, destino)
  loop
    execute format('alter table %I drop constraint if exists %I',
                   f.tabla, f.tabla || '_' || f.columna || '_fkey');
    execute format('alter table %I add constraint %I foreign key (%I) references %I(id) not valid',
                   f.tabla, f.tabla || '_' || f.columna || '_fkey', f.columna, f.destino);
    execute format('alter table %I validate constraint %I',
                   f.tabla, f.tabla || '_' || f.columna || '_fkey');
  end loop;
end
$$;

-- ============================================================================
-- Lo que TODAVIA queda sin FK, y por que: las columnas que apuntan a trips,
-- vehicles, fuel_loads, facturas de otras tablas aun en Mongo. Cada migracion
-- anterior dejo escrito el ALTER que las devuelve; se corren cuando esos
-- modulos crucen. Buscar huerfanos antes de restaurar cada una.
-- ============================================================================
