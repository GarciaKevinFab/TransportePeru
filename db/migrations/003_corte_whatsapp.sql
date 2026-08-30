-- ============================================================================
-- 003 - Corte a Postgres del modulo Bot de WhatsApp
-- ============================================================================
-- Tablas que pasan a tener Postgres como fuente de verdad:
--   whatsapp_events, whatsapp_unrecognized, whatsapp_pending_selection,
--   whatsapp_documentos_pendientes
--
-- Las escribe un unico archivo (whatsapp_bot.py) y nadie mas, asi que el corte
-- no toca ningun otro modulo. Con esto whatsapp_bot.py queda sin una sola
-- llamada a Mongo.
--
-- Nota sobre las dos tablas de log: whatsapp_events y whatsapp_unrecognized NO
-- tienen company_id a proposito. Son el registro de lo que llega al webhook,
-- que se escribe ANTES de resolver a que chofer -y por lo tanto a que
-- empresa- pertenece el numero. Su politica RLS ya es backend_full_access
-- (db/rls.sql), y el backend las escribe con una conexion sin contexto de
-- empresa (db_pg.tx_sin_empresa). Esa conexion no puede tocar ninguna tabla
-- con tenant: la politica tenant_isolation no le deja ver ni una fila.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- FKs QUE CRUZAN LA FRONTERA (companies, users y trips siguen en Mongo)
-- ---------------------------------------------------------------------------
alter table whatsapp_pending_selection     drop constraint if exists whatsapp_pending_selection_company_id_fkey;
alter table whatsapp_pending_selection     drop constraint if exists whatsapp_pending_selection_driver_id_fkey;

alter table whatsapp_documentos_pendientes drop constraint if exists whatsapp_documentos_pendientes_company_id_fkey;
alter table whatsapp_documentos_pendientes drop constraint if exists whatsapp_documentos_pendientes_driver_id_fkey;
alter table whatsapp_documentos_pendientes drop constraint if exists whatsapp_documentos_pendientes_trip_id_fkey;
alter table whatsapp_documentos_pendientes drop constraint if exists whatsapp_documentos_pendientes_assigned_by_fkey;

-- ---------------------------------------------------------------------------
-- DEVOLUCION DE FK DEL CORTE 001
--
-- linea_id -> liquidacion_lineas se quito en 001 porque bloqueaba el vaciado
-- de liquidacion_lineas durante aquella recarga. Ahora las dos puntas viven en
-- Postgres, asi que la base vuelve a hacerse cargo. NOT VALID + VALIDATE, el
-- mismo par que en 002: deja la restriccion vigente sin tomar en ningun
-- momento el lock que bloquea escrituras.
-- ---------------------------------------------------------------------------
alter table whatsapp_documentos_pendientes drop constraint if exists whatsapp_documentos_pendientes_linea_id_fkey;
alter table whatsapp_documentos_pendientes add  constraint whatsapp_documentos_pendientes_linea_id_fkey
  foreign key (linea_id) references liquidacion_lineas(id) not valid;
alter table whatsapp_documentos_pendientes validate constraint whatsapp_documentos_pendientes_linea_id_fkey;

-- ---------------------------------------------------------------------------
-- Indices de las consultas reales del bot
-- ---------------------------------------------------------------------------
-- El webhook busca la seleccion pendiente por numero de telefono en cada
-- mensaje de texto que llega.
create index if not exists whatsapp_pending_selection_wa_id_idx
  on whatsapp_pending_selection (wa_id);

-- La bandeja del panel filtra por empresa y estado.
create index if not exists whatsapp_documentos_pendientes_company_status_idx
  on whatsapp_documentos_pendientes (company_id, status);

-- ============================================================================
-- RESTAURACION PENDIENTE - cuando cada tabla destino cruce a Postgres:
--
-- --- cuando cruce companies ---
-- alter table whatsapp_pending_selection     add constraint whatsapp_pending_selection_company_id_fkey     foreign key (company_id) references companies(id);
-- alter table whatsapp_documentos_pendientes add constraint whatsapp_documentos_pendientes_company_id_fkey foreign key (company_id) references companies(id);
--
-- --- cuando crucen users ---
-- alter table whatsapp_pending_selection     add constraint whatsapp_pending_selection_driver_id_fkey      foreign key (driver_id)   references users(id);
-- alter table whatsapp_documentos_pendientes add constraint whatsapp_documentos_pendientes_driver_id_fkey  foreign key (driver_id)   references users(id);
-- alter table whatsapp_documentos_pendientes add constraint whatsapp_documentos_pendientes_assigned_by_fkey foreign key (assigned_by) references users(id);
--
-- --- cuando crucen trips ---
-- alter table whatsapp_documentos_pendientes add constraint whatsapp_documentos_pendientes_trip_id_fkey foreign key (trip_id) references trips(id);
-- ============================================================================
