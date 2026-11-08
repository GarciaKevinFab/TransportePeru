# Mercado Pago en CargoXprez

Dos formas de pagar el plan Pro (S/ 199 al mes, IGV incluido), las dos en el
sitio de Mercado Pago, y comprobantes (boleta o factura) emitidos a mano en
BSNegocios y entregados al cliente desde su cuenta:

- **Suscripción mensual con tarjeta** (Mercado Pago Suscripciones,
  `/preapproval`): se cobra sola cada mes.
- **Pago adelantado** de 1, 3, 6 o 12 meses (Checkout Pro,
  `/checkout/preferences`): con Yape, desde la banca móvil (PagoEfectivo: BCP,
  BBVA y otros, o agente) o con tarjeta. No se cobra solo: se avisa por correo
  antes de que venza. Ver la sección *Pago adelantado* más abajo.

Es la misma cuenta de Mercado Pago que LicitaPro (SOLUCIONES INFORMÁTICAS MDD
S.A.C., RUC 20490042068), pero con **su propia aplicación**: credenciales,
webhook y clave secreta separados. Los avisos de una app nunca llegan a la otra;
igual, cada aviso se valida por su `external_reference` (`cargoxprez|<empresa>|pro|mensual`)
y lo que no empieza por `cargoxprez|` se ignora.

## Cómo funciona

1. El dueño o admin de la empresa entra a **Suscripción** (`/suscripcion`) o a
   `/comprar`, elige boleta o factura (con RUC, que se valida contra el padrón de
   SUNAT) y pulsa pagar.
2. El backend crea un `preapproval` en Mercado Pago **sin plan** (el importe lo
   pone `planes.py`, nunca el navegador) y manda al cliente al `init_point`.
3. El cliente autoriza la tarjeta en Mercado Pago y vuelve a
   `https://<su-subdominio>/suscripcion?aviso=confirmando`. La pantalla espera
   el webhook; **no concede nada por haber vuelto**.
4. Mercado Pago avisa a `POST /webhooks/mercadopago`. Con la firma válida, el
   backend vuelve a leer el recurso en la API (no se fía del cuerpo del aviso):
   - `subscription_preapproval`: vincula la suscripción a la empresa, o la
     marca cancelada si se canceló desde Mercado Pago.
   - `subscription_authorized_payment`: cada cobro mensual. Aprobado → +30 días
     sobre el vencimiento vigente (o sobre lo que quedaba de prueba) y estado
     `activa`. Rechazado → se cuenta; a los 4 seguidos, `suspendida`.
   - `payment`: las devoluciones (resta los 30 días de ese cobro, una vez) y el
     pago adelantado (ver *Pago adelantado*).
   El aviso repetido no hace nada (índice único sobre el id de la factura).
5. Cada cobro aprobado queda en `pagos_suscripcion` con el comprobante
   `pendiente`. A `COMPROBANTES_AVISO_EMAIL` le llega un correo con los datos
   para emitirlo (y un recordatorio a las 24 h).
6. El superadmin lo emite en BSNegocios y lo registra en **Comprobantes**
   (`/admin/comprobantes`): serie, número, fecha y PDF. El cliente lo descarga
   desde su pantalla de Suscripción.

Estados: `trial` → `activa` → `vencida` (7 días de gracia, plan Pro entero) →
`suspendida`. `cancelada` conserva el plan Pro hasta el fin del periodo pagado.
Sin pago vigente (prueba vencida, `suspendida`, cancelación vencida) la empresa
**pasa al plan Gratis**, no a solo consulta: ver "Plan Gratis" más abajo.

Cancelar desde la cuenta cancela primero en Mercado Pago; si Mercado Pago no
responde, no se marca nada y el cliente ve el error (no puede quedar "cancelada"
aquí y cobrándose allá).

## Pasos para Kevin

### 1. Crear la aplicación en Mercado Pago

1. Entrar a <https://www.mercadopago.com.pe/developers/panel/app> con la cuenta
   de SOLUCIONES INFORMÁTICAS MDD.
2. **Crear aplicación** → nombre `CargoXprez`. Tipo de solución: *Pagos online*;
   ¿usa plataforma de e-commerce?: *No*; producto: **Suscripciones**.
3. En la app nueva → **Credenciales de producción** → copiar el
   **Access Token** (`APP_USR-...`). La Public Key no se usa.

