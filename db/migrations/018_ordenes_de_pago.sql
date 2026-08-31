-- ============================================================================
-- 018 - Ordenes de checkout: el pedido que existe ANTES del pago
-- ============================================================================
-- Izipay valida el comercio mirando la web: exige carrito, checkout o boton de
-- pago visibles. El flujo nuevo es /comprar -> resumen del pedido -> "Pagar".
-- Esta tabla guarda ese pedido en cuanto la persona pulsa pagar, de modo que
-- el boton hace algo real desde el primer dia: registra la intencion con su
-- numero de pedido, y la pasarela (cuando Izipay active el comercio) solo
-- tendra que cobrar contra una orden que ya existe.
--
-- No lleva company_id y es deliberado: el checkout es publico y ocurre antes
-- de tener cuenta o sesion -igual que password_reset_tokens-, asi que no hay
-- contexto de empresa que fijar. Si el comprador ya es cliente, el vinculo se
-- hace despues, al conciliar el pago.
--
-- El monto se guarda aunque se derive del plan: el precio de la web puede
-- cambiar manana, y la orden tiene que recordar cuanto costaba CUANDO se
-- pidio, no cuanto cuesta hoy.

create table if not exists checkout_orders (
  id            uuid primary key default gen_random_uuid(),
  -- Numero humano para hablar con el cliente ("tu pedido N° 12"): un uuid no
  -- se dicta por telefono.
  numero        bigint generated always as identity unique,
  plan          text not null,
  monto         numeric(10,2) not null,
  moneda        text not null default 'PEN',
  razon_social  text not null,
  ruc           text,
  email         text not null,
  telefono      text,
  -- pendiente_pago -> pagado / cancelado. Lo mueve la conciliacion con la
  -- pasarela, no el navegador.
  estado        text not null default 'pendiente_pago',
  ip_solicitud  text,
  created_at    timestamptz not null default now()
);

create index if not exists co_email_idx  on checkout_orders (email);
create index if not exists co_estado_idx on checkout_orders (estado);
