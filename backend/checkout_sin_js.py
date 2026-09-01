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

LO QUE ESTA PAGINA **NO** HACE, Y POR QUE NO ES UN ENGANO

  No captura la tarjeta. No puede: los datos de tarjeta se teclean en un
  iframe de micuentaweb (Lyra), que es lo que mantiene al comercio fuera del
  alcance de PCI, y ese formulario es JavaScript por diseno de la pasarela.

  Por eso el boton dice "Continuar al pago" y no "Pagar ahora": registra el
  pedido y lo dice claro. Pintar un boton que aparente cobrar sin cobrar seria
  enganar justo a quien viene a comprobar que el checkout es real.
"""
import html
import logging
from pathlib import Path

from fastapi import APIRouter, Form, HTTPException, Request
from fastapi.responses import HTMLResponse

import planes
import proveedor

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


def _formulario(plan: str, descripcion: str, importe: dict,
                error: str = "", valores: dict | None = None) -> str:
    v = valores or {}
    aviso = f'<div class="mal">{_e(error)}</div>' if error else ""
    return f"""
{ESTILOS}
<div class="cnj">
  <p><a href="/#planes">&larr; Volver a los planes</a></p>
  <h1>Finalizar compra</h1>
  <p class="sub">{_e(proveedor.PRODUCTO)} · pago procesado por Izipay</p>
  {aviso}

  <div class="caja">
    <h2>Tu pedido</h2>
    <div class="fila"><span>{_e(descripcion)}</span><span>S/ {importe['total']:.2f}</span></div>
    <div class="fila"><span>Cantidad</span><span>1</span></div>
    <div class="fila"><span>Valor de venta</span><span>S/ {importe['base']:.2f}</span></div>
    <div class="fila"><span>IGV (18%)</span><span>S/ {importe['igv']:.2f}</span></div>
    <div class="fila total"><span>Total al mes</span><span>S/ {importe['total']:.2f}</span></div>
    <p class="nota">Precio en soles, con IGV incluido. Se renueva cada mes y
       puedes cancelar cuando quieras. ¿Solo quieres probar? El plan Gratis no
       pide tarjeta.</p>
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
    <button type="submit">Continuar al pago · S/ {importe['total']:.2f}</button>
    <p class="nota">El cobro con tarjeta lo procesa <strong>Izipay</strong> sobre
       conexión cifrada. Tus datos de tarjeta viajan directos a la pasarela:
       {_e(proveedor.PRODUCTO)} nunca los ve ni los guarda.</p>
  </form>
  {_pie_proveedor()}
</div>"""


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
    valores = {"razon_social": razon, "ruc": doc, "telefono": tel, "email": correo}

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
    <p style="margin:0 0 10px">Te escribimos a <strong>{_e(correo)}</strong> con el
       enlace para pagar con tarjeta.</p>
    <p class="nota">El formulario de tarjeta lo sirve Izipay y necesita
       JavaScript: es un iframe suyo, y es justo lo que mantiene tus datos de
       tarjeta fuera de nuestros servidores. Si prefieres pagar ahora mismo,
       abre <a href="/comprar?plan={_e(plan)}">esta página</a> con JavaScript
       activado.</p>
  </div>
  {_pie_proveedor()}
</div>""")
    if pagina is None:
        raise HTTPException(status_code=404)
    return pagina
