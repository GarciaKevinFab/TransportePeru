"""Suscripcion con Mercado Pago y comprobantes, contra Postgres y con la API falsa.

    DATABASE_URL=postgresql://app_backend:...@host/db \\
    POSTGRES_ADMIN_URL=postgresql://postgres:...@host/db \\
    python -m pytest backend/tests/test_suscripcion_mercadopago.py -q

QUE SE MONTA

  - Postgres de verdad, con el esquema y la migracion 021 aplicados (en CI es
    el mismo que usa la suite de integracion). El codigo bajo prueba se conecta
    como app_backend, con RLS; las empresas de prueba se crean y se borran con
    el rol administrador.
  - Mercado Pago FALSO: se sustituye mercadopago._pedir por un diccionario. No
    sale ni una peticion a la red, ni a SUNAT (sunat_padron.consultar_ruc
    tambien es falso).
  - Una app FastAPI minima con el webhook y las rutas de suscripcion, con
    usuarios de mentira en lugar del JWT. Asi no hace falta levantar server.py.

Sin DATABASE_URL o sin la migracion 021, las pruebas se saltan con el motivo.
"""
import asyncio
import hashlib
import hmac
import json
import os
import secrets
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

asyncpg = pytest.importorskip("asyncpg")
httpx = pytest.importorskip("httpx")

import comprobantes  # noqa: E402
import db_pg  # noqa: E402
import mercadopago  # noqa: E402
import sunat_padron  # noqa: E402
import suscripciones  # noqa: E402

ADMIN_URL = os.environ.get("POSTGRES_ADMIN_URL", "")
CLAVE = "clave-webhook-de-prueba"
INIT_POINT = "https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_id="
INIT_POINT_PREFERENCIA = "https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id="
PDF = b"%PDF-1.4\n% comprobante de prueba\n%%EOF\n"


def _hay_base() -> str | None:
    if not os.environ.get("DATABASE_URL") or not ADMIN_URL:
        return "sin DATABASE_URL / POSTGRES_ADMIN_URL"

    async def mirar():
        c = await asyncpg.connect(ADMIN_URL)
        try:
            return await c.fetchval("select to_regclass('public.pagos_suscripcion') is not null")
        finally:
            await c.close()
    try:
        if not asyncio.run(mirar()):
            return "falta la migracion 021"
    except Exception as e:  # noqa: BLE001
        return f"Postgres no responde: {type(e).__name__}"
    return None


_MOTIVO = _hay_base()
pytestmark = pytest.mark.skipif(_MOTIVO is not None, reason=_MOTIVO or "")


# ─── Mercado Pago falso ──────────────────────────────────

class MercadoPagoFalso:
    """Lo minimo de la API: preapprovals, facturas y cobros, en memoria."""

    def __init__(self):
        self.preapprovals: dict[str, dict] = {}
        self.facturas: dict[str, dict] = {}
        self.cobros: dict[str, dict] = {}
        self.preferencias: dict[str, dict] = {}
        self.llamadas: list[tuple] = []
        self.caida = False

    async def pedir(self, metodo, ruta, cuerpo=None):
        self.llamadas.append((metodo, ruta, cuerpo))
        if self.caida:
            raise mercadopago.ErrorMercadoPago(f"{metodo} {ruta}: ConnectError")
        partes = ruta.strip("/").split("/")
        if metodo == "POST" and ruta == "/checkout/preferences":
            pref = f"pref-{uuid.uuid4().hex[:12]}"
            self.preferencias[pref] = {**cuerpo, "id": pref,
                                       "init_point": INIT_POINT_PREFERENCIA + pref}
            return dict(self.preferencias[pref])
        if metodo == "POST" and ruta == "/preapproval":
            pid = uuid.uuid4().hex
            self.preapprovals[pid] = {**cuerpo, "id": pid, "status": "pending",
                                      "init_point": INIT_POINT + pid}
            return dict(self.preapprovals[pid])
        if partes[0] == "preapproval":
            pre = self.preapprovals.get(partes[1])
            if not pre:
                raise mercadopago.ErrorMercadoPago(f"{metodo} {ruta}: 404", http=404)
            if metodo == "PUT":
                pre.update(cuerpo)
            return dict(pre)
        if partes[0] == "authorized_payments":
            if partes[1] not in self.facturas:
                raise mercadopago.ErrorMercadoPago(f"{metodo} {ruta}: 404", http=404)
            return dict(self.facturas[partes[1]])
        if partes[:2] == ["v1", "payments"]:
            if partes[2] not in self.cobros:
                raise mercadopago.ErrorMercadoPago(f"{metodo} {ruta}: 404", http=404)
            return dict(self.cobros[partes[2]])
        raise AssertionError(f"ruta no simulada: {metodo} {ruta}")

    # Lo que haria Mercado Pago por su lado
    def autorizar(self, pid):
        self.preapprovals[pid]["status"] = "authorized"

    def facturar(self, pid, estado="approved", monto=None):
        fid = str(7000000000 + len(self.facturas))
        cobro = str(9000000000 + len(self.facturas))
        pre = self.preapprovals[pid]
        self.facturas[fid] = {
            "id": fid, "preapproval_id": pid, "currency_id": "PEN",
            "transaction_amount": monto if monto is not None else pre["auto_recurring"]["transaction_amount"],
            "status": "processed",
            "payment": {"id": int(cobro), "status": estado, "status_detail": "accredited"},
        }
        self.cobros[cobro] = {"id": int(cobro), "status": estado,
                              "external_reference": pre["external_reference"]}
        return fid, cobro

    def pagar(self, pref, estado="approved", monto=None, moneda="PEN"):
        """El cliente paga la preferencia (Yape, PagoEfectivo o tarjeta)."""
        cobro = str(8000000000 + len(self.cobros))
        item = self.preferencias[pref]["items"][0]
        self.cobros[cobro] = {
            "id": int(cobro), "status": estado, "currency_id": moneda,
            "transaction_amount": monto if monto is not None else item["unit_price"],
            "external_reference": self.preferencias[pref]["external_reference"],
            "payment_method_id": "yape",
        }
        return cobro


@pytest.fixture
def mp(monkeypatch):
    falso = MercadoPagoFalso()
    monkeypatch.setenv("MERCADOPAGO_MODO", "produccion")
    monkeypatch.setenv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-falso")
    monkeypatch.setenv("MERCADOPAGO_WEBHOOK_SECRET", CLAVE)
    monkeypatch.setattr(mercadopago, "_pedir", falso.pedir)

    async def padron(ruc):
        return {"razon_social": "TRANSPORTES DE PRUEBA S.A.C.", "direccion": "AV. LOS PINOS 123"}
    monkeypatch.setattr(sunat_padron, "consultar_ruc", padron)
    return falso


