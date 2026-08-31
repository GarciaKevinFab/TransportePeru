-- ============================================================================
-- 015 - Suscripciones: plan, estado y prueba gratuita por empresa
-- ============================================================================
-- Hasta ahora una empresa solo existia si un superadmin la creaba a mano
-- (POST /companies exige ese rol). Para vender por suscripcion hace falta que
-- una transportista pueda darse de alta sola y empezar una prueba.
--
-- Tres columnas, todas en companies porque el inquilino ES la empresa:
--
--   plan                 que contrato. Texto libre a proposito: los niveles y
--                        sus precios se deciden en el catalogo comercial, no en
--                        el esquema, y no quiero una migracion cada vez que se
--                        renombre un plan.
--   subscription_status  trial | activa | vencida | cancelada
--   trial_ends_at        cuando termina la prueba. NULL = sin vencimiento.
--
-- ---------------------------------------------------------------------------
-- LO QUE NO PUEDE PASAR: dejar fuera a quien ya estaba
-- ---------------------------------------------------------------------------
-- Las empresas que ya existen no son pruebas: son las que estan operando. Si
-- heredaran el default 'trial' con una fecha de fin, el dia que venciera se
-- quedarian bloqueadas por una funcionalidad que nadie les vendio.
--
-- Por eso el UPDATE de mas abajo las marca 'activa' explicitamente. El default
-- solo rige para las filas nuevas, que son las altas por la web.
-- ============================================================================

alter table companies add column if not exists plan                text        not null default 'trial';
alter table companies add column if not exists subscription_status text        not null default 'trial';
alter table companies add column if not exists trial_ends_at       timestamptz;

-- Las que ya estaban: activas y sin vencimiento. Se filtra por trial_ends_at
-- is null para que reaplicar la migracion no pise una prueba en curso.
update companies
   set subscription_status = 'activa',
       plan = 'activa'
 where trial_ends_at is null
   and subscription_status = 'trial';

-- El estado se consulta en CADA peticion autenticada, para saber si la empresa
-- sigue al dia. Es la lectura mas caliente que va a tener esta tabla.
create index if not exists companies_suscripcion_idx
  on companies (subscription_status, trial_ends_at);

-- ============================================================================
-- NOTA - por que no hay tabla de pagos todavia
--
-- Esto habilita el alta y la prueba, que es lo que hace falta para que la
-- landing tenga un boton que funcione. El cobro es otra cosa: exige pasarela
-- (Izipay, como en licitapro), y con ella una tabla de pagos, el webhook de
-- confirmacion y la conciliacion. Meter aqui una tabla vacia que nadie escribe
-- solo daria la impresion de que el cobro existe.
--
-- Cuando llegue, subscription_status ya es el sitio donde apoyarse: el webhook
-- lo pasa a 'activa' y la renovacion lo mantiene.
-- ============================================================================
