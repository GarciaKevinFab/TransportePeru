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
