"""
Bot de WhatsApp Business API — recibe documentos (guía remitente, ticket UNACEM,
vale/factura de combustible, vale de entrega) que los choferes mandan por WhatsApp
y los deja en una bandeja de "pendientes por clasificar" ligada a su viaje activo.

NO auto-arma liquidaciones (decisión explícita del usuario, ver plan) — un
administrador revisa la bandeja (GET /whatsapp/pendientes) y arma la línea con
POST /whatsapp/pendientes/{id}/asignar.

Dependencia externa: Meta exige un número de WhatsApp Business verificado y una
URL HTTPS pública para el webhook — este módulo no puede probarse end-to-end en
vivo hasta que exista esa URL (VPS + dominio). El código en sí (verificación de
firma, resolución de teléfono, clasificación) es independiente de esa infra.

Mismo patrón de import que liquidacion_flete.py: import server as srv, referencias
resueltas en tiempo de request (server.py ya terminó de ejecutar para entonces).
"""
import hashlib
import hmac
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse

import db_pg
import server as srv
from liquidacion_flete import DOCUMENTO_KINDS, extract_document_fields

router = APIRouter(prefix="/api")


# ============== TABLAS EN POSTGRES ==============
# Las cuatro tablas del bot ya cortaron (db/migrations/003_corte_whatsapp.sql)
# y las escribe solo este archivo. trips y users se siguen leyendo de Mongo,
# que es correcto: esas todavia no cortaron.
#
# whatsapp_events y whatsapp_unrecognized no llevan company_id: son el
# registro de lo que entra al webhook, anterior a saber de que empresa es el
# numero. Por eso se escriben con db_pg.tx_sin_empresa().

EVENT_COLS = {
    "id": "uuid", "wa_id": "text", "msg_type": "text", "media_id": "text",
    "created_at": "ts",
}

UNRECOGNIZED_COLS = {
    "id": "uuid", "wa_id": "text", "created_at": "ts",
}

PENDING_SELECTION_COLS = {
    "id": "uuid", "wa_id": "text", "company_id": "uuid", "driver_id": "uuid",
    "media_id": "text", "msg_type": "text", "trip_options": "uuid[]",
    "expires_at": "ts", "created_at": "ts",
}

DOCUMENTO_PENDIENTE_COLS = {
    "id": "uuid", "company_id": "uuid", "trip_id": "uuid", "driver_id": "uuid",
    "whatsapp_number": "text", "detected_kind": "text", "confidence": "text",
    "extracted_data": "json", "file_url": "text", "status": "text",
    "linea_id": "uuid", "assigned_by": "uuid", "assigned_at": "ts",
    "created_at": "ts",
}

WHATSAPP_GRAPH_VERSION = "v20.0"
WHATSAPP_GRAPH_BASE = f"https://graph.facebook.com/{WHATSAPP_GRAPH_VERSION}"
PENDING_SELECTION_TTL_MINUTES = 15


# ============== HELPERS ==============

def _normalize_phone(raw: str) -> str:
    """Normaliza un número a E.164 (+51...). WhatsApp manda wa_id como solo dígitos."""
    digits = re.sub(r"[^0-9]", "", raw or "")
    if not digits:
        return ""
    return f"+{digits}"


def verify_whatsapp_signature(raw_body: bytes, signature_header: Optional[str]) -> bool:
    """Verifica X-Hub-Signature-256 (HMAC-SHA256 sobre el body crudo, clave
    WHATSAPP_APP_SECRET). Comparación constant-time. Sin secreto configurado,
    rechaza siempre (fail closed) — nunca aceptar webhooks sin verificar en producción."""
    app_secret = srv.os.environ.get("WHATSAPP_APP_SECRET", "")
    if not app_secret or not signature_header:
        return False
    if not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    provided = signature_header.split("sha256=", 1)[1]
    return hmac.compare_digest(expected, provided)


