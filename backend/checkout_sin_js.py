"""El checkout, tambien para quien no ejecuta JavaScript.

EL PROBLEMA, TAL Y COMO SE VE DESDE FUERA

  CargoXprez es una SPA de React. El servidor devuelve el MISMO index.html
  para cualquier URL -- comprobado: /, /precios, /comprar y hasta una ruta
  inventada dan el mismo fichero byte a byte -- y ese HTML solo contiene:

      <noscript>You need to enable JavaScript to run this app.</noscript>
      <div id="root"></div>

  Todo lo demas lo construye el navegador. Con JavaScript el checkout esta
  completo: pedido, total, formulario y boton de pagar. Sin JavaScript no hay
  absolutamente nada.

  Eso no es un detalle teorico. Izipay rechazo la integracion diciendo que la
  web "no cuenta con un carrito de compras, proceso de checkout o boton de
  pago", y desde su lado tenian razon: si su validador descarga el HTML sin
  ejecutarlo, la pagina esta vacia.

QUE HACE ESTE MODULO

  Sirve /comprar desde el servidor, con el resumen del pedido y un formulario
  que FUNCIONA sin JavaScript: se envia por POST, registra la orden de verdad
  -- la misma tabla y las mismas validaciones que usa el checkout de React --
  y responde con el numero de pedido.

  El contenido se inyecta dentro de `<div id="root">`. Cuando hay JavaScript,
  `createRoot().render()` reemplaza los hijos del contenedor y React toma el
  control como hasta ahora: la experiencia con JS no cambia en nada.

COMO COBRA, Y CUANDO NO

  Con Mercado Pago activo (ver mercadopago.py) el formulario pide ademas el
  correo y la contrasena de la cuenta: la suscripcion es de una EMPRESA, y sin
  sesion -esta pagina no tiene JavaScript con el que leer el token- la unica
  forma de saber de cual es comprobar sus credenciales. Con ellas se crea la
  suscripcion y el navegador va al `init_point` de Mercado Pago con un 303: un
  redirect simple, que funciona sin JavaScript. La tarjeta se teclea alli, no
  aqui.

  Tambien ofrece el PAGO ADELANTADO (1, 3, 6 o 12 meses con Yape, banca movil
  o tarjeta): un desplegable elige entre esos periodos y la suscripcion
  mensual con tarjeta. El adelantado no se calcula aqui: lo abre
  suscripcion_api.abrir_pago_adelantado, la misma funcion que usa la API de
  React (mismo total de planes.py, mismo bloqueo si ya hay cobro automatico).

  En modo `simulado` (o en `prueba` para un correo que no es de prueba) la
  pagina hace lo de siempre: registra el pedido y lo dice claro, sin cobrar.

  Pedir una contrasena en una pagina publica abre un sitio donde probarlas:
  por eso este POST lleva su propio limite por IP, mas estricto que el login.
"""
import html
import logging
import time
from collections import defaultdict, deque
from pathlib import Path

import bcrypt

from fastapi import APIRouter, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse

import comprobantes
import mercadopago
import planes
import proveedor
import seo_rutas

log = logging.getLogger(__name__)
router = APIRouter()

FRONTEND_BUILD = Path(__file__).resolve().parent.parent / "frontend" / "build"

# El ancla donde monta React. Si algun dia cambia en index.html, esta pagina
# deja de inyectarse -- y se nota, porque hay una prueba que lo comprueba.
ANCLA_ROOT = '<div id="root"></div>'


def _e(valor) -> str:
    """Escapa para HTML. Todo lo que venga del cliente pasa por aqui."""
    return html.escape(str(valor or ""), quote=True)


def _cascaron() -> str | None:
    """El index.html del build, o None si todavia no se ha construido."""
    try:
        return (FRONTEND_BUILD / "index.html").read_text(encoding="utf-8")
    except OSError:
        # Sin build no hay nada que inyectar: se cede el paso en vez de servir
        # media pagina rota.
        return None


