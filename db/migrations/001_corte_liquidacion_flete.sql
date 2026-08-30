-- ============================================================================
-- 001 — Corte a Postgres del módulo Liquidación de Flete
-- ============================================================================
-- Tablas que pasan a tener Postgres como fuente de verdad:
--   proveedores, tipos_carga, liquidaciones_flete, liquidacion_lineas
--
-- EL PROBLEMA QUE RESUELVE ESTE ARCHIVO
--
-- El corte es incremental: estas 4 tablas ya viven en Postgres, pero
-- companies, users, trips, facturas, fuel_loads, guias_transportista y
-- detracciones SIGUEN en Mongo. En Postgres esas tablas existen, pero solo
-- con la foto que dejó la migración inicial — no reciben las filas nuevas.
--
-- Entonces: si mañana se crea un fuel_load, nace en Mongo y NO existe en
-- Postgres. Al adjuntarlo a una línea de liquidación, el FK
-- liquidacion_lineas.fuel_load_id -> fuel_loads(id) falla y el usuario ve un
-- error 500 por una fila que para la aplicación existe perfectamente.
--
-- Por eso se quitan las 16 FKs que cruzan la frontera del corte, en los DOS
-- sentidos (las que salen de estas tablas y las que apuntan a ellas). NO es
-- relajar el modelo: es reconocer que una FK no puede atravesar dos bases de
-- datos distintas. Cada una se vuelve a poner cuando su tabla destino cruce a
-- Postgres (ver el bloque RESTAURACIÓN al final).
--
-- Las 3 FKs internas al conjunto se MANTIENEN — ahí Postgres sí puede
-- garantizar la integridad porque las dos puntas ya están en Postgres:
--   liquidacion_lineas.liquidacion_id  -> liquidaciones_flete
--   liquidaciones_flete.proveedor_id   -> proveedores
--   liquidaciones_flete.(company_id, tipo_carga) -> tipos_carga
--
-- Mientras tanto la integridad de las columnas huérfanas la sostiene la
-- aplicación, igual que la sostenía Mongo hasta hoy (Mongo nunca tuvo FKs).
-- ============================================================================

-- -> companies (la crea/edita server.py contra Mongo)
alter table proveedores         drop constraint if exists proveedores_company_id_fkey;
alter table tipos_carga         drop constraint if exists tipos_carga_company_id_fkey;
alter table liquidaciones_flete drop constraint if exists liquidaciones_flete_company_id_fkey;
alter table liquidacion_lineas  drop constraint if exists liquidacion_lineas_company_id_fkey;

-- -> users (los crea/edita server.py contra Mongo)
alter table proveedores         drop constraint if exists proveedores_created_by_fkey;
alter table liquidaciones_flete drop constraint if exists liquidaciones_flete_created_by_fkey;
alter table liquidaciones_flete drop constraint if exists liquidaciones_flete_closed_by_fkey;
alter table liquidaciones_flete drop constraint if exists liquidaciones_flete_reviewed_by_fkey;
alter table liquidacion_lineas  drop constraint if exists liquidacion_lineas_created_by_fkey;

-- -> tablas operativas que siguen en Mongo
alter table liquidacion_lineas drop constraint if exists liquidacion_lineas_trip_id_fkey;
alter table liquidacion_lineas drop constraint if exists liquidacion_lineas_factura_id_fkey;
alter table liquidacion_lineas drop constraint if exists liquidacion_lineas_fuel_load_id_fkey;
alter table liquidacion_lineas drop constraint if exists liquidacion_lineas_detraccion_id_fkey;
alter table liquidacion_lineas drop constraint if exists liquidacion_lineas_guia_transportista_id_fkey;

-- FKs ENTRANTES: tablas que siguen en Mongo y apuntan a las que ya cortaron.
-- Cruzan la misma frontera, en el otro sentido, y hay que quitarlas por dos
-- razones distintas:
--
--   1. Son igual de imposibles de cumplir: whatsapp_documentos_pendientes se
--      escribe en Mongo, y su copia en Postgres es una foto vieja que apunta a
--      lineas que ya pueden no existir.
--   2. Un FK entrante BLOQUEA el TRUNCATE de la tabla apuntada, que es
--      justamente lo que hace el paso de recarga del corte
--      (migrate_to_postgres.py --tables ... --truncate).
--
-- La segunda razon es la que hace que esto no sea opcional: sin estos dos
-- DROP, el corte no puede ni empezar.
alter table whatsapp_documentos_pendientes drop constraint if exists whatsapp_documentos_pendientes_linea_id_fkey;
alter table vehicles                       drop constraint if exists vehicles_proveedor_fk;

-- ============================================================================
-- RESTAURACIÓN — correr el bloque de cada tabla EN EL MOMENTO en que esa tabla
-- cruce a Postgres, no antes. Antes de restaurar hay que limpiar las
-- referencias huérfanas que se hayan acumulado, si no el ADD CONSTRAINT falla:
--
--   select count(*) from liquidacion_lineas l
--   where l.fuel_load_id is not null
--     and not exists (select 1 from fuel_loads f where f.id = l.fuel_load_id);
--
-- --- cuando cruce companies ---
-- alter table proveedores         add constraint proveedores_company_id_fkey         foreign key (company_id) references companies(id);
-- alter table tipos_carga         add constraint tipos_carga_company_id_fkey         foreign key (company_id) references companies(id);
-- alter table liquidaciones_flete add constraint liquidaciones_flete_company_id_fkey foreign key (company_id) references companies(id);
-- alter table liquidacion_lineas  add constraint liquidacion_lineas_company_id_fkey  foreign key (company_id) references companies(id);
--
-- --- cuando crucen users ---
-- alter table proveedores         add constraint proveedores_created_by_fkey          foreign key (created_by)  references users(id);
-- alter table liquidaciones_flete add constraint liquidaciones_flete_created_by_fkey  foreign key (created_by)  references users(id);
-- alter table liquidaciones_flete add constraint liquidaciones_flete_closed_by_fkey   foreign key (closed_by)   references users(id);
-- alter table liquidaciones_flete add constraint liquidaciones_flete_reviewed_by_fkey foreign key (reviewed_by) references users(id);
-- alter table liquidacion_lineas  add constraint liquidacion_lineas_created_by_fkey   foreign key (created_by)  references users(id);
--
-- --- cuando crucen las operativas (cada una por separado) ---
-- alter table liquidacion_lineas add constraint liquidacion_lineas_trip_id_fkey               foreign key (trip_id)               references trips(id);
-- alter table liquidacion_lineas add constraint liquidacion_lineas_factura_id_fkey            foreign key (factura_id)            references facturas(id);
-- alter table liquidacion_lineas add constraint liquidacion_lineas_fuel_load_id_fkey          foreign key (fuel_load_id)          references fuel_loads(id);
-- alter table liquidacion_lineas add constraint liquidacion_lineas_detraccion_id_fkey         foreign key (detraccion_id)         references detracciones(id);
-- alter table liquidacion_lineas add constraint liquidacion_lineas_guia_transportista_id_fkey foreign key (guia_transportista_id) references guias_transportista(id);
--
-- --- FKs entrantes: cuando cruce la tabla de origen, no la apuntada ---
-- alter table whatsapp_documentos_pendientes add constraint whatsapp_documentos_pendientes_linea_id_fkey foreign key (linea_id) references liquidacion_lineas(id);
-- alter table vehicles add constraint vehicles_proveedor_fk foreign key (proveedor_id) references proveedores(id);
-- ============================================================================
