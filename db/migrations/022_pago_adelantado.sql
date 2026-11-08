-- ============================================================================
-- 022 - Pago adelantado (Yape, banca movil o tarjeta) y recordatorio de renovacion
-- ============================================================================
-- Hasta la 021 solo se cobraba con la suscripcion mensual con tarjeta
-- (Mercado Pago /preapproval). Yape y PagoEfectivo no existen ahi: solo en un
-- pago unico de Checkout Pro. Esta migracion deja el esquema para que una
-- empresa pague 1, 3, 6 o 12 meses de una vez, y para avisarle antes de que
-- se le acabe lo pagado.
--
-- QUE CREA
--
--   pagos_suscripcion.origen    'suscripcion' (el cobro mensual con tarjeta)
--                               o 'adelantado' (un pago unico de Checkout Pro).
--   pagos_suscripcion.meses     cuantos meses compro ese pago. Una devolucion
--                               quita exactamente esos meses.
--   recordatorios_renovacion    un aviso enviado por fila: (empresa, fecha de
--                               vencimiento, dias antes). La clave primaria es
--                               la que impide mandar el mismo aviso dos veces,
--                               aunque corran dos backends a la vez.
--
-- SE PUEDE APLICAR CON LA APLICACION CORRIENDO, Y ANTES DEL BACKEND NUEVO
--
--   Dos columnas con valor por defecto (las filas viejas quedan como
--   'suscripcion' de 1 mes, que es lo que eran) y una tabla nueva que el
--   backend viejo no usa. Reaplicarla no cambia nada (IF NOT EXISTS).
-- ============================================================================

alter table pagos_suscripcion add column if not exists origen text not null default 'suscripcion';
alter table pagos_suscripcion add column if not exists meses  integer not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pagos_suscripcion_origen_check') then
    alter table pagos_suscripcion add constraint pagos_suscripcion_origen_check
      check (origen in ('suscripcion', 'adelantado'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pagos_suscripcion_meses_check') then
    alter table pagos_suscripcion add constraint pagos_suscripcion_meses_check
      check (meses between 1 and 12);
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Recordatorios de renovacion ya enviados
-- ---------------------------------------------------------------------------
-- `vence` es la fecha de fin que tenia la empresa cuando se mando el aviso: si
-- paga otro periodo, la fecha cambia y los avisos del periodo nuevo salen de
-- nuevo, una vez cada uno.
create table if not exists recordatorios_renovacion (
  company_id  uuid        not null references companies (id) on delete cascade,
  vence       timestamptz not null,
  dias        integer     not null check (dias in (1, 7)),
  enviado_en  timestamptz not null default now(),
  primary key (company_id, vence, dias)
);

do $$
begin
  execute 'alter table recordatorios_renovacion enable row level security';
  execute 'alter table recordatorios_renovacion force row level security';
  execute 'drop policy if exists tenant_isolation on recordatorios_renovacion';
  execute 'create policy tenant_isolation on recordatorios_renovacion for all to app_backend
             using (app_is_superadmin() or company_id = app_current_company_id())
             with check (app_is_superadmin() or company_id = app_current_company_id())';
  if exists (select 1 from pg_roles where rolname = 'app_backend') then
    grant select, insert, update, delete on recordatorios_renovacion to app_backend;
  end if;
end
$$;
