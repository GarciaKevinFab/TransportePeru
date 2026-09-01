import React from 'react';
import { Check } from 'lucide-react';

/**
 * Comparativa de planes y preguntas frecuentes de la landing.
 *
 * Van juntas porque responden a lo mismo: la duda de quien ya entendio el
 * producto y esta decidiendo. Las tarjetas de plan venden cada uno por
 * separado; esto contesta lo que de verdad se pregunta -que gano si paso de
 * Gratis a Pro- y lo que frena la firma.
 *
 * Los limites (3 y 20 vehiculos) son los que aplica el backend en
 * LIMITE_VEHICULOS. Si alli cambian, aqui tambien: una cifra anunciada y no
 * aplicada es una promesa que el cliente descubre el dia que quiere pagar mas.
 */

const FILAS = [
  ['Vehículos', 'Hasta 3', 'Hasta 20', 'Sin límite'],
  ['Viajes, viáticos y liquidación de flete', true, true, true],
  ['Llantas, mantenimiento e inventario', true, true, true],
  ['Documentos y alertas de vencimiento', true, true, true],
  ['App del chofer, con modo sin señal', true, true, true],
  ['Guías y facturas para SUNAT', false, true, true],
  ['Detracciones', false, true, true],
  ['Bot de WhatsApp', false, true, true],
  ['Lectura automática de facturas', false, true, true],
  ['Reportes y costo por kilómetro', false, true, true],
  ['Varias empresas en una cuenta', false, false, true],
  ['Integraciones a medida y soporte dedicado', false, false, true],
];

export const ComparativaPlanes = () => (
  <div className="mt-16 overflow-x-auto">
    <table className="w-full min-w-[640px] border-collapse text-sm">
      <caption className="sr-only">Comparación de lo que incluye cada plan</caption>
      <thead>
        <tr className="border-b border-white/10">
          <th scope="col" className="w-2/5 py-4 text-left font-normal text-grafito-400">
            Qué incluye
          </th>
          {['Gratis', 'Pro', 'Empresa'].map((plan) => (
            <th
              key={plan}
              scope="col"
              className={`px-3 py-4 text-center font-heading text-base font-bold tracking-tight ${
                plan === 'Pro' ? 'text-marca-400' : 'text-grafito-200'
              }`}
            >
              {plan}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {FILAS.map(([fila, ...celdas]) => (
          <tr key={fila} className="border-b border-white/5">
            <th scope="row" className="py-3.5 pr-4 text-left font-normal text-grafito-300">
              {fila}
            </th>
            {celdas.map((c, i) => (
              <td key={i} className="px-3 py-3.5 text-center">
                {c === true ? (
                  <Check className="mx-auto h-4 w-4 text-marca-500" aria-label="Incluido" />
                ) : c === false ? (
                  // Un guion y no una cruz: una cruz roja se lee como error, y
                  // esto no es un fallo, es que ese plan no lo trae.
                  <span className="text-grafito-600" aria-label="No incluido">
                    —
                  </span>
                ) : (
                  <span className="text-grafito-200">{c}</span>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const PREGUNTAS = [
  {
    p: '¿Los datos de mi empresa son míos?',
    r: 'Sí. Lo que cargas sigue siendo de tu empresa: puedes exportarlo mientras la cuenta esté activa y puedes pedir que lo eliminemos. No lo usamos para nada que no sea prestarte el servicio, no lo vendemos y no lo cruzamos con el de otras empresas.',
  },
  {
    p: '¿Otra transportista puede ver lo mío?',
    r: 'No, y no depende de que el programa se acuerde de filtrar: la separación la impone la base de datos. Una consulta sin empresa devuelve cero filas, no las de otro cliente.',
  },
  {
    p: '¿Funciona sin señal en carretera?',
    r: 'La app del chofer sí. El checklist, los gastos, los incidentes y las fotos se guardan en el celular y suben solos cuando vuelve la cobertura. El panel de oficina necesita internet.',
  },
  {
    p: '¿Emite comprobantes para SUNAT?',
    r: 'Sí, en los planes Pro y Empresa: guías de transportista y facturas electrónicas, más el control de detracciones. Necesitas tu certificado digital y tus credenciales de SUNAT.',
  },
  {
    p: '¿Qué pasa cuando terminan los 14 días?',
    r: 'Eliges plan. Si no eliges ninguno, la cuenta pasa al plan Gratis con hasta 3 vehículos: no pierdes nada de lo que cargaste ni se te cobra sin avisar. No pedimos tarjeta para probar.',
  },
  {
    p: '¿Mis choferes tienen que aprender a usarlo?',
    r: 'Poco. Entran con su DNI y un PIN de seis dígitos, y la app solo les muestra lo suyo. Si prefieres, también pueden mandar la foto de una factura por WhatsApp y entra al sistema sin instalar nada.',
  },
  {
    p: '¿Cuánto tardo en tenerlo funcionando?',
    r: 'Una tarde. Cargas tus unidades, tus choferes y tus rutas, y ya puedes registrar el primer viaje. Los vencimientos de documentos se cargan una vez y avisan solos desde entonces.',
  },
];

export const Preguntas = () => (
  <div className="mt-10 max-w-3xl divide-y divide-white/5 border-y border-white/5">
    {PREGUNTAS.map(({ p, r }) => (
      // <details> nativo: se abre sin JavaScript, funciona con teclado por
      // defecto y un buscador lo indexa. Un acordeón con estado propio solo
      // añadiría formas de romperlo.
      <details key={p} className="group py-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
          <span className="font-heading text-lg font-bold tracking-tight text-grafito-100">{p}</span>
          <span
            aria-hidden="true"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 text-grafito-400 transition group-open:rotate-45 group-open:border-marca-500/40 group-open:text-marca-400"
          >
            +
          </span>
        </summary>
        <p className="mt-3 max-w-2xl pr-11 text-[15px] leading-relaxed text-grafito-400">{r}</p>
      </details>
    ))}
  </div>
);