# ─── La app minima y las empresas de prueba ──────────────

def _app(usuarios: dict):
    from fastapi import FastAPI, Header, HTTPException

    import suscripcion_api
    import webhooks_mercadopago

    async def usuario(x_usuario: str = Header("")):
        if x_usuario not in usuarios:
            raise HTTPException(status_code=401)
        return dict(usuarios[x_usuario])

    async def gestor(x_usuario: str = Header("")):
        u = await usuario(x_usuario)
        if u["role"] not in ("owner", "admin", "superadmin"):
            raise HTTPException(status_code=403)
        return u

    async def superadmin(x_usuario: str = Header("")):
        u = await usuario(x_usuario)
        if u["role"] != "superadmin":
            raise HTTPException(status_code=403)
        return u

    app = FastAPI()
    app.include_router(webhooks_mercadopago.router)
    app.include_router(suscripcion_api.crear_router(usuario, gestor, superadmin))
    return app


async def _crear_empresa(admin, estado="trial", trial_en_dias=10, vence_en_dias=None, rol="owner"):
    cid = uuid.uuid4()
    ahora = datetime.now(timezone.utc)
    await admin.execute(
        "insert into companies (id, name, slug, ruc, plan, subscription_status, trial_ends_at, "
        "  subscription_ends_at) values ($1, $2, $3, '20490042068', $4, $5, $6, $7)",
        cid, f"Prueba MP {cid.hex[:6]}", f"prueba-mp-{cid.hex[:10]}",
        "trial" if estado == "trial" else "pro", estado,
        ahora + timedelta(days=trial_en_dias) if trial_en_dias is not None else None,
        ahora + timedelta(days=vence_en_dias) if vence_en_dias is not None else None)
    uid = uuid.uuid4()
    await admin.execute(
        "insert into users (id, company_id, email, name, role) values ($1, $2, $3, 'Dueno', $4)",
        uid, cid, f"dueno-{cid.hex[:8]}@prueba.pe", rol)
    return {"id": str(uid), "company_id": str(cid), "email": f"dueno-{cid.hex[:8]}@prueba.pe",
            "role": rol}


def escenario(cuerpo):
    """Corre una prueba async en su propio bucle, con conexiones propias.

    El pool de db_pg queda atado al bucle en el que nace: se cierra al final
    de cada escenario para que el siguiente arranque limpio.
    """
    async def correr():
        db_pg._pool_lock = asyncio.Lock()
        admin = await asyncpg.connect(ADMIN_URL)
        creadas: list[str] = []

        async def empresa(**kw):
            u = await _crear_empresa(admin, **kw)
            creadas.append(u["company_id"])
            return u

        try:
            await cuerpo(admin, empresa)
        finally:
            for cid in creadas:
                await admin.execute("delete from pagos_suscripcion where company_id = $1", uuid.UUID(cid))
                await admin.execute("delete from datos_facturacion where company_id = $1", uuid.UUID(cid))
                await admin.execute("delete from users where company_id = $1", uuid.UUID(cid))
                await admin.execute("delete from companies where id = $1", uuid.UUID(cid))
            await admin.close()
            await db_pg.close_pool()
    asyncio.run(correr())


def _cliente(app):
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="https://empresa.sisac.pe")


def _firma(data_id, request_id="req-1", ts="1730000000"):
    manifiesto = f"id:{str(data_id).lower()};request-id:{request_id};ts:{ts};"
    v1 = hmac.new(CLAVE.encode(), manifiesto.encode(), hashlib.sha256).hexdigest()
    return {"x-signature": f"ts={ts},v1={v1}", "x-request-id": request_id}


async def _aviso(cliente, tipo, data_id, firma=None):
    return await cliente.post(
        f"/webhooks/mercadopago?type={tipo}&data.id={data_id}",
        json={"type": tipo, "data": {"id": data_id}},
        headers=firma if firma is not None else _firma(data_id))


async def _empresa(admin, cid):
    return await admin.fetchrow("select * from companies where id = $1", uuid.UUID(cid))


async def _alta(cliente, mp, usuario, comprobante="factura", documento="20490042068"):
    r = await cliente.post("/api/suscripcion/mercadopago", headers={"x-usuario": usuario},
                           json={"plan": "pro", "comprobante": comprobante,
                                 "documento": documento, "monto": 1})
    assert r.status_code == 200, r.text
    pid = r.json()["init_point"].split("=")[-1]
    return pid


# ─── Alta ────────────────────────────────────────────────