async def resolve_driver(wa_id: str) -> Optional[dict]:
    """Resuelve el remitente por whatsapp_number — única forma de saber la
    empresa/chofer, ya que este endpoint no tiene JWT."""
    normalized = _normalize_phone(wa_id)
    if not normalized:
        return None
    return await srv.db.users.find_one(
        {"whatsapp_number": normalized, "is_active": True}, {"_id": 0}
    )


async def find_active_trips_for_driver(company_id: str, driver_id: str) -> List[dict]:
    """Viajes en_curso del chofer, más reciente primero. No existe hoy en server.py
    (GET /trips está atado a JWT y no filtra por chofer sin JWT)."""
    return await srv.db.trips.find(
        {"company_id": company_id, "driver_id": driver_id, "status": "en_curso"},
        {"_id": 0},
    ).sort("start_date", -1).to_list(10)


async def download_whatsapp_media(media_id: str) -> Optional[Dict[str, Any]]:
    """Descarga en 2 pasos, documentado por la API de WhatsApp Cloud:
    1) GET /{media_id} -> URL firmada de corta duración + mime_type
    2) GET esa URL -> bytes crudos
    Retorna {"bytes": bytes, "mime_type": str} o None si falla."""
    access_token = srv.os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
    if not access_token:
        srv.logger.error("WHATSAPP_ACCESS_TOKEN no configurado — no se puede descargar media")
        return None
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=30) as client:
        meta_resp = await client.get(f"{WHATSAPP_GRAPH_BASE}/{media_id}", headers=headers)
        meta_resp.raise_for_status()
        meta = meta_resp.json()
        media_url = meta.get("url")
        mime_type = meta.get("mime_type", "image/jpeg")
        if not media_url:
            return None
        file_resp = await client.get(media_url, headers=headers)
        file_resp.raise_for_status()
        return {"bytes": file_resp.content, "mime_type": mime_type}


async def send_whatsapp_text(to_wa_id: str, text: str) -> None:
    """Envío best-effort — nunca propaga errores (mismo criterio que notify_users
    en server.py). Un fallo al responder no debe tumbar el procesamiento del webhook."""
    access_token = srv.os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
    phone_number_id = srv.os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
    if not access_token or not phone_number_id:
        srv.logger.warning("WhatsApp no configurado — no se pudo responder al remitente")
        return
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            await client.post(
                f"{WHATSAPP_GRAPH_BASE}/{phone_number_id}/messages",
                headers={"Authorization": f"Bearer {access_token}"},
                json={
                    "messaging_product": "whatsapp",
                    "to": to_wa_id,
                    "type": "text",
                    "text": {"body": text},
                },
            )
    except Exception as e:
        srv.logger.error(f"Error enviando respuesta WhatsApp: {e}")


def _extract_messages(payload: dict) -> List[dict]:
    """Recorre el payload de Meta (entry[].changes[].value.messages[]) con
    accesos defensivos — la forma exacta puede variar (status updates, etc.)."""
    messages = []
    for entry in payload.get("entry", []) or []:
        for change in entry.get("changes", []) or []:
            value = change.get("value", {}) or {}
            for msg in value.get("messages", []) or []:
                messages.append(msg)
    return messages


# ============== WEBHOOK ==============

@router.get("/webhooks/whatsapp")
async def verify_whatsapp_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
):
    """Handshake de verificación de Meta. Debe responder el challenge en texto plano."""
    expected_token = srv.os.environ.get("WHATSAPP_VERIFY_TOKEN", "")
    if hub_mode == "subscribe" and expected_token and hub_verify_token == expected_token:
        return PlainTextResponse(content=hub_challenge or "")
    raise HTTPException(status_code=403, detail="Verificación fallida")


@router.post("/webhooks/whatsapp")
async def receive_whatsapp_webhook(request: Request):
    """Recibe eventos. SIEMPRE responde 200 rápido (evita reintentos agresivos de
    Meta) — cualquier error de procesamiento se loguea internamente, nunca se
    propaga como 4xx/5xx a Meta salvo fallo de firma."""
    raw_body = await request.body()
    signature = request.headers.get("x-hub-signature-256")

    if not verify_whatsapp_signature(raw_body, signature):
        # Sin logging: una request no verificada no es atribuible a nada.
        raise HTTPException(status_code=401, detail="Firma inválida")

    import json

    try:
        payload = json.loads(raw_body)
    except Exception:
        return {"status": "ok"}

    for message in _extract_messages(payload):
        try:
            await _process_message(message)
        except Exception as e:
            srv.logger.error(f"Error procesando mensaje de WhatsApp: {e}")

    return {"status": "ok"}