No reutilizar la aplicación de LicitaPro: el webhook de una aplicación es uno
solo y la clave secreta la comparten todos sus avisos.

### 2. Configurar el webhook

En la app de CargoXprez → **Webhooks** → **Configurar notificaciones** →
pestaña **Modo productivo**:

- URL: `https://cargoxprez.sisac.pe/webhooks/mercadopago`
- Eventos:
  - **Planes y suscripciones** — marcar los dos:
    `subscription_preapproval` y `subscription_authorized_payment`.
  - **Pagos** (`payment`) — necesario para enterarse de las devoluciones.
- Guardar y **copiar la clave secreta** que genera (botón "Revelar"). Es
  `MERCADOPAGO_WEBHOOK_SECRET`.

La ruta queda fuera del limitador de peticiones y no lleva sesión: la protege la
firma `x-signature`. Sin la clave configurada, todos los avisos se rechazan con
401 (falla cerrada). Mercado Pago reintenta cada 15 minutos lo que no recibió un
200/201, así que un aviso perdido durante un despliegue llega después.

El botón **Simular** del panel manda un aviso con `data.id` inventado: responde
200 con `"aplicado": false` (no existe en la API) o 503 si la API no responde.
Sirve para comprobar que la firma pasa; no cambia nada.

### 3. Variables en `backend/.env.production`

En el VPS (`/opt/transporteperu/backend/.env.production`), agregar:

```
MERCADOPAGO_MODO=prueba
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...            # paso 1
MERCADOPAGO_WEBHOOK_SECRET=...                  # paso 2
MERCADOPAGO_CORREOS_PRUEBA=correo-de-kevin@...  # quién ve el pago en modo prueba
COMPROBANTES_AVISO_EMAIL=correo-de-kevin@...    # a dónde llega "emitir boleta/factura"
CARGOXPREZ_URL_PUBLICA=https://cargoxprez.sisac.pe
```

`TENANT_BASE_DOMAIN` ya existe y se reutiliza: decide a qué subdominio vuelve el
cliente. Los correos salen por la configuración SMTP que ya usa la app.

Borrar las variables `IZIPAY_*` si estuvieran: ya no las lee nadie.

### 4. Despliegue: la migración ANTES que el backend

El backend nuevo lee columnas y tablas que crea la migración 021. Al revés, el
backend viejo funciona igual con la migración aplicada (solo agrega cosas).

```bash
# desde el repo, en la rama ya fusionada
scp -i ~/.ssh/hostinger_vps_ed25519 db/migrations/021_mercadopago_y_comprobantes.sql \
    root@2.24.115.75:/opt/transporteperu/db/migrations/
ssh -i ~/.ssh/hostinger_vps_ed25519 root@2.24.115.75 \
  "docker exec -i transporteperu-postgres sh -c 'psql -v ON_ERROR_STOP=1 -U \$POSTGRES_USER -d \$POSTGRES_DB' \
   < /opt/transporteperu/db/migrations/021_mercadopago_y_comprobantes.sql"
```

La migración es idempotente (`if not exists`, `create or replace`): si se corta,
se vuelve a correr. Comprobar:

```sql
select to_regclass('public.pagos_suscripcion'), to_regclass('public.datos_facturacion');
select tgname from pg_trigger where tgname = 'pagos_marcar_comprobante';
select tablename, policyname from pg_policies
 where tablename in ('pagos_suscripcion', 'datos_facturacion');
```

Después, el backend y el frontend como siempre: `bash scripts/deploy-app.sh`.

### 5. Probar en modo `prueba`

Con `MERCADOPAGO_MODO=prueba` solo los correos de `MERCADOPAGO_CORREOS_PRUEBA`
ven el botón de pago; para el resto todo sigue como hoy.

1. Entrar con una cuenta owner/admin cuyo correo esté en la lista (puede ser una
   empresa de prueba creada para esto).
2. **Suscripción** → elegir boleta → **Pagar con Mercado Pago**. Autorizar con
   una tarjeta **real** (el cobro es de verdad: S/ 199).
3. Al volver, la pantalla dice "confirmando" y pasa a **Activa** cuando llega el
   webhook (segundos). Si no pasa, revisar
   `docker logs transporteperu-backend | grep -i "mercado pago"` y en el panel
   de la app → Webhooks → historial de notificaciones.
4. Debe llegar el correo "Emitir boleta…" a `COMPROBANTES_AVISO_EMAIL`. En
   **Comprobantes**, registrar serie/número/PDF y descargarlo desde la cuenta
   de la empresa.
