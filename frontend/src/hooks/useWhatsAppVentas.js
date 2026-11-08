import { useEffect, useState } from 'react';
import api from '../services/api';

/**
 * El WhatsApp de ventas, o null si no hay.
 *
 * El numero NO esta en el codigo: lo da el backend (variable WHATSAPP_VENTAS,
 * GET /api/config/publica). Sin variable la respuesta es null y ningun boton
 * de WhatsApp se pinta.
 *
 * Se pide una vez por carga de pagina y se comparte entre todos los botones.
 * Se vuelve a validar el formato aqui porque el service worker contesta
 * {error: 'offline'} con un 200 cuando no hay red, y eso no es un numero.
 */
let pendiente = null;

const pedir = () => {
  if (!pendiente) {
    pendiente = api
      .get('/config/publica')
      .then(({ data }) => {
        const n = data && data.whatsapp_ventas;
        return typeof n === 'string' && /^51\d{9}$/.test(n) ? n : null;
      })
      .catch(() => {
        pendiente = null; // se reintenta en la siguiente pagina
        return null;
      });
  }
  return pendiente;
};

export const useWhatsAppVentas = () => {
  const [numero, setNumero] = useState(null);
  useEffect(() => {
    let vivo = true;
    pedir().then((n) => vivo && setNumero(n));
    return () => {
      vivo = false;
    };
  }, []);
  return numero;
};

/** El enlace wa.me/<numero>?text=... con el mensaje ya escrito. */
export const enlaceWhatsApp = (numero, mensaje) =>
  `https://wa.me/${numero}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`;