async def _process_message(message: dict) -> None:
    wa_id = message.get("from", "")
    msg_type = message.get("type")

    # Sin contexto de empresa: todavia no se sabe de quien es este numero.
    # tx_sin_empresa solo alcanza a estas dos tablas de log, que son las unicas
    # sin company_id; contra cualquier otra, RLS devolveria cero filas.
    async with db_pg.tx_sin_empresa() as conn:
        sql, values = db_pg.build_insert("whatsapp_events", EVENT_COLS, {
            "id": str(uuid.uuid4()),
            "wa_id": wa_id,
            "msg_type": msg_type,
            "media_id": (message.get(msg_type) or {}).get("id") if msg_type in ("image", "document") else None,
            "created_at": datetime.now(timezone.utc),
        })
        await conn.execute(sql, *values)

    driver = await resolve_driver(wa_id)
    if not driver:
        async with db_pg.tx_sin_empresa() as conn:
            sql, values = db_pg.build_insert("whatsapp_unrecognized", UNRECOGNIZED_COLS, {
                "id": str(uuid.uuid4()),
                "wa_id": wa_id,
                "created_at": datetime.now(timezone.utc),
            })
            await conn.execute(sql, *values)
        await send_whatsapp_text(wa_id, "Tu número no está registrado. Contacta a tu administrador.")
        return

    company_id = driver["company_id"]
    driver_id = driver["id"]

    # Respuesta de texto a una selección de viaje pendiente
    if msg_type == "text":
        # A esta altura el chofer ya esta resuelto, o sea que hay empresa y la
        # consulta puede ir con contexto normal.
        async with db_pg.tx({"company_id": company_id}) as conn:
            fila = await conn.fetchrow(
                "select * from whatsapp_pending_selection "
                "where wa_id = $1 and expires_at > now() "
                "order by created_at desc limit 1",
                wa_id,
            )
        pending = db_pg.to_api(fila)
        if pending:
            await _resolve_pending_selection(pending, message.get("text", {}).get("body", ""))
            return
        await send_whatsapp_text(wa_id, "Envía una foto o PDF de tu documento (guía, ticket UNACEM, vale o factura de combustible).")
        return

    if msg_type not in ("image", "document"):
        await send_whatsapp_text(wa_id, "Envía una foto o PDF de tu documento (guía, ticket UNACEM, vale o factura de combustible).")
        return

    media_id = (message.get(msg_type) or {}).get("id")
    if not media_id:
        return

    trips = await find_active_trips_for_driver(company_id, driver_id)
    if not trips:
        await send_whatsapp_text(wa_id, "No tienes ningún viaje en curso. Contacta a operaciones.")
        return

    if len(trips) > 1:
        options = "\n".join(f"{i + 1}. Viaje {t.get('id', '')[:8]}" for i, t in enumerate(trips))
        async with db_pg.tx({"company_id": company_id}) as conn:
            sql, values = db_pg.build_insert(
                "whatsapp_pending_selection", PENDING_SELECTION_COLS, {
                    "id": str(uuid.uuid4()),
                    "wa_id": wa_id,
                    "company_id": company_id,
                    "driver_id": driver_id,
                    "media_id": media_id,
                    "msg_type": msg_type,
                    "trip_options": [t["id"] for t in trips],
                    "expires_at": datetime.now(timezone.utc) + timedelta(minutes=PENDING_SELECTION_TTL_MINUTES),
                    "created_at": datetime.now(timezone.utc),
                },
            )
            await conn.execute(sql, *values)
        await send_whatsapp_text(wa_id, f"Tienes varios viajes activos. Responde con el número:\n{options}")
        return

    await _ingest_document(company_id, driver_id, trips[0]["id"], wa_id, media_id)