def test_alta_crea_la_suscripcion_con_el_precio_del_servidor(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa()
        app = _app({"d": dueno})
        async with _cliente(app) as c:
            pid = await _alta(c, mp, "d")
        enviado = mp.preapprovals[pid]
        # El "monto": 1 del navegador se ignoro: manda planes.py.
        assert enviado["auto_recurring"]["transaction_amount"] == 199.0
        assert enviado["external_reference"] == f"cargoxprez|{dueno['company_id']}|pro|mensual"
        assert enviado["payer_email"] == dueno["email"]
        assert enviado["back_url"] == "https://empresa.sisac.pe/suscripcion?aviso=confirmando" or \
            enviado["back_url"].endswith("/suscripcion?aviso=confirmando")
        # Nada se concede todavia: el plan llega con el pago.
        fila = await _empresa(admin, dueno["company_id"])
        assert fila["subscription_status"] == "trial" and fila["mp_preapproval_id"] is None
        datos = await admin.fetchrow("select * from datos_facturacion where company_id = $1",
                                     uuid.UUID(dueno["company_id"]))
        assert (datos["tipo"], datos["documento"], datos["nombre"]) == (
            "factura", "20490042068", "TRANSPORTES DE PRUEBA S.A.C.")
    escenario(cuerpo)


def test_alta_en_simulado_no_llama_a_mercado_pago(mp, monkeypatch):
    monkeypatch.setenv("MERCADOPAGO_MODO", "")

    async def cuerpo(admin, empresa):
        dueno = await empresa()
        async with _cliente(_app({"d": dueno})) as c:
            r = await c.post("/api/suscripcion/mercadopago", headers={"x-usuario": "d"}, json={"plan": "pro"})
        assert r.status_code == 503
        assert mp.llamadas == []
    escenario(cuerpo)


def test_alta_en_modo_prueba_solo_para_correos_de_prueba(mp, monkeypatch):
    monkeypatch.setenv("MERCADOPAGO_MODO", "prueba")

    async def cuerpo(admin, empresa):
        dueno = await empresa()
        async with _cliente(_app({"d": dueno})) as c:
            monkeypatch.setenv("MERCADOPAGO_CORREOS_PRUEBA", "otro@sisac.pe")
            r = await c.post("/api/suscripcion/mercadopago", headers={"x-usuario": "d"}, json={"plan": "pro"})
            assert r.status_code == 503
            monkeypatch.setenv("MERCADOPAGO_CORREOS_PRUEBA", dueno["email"])
            r = await c.post("/api/suscripcion/mercadopago", headers={"x-usuario": "d"}, json={"plan": "pro"})
            assert r.status_code == 200
    escenario(cuerpo)


def test_alta_rechaza_plan_desconocido_y_factura_sin_ruc(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa()
        async with _cliente(_app({"d": dueno})) as c:
            r1 = await c.post("/api/suscripcion/mercadopago", headers={"x-usuario": "d"}, json={"plan": "empresa"})
            r2 = await c.post("/api/suscripcion/mercadopago", headers={"x-usuario": "d"},
                              json={"plan": "pro", "comprobante": "factura", "documento": "123"})
        assert (r1.status_code, r2.status_code) == (400, 400)
        assert mp.llamadas == []
    escenario(cuerpo)


# ─── Cobro aprobado, repetido, renovacion ────────────────

def test_cobro_aprobado_activa_el_plan_y_pide_el_comprobante(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa(trial_en_dias=5)
        app = _app({"d": dueno})
        async with _cliente(app) as c:
            pid = await _alta(c, mp, "d")
            mp.autorizar(pid)
            r = await _aviso(c, "subscription_preapproval", pid)
            assert r.status_code == 200 and r.json()["aplicado"]
            fila = await _empresa(admin, dueno["company_id"])
            assert fila["mp_preapproval_id"] == pid and fila["subscription_status"] == "trial"

            fid, _ = mp.facturar(pid)
            r = await _aviso(c, "subscription_authorized_payment", fid)
            assert r.json()["resultado"] == "aplicado", r.text

        fila = await _empresa(admin, dueno["company_id"])
        assert (fila["plan"], fila["subscription_status"]) == ("pro", "activa")
        # Los 5 dias de prueba que quedaban no se pierden: 5 + 30.
        restante = fila["subscription_ends_at"] - datetime.now(timezone.utc)
        assert timedelta(days=34, hours=23) < restante <= timedelta(days=35)
        pago = await admin.fetchrow("select * from pagos_suscripcion where mp_payment_id = $1", fid)
        assert (pago["estado"], float(pago["monto"]), pago["comp_estado"], pago["comp_tipo"],
                pago["comp_documento"]) == ("pagado", 199.0, "pendiente", "factura", "20490042068")
    escenario(cuerpo)


def test_webhook_repetido_no_concede_dos_meses(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa()
        async with _cliente(_app({"d": dueno})) as c:
            pid = await _alta(c, mp, "d")
            mp.autorizar(pid)
            fid, _ = mp.facturar(pid)
            r1 = await _aviso(c, "subscription_authorized_payment", fid)
            vence = (await _empresa(admin, dueno["company_id"]))["subscription_ends_at"]
            r2 = await _aviso(c, "subscription_authorized_payment", fid)
            r3 = await _aviso(c, "subscription_authorized_payment", fid)
        assert r1.json()["resultado"] == "aplicado"
        assert r2.json()["resultado"] == r3.json()["resultado"] == "repetido"
        assert (await _empresa(admin, dueno["company_id"]))["subscription_ends_at"] == vence
        assert await admin.fetchval("select count(*) from pagos_suscripcion where mp_payment_id = $1", fid) == 1
    escenario(cuerpo)


def test_renovacion_extiende_desde_el_vencimiento(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa(estado="activa", trial_en_dias=None, vence_en_dias=3)
        async with _cliente(_app({"d": dueno})) as c:
            pid = await _alta(c, mp, "d")
            mp.autorizar(pid)
            antes = (await _empresa(admin, dueno["company_id"]))["subscription_ends_at"]
            fid, _ = mp.facturar(pid)
            await _aviso(c, "subscription_authorized_payment", fid)
            despues = (await _empresa(admin, dueno["company_id"]))["subscription_ends_at"]
            assert despues - antes == timedelta(days=30)
            fid2, _ = mp.facturar(pid)
            await _aviso(c, "subscription_authorized_payment", fid2)
        assert (await _empresa(admin, dueno["company_id"]))["subscription_ends_at"] - despues == timedelta(days=30)
    escenario(cuerpo)


def test_vencimiento_gracia_y_suspension(mp):
    async def cuerpo(admin, empresa):
        en_gracia = await empresa(estado="activa", trial_en_dias=None, vence_en_dias=-3)
        cortada = await empresa(estado="activa", trial_en_dias=None, vence_en_dias=-8)
        prueba = await empresa(trial_en_dias=-1)
        assert (await suscripciones.estado_de(en_gracia["company_id"]))["efectivo"] == "vencida"
        assert (await suscripciones.estado_de(cortada["company_id"]))["efectivo"] == "suspendida"
        assert (await suscripciones.estado_de(prueba["company_id"]))["efectivo"] == "prueba_vencida"
        # Y pagar desde la suspension la reactiva, contando desde hoy.
        async with _cliente(_app({"d": cortada})) as c:
            pid = await _alta(c, mp, "d")
            mp.autorizar(pid)
            fid, _ = mp.facturar(pid)
            await _aviso(c, "subscription_authorized_payment", fid)
        e = await suscripciones.estado_de(cortada["company_id"])
        assert e["efectivo"] == "activa"
        assert timedelta(days=29, hours=23) < e["subscription_ends_at"] - datetime.now(timezone.utc) <= timedelta(days=30)
    escenario(cuerpo)


# ─── Rechazos ────────────────────────────────────────────

def test_cobro_rechazado_en_prueba_no_suspende(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa()
        async with _cliente(_app({"d": dueno})) as c:
            pid = await _alta(c, mp, "d")
            fid, _ = mp.facturar(pid, estado="rejected")
            r = await _aviso(c, "subscription_authorized_payment", fid)
            r2 = await _aviso(c, "subscription_authorized_payment", fid)
        assert r.json()["contado"] is True and r2.json()["contado"] is False
        fila = await _empresa(admin, dueno["company_id"])
        assert (fila["subscription_status"], fila["mp_intentos_fallidos"]) == ("trial", 0)
        pago = await admin.fetchrow("select estado, comp_estado from pagos_suscripcion where mp_payment_id = $1", fid)
        assert (pago["estado"], pago["comp_estado"]) == ("fallido", None)  # sin venta, sin comprobante
    escenario(cuerpo)


def test_cuatro_rechazos_suspenden_a_quien_ya_paga(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa(estado="activa", trial_en_dias=None, vence_en_dias=1)
        async with _cliente(_app({"d": dueno})) as c:
            pid = await _alta(c, mp, "d")
            for _ in range(suscripciones.MAX_INTENTOS):
                fid, _ = mp.facturar(pid, estado="rejected")
                await _aviso(c, "subscription_authorized_payment", fid)
        e = await suscripciones.estado_de(dueno["company_id"])
        assert (e["subscription_status"], e["efectivo"]) == ("suspendida", "suspendida")
    escenario(cuerpo)


def test_importe_distinto_al_pactado_no_se_aplica(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa()
        async with _cliente(_app({"d": dueno})) as c:
            pid = await _alta(c, mp, "d")
            fid, _ = mp.facturar(pid, monto=1.0)
            r = await _aviso(c, "subscription_authorized_payment", fid)
        assert r.json()["motivo"] == "importe no coincide"
        assert (await _empresa(admin, dueno["company_id"]))["subscription_status"] == "trial"
    escenario(cuerpo)


def test_suscripcion_de_licitapro_se_ignora(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa()
        async with _cliente(_app({"d": dueno})) as c:
            pid = await _alta(c, mp, "d")
            mp.preapprovals[pid]["external_reference"] = "licitapro|12|pro|mensual"
            fid, _ = mp.facturar(pid)
            r = await _aviso(c, "subscription_authorized_payment", fid)
        assert r.json()["motivo"] == "referencia ajena"
        assert await admin.fetchval("select count(*) from pagos_suscripcion where mp_payment_id = $1", fid) == 0
    escenario(cuerpo)


# ─── Firma ───────────────────────────────────────────────

def test_firma_mala_responde_401_sin_consultar_nada(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa()
        async with _cliente(_app({"d": dueno})) as c:
            pid = await _alta(c, mp, "d")
            mp.autorizar(pid)
            fid, _ = mp.facturar(pid)
            mp.llamadas.clear()
            malas = [
                {},                                                     # sin cabeceras
                {"x-signature": "ts=1,v1=00", "x-request-id": "req-1"},
                _firma("otro-id"),                                      # firma de otro aviso
            ]
            for cabeceras in malas:
                r = await _aviso(c, "subscription_authorized_payment", fid, firma=cabeceras)
                assert r.status_code == 401
        assert mp.llamadas == []
        assert (await _empresa(admin, dueno["company_id"]))["subscription_status"] == "trial"
    escenario(cuerpo)


def test_aviso_firmado_con_la_pasarela_apagada_se_reintenta(mp, monkeypatch):
    async def cuerpo(admin, empresa):
        dueno = await empresa()
        async with _cliente(_app({"d": dueno})) as c:
            pid = await _alta(c, mp, "d")
            mp.autorizar(pid)
            fid, _ = mp.facturar(pid)
            monkeypatch.setenv("MERCADOPAGO_MODO", "simulado")
            mp.llamadas.clear()
            r = await _aviso(c, "subscription_authorized_payment", fid)
            # 503 y no 200: Mercado Pago no reintenta lo que recibio 200.
            assert r.status_code == 503 and mp.llamadas == []
            monkeypatch.setenv("MERCADOPAGO_MODO", "produccion")
            r = await _aviso(c, "subscription_authorized_payment", fid)
            assert r.json()["resultado"] == "aplicado"
    escenario(cuerpo)


def test_mercado_pago_caido_pide_reintento(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa()
        async with _cliente(_app({"d": dueno})) as c:
            pid = await _alta(c, mp, "d")
            fid, _ = mp.facturar(pid)
            mp.caida = True
            r = await _aviso(c, "subscription_authorized_payment", fid)
        assert r.status_code == 503
    escenario(cuerpo)


# ─── Cancelacion ─────────────────────────────────────────

def test_cancelar_conserva_lo_pagado_y_cancela_en_mercado_pago(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa()
        async with _cliente(_app({"d": dueno})) as c:
            pid = await _alta(c, mp, "d")
            mp.autorizar(pid)
            await _aviso(c, "subscription_preapproval", pid)
            fid, _ = mp.facturar(pid)
            await _aviso(c, "subscription_authorized_payment", fid)
            vence = (await _empresa(admin, dueno["company_id"]))["subscription_ends_at"]

            r = await c.post("/api/suscripcion/cancelar", headers={"x-usuario": "d"})
            assert r.status_code == 200, r.text
            assert r.json()["efectivo"] == "cancelada"
            assert mp.preapprovals[pid]["status"] == "cancelled"
            fila = await _empresa(admin, dueno["company_id"])
            assert (fila["subscription_status"], fila["mp_preapproval_id"], fila["subscription_ends_at"]) == (
                "cancelada", None, vence)

            # El aviso de "cancelled" que manda despues Mercado Pago no cambia nada.
            r = await _aviso(c, "subscription_preapproval", pid)
            assert r.status_code == 200 and r.json()["aplicado"] is False
            # Sin suscripcion viva, cancelar otra vez no hace nada en Mercado Pago.
            mp.llamadas.clear()
            r = await c.post("/api/suscripcion/cancelar", headers={"x-usuario": "d"})
            assert r.status_code == 200 and mp.llamadas == []
    escenario(cuerpo)


def test_si_mercado_pago_no_cancela_no_se_marca_cancelada(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa()
        async with _cliente(_app({"d": dueno})) as c:
            pid = await _alta(c, mp, "d")
            mp.autorizar(pid)
            await _aviso(c, "subscription_preapproval", pid)
            mp.caida = True
            r = await c.post("/api/suscripcion/cancelar", headers={"x-usuario": "d"})
        assert r.status_code == 502
        fila = await _empresa(admin, dueno["company_id"])
        assert fila["mp_preapproval_id"] == pid and fila["subscription_status"] == "trial"
    escenario(cuerpo)


def test_cancelacion_desde_mercado_pago_llega_por_webhook(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa(estado="activa", trial_en_dias=None, vence_en_dias=10)
        async with _cliente(_app({"d": dueno})) as c:
            pid = await _alta(c, mp, "d")
            mp.autorizar(pid)
            await _aviso(c, "subscription_preapproval", pid)
            mp.preapprovals[pid]["status"] = "cancelled"
            r = await _aviso(c, "subscription_preapproval", pid)
        assert r.json()["aplicado"] is True
        e = await suscripciones.estado_de(dueno["company_id"])
        assert (e["subscription_status"], e["efectivo"], e["mp_preapproval_id"]) == ("cancelada", "cancelada", None)
    escenario(cuerpo)


# ─── Devolucion ──────────────────────────────────────────

def test_devolucion_quita_el_periodo_una_sola_vez(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa(estado="activa", trial_en_dias=None, vence_en_dias=20)
        async with _cliente(_app({"d": dueno})) as c:
            pid = await _alta(c, mp, "d")
            mp.autorizar(pid)
            fid, cobro = mp.facturar(pid)
            await _aviso(c, "subscription_authorized_payment", fid)
            vence = (await _empresa(admin, dueno["company_id"]))["subscription_ends_at"]
            mp.cobros[cobro]["status"] = "refunded"
            r1 = await _aviso(c, "payment", cobro)
            r2 = await _aviso(c, "payment", cobro)
        assert r1.json()["resultado"] == "devuelto" and r2.json()["resultado"] == "sin_efecto"
        assert vence - (await _empresa(admin, dueno["company_id"]))["subscription_ends_at"] == timedelta(days=30)
        pago = await admin.fetchrow("select estado, comp_estado, comp_nota from pagos_suscripcion "
                                    "where mp_payment_id = $1", fid)
        # Devuelto antes de emitir: ya no hay venta que facturar.
        assert (pago["estado"], pago["comp_estado"]) == ("devuelto", "no_aplica")
    escenario(cuerpo)


# ─── Comprobantes ────────────────────────────────────────

async def _pago_aprobado(c, mp, usuario, comprobante="boleta", documento=""):
    pid = await _alta(c, mp, usuario, comprobante, documento)
    mp.autorizar(pid)
    fid, _ = mp.facturar(pid)
    await _aviso(c, "subscription_authorized_payment", fid)
    return fid


def test_el_dueno_registra_el_comprobante_y_solo_su_empresa_lo_descarga(mp):
    async def cuerpo(admin, empresa):
        a = await empresa()
        b = await empresa()
        sa = {"id": str(uuid.uuid4()), "company_id": str(uuid.uuid4()), "email": "kevin@sisac.pe",
              "role": "superadmin"}
        conta_b = dict(b, role="contabilidad")
        chofer_a = dict(a, role="chofer")
        app = _app({"a": a, "b": b, "sa": sa, "conta_b": conta_b, "chofer_a": chofer_a})
        async with _cliente(app) as c:
            fid = await _pago_aprobado(c, mp, "a", "boleta", "12345678")
            pago_id = str(await admin.fetchval("select id from pagos_suscripcion where mp_payment_id = $1", fid))

            # El panel es solo del superadmin.
            assert (await c.get("/api/admin/comprobantes", headers={"x-usuario": "a"})).status_code == 403
            panel = (await c.get("/api/admin/comprobantes", headers={"x-usuario": "sa"})).json()
            mio = next(p for p in panel["pendientes"] if p["id"] == pago_id)
            assert (mio["comp_tipo"], mio["comp_documento"], float(mio["base"]), float(mio["igv"])) == (
                "boleta", "12345678", 168.64, 30.36)

            def registrar(**kw):
                archivos = {"pdf": ("c.pdf", kw.pop("pdf", PDF), "application/pdf")}
                return c.post(f"/api/admin/comprobantes/{pago_id}", headers={"x-usuario": "sa"},
                              data=kw, files=archivos)

            assert (await registrar(serie="F001", numero="7")).status_code == 400   # boleta con serie F
            assert (await registrar(serie="B001", numero="7", pdf=b"no soy pdf")).status_code == 400
            assert (await c.post(f"/api/admin/comprobantes/{pago_id}", headers={"x-usuario": "a"},
                                 data={"serie": "B001", "numero": "7"})).status_code == 403
            r = await registrar(serie="B001", numero="0007", fecha="2026-11-07")
            assert r.status_code == 200, r.text
            assert (await registrar(serie="B001", numero="8")).status_code == 400   # ya no esta pendiente

            ruta = f"/api/suscripcion/pagos/{pago_id}/comprobante"
            r = await c.get(ruta, headers={"x-usuario": "a"})
            assert r.status_code == 200 and r.content == PDF
            assert 'filename="B001-7.pdf"' in r.headers["content-disposition"]
            # Otra empresa no lo ve, ni con un rol que si descarga los suyos.
            assert (await c.get(ruta, headers={"x-usuario": "b"})).status_code == 404
            assert (await c.get(ruta, headers={"x-usuario": "conta_b"})).status_code == 404
            # Dentro de la empresa, un chofer tampoco.
            assert (await c.get(ruta, headers={"x-usuario": "chofer_a"})).status_code == 403
            # Y la pantalla de B no lista el cobro de A.
            vista_b = (await c.get("/api/suscripcion", headers={"x-usuario": "b"})).json()
            assert all(p["id"] != pago_id for p in vista_b["pagos"])
            vista_a = (await c.get("/api/suscripcion", headers={"x-usuario": "a"})).json()
            mio = next(p for p in vista_a["pagos"] if p["id"] == pago_id)
            assert (mio["comp_serie"], mio["comp_numero"], mio["tiene_pdf"]) == ("B001", "7", True)
        # RLS por debajo: aun sin el filtro por empresa, la base no se lo daria.
        async with db_pg.tx({"company_id": b["company_id"]}) as conn:
            assert await conn.fetchval("select count(*) from pagos_suscripcion where id = $1",
                                       uuid.UUID(pago_id)) == 0
    escenario(cuerpo)


def test_misma_serie_y_numero_no_va_en_dos_cobros(mp):
    async def cuerpo(admin, empresa):
        a = await empresa()
        b = await empresa()
        async with _cliente(_app({"a": a, "b": b})) as c:
            f1 = await _pago_aprobado(c, mp, "a")
            f2 = await _pago_aprobado(c, mp, "b")
        p1 = str(await admin.fetchval("select id from pagos_suscripcion where mp_payment_id = $1", f1))
        p2 = str(await admin.fetchval("select id from pagos_suscripcion where mp_payment_id = $1", f2))
        serie = f"B{uuid.uuid4().hex[:3].upper()}"
        assert await comprobantes.registrar(p1, serie, "1", None, None) is None
        assert "ya está registrado" in await comprobantes.registrar(p2, serie, "1", None, None)
        assert await comprobantes.no_aplica(p2, "") is not None
        assert await comprobantes.no_aplica(p2, "Cortesia") is None
    escenario(cuerpo)


def test_aviso_al_dueno_y_recordatorio(mp, monkeypatch):
    enviados = []

    async def enviar(destino, asunto, texto, html=""):
        enviados.append((destino, asunto, texto))
        return True

    import correo
    monkeypatch.setattr(correo, "enviar", enviar)
    monkeypatch.setenv("COMPROBANTES_AVISO_EMAIL", "kevin@sisac.pe")

    async def cuerpo(admin, empresa):
        a = await empresa()
        async with _cliente(_app({"a": a})) as c:
            fid = await _pago_aprobado(c, mp, "a", "factura", "20490042068")
        await comprobantes.avisar()
        mios = [e for e in enviados if "20490042068" in e[2]]
        assert len(mios) == 1 and mios[0][1].startswith("Emitir factura")
        assert "TRANSPORTES DE PRUEBA S.A.C." in mios[0][2]
        # Dentro de las 24 h no se repite.
        enviados.clear()
        await comprobantes.avisar()
        assert not [e for e in enviados if "20490042068" in e[2]]
        # Pasado el dia, recordatorio.
        await admin.execute("update pagos_suscripcion set comp_avisado_en = now() - interval '25 hours' "
                            "where mp_payment_id = $1", fid)
        await comprobantes.avisar()
        mios = [e for e in enviados if "20490042068" in e[2]]
        assert len(mios) == 1 and mios[0][1].startswith("Recordatorio")
    escenario(cuerpo)


# ─── Checkout sin JavaScript ─────────────────────────────

def test_checkout_sin_js_manda_a_mercado_pago_con_la_cuenta(mp, monkeypatch):
    import bcrypt
    from fastapi import FastAPI

    import checkout_sin_js

    checkout_sin_js._INTENTOS_CLAVE.clear()
    # Generada en cada corrida: no hay ninguna clave escrita en el repo.
    clave = secrets.token_urlsafe(12)

    async def cuerpo(admin, empresa):
        dueno = await empresa()
        await admin.execute("update users set password_hash = $1 where id = $2",
                            bcrypt.hashpw(clave.encode(), bcrypt.gensalt(4)).decode(),
                            uuid.UUID(dueno["id"]))
        app = FastAPI()
        app.include_router(checkout_sin_js.router)
        async with _cliente(app) as c:
            base = {"plan": "pro", "razon_social": "Mi empresa", "email": dueno["email"].upper(),
                    "comprobante": "boleta", "documento": ""}
            r = await c.post("/comprar", data={**base, "password": clave[::-1]})
            assert r.status_code != 303 and not [x for x in mp.llamadas if x[0] == "POST"]
            r = await c.post("/comprar", data={**base, "password": clave})
        assert r.status_code == 303 and r.headers["location"].startswith(INIT_POINT)
        pre = next(iter(mp.preapprovals.values()))
        assert pre["auto_recurring"]["transaction_amount"] == 199.0
        assert pre["external_reference"] == f"cargoxprez|{dueno['company_id']}|pro|mensual"
    escenario(cuerpo)


def test_checkout_sin_js_limita_los_intentos_de_clave(mp):
    from fastapi import FastAPI

    import checkout_sin_js

    checkout_sin_js._INTENTOS_CLAVE.clear()

    async def cuerpo(admin, empresa):
        app = FastAPI()
        app.include_router(checkout_sin_js.router)
        llamadas = []
        original = checkout_sin_js._cuenta_que_paga

        async def contar(correo, clave):
            llamadas.append(correo)
            return await original(correo, clave)
        checkout_sin_js._cuenta_que_paga = contar
        try:
            async with _cliente(app) as c:
                for _ in range(checkout_sin_js.INTENTOS_MAXIMOS + 5):
                    await c.post("/comprar", data={"plan": "pro", "razon_social": "X S.A.C.",
                                                   "email": "nadie@prueba.pe", "password": secrets.token_hex(4)})
        finally:
            checkout_sin_js._cuenta_que_paga = original
        assert len(llamadas) == checkout_sin_js.INTENTOS_MAXIMOS
    escenario(cuerpo)


def test_json_de_respuesta_de_mercado_pago_se_guarda(mp):
    async def cuerpo(admin, empresa):
        a = await empresa()
        async with _cliente(_app({"a": a})) as c:
            fid = await _pago_aprobado(c, mp, "a")
        crudo = await admin.fetchval("select respuesta::text from pagos_suscripcion where mp_payment_id = $1", fid)
        assert json.loads(crudo)["preapproval_id"]
    escenario(cuerpo)


# ─── Pago adelantado (Checkout Pro: Yape, PagoEfectivo o tarjeta) ─────

async def _adelantado(cliente, usuario, meses=3, **extra):
    return await cliente.post("/api/suscripcion/adelantado", headers={"x-usuario": usuario},
                              json={"plan": "pro", "meses": meses, "comprobante": "boleta",
                                    "documento": "", **extra})


async def _preferencia(cliente, mp, usuario, meses=3):
    r = await _adelantado(cliente, usuario, meses)
    assert r.status_code == 200, r.text
    return r.json()["init_point"].split("=")[-1]


async def _mas_meses(admin, desde, meses):
    """Lo que calcula Postgres: meses de calendario, no 30 dias."""
    return await admin.fetchval("select $1::timestamptz + make_interval(months => $2)", desde, meses)


def test_adelantado_cobra_el_total_del_catalogo_y_no_el_del_navegador(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa()
        async with _cliente(_app({"d": dueno})) as c:
            for meses, total in ((1, 199.0), (3, 597.0), (6, 1194.0), (12, 2388.0)):
                # Todo lo que el navegador pudiera inventar se ignora.
                r = await _adelantado(c, "d", meses, total=1, monto=1, unit_price=1, precio=1)
                assert r.status_code == 200, r.text
                assert r.json()["total"] == total
                pref = mp.preferencias[r.json()["init_point"].split("=")[-1]]
                assert len(pref["items"]) == 1
                item = pref["items"][0]
                assert (item["unit_price"], item["quantity"], item["currency_id"]) == (total, 1, "PEN")
                assert pref["external_reference"] == f"cargoxprez|{dueno['company_id']}|pro|adelantado-{meses}"
                assert pref["payer"]["email"] == dueno["email"]
                assert pref["payment_methods"] == {"installments": 1}
                assert pref["auto_return"] == "approved"
                assert pref["notification_url"].endswith("/webhooks/mercadopago?source_news=webhooks")
                assert pref["back_urls"]["pending"].endswith("/suscripcion?pago=pendiente")
            r = await c.get("/api/suscripcion", headers={"x-usuario": "d"})
            opciones = r.json()["planes"][0]["adelantado"]
            assert [(o["meses"], o["total"], o["yape"]) for o in opciones] == [
                (1, 199.0, True), (3, 597.0, True), (6, 1194.0, True), (12, 2388.0, False)]
            # Periodos que no se venden.
            for malo in (0, 2, 24, "3; drop", None):
                r = await _adelantado(c, "d", malo)
                assert r.status_code == 400, malo
        # Crear la preferencia no concede nada.
        fila = await _empresa(admin, dueno["company_id"])
        assert fila["subscription_status"] == "trial"
    escenario(cuerpo)


def test_adelantado_no_se_ofrece_con_cobro_automatico_activo(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa()
        await admin.execute("update companies set mp_preapproval_id = $2 where id = $1",
                            uuid.UUID(dueno["company_id"]), "pre-" + uuid.uuid4().hex)
        async with _cliente(_app({"d": dueno})) as c:
            mp.llamadas.clear()
            r = await _adelantado(c, "d", 3)
        assert r.status_code == 409
        assert "cancélalo primero" in r.json()["detail"].lower()
        assert mp.llamadas == []
    escenario(cuerpo)


def test_adelantado_aprobado_extiende_y_pide_el_comprobante(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa(estado="activa", trial_en_dias=None, vence_en_dias=10)
        antes = (await _empresa(admin, dueno["company_id"]))["subscription_ends_at"]
        async with _cliente(_app({"d": dueno})) as c:
            pref = await _preferencia(c, mp, "d", 3)
            cobro = mp.pagar(pref)
            r = await _aviso(c, "payment", cobro)
        assert r.status_code == 200 and r.json()["resultado"] == "aplicado", r.text
        fila = await _empresa(admin, dueno["company_id"])
        # hasta = max(ahora, hasta_actual) + 3 meses: los 10 dias que quedaban se suman.
        assert fila["subscription_ends_at"] == await _mas_meses(admin, antes, 3)
        assert (fila["plan"], fila["subscription_status"]) == ("pro", "activa")
        pago = await admin.fetchrow("select * from pagos_suscripcion where mp_payment_id = $1", cobro)
        assert (pago["estado"], float(pago["monto"]), pago["origen"], pago["meses"],
                pago["mp_cobro_id"], pago["comp_estado"]) == (
            "pagado", 597.0, "adelantado", 3, cobro, "pendiente")
        respuesta = pago["respuesta"]
        if isinstance(respuesta, str):
            respuesta = json.loads(respuesta)
        assert respuesta["payment_method_id"] == "yape"
    escenario(cuerpo)


def test_adelantado_vencido_cuenta_desde_hoy(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa(estado="activa", trial_en_dias=None, vence_en_dias=-30)
        async with _cliente(_app({"d": dueno})) as c:
            pref = await _preferencia(c, mp, "d", 1)
            antes = await admin.fetchval("select now()")
            await _aviso(c, "payment", mp.pagar(pref))
        fila = await _empresa(admin, dueno["company_id"])
        desde_hoy = await _mas_meses(admin, antes, 1)
        assert timedelta(0) <= fila["subscription_ends_at"] - desde_hoy < timedelta(minutes=1)
        assert suscripciones.estado_efectivo(fila["subscription_status"], None,
                                             fila["subscription_ends_at"]) == "activa"
    escenario(cuerpo)


def test_adelantado_repetido_no_suma_dos_veces(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa(trial_en_dias=5)
        async with _cliente(_app({"d": dueno})) as c:
            pref = await _preferencia(c, mp, "d", 6)
            cobro = mp.pagar(pref)
            r1 = await _aviso(c, "payment", cobro)
            vence = (await _empresa(admin, dueno["company_id"]))["subscription_ends_at"]
            r2 = await _aviso(c, "payment", cobro, firma=_firma(cobro, request_id="req-2"))
        assert (r1.json()["resultado"], r2.json()["resultado"]) == ("aplicado", "repetido")
        assert (await _empresa(admin, dueno["company_id"]))["subscription_ends_at"] == vence
        n = await admin.fetchval("select count(*) from pagos_suscripcion where company_id = $1",
                                 uuid.UUID(dueno["company_id"]))
        assert n == 1
    escenario(cuerpo)


def test_adelantado_con_otro_importe_no_activa(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa()
        async with _cliente(_app({"d": dueno})) as c:
            pref = await _preferencia(c, mp, "d", 12)
            menos = mp.pagar(pref, monto=199.0)            # 12 meses al precio de 1
            dolares = mp.pagar(pref, moneda="USD")          # mismo numero, otra moneda
            r1 = await _aviso(c, "payment", menos)
            r2 = await _aviso(c, "payment", dolares)
        assert r1.json()["motivo"] == r2.json()["motivo"] == "importe no coincide"
        fila = await _empresa(admin, dueno["company_id"])
        assert fila["subscription_status"] == "trial" and fila["subscription_ends_at"] is None
        assert not await admin.fetchval("select count(*) from pagos_suscripcion where company_id = $1",
                                        uuid.UUID(dueno["company_id"]))
    escenario(cuerpo)


def test_adelantado_pendiente_o_rechazado_no_activa(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa()
        async with _cliente(_app({"d": dueno})) as c:
            pref = await _preferencia(c, mp, "d", 3)
            for estado in ("pending", "in_process", "rejected", "cancelled"):
                r = await _aviso(c, "payment", mp.pagar(pref, estado=estado))
                assert r.status_code == 200 and r.json()["aplicado"] is False, estado
        fila = await _empresa(admin, dueno["company_id"])
        assert fila["subscription_status"] == "trial" and fila["subscription_ends_at"] is None
    escenario(cuerpo)


def test_codigo_de_pago_pagado_despues_activa(mp):
    """El codigo de PagoEfectivo pagado despues llega como el mismo pago, ya aprobado."""
    async def cuerpo(admin, empresa):
        dueno = await empresa()
        async with _cliente(_app({"d": dueno})) as c:
            pref = await _preferencia(c, mp, "d", 1)
            cobro = mp.pagar(pref, estado="pending")
            assert (await _aviso(c, "payment", cobro)).json()["aplicado"] is False
            mp.cobros[cobro]["status"] = "approved"
            r = await _aviso(c, "payment", cobro, firma=_firma(cobro, request_id="req-2"))
        assert r.json()["resultado"] == "aplicado"
    escenario(cuerpo)


def test_adelantado_devuelto_quita_sus_meses(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa(estado="activa", trial_en_dias=None, vence_en_dias=40)
        async with _cliente(_app({"d": dueno})) as c:
            pref = await _preferencia(c, mp, "d", 3)
            cobro = mp.pagar(pref)
            await _aviso(c, "payment", cobro)
            vence = (await _empresa(admin, dueno["company_id"]))["subscription_ends_at"]
            mp.cobros[cobro]["status"] = "refunded"
            r1 = await _aviso(c, "payment", cobro, firma=_firma(cobro, request_id="req-2"))
            r2 = await _aviso(c, "payment", cobro, firma=_firma(cobro, request_id="req-3"))
        assert (r1.json()["resultado"], r2.json()["resultado"]) == ("devuelto", "sin_efecto")
        despues = (await _empresa(admin, dueno["company_id"]))["subscription_ends_at"]
        assert despues == await admin.fetchval(
            "select $1::timestamptz - make_interval(months => 3)", vence)
        pago = await admin.fetchrow("select estado, comp_estado from pagos_suscripcion "
                                    "where mp_payment_id = $1", cobro)
        assert (pago["estado"], pago["comp_estado"]) == ("devuelto", "no_aplica")
    escenario(cuerpo)


def test_adelantado_firma_mala_401_y_mercado_pago_caido_503(mp):
    async def cuerpo(admin, empresa):
        dueno = await empresa()
        async with _cliente(_app({"d": dueno})) as c:
            pref = await _preferencia(c, mp, "d", 3)
            cobro = mp.pagar(pref)
            mp.llamadas.clear()
            r = await _aviso(c, "payment", cobro, firma=_firma("otro-id"))
            assert r.status_code == 401 and mp.llamadas == []
            mp.caida = True
            r = await _aviso(c, "payment", cobro)
            assert r.status_code == 503
            mp.caida = False
            r = await _aviso(c, "payment", cobro)
            assert r.json()["resultado"] == "aplicado"
    escenario(cuerpo)


def test_cobro_de_la_tarjeta_no_se_confunde_con_un_adelantado(mp):
    """El cobro mensual tambien avisa como `payment`: no suma nada por ahi."""
    async def cuerpo(admin, empresa):
        dueno = await empresa(trial_en_dias=5)
        async with _cliente(_app({"d": dueno})) as c:
            pid = await _alta(c, mp, "d")
            mp.autorizar(pid)
            fid, cobro = mp.facturar(pid)
            await _aviso(c, "subscription_authorized_payment", fid)
            vence = (await _empresa(admin, dueno["company_id"]))["subscription_ends_at"]
            r = await _aviso(c, "payment", cobro)
        assert r.json()["aplicado"] is False
        assert (await _empresa(admin, dueno["company_id"]))["subscription_ends_at"] == vence
        pagos = await admin.fetch("select origen, meses from pagos_suscripcion where company_id = $1",
                                  uuid.UUID(dueno["company_id"]))
        assert [(p["origen"], p["meses"]) for p in pagos] == [("suscripcion", 1)]
    escenario(cuerpo)


# ─── Recordatorio de renovacion ──────────────────────────

def test_recordatorio_a_7_y_a_1_dia_sin_repetir(mp, monkeypatch):
    import correo
    import recordatorios

    enviados = []

    async def enviar(destino, asunto, texto, html=""):
        enviados.append((destino, asunto, texto))
        return True
    monkeypatch.setattr(correo, "enviar", enviar)

    async def cuerpo(admin, empresa):
        dueno = await empresa(estado="activa", trial_en_dias=None, vence_en_dias=20)
        con_tarjeta = await empresa(estado="activa", trial_en_dias=None, vence_en_dias=20)
        async with _cliente(_app({"d": dueno, "t": con_tarjeta})) as c:
            await _aviso(c, "payment", mp.pagar(await _preferencia(c, mp, "d", 1)))
            pid = await _alta(c, mp, "t")
            mp.autorizar(pid)
            await _aviso(c, "subscription_preapproval", pid)
            fid, _ = mp.facturar(pid)
            await _aviso(c, "subscription_authorized_payment", fid)

        def mios(quien):
            return [e for e in enviados if e[0] == quien["email"]]

        async def vence_en(quien, intervalo):
            return await admin.fetchval(
                "update companies set subscription_ends_at = now() + $2::interval "
                "where id = $1 returning subscription_ends_at",
                uuid.UUID(quien["company_id"]), intervalo)

        # Faltan semanas: nada.
        await recordatorios.recordar()
        assert not mios(dueno)

        await vence_en(dueno, timedelta(days=6, hours=20))
        await vence_en(con_tarjeta, timedelta(days=6, hours=20))
        await recordatorios.recordar()
        assert len(mios(dueno)) == 1, enviados
        asunto, texto = mios(dueno)[0][1], mios(dueno)[0][2]
        assert asunto == "Tu plan de CargoXprez vence en 6 días"
        assert "/suscripcion" in texto and "Yape" in texto and "solo consulta" in texto
        # Quien paga con tarjeta no necesita aviso: se cobra solo.
        assert not mios(con_tarjeta)

        await recordatorios.recordar()
        assert len(mios(dueno)) == 1                         # el de 7 dias, una sola vez

        # Pasan los dias sin pagar: el mismo vencimiento, ya a menos de un dia.
        # (now() no se puede mover: se acercan juntas la fecha y su aviso ya enviado.)
        nuevo = await vence_en(dueno, timedelta(hours=20))
        await admin.execute("update recordatorios_renovacion set vence = $2 where company_id = $1",
                            uuid.UUID(dueno["company_id"]), nuevo)
        await recordatorios.recordar()
        assert len(mios(dueno)) == 2
        assert mios(dueno)[1][1] == "Tu plan de CargoXprez vence hoy"
        await recordatorios.recordar()
        assert len(mios(dueno)) == 2                         # el de 1 dia, una sola vez
        dias = await admin.fetch("select dias from recordatorios_renovacion where company_id = $1 "
                                 "order by dias", uuid.UUID(dueno["company_id"]))
        assert [d["dias"] for d in dias] == [1, 7]
    escenario(cuerpo)


def test_recordatorio_que_no_sale_se_reintenta(mp, monkeypatch):
    import correo
    import recordatorios

    salen = {"ok": False}
    enviados = []

    async def enviar(destino, asunto, texto, html=""):
        if salen["ok"]:
            enviados.append(destino)
        return salen["ok"]
    monkeypatch.setattr(correo, "enviar", enviar)

    async def cuerpo(admin, empresa):
        dueno = await empresa(estado="activa", trial_en_dias=None, vence_en_dias=20)
        async with _cliente(_app({"d": dueno})) as c:
            await _aviso(c, "payment", mp.pagar(await _preferencia(c, mp, "d", 1)))
        await admin.execute("update companies set subscription_ends_at = now() + interval '3 days' "
                            "where id = $1", uuid.UUID(dueno["company_id"]))
        await recordatorios.recordar()
        assert not await admin.fetchval("select count(*) from recordatorios_renovacion "
                                        "where company_id = $1", uuid.UUID(dueno["company_id"]))
        salen["ok"] = True
        await recordatorios.recordar()
        await recordatorios.recordar()
        assert enviados.count(dueno["email"]) == 1
    escenario(cuerpo)