def _envolver(interior: str) -> HTMLResponse | None:
    cascaron = _cascaron()
    if cascaron is None:
        return None
    if ANCLA_ROOT not in cascaron:
        log.warning("checkout sin js: no encontre %s en index.html; la pagina "
                    "se serviria sin el contenido del servidor", ANCLA_ROOT)
        return None
    cascaron = seo_rutas.personalizar(cascaron, "comprar")
    pagina = cascaron.replace(ANCLA_ROOT, f'<div id="root">{interior}</div>', 1)
    # Sin cache: el precio y los datos del proveedor cambian por configuracion,
    # y una copia guardada en un intermediario los congelaria.
    return HTMLResponse(pagina, headers={"Cache-Control": "no-store"})


# Estilos propios y con prefijo `cnj-`: esta pagina se ve ANTES de que cargue
# nada de React, asi que no puede depender de sus clases.
ESTILOS = """
<style>
.cnj{max-width:760px;margin:0 auto;padding:32px 20px 64px;
  font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  color:#0f172a;line-height:1.6}
.cnj h1{font-size:1.6rem;margin:0 0 4px;letter-spacing:-.02em}
.cnj .sub{color:#64748b;font-size:.95rem;margin:0 0 26px}
.cnj .caja{border:1px solid #e2e8f0;border-radius:10px;padding:20px;
  margin-bottom:18px;background:#fff}
.cnj h2{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;
  color:#64748b;margin:0 0 14px;font-weight:600}
.cnj .fila{display:flex;justify-content:space-between;gap:16px;padding:8px 0;
  border-bottom:1px solid #f1f5f9;font-size:.95rem}
.cnj .fila:last-child{border-bottom:none}
.cnj .total{border-top:2px solid #0f172a;margin-top:8px;padding-top:12px;
  font-size:1.15rem;font-weight:700}
.cnj label{display:block;margin-bottom:14px;font-size:.72rem;letter-spacing:.1em;
  text-transform:uppercase;color:#64748b;font-weight:600}
.cnj input{display:block;width:100%;margin-top:6px;padding:11px 12px;
  border:1px solid #cbd5e1;border-radius:7px;font:inherit;font-size:1rem;
  text-transform:none;letter-spacing:normal;color:#0f172a}
.cnj button{width:100%;padding:15px;border:0;border-radius:8px;background:#e00000;
  color:#fff;font:inherit;font-size:1.05rem;font-weight:700;cursor:pointer}
.cnj .nota{font-size:.82rem;color:#64748b;margin:12px 0 0}
.cnj .mal{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;
  border-radius:8px;padding:12px 14px;margin-bottom:18px;font-size:.92rem}
.cnj .ok{background:#f0fdf4;border-color:#bbf7d0;color:#166534}
.cnj a{color:#0369a1}
.cnj .pie{font-size:.8rem;color:#64748b;border-top:1px solid #e2e8f0;
  margin-top:26px;padding-top:16px;line-height:1.75}
</style>
"""


def _pie_proveedor() -> str:
    """Quien cobra, con sus vias de contacto.

    EL <!--email_off--> NO ES DECORACION

      Cloudflare tiene activada "Email Address Obfuscation" en esta zona:
      reescribe cada mailto: como /cdn-cgi/l/email-protection y sustituye el
      texto por un script. Comprobado aqui mismo -- el correo salia como
      "[email protected]" a traves de Cloudflare.

      Justo lo que este modulo viene a arreglar: la pagina existe para quien NO
      ejecuta JavaScript, y dejar su unica via de contacto detras de un script
      seria volver a empezar. `<!--email_off-->` es el mecanismo que documenta
      la propia Cloudflare para excluir un bloque, y se usa solo aqui: en el
      resto del sitio la ofuscacion sigue frenando a los recolectores.
    """
    return f"""
  <p class="pie">
    Contratas con <strong>{_e(proveedor.RAZON_SOCIAL)}</strong> — RUC {_e(proveedor.RUC)}.<br>
    {_e(proveedor.DOMICILIO)}<br>
    <!--email_off--><a href="mailto:{_e(proveedor.EMAIL)}">{_e(proveedor.EMAIL)}</a><!--/email_off--> ·
    <a href="tel:{_e(proveedor.telefono_uri())}">{_e(proveedor.TELEFONO)}</a><br>
    <a href="/terminos">Términos del servicio</a> ·
    <a href="/privacidad">Política de privacidad</a> ·
    <a href="/reclamaciones">Libro de reclamaciones</a>
  </p>"""