5. **Cancelar suscripción** desde la cuenta: en Mercado Pago (Suscripciones del
   pagador) debe figurar cancelada; aquí queda "Cancelada" con acceso hasta la
   fecha pagada.
6. Devolver el cobro desde el panel de Mercado Pago (Actividad → el pago →
   Devolver). El aviso `payment` resta los 30 días; si el comprobante ya estaba
   emitido, aparece en **Comprobantes** como "emite nota de crédito".

Las credenciales y usuarios de prueba de Mercado Pago (`TEST-...`) no sirven
aquí tal cual: la suscripción exige que `payer_email` sea otro usuario de
prueba, y el correo del preapproval es el de la cuenta de CargoXprez. Por eso la
prueba se hace con dinero real y se devuelve, igual que se hizo en LicitaPro.

### 6. Abrir a todos

Cuando la prueba salga bien: `MERCADOPAGO_MODO=produccion` en
`.env.production` y reiniciar solo el backend
(`docker compose up -d backend` en `/opt/transporteperu`).

En `produccion`, `/comprar` sin sesión pide el correo y la contraseña del dueño
o admin de la empresa (la suscripción es de una empresa existente); sin JS
también funciona (`checkout_sin_js.py`), con límite de 10 intentos por IP cada
15 minutos.

El formulario sin JS ofrece lo mismo que el de React: un desplegable **Periodo**
(`name="pago"`) con 1, 3, 6 o 12 meses por adelantado (Yape, banca móvil o
tarjeta; los 12 meses marcados "sin Yape") y la suscripción mensual con tarjeta.
El adelantado llama a `suscripcion_api.abrir_pago_adelantado`, la misma función
que `POST /api/suscripcion/adelantado`: total del catálogo, mismas validaciones
y el mismo bloqueo si ya hay cobro automático con tarjeta. Sin el campo `pago`
se entiende `mensual`, como antes.

## Pago adelantado (Yape, banca móvil o tarjeta)

Yape y PagoEfectivo solo existen en pagos únicos (Checkout Pro), no en
`/preapproval`. Por eso el pago adelantado es una preferencia aparte.

### Cómo funciona

1. En `/comprar` (con sesión de dueño o admin) el cliente elige **1, 3, 6 o 12
   meses** y boleta o factura. Los totales los manda el servidor
   (`planes.opciones_adelantado`): **199 × meses, sin descuento**: S/ 199,
   S/ 597, S/ 1.194 y S/ 2.388. Los 12 meses pasan el tope de Yape (S/ 2.000 por
   pago): la pantalla lo dice y Mercado Pago no muestra Yape en ese pago.
2. `POST /api/suscripcion/adelantado` recibe **solo** plan y meses, calcula el
   total con `planes.total_adelantado` y crea la preferencia:
   - un ítem, `unit_price` = total del catálogo, `currency_id: PEN`, `quantity: 1`;
   - `external_reference`: `cargoxprez|<empresa>|pro|adelantado-<meses>`;
   - `payer.email` = el correo del usuario; `back_urls` a
     `https://<su-subdominio>/suscripcion?pago=aprobado|pendiente|error`;
     `auto_return: approved`;
   - `notification_url`: `$CARGOXPREZ_URL_PUBLICA/webhooks/mercadopago?source_news=webhooks`;
   - `payment_methods.installments: 1` (no se excluye ningún medio);
   - `date_of_expiration`: 3 días (plazo para pagar el código de PagoEfectivo;
     lo que se pague después lo devuelve Mercado Pago solo);
   - `statement_descriptor: CARGOXPREZ`.
