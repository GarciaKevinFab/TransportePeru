-- ============================================================================
-- 005 - Corte a Postgres del modulo Inventario
-- ============================================================================
-- Tablas que pasan a tener Postgres como fuente de verdad:
--   suppliers, inventory_items, stock_moves, purchase_orders
--
-- El corte mas limpio hasta ahora, y se nota que companies y users ya cruzaron:
-- de las 13 FKs de estas cuatro tablas, 12 se QUEDAN. Nueve apuntan a companies
-- o users (ya en Postgres) y tres son internas al grupo:
--   stock_moves.item_id       -> inventory_items
--   purchase_orders.supplier_id -> suppliers
--   (mas las de company_id/created_by de cada una)
--
-- Solo una cruza la frontera, y es la unica que hay que quitar.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- La unica FK saliente: work_orders sigue en Mongo, asi que una OT creada alli
-- no existe en Postgres y el INSERT del consumo de repuestos fallaria.
-- ---------------------------------------------------------------------------
alter table stock_moves drop constraint if exists stock_moves_work_order_id_fkey;

-- ---------------------------------------------------------------------------
-- Indices de las consultas reales del modulo
-- ---------------------------------------------------------------------------
-- El kardex de un articulo: historial por item dentro de la empresa, mas
-- reciente primero. Sin esto hay que recorrer todos los movimientos de la
-- empresa para armar el de un solo articulo.
create index if not exists stock_moves_company_item_fecha_idx
  on stock_moves (company_id, item_id, move_date desc);

-- El listado de articulos filtra siempre por activos, y muchas veces tambien
-- por categoria.
create index if not exists inventory_items_company_activos_idx
  on inventory_items (company_id, category) where is_active;

-- Igual para el listado de proveedores.
create index if not exists suppliers_company_activos_idx
  on suppliers (company_id) where is_active;

-- ============================================================================
-- RESTAURACION PENDIENTE - cuando work_orders cruce a Postgres. Buscar antes
-- referencias huerfanas:
--   select count(*) from stock_moves s where s.work_order_id is not null
--     and not exists (select 1 from work_orders w where w.id = s.work_order_id);
--
-- alter table stock_moves add constraint stock_moves_work_order_id_fkey
--   foreign key (work_order_id) references work_orders(id) not valid;
-- alter table stock_moves validate constraint stock_moves_work_order_id_fkey;
-- ============================================================================