COMO_SE_PAGA = "Paga con Yape, desde tu banca móvil (BCP, BBVA y otros) o con tarjeta"
_SELECT = ("display:block;width:100%;margin-top:6px;padding:11px 12px;"
           "border:1px solid #cbd5e1;border-radius:7px;font:inherit")


def _meses(m: int) -> str:
    return f"{m} {'mes' if m == 1 else 'meses'}"


def _soles(n: float) -> str:
    return f"S/ {n:.2f}"


def _elegir_pago(plan: str, elegido: str) -> str:
    """El desplegable de forma de pago: los periodos adelantados y la tarjeta."""
    opciones = []
    for o in planes.opciones_adelantado(plan):
        valor = f"adelantado-{o['meses']}"
        sin_yape = "" if o["yape"] else " (sin Yape: pasa su tope)"
        opciones.append(
            f'<option value="{valor}"{" selected" if elegido == valor else ""}>'
            f'{_meses(o["meses"])} por adelantado · {_soles(o["total"])}{sin_yape}</option>')
    mensual = planes.PRECIOS_CHECKOUT[plan][1]
    opciones.append(
        f'<option value="mensual"{" selected" if elegido == "mensual" else ""}>'
        f'Mensual con tarjeta · {_soles(mensual)} al mes, se cobra solo</option>')
    tope = _soles(planes.TOPE_YAPE)
    return f"""
    <h2 style="margin-top:22px">Cómo pagas</h2>
    <p class="nota" style="margin:0 0 12px"><strong>{_e(COMO_SE_PAGA)}.</strong> Por
       adelantado pagas una sola vez y no se cobra solo: te avisamos por correo 7 días y
       1 día antes de que venza. Yape acepta hasta {tope} por pago, así que los 12 meses
       se pagan desde la banca móvil o con tarjeta.</p>
    <label>Periodo
      <select name="pago" style="{_SELECT}">{''.join(opciones)}</select></label>"""


