"""Las rutas de la suscripcion: la cuenta del cliente y el panel del dueno.

    GET  /api/suscripcion                          estado, cobros y comprobantes
    POST /api/suscripcion/mercadopago              alta: devuelve el init_point
    POST /api/suscripcion/adelantado               pago unico de 1/3/6/12 meses
                                                   (Yape, banca movil o tarjeta)
    POST /api/suscripcion/cancelar                 cancela el cobro automatico
    GET  /api/suscripcion/pagos/{id}/comprobante   PDF del comprobante (de SU empresa)

    GET  /api/admin/comprobantes                   panel del dueno (solo superadmin)
    POST /api/admin/comprobantes/{id}              registrar serie, numero y PDF
    POST /api/admin/comprobantes/{id}/no-aplica    cerrar sin comprobante

POR QUE UNA FABRICA Y NO UN ROUTER SUELTO

  Las dependencias de sesion (get_current_user, require_roles) viven en
  server.py, que importa este modulo. Recibirlas por parametro evita el import
  circular y deja que las pruebas monten estas rutas con usuarios de mentira,
  sin levantar las once mil lineas de server.py.

EL CORTE POR SUSCRIPCION NO SE APLICA AQUI

  server.py deja pasar /api/suscripcion aunque la empresa este vencida: cortar
  el acceso a la pagina de pago es dispararse en el pie, el cliente que quiere
  pagar no podria.

EL MONTO SALE SIEMPRE DE planes.py

  El navegador manda el codigo del plan y nada mas.
"""
import logging
import os
from datetime import date
from urllib.parse import urlsplit

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response

import comprobantes
import db_pg
import mercadopago
import planes
import suscripciones
import tenant_host
import webhooks_mercadopago

log = logging.getLogger("suscripcion_api")

#: Roles que gestionan la suscripcion de su empresa.
GESTORES = ("owner", "admin")
#: Roles que pueden descargar los comprobantes de su empresa.
VEN_COMPROBANTES = ("owner", "admin", "contabilidad", "superadmin")

RUTA_CLIENTE = "/suscripcion"


def origen_publico(host: str | None) -> str:
    """La direccion https a la que Mercado Pago devuelve al cliente.

    Solo se acepta el host de la peticion si es del dominio propio (la empresa
    vuelve a SU subdominio, donde tiene la sesion). Cualquier otro valor -un
    Host inventado, localhost- cae a la direccion publica configurada.
    """
    defecto = os.getenv("CARGOXPREZ_URL_PUBLICA", "https://cargoxprez.sisac.pe").rstrip("/")
    nombre = (host or "").split(":")[0].strip().lower()
    base = tenant_host.DOMINIO_BASE or (urlsplit(defecto).hostname or "")
    if nombre and base and (nombre == base or nombre.endswith("." + base)):
        return f"https://{nombre}"
    return defecto


def url_publica() -> str:
    return os.getenv("CARGOXPREZ_URL_PUBLICA", "https://cargoxprez.sisac.pe").rstrip("/")


def url_del_webhook() -> str:
    """Donde Mercado Pago avisa del pago adelantado: siempre la direccion publica.

    `source_news=webhooks` pide solo los avisos firmados (no los IPN viejos,
    que no traen x-signature y se rechazarian con 401 una y otra vez).
    """
    return f"{url_publica()}{webhooks_mercadopago.RUTA}?source_news=webhooks"


AVISO_CON_TARJETA = ("Ya tienes cobro automático con tarjeta. Cancélalo primero si "
                     "prefieres pagar por adelantado.")


def _vista_estado(e: dict) -> dict:
    return {
        "plan": e["plan"],
        "estado": e["subscription_status"],
        "efectivo": e["efectivo"],
        "puede_escribir": suscripciones.puede_escribir(e["efectivo"]),
        "trial_ends_at": e["trial_ends_at"].isoformat() if e["trial_ends_at"] else None,
        "vence": e["subscription_ends_at"].isoformat() if e["subscription_ends_at"] else None,
        "cobro_automatico": bool(e["mp_preapproval_id"]),
        "dias_gracia": suscripciones.DIAS_GRACIA,
    }


