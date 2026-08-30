-- ============================================================================
-- 010 - Corte a Postgres de checklist_templates, checklists y checklist_runs
-- ============================================================================
-- El checklist pre-viaje: la plantilla de items a revisar, y el resultado de
-- cada revision. Van juntas porque checklist_runs apunta a
-- checklist_templates.
--
-- Las tres colecciones estan VACIAS en produccion, asi que no hay datos que
-- migrar ni valores raros que descubrir. Tampoco hay FKs que quitar: las tres
-- apuntan a companies, users, vehicles, trips o entre ellas mismas, y todas
-- ya cruzaron.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- LA FK QUE LA 007 DEJO ANOTADA Y QUE NO SE PUEDE CREAR
--
-- La migracion 007 dejo escrito que, cuando checklists cruzara, habria que
-- agregar:
--
--   alter table trips add constraint trips_checklist_id_fkey
--     foreign key (checklist_id) references checklists(id);
--
-- No se puede, y conviene dejar dicho por que para que nadie lo intente de
-- nuevo: trips.checklist_id recibe ids de DOS tablas distintas.
--
--   POST /checklists          crea un Checklist     y guarda su id en el viaje
--   POST /checklists/start    crea un ChecklistRun  y guarda su id en el viaje
--
-- O sea que la columna es una referencia polimorfica de facto, y una FK contra
-- cualquiera de las dos tablas rechazaria las filas de la otra.
--
-- La causa de fondo es que el sistema tiene DOS modelos para la misma cosa:
-- `checklists` (items + tire_checks) y `checklist_runs` (responses +
-- tire_checks + plantilla + fotos), cada uno con su juego de endpoints. Eso es
-- deuda de diseno anterior a esta migracion y no se resuelve aca: unificarlos
-- toca el frontend y merece su propio cambio. Mientras existan las dos, la
-- columna se queda sin FK, como estaba.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- INDICES DE LAS CONSULTAS REALES
-- ---------------------------------------------------------------------------
-- El checklist de un viaje se busca siempre por trip_id: al abrirlo, al
-- enviarlo y al comprobar si ya existe uno.
create index if not exists checklist_runs_trip_idx on checklist_runs (trip_id);
create index if not exists checklists_trip_idx     on checklists (trip_id);

-- Al abrir un checklist se busca la plantilla activa de la empresa. El indice
-- parcial solo cubre las activas, que son las unicas que se consultan.
create index if not exists checklist_templates_company_activas_idx
  on checklist_templates (company_id) where is_active;

-- ============================================================================
-- NOTA - la ubicacion se guarda en dos columnas, no en un dict
--
-- checklists y checklist_runs tienen location_lat y location_lng, mientras que
-- los modelos de Python llevan un unico `location` = {lat, lng}, que es la
-- forma que manda y espera el frontend. La traduccion entre las dos formas se
-- hace en server.py (_fila_con_ubicacion / _api_con_ubicacion); sin ella el
-- dict no coincide con ninguna columna declarada y se descartaria en silencio,
-- perdiendo la ubicacion sin ningun error.
--
-- El mismo par de columnas lo tienen fuel_loads e issues, que cruzan en cortes
-- posteriores y usaran los mismos dos helpers.
-- ============================================================================