async def _resolve_pending_selection(pending: dict, reply_text: str) -> None:
    try:
        index = int(reply_text.strip()) - 1
    except ValueError:
        await send_whatsapp_text(pending["wa_id"], "Respuesta no válida. Envía solo el número del viaje.")
        return

    trip_ids = pending.get("trip_options", [])
    if index < 0 or index >= len(trip_ids):
        await send_whatsapp_text(pending["wa_id"], "Número fuera de rango. Intenta de nuevo.")
        return

    async with db_pg.tx({"company_id": pending["company_id"]}) as conn:
        await conn.execute(
            "delete from whatsapp_pending_selection where id = $1 and company_id = $2",
            db_pg.as_uuid(pending["id"]), db_pg.as_uuid(pending["company_id"]),
        )
    await _ingest_document(
        pending["company_id"], pending["driver_id"], trip_ids[index], pending["wa_id"], pending["media_id"]
    )


async def _ingest_document(company_id: str, driver_id: str, trip_id: str, wa_id: str, media_id: str) -> None:
    media = await download_whatsapp_media(media_id)
    if not media:
        await send_whatsapp_text(wa_id, "No pude descargar tu documento. Intenta enviarlo de nuevo.")
        return

    try:
        ocr_result = await extract_document_fields(media["bytes"], media["mime_type"], "auto")
    except Exception as e:
        srv.logger.error(f"OCR falló en pipeline de WhatsApp: {e}")
        ocr_result = {"detected_kind": "unknown", "confidence": "baja", "extracted_data": {}}

    detected_kind = ocr_result.get("detected_kind", "unknown")
    confidence = ocr_result.get("confidence")

    pendiente_id = str(uuid.uuid4())
    ext = "pdf" if media["mime_type"] == "application/pdf" else "jpg"
    upload = await srv.save_uploaded_content(
        media["bytes"], "whatsapp_pendiente", pendiente_id, media["mime_type"], ext
    )

    async with db_pg.tx({"company_id": company_id}) as conn:
        sql, values = db_pg.build_insert(
            "whatsapp_documentos_pendientes", DOCUMENTO_PENDIENTE_COLS, {
                "id": pendiente_id,
                "company_id": company_id,
                "trip_id": trip_id,
                "driver_id": driver_id,
                "whatsapp_number": _normalize_phone(wa_id),
                "detected_kind": detected_kind,
                "confidence": confidence,
                "extracted_data": ocr_result.get("extracted_data", {}),
                "file_url": upload["url"],
                "status": "pendiente",
                "created_at": datetime.now(timezone.utc),
            },
        )
        await conn.execute(sql, *values)

    if detected_kind not in DOCUMENTO_KINDS or confidence == "baja":
        await send_whatsapp_text(
            wa_id, "Recibí tu documento pero no pude identificarlo con certeza. Un administrador lo revisará."
        )
    else:
        label = {
            "guia_remitente": "guía remitente",
            "ticket_unacem": "ticket UNACEM",
            "vale_combustible": "vale de combustible",
            "factura_combustible": "factura de combustible",
            "vale_entrega": "vale de entrega",
        }.get(detected_kind, detected_kind)
        await send_whatsapp_text(wa_id, f"✅ Recibido: {label} para tu viaje. Será procesado por el equipo.")


# ============== BANDEJA DE PENDIENTES (panel admin) ==============

@router.get("/whatsapp/pendientes")
async def get_whatsapp_pendientes(
    status: str = "pendiente",
    current_user: dict = Depends(srv.require_roles("owner", "admin", "contabilidad", "operaciones")),
):
    async with db_pg.tx(current_user) as conn:
        filas = await conn.fetch(
            "select * from whatsapp_documentos_pendientes "
            "where company_id = $1 and status = $2 "
            "order by created_at desc limit 500",
            db_pg.as_uuid(current_user["company_id"]), status,
        )
    return db_pg.rows_to_api(filas)