def crear_router(usuario_dep, gestor_dep, superadmin_dep) -> APIRouter:
    router = APIRouter()

    # ─── La cuenta del cliente ───────────────────────────

    @router.get("/api/suscripcion")
    async def ver_suscripcion(usuario: dict = Depends(gestor_dep)):
        estado = await suscripciones.estado_de(usuario["company_id"])
        if not estado:
            raise HTTPException(status_code=404, detail="Empresa no encontrada")
        planes_venta = [
            {"codigo": codigo, "descripcion": desc, "monto": monto,
             **{k: v for k, v in planes.desglose(monto).items() if k != "total"}}
            for codigo, (desc, monto) in planes.PRECIOS_CHECKOUT.items()
        ]
        for p in planes_venta:
            p["adelantado"] = planes.opciones_adelantado(p["codigo"])
        return {
            **_vista_estado(estado),
            "mercadopago_disponible": mercadopago.disponible_para(usuario.get("email")),
            "planes": planes_venta,
            "tope_yape": planes.TOPE_YAPE,
            "facturacion": await comprobantes.datos_de(usuario),
            "pagos": await comprobantes.pagos_de(usuario),
        }

    @router.post("/api/suscripcion/mercadopago")
    async def suscribirse(request: Request, datos: dict = Body(...),
                          usuario: dict = Depends(gestor_dep)):
        if usuario.get("role") == "superadmin":
            # Quien paga es el cliente, con su correo: un superadmin dentro de
            # una empresa ajena no debe dejar SU correo como pagador.
            raise HTTPException(status_code=403, detail="La suscripción la contrata el cliente desde su cuenta")
        plan = str(datos.get("plan") or "pro").strip().lower()
        if plan not in planes.PRECIOS_CHECKOUT:
            raise HTTPException(status_code=400, detail="Plan no disponible para compra en línea")
        facturacion, motivo = comprobantes.validar(datos.get("comprobante"), datos.get("documento"))
        if motivo:
            raise HTTPException(status_code=400, detail=motivo)
        correo = (usuario.get("email") or "").strip()
        if not correo:
            raise HTTPException(status_code=400, detail="Tu usuario no tiene correo")
        if not mercadopago.disponible_para(correo):
            raise HTTPException(status_code=503, detail="El pago automático todavía no está disponible.")

        estado = await suscripciones.estado_de(usuario["company_id"])
        if estado and estado["mp_preapproval_id"]:
            raise HTTPException(status_code=409, detail=(
                "Ya tienes un cobro automático activo. Para cambiar de plan, "
                "cancélalo y contrata el nuevo."))

        # Antes del cobro: la foto para el comprobante se toma al confirmarse,
        # por webhook. Nunca corta la compra.
        try:
            await comprobantes.guardar_datos(usuario, facturacion, str(datos.get("nombre") or ""))
        except Exception:  # noqa: BLE001
            log.exception("No se guardaron los datos de facturacion de la empresa %s",
                          usuario["company_id"])

        descripcion, monto = planes.PRECIOS_CHECKOUT[plan]
        volver_a = f"{origen_publico(request.headers.get('host'))}{RUTA_CLIENTE}?aviso=confirmando"
        try:
            suscripcion = await mercadopago.crear_preapproval(
                str(usuario["company_id"]), correo, plan, descripcion, monto, volver_a)
        except mercadopago.ErrorMercadoPago as e:
            log.error("Mercado Pago no creo la suscripcion de la empresa %s: %s",
                      usuario["company_id"], e)
            raise HTTPException(status_code=502, detail=(
                "No pudimos abrir el pago. No se te cobró nada: vuelve a intentarlo "
                "en un momento."))
        return {"init_point": suscripcion["init_point"]}

    @router.post("/api/suscripcion/adelantado")
    async def pagar_adelantado(request: Request, datos: dict = Body(...),
                               usuario: dict = Depends(gestor_dep)):
        """Pago unico de Checkout Pro. El navegador manda plan y meses, nada mas."""
        if usuario.get("role") == "superadmin":
            raise HTTPException(status_code=403, detail="El pago lo hace el cliente desde su cuenta")
        plan = str(datos.get("plan") or "pro").strip().lower()
        try:
            meses = int(datos.get("meses"))
        except (TypeError, ValueError):
            meses = 0
        total = planes.total_adelantado(plan, meses)
        if total is None:
            raise HTTPException(status_code=400, detail="Elige 1, 3, 6 o 12 meses de un plan disponible")
        facturacion, motivo = comprobantes.validar(datos.get("comprobante"), datos.get("documento"))
        if motivo:
            raise HTTPException(status_code=400, detail=motivo)
        correo = (usuario.get("email") or "").strip()
        if not correo:
            raise HTTPException(status_code=400, detail="Tu usuario no tiene correo")
        if not mercadopago.disponible_para(correo):
            raise HTTPException(status_code=503, detail="El pago en línea todavía no está disponible.")

        estado = await suscripciones.estado_de(usuario["company_id"])
        if estado and estado["mp_preapproval_id"]:
            raise HTTPException(status_code=409, detail=AVISO_CON_TARJETA)

        try:
            await comprobantes.guardar_datos(usuario, facturacion, str(datos.get("nombre") or ""))
        except Exception:  # noqa: BLE001
            log.exception("No se guardaron los datos de facturacion de la empresa %s",
                          usuario["company_id"])

        descripcion = planes.PRECIOS_CHECKOUT[plan][0].split(" (")[0]
        volver_a = f"{origen_publico(request.headers.get('host'))}{RUTA_CLIENTE}"
        try:
            preferencia = await mercadopago.crear_preferencia(
                str(usuario["company_id"]), correo, plan, descripcion, meses, total,
                volver_a, url_del_webhook())
        except mercadopago.ErrorMercadoPago as e:
            log.error("Mercado Pago no creo el pago adelantado de la empresa %s: %s",
                      usuario["company_id"], e)
            raise HTTPException(status_code=502, detail=(
                "No pudimos abrir el pago. No se te cobró nada: vuelve a intentarlo "
                "en un momento."))
        return {"init_point": preferencia["init_point"], "meses": meses, "total": total}

    @router.post("/api/suscripcion/cancelar")
    async def cancelar(usuario: dict = Depends(gestor_dep)):
        estado = await suscripciones.estado_de(usuario["company_id"])
        if not estado or not (estado["mp_preapproval_id"] or estado["subscription_ends_at"]):
            raise HTTPException(status_code=409, detail="No tienes una suscripción de pago que cancelar.")
        if estado["mp_preapproval_id"]:
            try:
                await mercadopago.cancelar(estado["mp_preapproval_id"])
            except mercadopago.ErrorMercadoPago as e:
                # Si Mercado Pago no la cancela, no se marca nada aqui: decir
                # "cancelada" mientras alla sigue cobrando es lo peor posible.
                log.error("No se cancelo en Mercado Pago la suscripcion de %s: %s",
                          usuario["company_id"], e)
                raise HTTPException(status_code=502, detail=(
                    "No pudimos cancelar en Mercado Pago. Inténtalo de nuevo en un momento."))
        await suscripciones.cancelar(usuario["company_id"])
        estado = await suscripciones.estado_de(usuario["company_id"])
        return _vista_estado(estado)

    @router.get("/api/suscripcion/pagos/{pago_id}/comprobante")
    async def descargar(pago_id: str, usuario: dict = Depends(usuario_dep)):
        if usuario.get("role") not in VEN_COMPROBANTES:
            raise HTTPException(status_code=403, detail="No autorizado")
        hallado = await comprobantes.pdf_de_la_empresa(pago_id, usuario)
        if not hallado:
            raise HTTPException(status_code=404, detail="Comprobante no encontrado")
        contenido, nombre = hallado
        return Response(contenido, media_type="application/pdf", headers={
            "Content-Disposition": f'attachment; filename="{nombre}"',
            "Cache-Control": "no-store",
        })

    # ─── El panel del dueno ──────────────────────────────

    @router.get("/api/admin/comprobantes")
    async def panel(_: dict = Depends(superadmin_dep)):
        def limpio(filas):
            return [db_pg.to_api(f) for f in filas]
        return {
            "pendientes": limpio(await comprobantes.pendientes()),
            "devueltos": limpio(await comprobantes.devueltos_con_comprobante()),
            "recientes": limpio(await comprobantes.recientes()),
        }

    @router.post("/api/admin/comprobantes/{pago_id}")
    async def registrar(pago_id: str, serie: str = Form(""), numero: str = Form(""),
                        fecha: str = Form(""), pdf: UploadFile | None = File(None),
                        _: dict = Depends(superadmin_dep)):
        emitido = None
        if fecha.strip():
            try:
                emitido = date.fromisoformat(fecha.strip())
            except ValueError:
                raise HTTPException(status_code=400, detail="Fecha no válida (AAAA-MM-DD).")
        contenido = None
        if pdf is not None and pdf.filename:
            contenido = await pdf.read(comprobantes.MAX_PDF + 1)
        motivo = await comprobantes.registrar(pago_id, serie, numero, emitido, contenido)
        if motivo:
            raise HTTPException(status_code=400, detail=motivo)
        return {"ok": True}

    @router.post("/api/admin/comprobantes/{pago_id}/no-aplica")
    async def sin_comprobante(pago_id: str, datos: dict = Body(...),
                              _: dict = Depends(superadmin_dep)):
        motivo = await comprobantes.no_aplica(pago_id, str(datos.get("nota") or ""))
        if motivo:
            raise HTTPException(status_code=400, detail=motivo)
        return {"ok": True}

    return router
