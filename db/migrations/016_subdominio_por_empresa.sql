-- ============================================================================
-- 016 - Subdominio por empresa: companies.slug
-- ============================================================================
-- Hasta ahora el inquilino se resolvia UNICAMENTE por el company_id del JWT, y
-- el host no participaba en nada. Eso deja dos cosas sin resolver:
--
--   1. El login busca en TODO el sistema:
--
--          select * from users where email = $1    -- login admin
--          select * from users where dni   = $1    -- login chofer
--
--      users_dni_idx NO es unico. Dos choferes con el mismo DNI en empresas
--      distintas y fetchrow se queda con la fila que le toque: uno de los dos
--      no puede entrar NUNCA, y no hay mensaje de error que lo explique. Con
--      un cliente no se nota; con veinte es una incidencia al mes.
--
--      El indice de email ya es (company_id, email), o sea que el esquema ya
--      estaba disenado para que el login fuera POR EMPRESA. Lo que faltaba era
--      de donde sacar la empresa antes de tener credenciales validadas. El
--      host es exactamente eso.
--
--   2. La pantalla de acceso no puede llevar la marca del cliente, porque
--      antes de autenticar no se sabe de quien es.
--
-- El slug NO es la frontera de seguridad -esa sigue siendo el company_id del
-- token mas las politicas RLS-. Es como se ELIGE la empresa antes de tener
-- token, y como se acota la busqueda del login.
--
-- ---------------------------------------------------------------------------
-- LO QUE NO PUEDE PASAR: que una empresa que ya opera se quede sin direccion
-- ---------------------------------------------------------------------------
-- La columna nace NULL, se rellena para todas las filas existentes y recien
-- entonces se marca NOT NULL. Si naciera NOT NULL con un default, todas las
-- empresas compartirian el mismo slug y el indice unico reventaria la
-- migracion a mitad de camino.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. LA COLUMNA, todavia opcional
-- ---------------------------------------------------------------------------
alter table companies add column if not exists slug text;

-- ---------------------------------------------------------------------------
-- B0. DIRECCIONES QUE YA EXISTEN FUERA DE LA BASE
--
-- Estas empresas YA tienen su subdominio publicado en Cloudflare y en los
-- marcadores de sus usuarios. Aqui la base de datos no decide nada: copia una
-- realidad que se decidio antes y en otro sitio.
--
-- Sin esto, el relleno automatico de B derivaria el slug del nombre:
--
--     'G&E TRANSPORTA S.A.C.'  ->  'g-e-transporta-s-a-c'
--
-- y el backend, al recibir una peticion a gyetransporta.sisac.pe, no
-- encontraria ninguna empresa con ese slug. El sintoma seria feo y silencioso:
-- la pantalla de acceso sin marca, y el login del chofer buscando en todo el
-- sistema como si el host no existiera.
--
-- Se fija por id y no por RUC ni por nombre: el nombre comercial se edita
-- desde la propia aplicacion y el RUC de esta fila es todavia uno de relleno
-- (20123456789). El id es lo unico que no va a cambiar.
--
-- El WHERE ... is null lo hace idempotente y ademas inofensivo en local, en CI
-- y en cualquier instalacion nueva: alli esos ids no existen y no pasa nada.
-- ---------------------------------------------------------------------------
update companies c
   set slug = f.slug
  from (values
    ('b42a968f-7dc2-4cd5-b656-504d87781710'::uuid, 'gyetransporta')  -- G&E TRANSPORTA S.A.C.
  ) as f(id, slug)
 where c.id = f.id
   and c.slug is null;