@router.post("/whatsapp/pendientes/{pendiente_id}/asignar")
async def asignar_whatsapp_pendiente(
    pendiente_id: str,
    request: dict = Body(...),
    current_user: dict = Depends(srv.require_roles("owner", "admin", "contabilidad", "operaciones")),
):
    """Arma la línea con el documento pendiente: crea una LiquidacionLinea nueva
    prellenada con extracted_data, o adjunta el documento a una línea existente."""
    company_id = current_user["company_id"]
    liquidacion_id = request.get("liquidacion_id")
    linea_id = request.get("linea_id")

    from liquidacion_flete import (
        LINEA_COLS,
        LiquidacionLinea,
        _model_to_row,
        _recalc_linea_totales,
        _recalc_liquidacion_totales,
        _require_liquidacion_editable,
    )

    # Todo en UNA transaccion. Antes eran escrituras en dos bases distintas
    # (la linea en Postgres, el pendiente en Mongo), asi que un fallo en medio
    # dejaba la linea creada y el pendiente todavia marcado como pendiente:
    # el documento se adjuntaba dos veces si alguien reintentaba. Ahora las dos
    # tablas viven en Postgres y o entran juntas o no entra ninguna.
    async with db_pg.tx(current_user) as conn:
        fila = await conn.fetchrow(
            "select * from whatsapp_documentos_pendientes "
            "where id = $1 and company_id = $2",
            db_pg.as_uuid(pendiente_id), db_pg.as_uuid(company_id),
        )
        if not fila:
            raise HTTPException(status_code=404, detail="Pendiente no encontrado")
        pendiente = db_pg.to_api(fila)
        if pendiente.get("status") != "pendiente":
            raise HTTPException(status_code=400, detail="Este pendiente ya fue procesado")

        field = DOCUMENTO_KINDS.get(pendiente.get("detected_kind"))
        if not field:
            raise HTTPException(
                status_code=400, detail="Tipo de documento no reconocido, revisa manualmente"
            )

        if not linea_id:
            if not liquidacion_id:
                raise HTTPException(status_code=400, detail="Se requiere liquidacion_id o linea_id")
            await _require_liquidacion_editable(conn, company_id, liquidacion_id)
            linea = LiquidacionLinea(
                company_id=company_id,
                liquidacion_id=liquidacion_id,
                trip_id=pendiente.get("trip_id"),
                created_by=current_user["id"],
                **{field: pendiente["file_url"]},
            )
            data = _model_to_row(linea)
            data.update(await _recalc_linea_totales(conn, company_id, data))
            sql, values = db_pg.build_insert("liquidacion_lineas", LINEA_COLS, data)
            await conn.execute(sql, *values)
            await _recalc_liquidacion_totales(conn, company_id, liquidacion_id)
            linea_id = linea.id
        else:
            liq_id = await conn.fetchval(
                "select liquidacion_id from liquidacion_lineas where id = $1 and company_id = $2",
                db_pg.as_uuid(linea_id), db_pg.as_uuid(company_id),
            )
            if not liq_id:
                raise HTTPException(status_code=404, detail="Línea no encontrada")
            await _require_liquidacion_editable(conn, company_id, str(liq_id))
            sql, values = db_pg.build_update(
                "liquidacion_lineas",
                LINEA_COLS,
                {
                    field: pendiente["file_url"],
                    "updated_at": datetime.now(timezone.utc),
                    "id": linea_id,
                    "company_id": company_id,
                },
                ["id", "company_id"],
            )
            await conn.execute(sql, *values)

        sql, values = db_pg.build_update(
            "whatsapp_documentos_pendientes",
            DOCUMENTO_PENDIENTE_COLS,
            {
                "status": "asignado",
                "linea_id": linea_id,
                "assigned_by": current_user["id"],
                "assigned_at": datetime.now(timezone.utc),
                "id": pendiente_id,
                "company_id": company_id,
            },
            ["id", "company_id"],
        )
        await conn.execute(sql, *values)

    return {"linea_id": linea_id, "message": "Documento asignado"}