def _formulario(plan: str, descripcion: str, importe: dict,
                error: str = "", valores: dict | None = None) -> str:
    v = valores or {}
    aviso = f'<div class="mal">{_e(error)}</div>' if error else ""
    con_mp = mercadopago.activo()
    elegido = (v.get("comprobante") or "boleta")
    if con_mp:
        pasarela = "pago con Mercado Pago"
        nota_precio = ("Precio en soles, con IGV incluido. Pagas 1, 3, 6 o 12 meses "
                       "por adelantado (sin recargo), o la suscripción mensual con "
                       "tarjeta, que Mercado Pago cobra cada mes y cancelas cuando "
                       "quieras desde tu cuenta.")
        cuenta = f"""
    {_elegir_pago(plan, v.get("pago") or "adelantado-1")}
    <h2 style="margin-top:22px">Tu cuenta CargoXprez</h2>
    <p class="nota" style="margin:0 0 12px">La suscripción es de tu empresa: entra con el
       correo y la contraseña de tu cuenta. ¿Aún no tienes? <a href="/registro">Créala
       gratis</a> (14 días de prueba) y vuelve aquí.</p>
    <label>Contraseña de tu cuenta
      <input type="password" name="password" autocomplete="current-password"></label>
    <h2 style="margin-top:22px">Comprobante</h2>
    <label>Boleta o factura
      <select name="comprobante" style="display:block;width:100%;margin-top:6px;padding:11px 12px;border:1px solid #cbd5e1;border-radius:7px;font:inherit">
        <option value="boleta"{' selected' if elegido != 'factura' else ''}>Boleta</option>
        <option value="factura"{' selected' if elegido == 'factura' else ''}>Factura</option>
      </select></label>
    <label>DNI o RUC (factura: RUC obligatorio)
      <input type="text" name="documento" inputmode="numeric" value="{_e(v.get('documento'))}"></label>"""
        pie_boton = ("Te llevamos al sitio de <strong>Mercado Pago</strong> para pagar. "
                     f"{_e(proveedor.PRODUCTO)} nunca ve ni guarda tus datos de pago.")
    else:
        pasarela = "pedido en línea"
        nota_precio = ("Precio en soles, con IGV incluido. El pago en línea todavía "
                       "no está activo: registramos tu pedido y te escribimos para "
                       "completarlo. No se hace ningún cargo. ¿Solo quieres probar? "
                       "El plan Gratis no pide tarjeta.")
        cuenta = ""
        pie_boton = "Registramos tu pedido. No se hace ningún cargo."
    return f"""
{ESTILOS}
<div class="cnj">
  <p><a href="/#planes">&larr; Volver a los planes</a></p>
  <h1>Finalizar compra</h1>
  <p class="sub">{_e(proveedor.PRODUCTO)} · {pasarela}</p>
  {aviso}

  <div class="caja">
    <h2>Tu pedido</h2>
    <div class="fila"><span>{_e(descripcion)}</span><span>S/ {importe['total']:.2f}</span></div>
    <div class="fila"><span>Cantidad</span><span>1</span></div>
    <div class="fila"><span>Valor de venta</span><span>S/ {importe['base']:.2f}</span></div>
    <div class="fila"><span>IGV (18%)</span><span>S/ {importe['igv']:.2f}</span></div>
    <div class="fila total"><span>Total al mes</span><span>S/ {importe['total']:.2f}</span></div>
    <p class="nota">{nota_precio}</p>
  </div>

  <form class="caja" method="post" action="/comprar">
    <h2>Datos de facturación</h2>
    <input type="hidden" name="plan" value="{_e(plan)}">
    <label>Razón social o nombre *
      <input type="text" name="razon_social" required value="{_e(v.get('razon_social'))}"></label>
    <label>RUC (opcional)
      <input type="text" name="ruc" inputmode="numeric" value="{_e(v.get('ruc'))}"></label>
    <label>Teléfono (opcional)
      <input type="tel" name="telefono" value="{_e(v.get('telefono'))}"></label>
    <label>Correo *
      <input type="email" name="email" required value="{_e(v.get('email'))}"></label>
    {cuenta}
    <button type="submit">Continuar al pago{'' if con_mp else f" · S/ {importe['total']:.2f}"}</button>
    <p class="nota">{pie_boton}</p>
  </form>
  {_pie_proveedor()}
</div>"""


# Intentos con contrasena por IP: (instantes). Un solo proceso uvicorn, igual
# que limites.py, asi que en memoria es exacto. Mas estricto que el login
# (10/minuto): aqui no hay motivo para teclear la clave mas de unas pocas veces.
_INTENTOS_CLAVE = defaultdict(deque)
INTENTOS_MAXIMOS = 10
VENTANA_SEGUNDOS = 15 * 60


def _clave_permitida(ip: str) -> bool:
    ahora = time.monotonic()
    marcas = _INTENTOS_CLAVE[ip]
    while marcas and marcas[0] <= ahora - VENTANA_SEGUNDOS:
        marcas.popleft()
    if len(marcas) >= INTENTOS_MAXIMOS:
        return False
    marcas.append(ahora)
    return True


