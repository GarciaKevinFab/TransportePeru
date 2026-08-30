-- ============================================================================
-- 009 - Corte a Postgres de document_types, documents y blocks
-- ============================================================================
-- Documentos (licencias, SOAT, revision tecnica...) y los bloqueos operativos
-- que se disparan cuando uno vence. Van juntas porque documents apunta a
-- document_types y blocks apunta a las dos.
--
-- Es el corte mas limpio de la serie, y por una vez conviene decir por que NO
-- hace falta nada de lo habitual:
--
--   * Ningun enum que ampliar. Se revisaron los valores que hay en Mongo y
--     todos caben: documents.status usa 'pendiente' y 'vigente' de los siete
--     que declara document_status, y document_types.block_rule usa los tres de
--     block_rule. Es la primera vez en nueve cortes que no aparece una deriva
--     de valores.
--   * Ninguna FK que quitar. Las tres apuntan a companies, users o entre
--     ellas mismas, y todas esas ya cruzaron.
--   * Nada las referencia desde fuera, asi que se pueden vaciar y recargar:
--     este corte va con RECARGA=si y Postgres queda con la foto exacta de
--     Mongo, en vez de asumir que venian sincronizadas.
--
-- Los datos se revisaron antes: 18 tipos, 12 documentos y 2 bloqueos, sin
-- huerfanos, con todos los entity_id en formato uuid y todos los alert_days
-- como arrays de enteros.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- INDICES DE LAS CONSULTAS REALES
--
-- Ya existian los de company_id sueltos (blocks, document_types) y el
-- (company_id, entity_id) de documents. Faltaban los de las consultas que mas
-- se repiten.
-- ---------------------------------------------------------------------------

-- check_entity_blocks corre en CADA validacion de asignacion y de arranque de
-- viaje: pregunta si esta entidad tiene bloqueos activos. El indice parcial
-- solo indexa los activos, que son los unicos que se buscan y siempre son unos
-- pocos frente al historico de resueltos.
create index if not exists blocks_entidad_activos_idx
  on blocks (company_id, entity_type, entity_id) where is_active;

-- El barrido de alertas y el reporte de vencimientos recorren los documentos
-- con fecha de caducidad.
create index if not exists documents_company_expiry_idx
  on documents (company_id, expiry_date) where expiry_date is not null;

-- Borrar un tipo de documento cuenta antes cuantos lo usan.
create index if not exists documents_company_tipo_idx
  on documents (company_id, document_type_id);

-- La matriz documental filtra los tipos por a quien aplican.
create index if not exists document_types_company_aplica_idx
  on document_types (company_id, applies_to);

-- El seed y la siembra de arranque buscan por nombre para no duplicar.
create index if not exists document_types_company_nombre_idx
  on document_types (company_id, name);

-- ============================================================================
-- NOTA - blocks.resolved_by y el usuario "system"
--
-- El barrido automatico de documentos cerraba los bloqueos escribiendo
-- resolved_by = "system", pero la columna es uuid con FK a users y no existe
-- ningun usuario "system". En Mongo se guardaba la cadena y nadie la miraba
-- (el frontend no lee ese campo, y en produccion todos los valores son null).
--
-- A partir de este corte el barrido deja resolved_by en NULL. Un bloqueo con
-- resolved_at puesto y resolved_by en NULL es, por definicion, uno que cerro
-- el sistema: la distincion se conserva sin inventar un usuario ni agregar una
-- columna.
--
-- NOTA - blocks.entity_id y documents.entity_id son polimorficos (apuntan a
-- vehicles o a users segun entity_type) y por eso van sin FK, como estaban.
-- ============================================================================
