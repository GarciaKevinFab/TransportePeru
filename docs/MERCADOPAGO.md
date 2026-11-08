# Mercado Pago en CargoXprez

Suscripción mensual del plan Pro (S/ 199, IGV incluido) cobrada con Mercado
Pago Suscripciones, y comprobantes (boleta o factura) emitidos a mano en
BSNegocios y entregados al cliente desde su cuenta.

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
   - `payment`: solo para devoluciones (resta los 30 días de ese cobro, una vez).
   El aviso repetido no hace nada (índice único sobre el id de la factura).
5. Cada cobro aprobado queda en `pagos_suscripcion` con el comprobante
   `pendiente`. A `COMPROBANTES_AVISO_EMAIL` le llega un correo con los datos
   para emitirlo (y un recordatorio a las 24 h).
6. El superadmin lo emite en BSNegocios y lo registra en **Comprobantes**
   (`/admin/comprobantes`): serie, número, fecha y PDF. El cliente lo descarga
   desde su pantalla de Suscripción.

Estados: `trial` → `activa` → `vencida` (7 días de gracia, se sigue
escribiendo) → `suspendida` (solo lectura). `cancelada` conserva el acceso hasta
el fin del periodo pagado. La prueba vencida corta como hasta ahora, sin gracia.

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

## Apagar

`MERCADOPAGO_MODO=simulado` (o borrar la variable) y reiniciar el backend. Las
suscripciones ya autorizadas **siguen cobrándose en Mercado Pago**. Los avisos
firmados que lleguen con la pasarela apagada se responden 503, así que Mercado
Pago los reintenta y se asientan al volver a encender. Si el apagado es
definitivo, hay que cancelar antes las suscripciones vivas.
