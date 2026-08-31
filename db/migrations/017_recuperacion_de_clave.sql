-- ============================================================================
-- 017 - Recuperacion de contrasena por correo
-- ============================================================================
-- Hasta ahora, quien olvidaba su contrasena dependia de que otra persona se la
-- reescribiera (POST /users/{id}/reset-password). Para un chofer o un admin eso
-- vale; para el dueno de la empresa no habia nadie por encima salvo el
-- superadmin, y para el superadmin no habia absolutamente nadie: la unica
-- salida era entrar a la base a mano.
--
-- ---------------------------------------------------------------------------
-- SE GUARDA EL HASH DEL CODIGO, NO EL CODIGO
-- ---------------------------------------------------------------------------
-- token_hash es un SHA-256 del codigo que viaja en el enlace. Es la misma
-- razon por la que las contrasenas no se guardan en claro: quien consiga leer
-- esta tabla -un volcado, un backup extraviado, una consulta de mas- no puede
-- construir con ella ningun enlace valido. Solo puede comprobar si un codigo
-- que YA tiene es correcto, que es exactamente lo que necesita el backend.
--
-- No lleva company_id, y es deliberado: la empresa se deduce del usuario, y
-- este flujo ocurre SIN sesion -no hay contexto de empresa que fijar para RLS-.
-- Es la misma situacion que whatsapp_events.
-- ============================================================================

create table if not exists password_reset_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  token_hash  text not null unique,
  expira_en   timestamptz not null,
  usado_en    timestamptz,
  -- Para poder responder "quien pidio esto y desde donde" si algun dia hay que
  -- investigar un acceso raro. Se guarda la IP tal cual llega, sin cruzarla con
  -- nada.
  ip_solicitud text,
  created_at  timestamptz not null default now()
);

-- La busqueda del canje es siempre por hash. El indice unico ya la resuelve,
-- pero se deja explicito que ese es el unico camino de lectura.
create index if not exists prt_user_idx on password_reset_tokens (user_id);

-- Los caducados no sirven para nada y no deben acumularse: cada emision borra
-- lo que ya vencio (ver _emitir_codigo_de_recuperacion en server.py). El indice
-- hace que esa limpieza no recorra la tabla entera.
create index if not exists prt_expira_idx on password_reset_tokens (expira_en);

-- ============================================================================
-- POR QUE NO HAY POLITICA RLS AQUI
--
-- Las politicas de db/rls.sql se aplican a las tablas con company_id. Esta no
-- la tiene, asi que queda como whatsapp_events: accesible para app_backend sin
-- filtro de empresa. No es un agujero -no contiene datos de negocio, solo
-- hashes de un solo uso con caducidad de minutos- y es lo que permite que el
-- flujo funcione antes de que exista ninguna sesion.
-- ============================================================================
