import { useEffect, useRef } from 'react';
import { notificationsApi } from '../services/api';

/**
 * Convierte una VAPID public key en formato base64 URL-safe a Uint8Array,
 * requerido por PushManager.subscribe({ applicationServerKey }).
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Extrae la VAPID public key de la respuesta del backend, tolerando
 * distintas formas de respuesta (objeto o string plano).
 */
function extractVapidKey(data) {
  if (!data) return '';
  if (typeof data === 'string') return data.trim();
  return (
    data.public_key ||
    data.vapid_public_key ||
    data.publicKey ||
    data.vapidPublicKey ||
    data.key ||
    ''
  ).trim();
}

/**
 * usePush — registra la suscripción de Web Push del navegador contra el backend.
 *
 * - Verifica soporte (serviceWorker + PushManager).
 * - Pide permiso de notificaciones (solo si aún no fue decidido).
 * - Obtiene el registration del service worker.
 * - Es idempotente: reutiliza la suscripción existente si ya la hay.
 * - Obtiene la VAPID public key, la convierte y crea la suscripción.
 * - Envía la suscripción al backend con notificationsApi.subscribe.
 * - Maneja todos los errores en silencio (nunca rompe la app).
 */
export const usePush = () => {
  const attempted = useRef(false);

  useEffect(() => {
    // Solo intentamos una vez por montaje para no spamear al backend.
    if (attempted.current) return;
    attempted.current = true;

    const setupPush = async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          return;
        }
        if (typeof Notification === 'undefined') {
          return;
        }

        // Pedir permiso solo si el usuario aún no lo decidió.
        let permission = Notification.permission;
        if (permission === 'default') {
          permission = await Notification.requestPermission();
        }
        if (permission !== 'granted') {
          return;
        }

        // Obtener el service worker registrado (registrado por el arranque de la PWA).
        const registration = await navigator.serviceWorker.ready;

        // Idempotente: si ya existe una suscripción, no re-suscribir.
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          const res = await notificationsApi.getVapidKey();
          const key = extractVapidKey(res?.data);
          if (!key) return;

          const applicationServerKey = urlBase64ToUint8Array(key);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });
        }

        // Registrar/actualizar la suscripción en el backend.
        // El backend espera el objeto envuelto como { subscription }.
        await notificationsApi.subscribe({ subscription: subscription.toJSON() });
      } catch (err) {
        // Silencio intencional: push es una mejora opcional, nunca debe romper la app.
      }
    };

    setupPush();
  }, []);
};

export default usePush;