async def _cuenta_que_paga(correo: str, clave: str) -> dict | None:
    """El usuario que gestiona la empresa, si correo y contrasena son suyos."""
    import db_pg

    async with db_pg.tx_global("checkout sin js: resolver la cuenta antes de conocer la empresa") as conn:
        fila = await conn.fetchrow(
            "select id, company_id, email, role::text as role, password_hash, is_active "
            "  from users where lower(email) = $1", correo)
    if not fila or not fila["password_hash"] or not fila["is_active"]:
        return None
    try:
        if not bcrypt.checkpw(clave.encode("utf-8"), fila["password_hash"].encode("utf-8")):
            return None
    except ValueError:
        return None
    if fila["role"] not in ("owner", "admin"):
        return None
    return {"id": str(fila["id"]), "company_id": str(fila["company_id"]),
            "email": fila["email"], "role": fila["role"]}


@router.get("/comprar", response_class=HTMLResponse)
async def comprar(request: Request):
    """El checkout, ya armado en el servidor.

    React lo reemplaza en cuanto arranca; quien no ejecute JavaScript se queda
    con esta version, que es funcional y no un cartel.
    """
    plan = (request.query_params.get("plan") or "pro").strip().lower()
    if plan not in planes.PRECIOS_CHECKOUT:
        plan = "pro"
    descripcion, monto = planes.PRECIOS_CHECKOUT[plan]
    pagina = _envolver(_formulario(plan, descripcion, planes.desglose(monto)))
    if pagina is None:
        # Sin build utilizable, que siga el catch-all de siempre.
        raise HTTPException(status_code=404)
    return pagina


