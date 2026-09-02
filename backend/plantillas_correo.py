"""
Plantillas de correo de CargoXprez.
===================================
Un solo sitio donde se decide como se ve un correo nuestro. Antes cada envio
traia su HTML escrito a mano en el punto de llamada: el de recuperacion de
contrasena tenia boton naranja -un color que no esta en la marca-, el del
Libro de Reclamaciones era texto pelado, y ninguno de los tres llevaba
logotipo.

POR QUE ESTA ESCRITO ASI Y NO COMO UNA PAGINA NORMAL

El correo se pinta en clientes que van veinte anos por detras del navegador:
Outlook de escritorio usa el motor de Word. De ahi las tres reglas que
gobiernan el archivo entero.

1. TABLAS, NO DIVS. Ni flex ni grid: no existen. La maquetacion es de tablas
   anidadas con role="presentation", para que los lectores de pantalla no las
   anuncien como si fueran datos.

2. ESTILOS EN LINEA. Varios clientes de Gmail descartan el <style> del <head>.
   Lo que no vaya en el atributo style de cada etiqueta, no existe.

3. FONDOS EXPLICITOS, Y ADEMAS EN bgcolor. Ver el apartado siguiente.

EL CORREO ES OSCURO, Y ESO OBLIGA A DEFENDERLO

La aplicacion es oscura y estos correos van a juego. Pero un correo que YA
viene oscuro es mas fragil que uno claro, porque varios clientes -Outlook.com,
Gmail en Android, Apple Mail- aplican su PROPIA transformacion de modo oscuro
encima. Cuando encuentran un diseno claro lo oscurecen, que es inofensivo;
cuando encuentran uno oscuro intentan ACLARARLO, y ahi es donde el texto claro
sobre un fondo aclarado se queda ilegible.

Dos defensas, y hacen falta las dos:

  a) Las metas color-scheme y supported-color-schemes declaran que el mensaje
     ya trae su propio esquema oscuro. Los clientes que las respetan dejan de
     tocar los colores.

  b) El atributo bgcolor ADEMAS del style en cada celda de fondo. Outlook
     respeta bgcolor mucho mejor que background en CSS, y es lo que sostiene
     el diseno en los clientes que ignoran (a).

LAS IMAGENES SE BLOQUEAN, Y EL CORREO TIENE QUE AGUANTARLO

Outlook y buena parte de Gmail no cargan imagenes remotas sin permiso. Por eso
el logotipo no es la unica marca del mensaje: va sobre la banda oscura con la
franja roja debajo, lleva alt en blanco -legible sobre ese fondo- y ningun
dato vive solo dentro de una imagen. Si el logo no carga, el correo se lee
igual de bien.
"""
import html as _html

# --- Identidad ------------------------------------------------------------
MARCA = "CargoXprez"
SITIO = "https://cargoxprez.sisac.pe"
# Se usa el asset que YA publica el frontend, no una copia subida a mano: el
# despliegue del frontend ROTA la carpeta build (deja la anterior como
# build.viejo), asi que cualquier archivo colocado ahi a mano desaparece en el
# siguiente despliegue y el correo se queda sin logotipo.
LOGO = SITIO + "/cargoxprez.png"
LOGO_ANCHO = 240          # px de visualizacion; el archivo mide 512

ROJO = "#E00000"          # el rojo del logotipo. Blanco encima da 5.07:1,
                          # asi que el texto del boton pasa AA sin retoques.
LIENZO = "#08090B"        # el fondo, por fuera de la tarjeta
PANEL = "#141519"         # la tarjeta
CABECERA = "#0E0F13"      # la banda del logotipo
PIE = "#0E0F12"
TINTA = "#F4F5F7"         # titulos
TEXTO = "#C2C7CE"         # cuerpo
TENUE = "#8B929B"         # etiquetas y notas
LINEA = "#272A31"         # separadores
AVISO = "#191B21"         # el recuadro de la nota al pie

TIPO = ("-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,"
        "sans-serif")


