-- ============================================================================
-- 019 - Cobro real por Izipay, y el Libro de Reclamaciones
-- ============================================================================
-- Dos cosas que van juntas porque llegan del mismo sitio: vender en linea en
-- Peru. La pasarela necesita donde anotar el resultado del cobro; la ley
-- 29571 obliga a que una web que vende tenga Libro de Reclamaciones virtual.

-- ---------------------------------------------------------------------------
-- 1) El resultado del cobro, sobre la orden que ya existia (migracion 018)
-- ---------------------------------------------------------------------------
-- La orden se crea al pulsar "Pagar"; estas columnas las escribe la pasarela
-- despues, por su webhook. Van aca y no en una tabla aparte porque son el
-- desenlace de la MISMA fila: preguntar "como acabo el pedido 12" tiene que
-- ser mirar el pedido 12.
alter table checkout_orders add column if not exists transaccion_id     text;
alter table checkout_orders add column if not exists pagado_en          timestamptz;
-- La respuesta cruda de la pasarela, tal como llego. Cuando dentro de seis
-- meses haya que discutir un cobro con Izipay, lo que vale es lo que ELLOS
-- dijeron, no nuestro resumen de lo que dijeron.
alter table checkout_orders add column if not exists respuesta_pasarela jsonb;
-- La empresa a la que se le activo el plan, si se pudo enlazar por correo. Es
-- nullable a proposito: se puede pagar antes de tener cuenta, y esa conciliacion
-- ocurre despues.
alter table checkout_orders add column if not exists company_id uuid references companies(id) on delete set null;

create index if not exists co_company_idx on checkout_orders (company_id);
-- Un id de transaccion no puede repetirse entre ordenes: si el webhook llega
-- dos veces -y llega, los reintentos son parte del protocolo- el segundo tiene
-- que chocar contra esto en vez de cobrar dos veces.
create unique index if not exists co_transaccion_idx on checkout_orders (transaccion_id) where transaccion_id is not null;

-- ---------------------------------------------------------------------------
-- 2) Libro de Reclamaciones (Ley 29571, D.S. 101-2022-PCM)
-- ---------------------------------------------------------------------------
-- Obligatorio para quien vende al consumidor, y la pasarela lo revisa. La ley
-- pide: hoja con numero correlativo, copia al consumidor, respuesta en 15 dias
-- habiles y conservacion de lo reclamado. Todo eso son columnas aca.
--
-- Sin company_id, como checkout_orders y por lo mismo: quien reclama puede no
-- ser cliente todavia -o serlo y no haber iniciado sesion-, asi que no hay
-- contexto de empresa que fijar. El reclamo es contra NOSOTROS, no dentro de
-- una empresa cliente.
create table if not exists reclamaciones (
  id             uuid primary key default gen_random_uuid(),
  -- El correlativo que la ley exige y que la persona necesita para acudir a
  -- INDECOPI. Se muestra como LR-000001.
  numero         bigint generated always as identity unique,
  -- reclamo = disconformidad con el servicio; queja = malestar con la
  -- atencion. La ley las distingue y hay que preguntarlo, no deducirlo.
  tipo           text not null check (tipo in ('reclamo', 'queja')),

  nombre           text not null,
  documento_tipo   text not null,
  documento_numero text not null,
  email            text not null,
  telefono         text,
  direccion        text,
  es_menor_edad    boolean not null default false,
  apoderado        text,

  bien_contratado  text not null default 'servicio',
  descripcion_bien text,
  monto_reclamado  numeric(10,2),

  detalle          text not null,
  pedido           text not null,

  -- pendiente -> respondido. La fecha limite se calcula al recibir y se guarda
  -- ya resuelta: el plazo legal corre desde la presentacion, y recalcularlo
  -- mas tarde a partir de "hoy" daria una fecha distinta cada vez que se mire.
  estado           text not null default 'pendiente',
  respuesta        text,
  respondido_en    timestamptz,
  limite_respuesta timestamptz not null,

  ip_solicitud     text,
  created_at       timestamptz not null default now()
);

create index if not exists rec_estado_idx on reclamaciones (estado);
create index if not exists rec_email_idx  on reclamaciones (email);
