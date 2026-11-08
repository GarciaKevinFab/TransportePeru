-- ============================================================================
-- 021 - Cobro recurrente con Mercado Pago y comprobantes emitidos a mano
-- ============================================================================
-- Hasta aqui CargoXprez no cobraba: el checkout registraba un pedido y nada
-- mas (Izipay rechazo la integracion). Esta migracion deja el esquema para
-- cobrar con Mercado Pago Suscripciones, el mismo diseno que ya cobra en
-- produccion en LicitaPro, adaptado a que aqui el cliente es la EMPRESA y no
-- un usuario.
--
-- QUE CREA
--
--   companies.subscription_ends_at   hasta cuando esta pagado el plan. Lo
--                                    extiende cada cobro aprobado, y solo eso.
--   companies.mp_preapproval_id      la suscripcion viva en Mercado Pago.
--   companies.mp_intentos_fallidos   cobros rechazados seguidos de quien ya paga.
--   pagos_suscripcion                un cobro (o intento) por fila, con la foto
--                                    de los datos de facturacion (comp_*).
--   datos_facturacion                boleta o factura, DNI o RUC de la empresa.
--   marcar_comprobante()             el disparador que pide el comprobante.
--
-- LA IDEMPOTENCIA DEL WEBHOOK ES UN INDICE, NO UN IF
--
--   Mercado Pago reintenta cada aviso hasta recibir 200, asi que el mismo
--   cobro llega varias veces. El indice unico de mp_payment_id hace que el
--   segundo choque contra la base en vez de conceder otro mes. El de
--   mp_preapproval_id impide que dos empresas reclamen la misma suscripcion.
--
-- POR QUE UN DISPARADOR PARA EL COMPROBANTE
--
--   Un cobro pasa a 'pagado' por mas de un camino (webhook, alta manual del
--   superadmin). Si cada uno tuviera que acordarse de pedir el comprobante, el
--   que se olvidara dejaria una venta sin boleta ni factura y sin aviso. El
--   disparador lo hace en la misma transaccion que el cobro, venga de donde
--   venga, y guarda la foto de los datos EN ESE MOMENTO: si el cliente los
--   cambia despues, el comprobante de un cobro viejo no cambia.
--
-- EL PDF VA EN LA BASE, NO EN /uploads
--
--   /uploads se sirve con StaticFiles sin autenticacion: un comprobante ahi
--   seria publico para quien adivine la ruta. En bytea queda detras de RLS y
--   del endpoint que comprueba la empresa, y entra en el respaldo de Postgres.
--   Son unos pocos KB por mes y empresa.
--
-- SE PUEDE APLICAR CON LA APLICACION CORRIENDO, Y ANTES DEL BACKEND NUEVO
--
--   Columnas nulables, dos tablas nuevas y un disparador que solo actua sobre
--   filas de pagos_suscripcion, que el backend viejo no conoce. Reaplicarla no
--   cambia nada (todo es IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================================

alter table companies add column if not exists subscription_ends_at timestamptz;
alter table companies add column if not exists mp_preapproval_id    text;
alter table companies add column if not exists mp_intentos_fallidos integer not null default 0;

create unique index if not exists companies_mp_preapproval_idx
  on companies (mp_preapproval_id) where mp_preapproval_id is not null;

-- ---------------------------------------------------------------------------
-- Datos de facturacion de la empresa
-- ---------------------------------------------------------------------------
create table if not exists datos_facturacion (
  company_id     uuid primary key references companies(id) on delete cascade,
  tipo           text not null check (tipo in ('boleta', 'factura')),
  documento      text,
  nombre         text,
  direccion      text,
  actualizado_en timestamptz not null default now(),
  -- Factura siempre con RUC. Boleta: DNI, RUC o nada (SUNAT admite boleta sin
  -- documento por debajo de S/ 700, y ningun cobro de aqui llega).
  check (tipo = 'boleta' or documento ~ '^[0-9]{11}$'),
  check (documento is null or documento ~ '^([0-9]{8}|[0-9]{11})$')
);

-- ---------------------------------------------------------------------------
-- Cobros de la suscripcion
-- ---------------------------------------------------------------------------
create table if not exists pagos_suscripcion (
  id               uuid primary key default gen_random_uuid(),
  -- Numero humano para el correo al dueno y para hablar con el cliente.
  numero           bigint generated always as identity unique,
  company_id       uuid not null references companies(id) on delete cascade,
  plan             text not null,
  monto            numeric(10,2) not null,
  moneda           text not null default 'PEN',
  -- pagado | fallido | devuelto
  estado           text not null check (estado in ('pagado', 'fallido', 'devuelto')),
  -- mercadopago | manual
  metodo           text not null,
  -- La factura de Mercado Pago (/authorized_payments/{id}): una por periodo.
  mp_payment_id    text,
  -- El cobro en si (/v1/payments/{id}): es lo que trae el aviso de devolucion.
  mp_cobro_id      text,
  mp_preapproval_id text,
  -- La respuesta cruda, tal como llego. En una disputa vale lo que ELLOS dijeron.
  respuesta        jsonb,
  confirmado_en    timestamptz,
  created_at       timestamptz not null default now(),

  -- Comprobante emitido a mano en BSNegocios.
  comp_estado      text check (comp_estado is null or comp_estado in ('pendiente', 'emitido', 'no_aplica')),
  comp_tipo        text,
  comp_documento   text,
  comp_nombre      text,
  comp_direccion   text,
  comp_serie       text,
  comp_numero      text,
  comp_pdf         bytea,
  comp_nota        text,
  comp_emitido_en  timestamptz,
  comp_avisado_en  timestamptz,
  comp_recordado_en timestamptz
);

create unique index if not exists pagos_mp_payment_idx
  on pagos_suscripcion (mp_payment_id) where mp_payment_id is not null;
create index if not exists pagos_mp_cobro_idx
  on pagos_suscripcion (mp_cobro_id) where mp_cobro_id is not null;
create index if not exists pagos_company_idx on pagos_suscripcion (company_id, created_at desc);
-- Una misma serie y numero no puede ir en dos cobros.
create unique index if not exists pagos_comp_numero_idx
  on pagos_suscripcion (comp_serie, comp_numero) where comp_numero is not null;
create index if not exists pagos_comp_pendiente_idx
  on pagos_suscripcion (comp_estado) where comp_estado = 'pendiente';

-- ---------------------------------------------------------------------------
-- RLS: las dos tablas tienen company_id, asi que van aisladas como el resto
-- ---------------------------------------------------------------------------
-- rls.sql recorre las tablas con company_id solo cuando se vuelve a aplicar;
-- sin esto, estas dos quedarian abiertas hasta el proximo despliegue completo.
-- El webhook y el panel del dueno las leen con tx_global, que fija
-- app.is_superadmin; el cliente, con tx(), que solo ve su empresa.
do $$
declare
  t text;
begin
  foreach t in array array['datos_facturacion', 'pagos_suscripcion']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format(
      'create policy tenant_isolation on %I for all to app_backend
         using (app_is_superadmin() or company_id = app_current_company_id())
         with check (app_is_superadmin() or company_id = app_current_company_id())',
      t);
  end loop;
end
$$;

-- El rol del backend tiene "default privileges", pero solo para tablas que
-- crea el mismo usuario que los fijo. Se da explicito para no depender de con
-- que rol se aplique la migracion.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_backend') then
    grant select, insert, update, delete on datos_facturacion, pagos_suscripcion to app_backend;
    grant usage, select on all sequences in schema public to app_backend;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- El disparador que pide el comprobante
-- ---------------------------------------------------------------------------
create or replace function marcar_comprobante() returns trigger as $$
declare
  d datos_facturacion%rowtype;
begin
  if new.estado = 'pagado' and new.comp_estado is null and new.monto > 0
     and (tg_op = 'INSERT' or old.estado is distinct from 'pagado') then
    select df.* into d from datos_facturacion df where df.company_id = new.company_id;
    new.comp_estado    := 'pendiente';
    new.comp_tipo      := coalesce(d.tipo, 'boleta');
    new.comp_documento := d.documento;
    new.comp_nombre    := d.nombre;
    new.comp_direccion := d.direccion;
  elsif tg_op = 'UPDATE' and new.estado = 'devuelto'
        and old.estado = 'pagado' and new.comp_estado = 'pendiente' then
    -- Devuelto antes de emitir: ya no hay venta que facturar.
    new.comp_estado := 'no_aplica';
    new.comp_nota   := 'Devuelto antes de emitir el comprobante';
  end if;
  return new;
end
$$ language plpgsql;

drop trigger if exists pagos_marcar_comprobante on pagos_suscripcion;
create trigger pagos_marcar_comprobante
  before insert or update of estado on pagos_suscripcion
  for each row execute function marcar_comprobante();
