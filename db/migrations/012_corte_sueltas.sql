-- ============================================================================
-- 012 - Corte a Postgres de alerts, notifications, audit_logs,
--       vehicle_equipment y los planes matriciales de mantenimiento
-- ============================================================================
-- Cinco tablas que no dependen unas de otras: alertas, notificaciones, bitacora
-- de auditoria, el EPP de cada vehiculo y los planes matriciales. Van en un
-- mismo corte no porque esten relacionadas, sino porque ninguna lo esta: todas
-- apuntan solo a companies, users o vehicles, que ya cruzaron, y nada las
-- referencia desde fuera.
--
-- La sexta, maintenance_matrix_plan_vehicles, va con maintenance_matrix_plans
-- porque es su tabla puente.
--
-- Ningun enum que ampliar: se revisaron los valores reales y todos caben.
-- alerts.severity es texto libre (info, warning, critical) y notifications.type
-- usa 'alert', que ya declara notification_type.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- INDICES DE LAS CONSULTAS REALES
-- ---------------------------------------------------------------------------

-- El tablero cuenta alertas sin resolver, y el listado filtra por lo mismo.
create index if not exists alerts_company_resueltas_idx on alerts (company_id, resolved);
-- create_alert_once pregunta, en CADA barrido, si ya hay una alerta viva del
-- mismo tipo para la entidad. El indice parcial cubre solo las no resueltas,
-- que son las unicas que se buscan.
create index if not exists alerts_dedup_idx
  on alerts (company_id, entity_id, alert_type) where not resolved;

-- La campana de notificaciones filtra por leidas y por destinatario.
create index if not exists notifications_company_leidas_idx on notifications (company_id, is_read);
create index if not exists notifications_company_usuario_idx on notifications (company_id, user_id);

-- La bitacora se lee siempre por fecha descendente, y a veces por entidad.
create index if not exists audit_logs_company_fecha_idx on audit_logs (company_id, created_at);
create index if not exists audit_logs_company_entidad_idx on audit_logs (company_id, entity_type, entity_id);

-- El EPP se busca por vehiculo. Es unico de hecho -hay una sola fila de
-- equipamiento por vehiculo- pero el indice se deja simple: la unicidad la
-- garantiza hoy el codigo, y convertirla en constraint sin revisar los datos
-- de todas las empresas seria arriesgarse a un corte fallido por una fila
-- duplicada vieja.
create index if not exists vehicle_equipment_company_vehiculo_idx
  on vehicle_equipment (company_id, vehicle_id);

-- El plan matricial de una unidad se busca por el vehiculo, no por el plan.
create index if not exists matrix_plan_vehicles_vehiculo_idx
  on maintenance_matrix_plan_vehicles (vehicle_id);

-- ============================================================================
-- NOTA - applies_to_vehicle_ids no es una columna
--
-- El modelo MaintenanceMatrixPlan lleva applies_to_vehicle_ids como una lista,
-- pero en Postgres esa relacion esta normalizada en la tabla puente
-- maintenance_matrix_plan_vehicles. La lista blanca de columnas habria
-- descartado el campo en silencio y el plan habria quedado sin sus vehiculos,
-- sin ningun error.
--
-- server.py la escribe y la reconstruye explicitamente, de modo que la API
-- sigue recibiendo y devolviendo la lista de siempre.
--
-- NOTA - la tabla puente no se recarga desde Mongo
--
-- maintenance_matrix_plan_vehicles NO tiene coleccion equivalente en Mongo:
-- alli esa relacion vive dentro del array applies_to_vehicle_ids del plan. Por
-- eso NO se la puede pasar a cutover-modulo.sh en la lista de tablas: el
-- script solo sabe recargar tablas que existen a los dos lados, y aborta con
-- "tablas desconocidas".
--
-- Y como la puente apunta al plan, tampoco se puede vaciar
-- maintenance_matrix_plans para recargarlo. El corte se hizo en dos tandas:
--
--   bash scripts/cutover-modulo.sh \n--        db/migrations/012_corte_sueltas.sql \n--        alerts,notifications,audit_logs,vehicle_equipment
--
-- y el plan aparte, comprobando antes a mano que ya coincidia (mismo id a los
-- dos lados). Si algun dia hubiera planes con vehiculos asignados en Mongo,
-- recargarlos exigiria ademas repoblar la puente leyendo el array, que es algo
-- que migrate_to_postgres.py hoy no hace.
--
-- NOTA - alerts no tiene resolved_at
--
-- Al resolver las alertas de alineacion el codigo escribia resolved_at, que no
-- es una columna de alerts (si la tienen blocks). Se descarta por la lista
-- blanca; lo que importa, resolved = true, si se guarda.
-- ============================================================================