class Marcado(str):
    """Texto que YA es HTML y no debe escaparse.

    Explicito a proposito: obliga a marcar a mano las pocas lineas que llevan
    formato y deja todo lo demas escapado por defecto, que es como no se cuela
    una etiqueta por accidente.
    """


def _e(v):
    """Escapa lo que venga de fuera. Un nombre con '<' no puede romper el
    correo ni colar etiquetas: esto se manda a terceros."""
    return _html.escape(str(v if v is not None else ""), quote=True)


def _t(v):
    return str(v) if isinstance(v, Marcado) else _e(v)


def _filas(filas):
    """Tabla de datos etiqueta/valor.

    La etiqueta va encima en versalitas pequenas y el valor debajo en grande,
    en lugar de dos columnas: a 320 px -que es un movil- dos columnas obligan
    a partir el valor en tres lineas o a encogerlo hasta lo ilegible.
    """
    if not filas:
        return ""
    trozos = []
    for i, (etiqueta, valor) in enumerate(filas):
        borde = "" if i == 0 else "border-top:1px solid %s;" % LINEA
        trozos.append(
            '<tr><td style="%spadding:14px 0 12px;">'
            '<div style="font:600 11px/1.2 %s;letter-spacing:.08em;'
            'text-transform:uppercase;color:%s;padding-bottom:5px;">%s</div>'
            '<div style="font:500 16px/1.45 %s;color:%s;">%s</div>'
            '</td></tr>'
            % (borde, TIPO, TENUE, _e(etiqueta), TIPO, TINTA, _t(valor))
        )
    return ('<table role="presentation" width="100%" cellpadding="0" '
            'cellspacing="0" border="0" style="margin:26px 0 6px;">'
            + "".join(trozos) + "</table>")


def _boton(boton):
    """Boton a prueba de Outlook.

    Outlook ignora padding y border-radius en un <a>, asi que el area pulsable
    la da una celda de tabla con bgcolor y el texto va dentro. Es incomoda de
    escribir y es la unica que se pinta igual en todas partes.
    """
    if not boton:
        return ""
    return ('<table role="presentation" cellpadding="0" cellspacing="0" '
            'border="0" style="margin:30px 0 8px;"><tr>'
            '<td bgcolor="%s" style="background:%s;border-radius:8px;">'
            '<a href="%s" style="display:inline-block;padding:15px 32px;'
            'font:600 15px/1 %s;color:#FFFFFF;text-decoration:none;'
            'border-radius:8px;">%s</a></td></tr></table>'
            % (ROJO, ROJO, _e(boton["url"]), TIPO, _e(boton["texto"])))


def _parrafos(lineas, color=TEXTO, tam=15):
    return "".join(
        '<p style="margin:0 0 14px;font:400 %dpx/1.65 %s;color:%s;">%s</p>'
        % (tam, TIPO, color, _t(l)) for l in lineas
    )