3. Si la empresa ya tiene **cobro automático con tarjeta**, responde 409 ("Ya
   tienes cobro automático con tarjeta. Cancélalo primero si prefieres pagar por
   adelantado.") y la pantalla no ofrece el pago adelantado.
4. El aviso llega como `payment`. Con la firma válida se relee
   `GET /v1/payments/{id}`:
   - `approved` y referencia `adelantado-N`: se comparan `transaction_amount` y
     `currency_id` con el catálogo (`PEN`, 199 × N). Si cuadran:
     `subscription_ends_at = max(ahora, vencimiento actual) + N meses` (lo que
     quedaba de prueba también se respeta), estado `activa`, y el pago queda en
     `pagos_suscripcion` con `origen = 'adelantado'`, `meses = N` y el
     comprobante `pendiente` (llega el correo de siempre a
     `COMPROBANTES_AVISO_EMAIL`). Idempotente por el id del pago.
   - Importe o moneda distintos: `log.error` ("conciliar a mano") y **no** se activa.
   - `pending` / `in_process` (el cliente tiene un código de PagoEfectivo por
     pagar): nada. La pantalla de vuelta dice "Te llegó el código de pago".
     Cuando lo paga, Mercado Pago avisa del mismo pago ya `approved`.
   - `rejected` / `cancelled`: nada.
   - `refunded` / `charged_back`: se quitan esos N meses, una sola vez.
   - Mercado Pago caído: 503, para que reintente.
5. Al vencer sin renovar, la máquina de estados de siempre: `vencida` (7 días
   de gracia) y después `suspendida`, que deja la cuenta **en el plan Gratis**
   (no se borra nada). No hay estados nuevos.

### Recordatorio de renovación

`backend/recordatorios.py`. A **7 días** y a **1 día** del vencimiento, correo a
los owner/admin de las empresas **sin suscripción con tarjeta viva** y cuyo
**último pago confirmado fue adelantado**. Lleva un enlace a
`https://<su-subdominio>/suscripcion` (no una preferencia pregenerada).

- Lo programa el propio backend: un bucle asyncio que arranca con la app
  (`start_recordatorios_de_renovacion` en `server.py`, junto al de avisos de
  comprobantes), corre a los 90 s del arranque y luego **cada hora**
  (`RECORDAR_CADA_SEGUNDOS = 3600`). No hace falta cron. `DISABLE_SCHEDULER=1`
  lo apaga, igual que a los demás.
- No repite: cada aviso enviado es una fila de `recordatorios_renovacion`
  (empresa, vencimiento, días). Si el correo no sale, se borra la fila y se
  reintenta en la pasada siguiente. Si la empresa paga otro periodo, la fecha
  cambia y los dos avisos del periodo nuevo salen una vez cada uno.
- Si el backend estuvo apagado justo a los 7 días, el aviso sale al volver con
  los días que de verdad faltan.

### Desplegar

La migración **022** va **antes** que el backend nuevo (el backend viejo
funciona igual con ella: dos columnas con valor por defecto y una tabla nueva).

```bash
scp -i ~/.ssh/hostinger_vps_ed25519 db/migrations/022_pago_adelantado.sql \
    root@2.24.115.75:/opt/transporteperu/db/migrations/
ssh -i ~/.ssh/hostinger_vps_ed25519 root@2.24.115.75 \
  "docker exec -i transporteperu-postgres sh -c 'psql -v ON_ERROR_STOP=1 -U \$POSTGRES_USER -d \$POSTGRES_DB' \
   < /opt/transporteperu/db/migrations/022_pago_adelantado.sql"
```

Comprobar:

```sql
select column_name from information_schema.columns
 where table_name = 'pagos_suscripcion' and column_name in ('origen', 'meses');
select to_regclass('public.recordatorios_renovacion');
select policyname from pg_policies where tablename = 'recordatorios_renovacion';
```

Después, `bash scripts/deploy-app.sh` como siempre. **No hay variables nuevas**:
usa `MERCADOPAGO_MODO`, el token, la clave del webhook,
`CARGOXPREZ_URL_PUBLICA` y el SMTP que ya están. El evento **Pagos**
(`payment`) del webhook ya está activo (lo usan las devoluciones); con
`notification_url` en la preferencia, los avisos llegan a la misma ruta y con la
misma clave. Comprobar en los logs que el bucle no falle:
`docker logs transporteperu-backend 2>&1 | grep -i recordatorio`.

Si al crear la preferencia Mercado Pago respondiera 401/403, habilitar
**Checkout Pro** en la aplicación de CargoXprez (Tus integraciones → la app →
producto) y reintentar; el token no cambia.

### Probar

Con `MERCADOPAGO_MODO=prueba` y tu correo en `MERCADOPAGO_CORREOS_PRUEBA`
(dinero real, como la suscripción):

1. `/comprar` con la cuenta owner de una empresa de prueba → **1 mes** → boleta
   → **Pagar S/ 199,00 con Mercado Pago** → pagar con **Yape**. Al volver
   (`?pago=aprobado`) la pantalla pasa a **Activa** y "Pagado hasta" suma un mes.
   En la tabla de cobros figura "1 mes por adelantado".
2. Otro pago de 1 mes eligiendo **PagoEfectivo / banca móvil**: al volver
   (`?pago=pendiente`) dice "Te llegó el código de pago" y no cambia nada. Pagar
   el código desde la banca móvil: al acreditarse llega el aviso y suma el mes.
3. Elegir **12 meses**: debe salir la línea de que Yape no aparece (tope S/ 2.000).
   No hace falta pagarlo.
4. Devolver el pago del paso 1 desde el panel de Mercado Pago: el aviso
   `payment` resta ese mes.
5. Recordatorio: con la empresa de prueba pagada por adelantado, en la base
   `update companies set subscription_ends_at = now() + interval '6 days' where slug = '<slug>';`.
   En menos de una hora llega "Tu plan de CargoXprez vence en 5 días" (o 6) al
   owner, y no se repite. Con `interval '20 hours'` llega el de "vence hoy".

En el repositorio: `backend/tests/test_pago_adelantado.py` (catálogo,
referencia, cuerpo de la preferencia, sin llaves en el repo; sin base de datos)
y las pruebas `test_adelantado_*` y `test_recordatorio_*` de
`backend/tests/test_suscripcion_mercadopago.py` (contra Postgres, en CI).

## Plan Gratis (sin pago vigente)

Ninguna empresa queda en "solo consulta" por no pagar. Sin pago vigente
(`prueba_vencida`, `suspendida` o `cancelada_vencida`, según
`suscripciones.estado_efectivo`), `suscripciones.plan_efectivo` devuelve
`gratis`. Se calcula al leer: **no se escribe nada en la base** y no hace falta
migración. Al desplegar, las empresas que hoy estaban en solo consulta pasan
solas al plan Gratis. Un pago (adelantado o suscripción) deja `activa` con
vencimiento futuro y la saca de Gratis como siempre.

Lo que hace `_exigir_suscripcion_al_dia` (server.py) en Gratis:

- Se usa lo que la landing anuncia para Gratis: viajes, viáticos y liquidación,
  llantas, mantenimiento e inventario, documentos y alertas, app del chofer.
- Lo del plan Pro responde 402: guías y facturas SUNAT, detracciones,
  configuración SUNAT, lectura automática de facturas (`/api/fuel/ocr`), el bot
  de WhatsApp (además el bot contesta que es del plan Pro) y los reportes
  `/api/reports/trips|fuel|maintenance|cost-per-km`. Lo ya registrado se lee.
- Tope de **3 vehículos activos** (`suscripciones.TOPE_GRATIS`). Activo = todo
  estado distinto de `fuera_servicio`. Agregar el cuarto responde 403.
- Con **más de 3 activos** se consulta todo, y toda escritura responde 402 con
  la regla, salvo lo que libera cupo (marcar un vehículo **Fuera de servicio**
  con `PUT /api/vehicles/{id}` o eliminarlo), la sesión (`/api/auth/`) y el
  pago (`/api/suscripcion`). Nada se borra ni se oculta.
- La app muestra un aviso arriba de cada pantalla (`AvisoPlanGratis.jsx`,
  datos de `GET /api/suscripcion/plan`) con el botón "Activar el plan Pro" a
  `/comprar?plan=pro`.

Para contar las empresas que pasan a Gratis al desplegar:

```sql
select count(*) from companies
 where (subscription_status = 'trial' and trial_ends_at < now())
    or (subscription_status in ('activa', 'vencida') and subscription_ends_at < now() - interval '7 days')
    or (subscription_status = 'vencida' and subscription_ends_at is null)
    or subscription_status = 'suspendida'
    or (subscription_status = 'cancelada' and (subscription_ends_at is null or subscription_ends_at < now()));
```

Pruebas: `test_prueba_vencida_pasa_al_plan_gratis_*`, `test_con_mas_de_3_*`,
`test_el_tope_de_3_*`, `test_un_pago_saca_de_gratis` y
`test_checkout_sin_js_*adelantado*` en `backend/tests/test_suscripcion_mercadopago.py`.

## Apagar

`MERCADOPAGO_MODO=simulado` (o borrar la variable) y reiniciar el backend. Las
suscripciones ya autorizadas **siguen cobrándose en Mercado Pago**. Los avisos
firmados que lleguen con la pasarela apagada se responden 503, así que Mercado
Pago los reintenta y se asientan al volver a encender. Si el apagado es
definitivo, hay que cancelar antes las suscripciones vivas.