-- ---------------------------------------------------------------------------
-- B. RELLENO DE LAS EMPRESAS QUE YA EXISTEN
--
-- El slug se deriva del nombre: "G&E Transportes S.A.C." -> "g-e-transportes-s-a-c",
-- recortado a 30. Si el nombre no deja nada utilizable (vacio, solo simbolos,
-- solo caracteres no latinos) se cae a "empresa-<6 hex del id>", que siempre
-- produce algo valido y unico.
--
-- La lista de reservados de aca abajo es un MINIMO defensivo para que el
-- relleno no genere por accidente un slug que colisione con un host de
-- servicio. La lista autoritativa -la que se valida en cada alta y en cada
-- cambio- vive en backend/tenant_host.py: es politica operativa y va a crecer,
-- y no quiero una migracion cada vez que se reserve una palabra mas.
--
-- El bucle es fila a fila a proposito: cada slug que se asigna cambia el
-- conjunto de los que quedan libres para el siguiente, asi que un UPDATE
-- masivo con row_number() no podria comprobar sus propias colisiones.
-- ---------------------------------------------------------------------------
do $$
declare
  f          record;
  base       text;
  candidato  text;
  n          int;
  reservados text[] := array[
    'www', 'api', 'app', 'admin', 'mail', 'static', 'assets', 'cdn',
    'fletepro', 'transportes', 'soporte', 'blog', 'docs', 'status'
  ];
begin
  -- `where slug is null` deja fuera las direcciones fijadas en B0, y ademas
  -- hace que reaplicar la migracion no reescriba ningun slug ya asignado.
  for f in select id, name from companies where slug is null order by created_at loop

    -- minusculas -> sin tildes -> todo lo que no sea [a-z0-9] pasa a guion ->
    -- guiones repetidos colapsan -> se recorta a 30 -> se quitan los guiones
    -- de las puntas (el recorte pudo dejar uno colgando).
    base := regexp_replace(
              regexp_replace(
                translate(lower(coalesce(f.name, '')),
                          'áàäâãéèëêíìïîóòöôõúùüûñç',
                          'aaaaaeeeeiiiiooooouuuunc'),
                '[^a-z0-9]+', '-', 'g'),
              '-{2,}', '-', 'g');
    base := trim(both '-' from left(trim(both '-' from base), 30));

    if length(base) < 2 then
      base := 'empresa-' || left(replace(f.id::text, '-', ''), 6);
    end if;

    candidato := base;
    n := 1;
    while candidato = any(reservados)
       or exists (select 1 from companies where slug = candidato) loop
      n := n + 1;
      -- Se recorta la base ANTES de pegar el sufijo para no pasarse de 30.
      candidato := trim(both '-' from left(base, 30 - length('-' || n))) || '-' || n;
    end loop;

    update companies set slug = candidato where id = f.id;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- C. AHORA SI: OBLIGATORIA Y UNICA
--
-- Sin slug una empresa no tiene direccion, y el dia que el acceso viva solo en
-- el subdominio sus usuarios no tendrian por donde entrar. Es tan estructural
-- como el nombre.
-- ---------------------------------------------------------------------------
alter table companies alter column slug set not null;

create unique index if not exists companies_slug_idx on companies (slug);

-- ---------------------------------------------------------------------------
-- D. FORMATO: lo que exige el DNS, no lo que exige el negocio
--
-- Solo la forma, que no cambia nunca: minusculas, digitos y guiones, sin
-- empezar ni terminar en guion, entre 2 y 30 caracteres.
--
-- El '--' queda prohibido porque las posiciones 3 y 4 estan reservadas para
-- punycode (xn--...): un slug con doble guion ahi produce un nombre de dominio
-- que algunos resolvers interpretan como IDN y otros no.
--
-- Las palabras reservadas NO estan aca. Son politica comercial y operativa
-- -hoy 'api', manana 'facturacion'-, y meterlas en una CHECK obligaria a una
-- migracion por cada palabra nueva. Van en backend/tenant_host.py.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'companies_slug_formato'
  ) then
    alter table companies add constraint companies_slug_formato check (
      slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'
      and slug !~ '--'
      and length(slug) between 2 and 30
    );
  end if;
end
$$;

-- ============================================================================
-- NOTA - por que no hay tabla de alias todavia
--
-- Cuando una empresa cambie de slug, el anterior deberia seguir respondiendo
-- con un redirect en vez de morir: los usuarios tienen la direccion en
-- marcadores y la app instalada como PWA con ese origen grabado.
--
-- Eso es una tabla (slug_anterior -> company_id, con fecha) y una regla de
-- redireccion. No se agrega ahora porque hoy NADIE puede cambiar de slug: el
-- alta lo genera y ningun endpoint lo modifica. Una tabla vacia que nadie
-- escribe solo daria la impresion de que el cambio de direccion ya esta
-- resuelto.
-- ============================================================================