def documento(titulo, intro=(), filas=(), boton=None, aviso=None,
              cierre=(), preencabezado=""):
    """Arma el HTML completo de un correo."""
    # El preencabezado es lo que la bandeja ensena junto al asunto. Sin el,
    # Gmail rellena ese hueco con lo primero del cuerpo, que suele ser ruido.
    oculto = ""
    if preencabezado:
        oculto = ('<div style="display:none;max-height:0;overflow:hidden;'
                  'opacity:0;mso-hide:all;">%s%s</div>'
                  % (_e(preencabezado), "&#8203;&nbsp;" * 60))

    caja_aviso = ""
    if aviso:
        caja_aviso = ('<table role="presentation" width="100%%" cellpadding="0" '
                      'cellspacing="0" border="0" style="margin:24px 0 0;"><tr>'
                      '<td bgcolor="%s" style="background:%s;'
                      'border-left:3px solid %s;padding:14px 16px;">'
                      '<p style="margin:0;font:400 13px/1.6 %s;color:%s;">%s</p>'
                      '</td></tr></table>'
                      % (AVISO, AVISO, LINEA, TIPO, TENUE, _t(aviso)))

    return """<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>%(titulo)s</title></head>
<body bgcolor="%(lienzo)s" style="margin:0;padding:0;background:%(lienzo)s;">
%(oculto)s
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
       border="0" bgcolor="%(lienzo)s" style="background:%(lienzo)s;">
<tr><td align="center" style="padding:32px 12px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0"
         border="0" bgcolor="%(panel)s"
         style="width:100%%;max-width:600px;background:%(panel)s;
         border:1px solid %(linea)s;border-radius:12px;overflow:hidden;">

    <tr><td align="center" bgcolor="%(cabecera)s"
            style="background:%(cabecera)s;padding:30px 24px 24px;">
      <img src="%(logo)s" width="%(logo_ancho)d" alt="%(marca)s"
           style="display:block;border:0;width:%(logo_ancho)dpx;max-width:70%%;
                  height:auto;font:700 20px/1.2 %(tipo)s;color:#FFFFFF;">
    </td></tr>
    <tr><td bgcolor="%(rojo)s" style="background:%(rojo)s;height:4px;
                   line-height:4px;font-size:0;">&nbsp;</td></tr>

    <tr><td bgcolor="%(panel)s"
            style="padding:34px 36px 30px;background:%(panel)s;">
      <h1 style="margin:0 0 18px;font:700 23px/1.3 %(tipo)s;color:%(tinta)s;
                 letter-spacing:-.01em;">%(titulo)s</h1>
      %(intro)s
      %(filas)s
      %(boton)s
      %(cierre)s
      %(aviso)s
    </td></tr>

    <tr><td bgcolor="%(pie)s" style="background:%(pie)s;
                   border-top:1px solid %(linea)s;padding:22px 36px 26px;">
      <p style="margin:0 0 5px;font:600 13px/1.5 %(tipo)s;
                color:%(texto)s;">%(marca)s</p>
      <p style="margin:0 0 10px;font:400 12px/1.6 %(tipo)s;color:%(tenue)s;">
        Gestión de flota para empresas de transporte &middot;
        <a href="%(sitio)s" style="color:%(tenue)s;text-decoration:underline;"
           >cargoxprez.sisac.pe</a>
      </p>
      <p style="margin:0;font:400 11px/1.6 %(tipo)s;color:#7B828B;">
        Correo automático, no hace falta responder.
        Un producto de Star Insights IT by SISAC.
      </p>
    </td></tr>

  </table>
</td></tr></table>
</body></html>""" % {
        "titulo": _e(titulo), "oculto": oculto, "lienzo": LIENZO,
        "panel": PANEL, "cabecera": CABECERA, "linea": LINEA, "logo": LOGO,
        "logo_ancho": LOGO_ANCHO, "marca": MARCA, "tipo": TIPO,
        "tinta": TINTA, "rojo": ROJO, "texto": TEXTO, "tenue": TENUE,
        "pie": PIE, "sitio": SITIO,
        "intro": _parrafos(intro), "filas": _filas(filas),
        "boton": _boton(boton), "aviso": caja_aviso,
        "cierre": _parrafos(cierre, color=TENUE, tam=14),
    }


def version_texto(titulo, intro=(), filas=(), boton=None, aviso=None,
                  cierre=(), preencabezado=""):
    """La alternativa en texto plano.

    No es un resumen: es el correo entero. Hay clientes que solo pintan texto,
    y los filtros penalizan los mensajes que llegan solo en HTML.
    """
    p = [titulo, "=" * len(titulo), ""]
    if intro:
        p += [str(l) for l in intro] + [""]
    if filas:
        p += ["%s: %s" % (e, v) for e, v in filas] + [""]
    if boton:
        p += ["%s:" % boton["texto"], boton["url"], ""]
    if cierre:
        p += [str(l) for l in cierre] + [""]
    if aviso:
        p += [str(aviso), ""]
    p += ["-" * 44, "%s — %s" % (MARCA, SITIO),
          "Correo automático, no hace falta responder.",
          "Un producto de Star Insights IT by SISAC."]
    return "\n".join(p)


def componer(**kw):
    """Devuelve (texto, html) listos para correo.enviar()."""
    return version_texto(**kw), documento(**kw)
