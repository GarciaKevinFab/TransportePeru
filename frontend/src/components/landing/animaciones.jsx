import React, { useEffect, useRef, useState } from 'react';

/**
 * Las tres animaciones de la landing. Sin librerias: un IntersectionObserver,
 * un listener de scroll con requestAnimationFrame y transiciones CSS.
 *
 * REGLA QUE MANDA EN TODO EL ARCHIVO: prefers-reduced-motion apaga las tres.
 * No "las suaviza": las apaga. Quien pide menos movimiento suele pedirlo por
 * mareo o vestibulopatia, y una animacion "sutil" sigue siendo movimiento.
 * Con la preferencia activa todo se pinta ya colocado y los numeros salen
 * escritos.
 *
 * Y la segunda regla: solo se anima transform y opacity. Nada que dispare
 * layout ni paint -ni height, ni top, ni blur animado-, porque esta pagina
 * tiene que ir fina en el celular de un chofer, no solo en la laptop de quien
 * la escribio.
 */

const sinMovimiento = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Sin IntersectionObserver no hay forma de saber cuando revelar, y la unica
// respuesta aceptable es mostrarlo todo ya: contenido invisible por una
// animacion que nunca va a dispararse es el peor fallo posible de esta clase
// de efectos -para el visitante y para el buscador que indexa la pagina-.
const sinObserver = () => typeof IntersectionObserver === 'undefined';

/**
 * Aparicion al entrar en pantalla. Envuelve cualquier cosa:
 *
 *   <Revelado retraso={120}>...</Revelado>
 *
 * Una sola vez y sin volver a esconderse al salir: el efecto "desaparece al
 * subir" convierte la lectura en un juego de escondite.
 *
 * EL ESTADO POR DEFECTO ES VISIBLE. El elemento nace sin clase de ocultacion;
 * es el efecto (ya montado, con observador disponible y sin reduced-motion)
 * el que pone `revelado-espera` y la quita al entrar en pantalla. Si algo
 * falla por el camino, el contenido se ve. Discreto: opacidad + 12 px en
 * 500 ms con la curva de salida del sistema (.revelado, en LandingPage).
 */
export const Revelado = ({ children, retraso = 0, className = '' }) => {
  const ref = useRef(null);
  const [estado, setEstado] = useState('visible'); // 'visible' | 'espera'

  useEffect(() => {
    const el = ref.current;
    if (!el || sinMovimiento() || sinObserver()) return undefined;
    // Si ya esta en pantalla o por encima al montar, no hay nada que revelar.
    const r = el.getBoundingClientRect();
    const alto = window.innerHeight || 0;
    if (r.top < alto * 0.9) return undefined;

    setEstado('espera');
    const io = new IntersectionObserver(
      ([e]) => {
        // Entra... O YA QUEDO POR ENCIMA.
        //
        // Lo segundo no es un adorno: con `isIntersecting` a secas, saltar de
        // golpe -la barra de scroll, la tecla Fin, o llegar por un ancla como
        // #planes- lleva al bloque de "abajo" a "arriba" sin que llegue a
        // intersectar en ningun fotograma. El observador no dispara y el
        // bloque se queda invisible PARA SIEMPRE, aunque el lector pase por
        // encima.
        if (e.isIntersecting || e.boundingClientRect.top <= 0) {
          setEstado('visible');
          io.disconnect();
        }
      },
      // Dispara un poco antes de que el elemento asome del todo, para que la
      // transicion ya este corriendo cuando el ojo llega.
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`revelado ${estado === 'espera' ? 'revelado-espera' : ''} ${className}`}
      style={{ transitionDelay: `${retraso}ms` }}
    >
      {children}
    </div>
  );
};

/**
 * Contador que sube hasta su valor cuando entra en pantalla. Para las cifras
 * de la prueba social: un numero que crece delante del visitante pesa mas que
 * uno que ya estaba escrito.
 */
export const Cifra = ({ valor, className = '' }) => {
  const objetivo = parseInt(valor, 10) || 0;
  const ref = useRef(null);
  const [n, setN] = useState(() => (sinMovimiento() || sinObserver() ? objetivo : 0));
  const [arrancado, setArrancado] = useState(false);

  useEffect(() => {
    if (arrancado || sinMovimiento() || sinObserver() || !ref.current) return undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setArrancado(true);
        io.disconnect();
        const inicio = performance.now();
        const DURACION = 900;
        const paso = (t) => {
          const avance = Math.min((t - inicio) / DURACION, 1);
          // easeOutCubic: frena al llegar, que es lo que hace creible el conteo.
          setN(Math.round(objetivo * (1 - Math.pow(1 - avance, 3))));
          if (avance < 1) requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
      },
      { threshold: 0.5 }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [arrancado, objetivo]);

  return (
    <span ref={ref} className={className}>
      {n}
    </span>
  );
};

/**
 * La captura del panel en perspectiva: nace inclinada hacia atras (rotateX) y
 * se endereza conforme el scroll la acerca al centro de la pantalla. Es el
 * unico efecto "3D" que se gana el sitio: dirige la mirada a la imagen del
 * producto, que es lo que la pagina vende.
 *
 * Escucha scroll con rAF y solo escribe transform, asi que no fuerza layout.
 * El listener se quita al desmontar y ni se instala con reduced-motion.
 */
export const CapturaTilt = ({ children, className = '' }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || sinMovimiento()) return undefined;

    let pedido = 0;
    const colocar = () => {
      pedido = 0;
      const r = el.getBoundingClientRect();
      const alto = window.innerHeight || 1;
      // 0 cuando el centro del elemento esta abajo del todo; 1 cuando llega al
      // centro de la pantalla. Fuera de ese tramo se queda plano.
      const centro = r.top + r.height / 2;
      const avance = Math.min(Math.max(1 - (centro - alto * 0.5) / (alto * 0.6), 0), 1);
      const angulo = 14 * (1 - avance);
      const escala = 0.96 + 0.04 * avance;
      el.style.transform = `rotateX(${angulo.toFixed(2)}deg) scale(${escala.toFixed(3)})`;
    };
    const alScroll = () => {
      if (!pedido) pedido = requestAnimationFrame(colocar);
    };
    colocar();
    window.addEventListener('scroll', alScroll, { passive: true });
    window.addEventListener('resize', alScroll);
    return () => {
      window.removeEventListener('scroll', alScroll);
      window.removeEventListener('resize', alScroll);
      if (pedido) cancelAnimationFrame(pedido);
    };
  }, []);

  return (
    <div style={{ perspective: '1200px' }} className={className}>
      <div ref={ref} style={{ transformOrigin: 'center top', willChange: 'transform' }}>
        {children}
      </div>
    </div>
  );
};