@router.post("/comprar", response_class=HTMLResponse)
async def comprar_enviar(
    request: Request,
    plan: str = Form("pro"),
    razon_social: str = Form(""),
    email: str = Form(""),
    ruc: str = Form(""),
    telefono: str = Form(""),
    password: str = Form(""),
    comprobante: str = Form("boleta"),
    documento: str = Form(""),
    pago: str = Form("mensual"),
):
    """Registra el pedido de verdad, con las mismas reglas que la API.

    No se relajan aqui: si lo hicieran, este formulario seria la puerta trasera
    para crear ordenes que el checkout de React rechaza.
    """
    import db_pg

    plan = (plan or "").strip().lower()
    razon = (razon_social or "").strip()
    correo = (email or "").strip().lower()
    doc = (ruc or "").strip()
    tel = (telefono or "").strip()
    pago = (pago or "mensual").strip().lower()
    valores = {"razon_social": razon, "ruc": doc, "telefono": tel, "email": correo,
               "comprobante": comprobante, "documento": documento, "pago": pago}

    def con_error(msg: str, plan_valido: str = "pro"):
        descripcion, monto = planes.PRECIOS_CHECKOUT[plan_valido]
        pagina = _envolver(_formulario(plan_valido, descripcion,
                                       planes.desglose(monto), msg, valores))
        if pagina is None:
            raise HTTPException(status_code=404)
        return pagina

    if plan not in planes.PRECIOS_CHECKOUT:
        return con_error("Ese plan no está disponible para compra en línea.")
    if len(razon) < 2:
        return con_error("Falta la razón social o el nombre.", plan)
    if "@" not in correo or "." not in correo.split("@")[-1]:
        return con_error("Ese correo no parece válido.", plan)
    if doc and (not doc.isdigit() or len(doc) != 11):
        return con_error("El RUC debe tener 11 dígitos.", plan)

    descripcion, monto = planes.PRECIOS_CHECKOUT[plan]

    # ─── Con Mercado Pago: suscripcion de la empresa ─────
    if mercadopago.activo() and password:
        ip = request.headers.get("cf-connecting-ip") or (request.client.host if request.client else "?")
        if not _clave_permitida(ip):
            return con_error("Demasiados intentos. Vuelve a intentarlo en unos minutos.", plan)
        facturacion, motivo = comprobantes.validar(comprobante, documento)
        if motivo:
            return con_error(motivo, plan)
        usuario = await _cuenta_que_paga(correo, password)
        if not usuario:
            # Mismo mensaje para correo inexistente, clave mala o rol sin
            # permiso: no se confirma que una cuenta exista.
            return con_error("Correo o contraseña incorrectos, o tu usuario no "
                             "administra la empresa.", plan)
        if not mercadopago.disponible_para(usuario["email"]):
            return con_error("El pago automático todavía no está disponible.", plan)
        import suscripciones
        import suscripcion_api

        if pago.startswith("adelantado-"):
            # La misma funcion que la API de React: total del catalogo y bloqueo
            # si ya hay cobro automatico con tarjeta.
            try:
                abierto = await suscripcion_api.abrir_pago_adelantado(
                    usuario, plan, pago.split("-", 1)[1], comprobante, documento, razon,
                    request.headers.get("host"))
            except suscripcion_api.NoSePuedePagar as e:
                return con_error(e.detalle, plan)
            return RedirectResponse(abierto["init_point"], status_code=303)
        estado = await suscripciones.estado_de(usuario["company_id"])
        if estado and estado["mp_preapproval_id"]:
            return con_error("Tu empresa ya tiene un cobro automático con tarjeta activo.", plan)
        try:
            await comprobantes.guardar_datos(usuario, facturacion, razon)
        except Exception:  # noqa: BLE001
            log.exception("checkout sin js: no se guardaron los datos de facturacion")
        volver_a = (f"{suscripcion_api.origen_publico(request.headers.get('host'))}"
                    f"{suscripcion_api.RUTA_CLIENTE}?aviso=confirmando")
        try:
            suscripcion = await mercadopago.crear_preapproval(
                usuario["company_id"], usuario["email"], plan, descripcion, monto, volver_a)
        except mercadopago.ErrorMercadoPago as e:
            log.error("checkout sin js: Mercado Pago no creo la suscripcion: %s", e)
            return con_error("No pudimos abrir el pago. No se te cobró nada: vuelve "
                             "a intentarlo en un momento.", plan)
        return RedirectResponse(suscripcion["init_point"], status_code=303)

    if mercadopago.modo() == "produccion":
        return con_error("Para suscribirte escribe la contraseña de tu cuenta "
                         "CargoXprez. ¿No tienes cuenta? Créala gratis en /registro.", plan)

    # ─── Sin Mercado Pago: el pedido de siempre, sin cobro ───
    async with db_pg.tx_global("registrar una orden de checkout (sin javascript)") as conn:
        fila = await conn.fetchrow(
            "insert into checkout_orders "
            "(plan, monto, moneda, razon_social, ruc, email, telefono, ip_solicitud) "
            "values ($1, $2, 'PEN', $3, $4, $5, $6, $7) "
            "returning id, numero, estado",
            plan, monto, razon, doc or None, correo, tel or None,
            request.client.host if request.client else None,
        )
    orden = db_pg.to_api(fila)
    log.info("checkout sin js: orden %s registrada (plan %s)", orden["numero"], plan)

    importe = planes.desglose(monto)
    pagina = _envolver(f"""
{ESTILOS}
<div class="cnj">
  <h1>Pedido registrado</h1>
  <p class="sub">Número <strong>{_e(orden['numero'])}</strong></p>
  <div class="caja ok">
    <p style="margin:0">Guardamos tu pedido de <strong>{_e(descripcion)}</strong>
       por <strong>S/ {importe['total']:.2f}</strong> a nombre de
       <strong>{_e(razon)}</strong>.</p>
  </div>
  <div class="caja">
    <h2>Qué sigue</h2>
    <p style="margin:0 0 10px">Te escribimos a <strong>{_e(correo)}</strong> para
       completar el pago y activar tu plan.</p>
    <p class="nota">No se ha realizado ningún cargo.</p>
  </div>
  {_pie_proveedor()}
</div>""")
    if pagina is None:
        raise HTTPException(status_code=404)
    return pagina
