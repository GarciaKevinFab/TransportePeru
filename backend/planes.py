"""El catalogo que se puede comprar en linea, y su precio.

VIVE APARTE PORQUE LO LEEN DOS CHECKOUTS

  El de React (`/comprar`, que arma la pagina en el navegador) y el del
  servidor (`checkout_sin_js.py`, que la arma en HTML para quien no ejecuta
  JavaScript). Los dos tienen que cobrar exactamente lo mismo.

  Estaba escrito dentro de server.py, que son once mil lineas. Copiarlo al
  segundo checkout habria funcionado el primer dia y habria empezado a mentir
  el dia que alguien subiera el precio en uno solo -- sin error, sin log, y con
  dos importes distintos segun como hubiera entrado el cliente.

EL PRECIO VIVE EN EL SERVIDOR

  El navegador manda el codigo del plan y nada mas. Un monto que va a viajar
  hasta una pasarela de pago no puede venir en un campo que el cliente edita.
"""

# codigo -> (descripcion que se factura, monto en soles)
PRECIOS_CHECKOUT = {"pro": ("Plan Pro (mensual)", 199.00)}

# Dias de prueba de un alta nueva. La landing lo anuncia, asi que si cambia
# aqui tiene que cambiar alli: es la misma promesa. Lo leen el alta
# (server.signup) y la portada que arma el servidor (seo_rutas.py).
DIAS_DE_PRUEBA = 14

# Vehiculos que admite cada plan. La landing publica estas cifras, asi que
# tienen que cumplirse: un limite anunciado y no aplicado es una cifra
# decorativa, y el cliente lo descubre el dia que quiere pagar mas.
#
# Lo que NO esta en el mapa no tiene limite, y es intencionado: 'trial' -para
# que se pueda probar con la flota entera, que es de lo que depende la venta- y
# 'activa', que es como quedaron las empresas que ya operaban antes de que
# existieran los planes. Ante un plan desconocido se deja pasar, por lo mismo
# que el corte por suscripcion falla abierto.
LIMITE_VEHICULOS = {"gratis": 3, "pro": 20}

# Pago adelantado (Checkout Pro: Yape, banca movil o tarjeta). Meses que se
# venden y el tope de Yape. CargoXprez solo tiene el precio mensual: N meses
# cuestan N veces ese precio, sin descuento.
MESES_ADELANTADO = (1, 3, 6, 12)
TOPE_YAPE = 2000.00


def total_adelantado(plan: str, meses: int) -> float | None:
    """Lo que cuesta pagar `meses` del plan por adelantado, o None si no se vende.

    Es la UNICA fuente del importe: la preferencia de Mercado Pago se crea con
    esto y el webhook compara el pago contra esto mismo.
    """
    if plan not in PRECIOS_CHECKOUT or meses not in MESES_ADELANTADO:
        return None
    return round(PRECIOS_CHECKOUT[plan][1] * meses, 2)


def opciones_adelantado(plan: str) -> list[dict]:
    """Los periodos que se ofrecen en pantalla, con su total y si entra Yape."""
    opciones = []
    for meses in MESES_ADELANTADO:
        total = total_adelantado(plan, meses)
        if total is None:
            continue
        opciones.append({"meses": meses, "total": total, "yape": total <= TOPE_YAPE,
                         "desglose": desglose(total)})
    return opciones

# Los precios publicados YA incluyen IGV, asi que el desglose se calcula hacia
# atras. Se muestra porque un resumen de pedido peruano sin base imponible ni
# IGV a la vista no es un resumen de nada, y porque es lo primero que mira
# quien valida un comercio.
IGV = 0.18


def desglose(total: float) -> dict:
    """Base imponible e IGV a partir de un precio que ya lo incluye.

    El IGV se saca RESTANDO y no multiplicando: asi las tres cifras suman
    exactamente lo que se cobra, pase lo que pase con el redondeo de la base.
    Multiplicando, deja un centimo de descuadre entre base + IGV y total, y ese
    centimo aparece justo en la pantalla que el cliente compara con el cargo de
    su tarjeta.
    """
    total = round(float(total), 2)
    base = round(total / (1 + IGV), 2)
    return {"base": base, "igv": round(total - base, 2), "total": total}
