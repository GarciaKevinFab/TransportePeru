import React from 'react';
import { Link } from 'react-router-dom';
import { PROVEEDOR, MARCA } from '../config/proveedor';
import { ArrowLeft } from 'lucide-react';
import LogoMarca from '../components/LogoMarca';

/**
 * Privacidad y Términos.
 *
 * No existían, y no es un detalle de formulario: CargoXprez trata datos
 * personales de gente que NO es su cliente —los choferes de la transportista:
 * su DNI, su licencia, sus fotos— y la Ley 29733 de Protección de Datos
 * Personales obliga a decir qué se recoge, para qué y por cuánto tiempo.
 *
 * El texto describe lo que el sistema hace DE VERDAD, contrastado con el
 * esquema: users (dni, licencia, teléfono, whatsapp_number, epp), documentos
 * con vencimientos, fotos de facturas y guías, y los mensajes del bot. Una
 * política copiada de una plantilla que prometiera otra cosa sería peor que no
 * tenerla: una declaración falsa por escrito.
 *
 * Las dos secciones van en un archivo porque comparten marco y se enlazan entre
 * sí constantemente.
 */

const ACTUALIZADO = '31 de agosto de 2026';

const Marco = ({ titulo, children }) => (
  <div className="min-h-screen bg-slate-950 text-slate-100">
    <header className="border-b border-white/5">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center">
          <LogoMarca className="h-14 w-auto" />
        </Link>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </div>
    </header>

    <main className="mx-auto w-full max-w-3xl px-6 py-12 pb-24">
      <h1 className="font-heading text-3xl font-black uppercase tracking-tight sm:text-4xl">
        {titulo}
      </h1>
      <p className="mt-3 text-sm text-slate-500">Última actualización: {ACTUALIZADO}</p>

      {/* Estilos de prosa a mano: el proyecto no trae @tailwindcss/typography, y
          sumar una dependencia entera por dos páginas de texto no se sostiene. */}
      <div
        className="mt-10 text-[15px] leading-relaxed text-slate-300
                   [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-100
                   [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:tracking-tight
                   [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:list-disc
                   [&_strong]:text-slate-100 [&_strong]:font-semibold
                   [&_a]:text-marca-400 [&_a]:underline [&_a]:underline-offset-4"
      >
        {children}
      </div>

      <footer className="mt-16 border-t border-white/5 pt-6 text-sm text-slate-500">
        ¿Dudas sobre esto? Escríbenos a{' '}
        <a href="mailto:soporte@sisac.pe" className="text-marca-400 underline underline-offset-4">
          soporte@sisac.pe
        </a>
        .
        {/* El Libro de Reclamaciones va aqui tambien: la ley pide que se llegue
            a el desde cualquier punto de la web, y quien esta leyendo las
            condiciones es justo quien puede necesitarlo. */}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/privacidad" className="hover:text-slate-300">Privacidad</Link>
          <Link to="/terminos" className="hover:text-slate-300">Términos</Link>
          <Link to="/reclamaciones" className="hover:text-slate-300">Libro de Reclamaciones</Link>
          <Link to="/" className="hover:text-slate-300">Inicio</Link>
        </div>
      </footer>
    </main>
  </div>
);

export const PrivacidadPage = () => (
  <Marco titulo="Política de privacidad">
    <p>
      {PROVEEDOR.producto} es un servicio de <strong>{PROVEEDOR.razonSocial}</strong> (RUC{' '}
      {PROVEEDOR.ruc}), con domicilio en {PROVEEDOR.domicilio}, para empresas de
      transporte en Perú. Esta política explica qué datos tratamos, para qué y
      durante cuánto tiempo, conforme a la Ley 29733 de Protección de Datos
      Personales y su reglamento.
    </p>
    <p>
      {/* Quien es el responsable del tratamiento tiene que estar dicho con
          nombre y RUC: es a quien se le ejercen los derechos ARCO, y sin eso
          la politica no sirve para ejercerlos. */}
      A efectos de la Ley 29733, el <strong>responsable del tratamiento</strong> es{' '}
      {PROVEEDOR.razonSocial}, y puedes dirigirte a nosotros en{' '}
      <a href={`mailto:${PROVEEDOR.email}`}>{PROVEEDOR.email}</a> o al {PROVEEDOR.telefono}.
    </p>

    <h2>Quién responde por cada dato</h2>
    <p>
      Hay una distinción que importa. La <strong>empresa de transporte</strong> que
      contrata CargoXprez es la responsable de los datos que carga: los de sus
      choferes, sus vehículos y sus operaciones. Nosotros los tratamos por
      encargo suyo, como proveedores del sistema donde viven.
    </p>
    <p>
      De los datos de la <strong>cuenta</strong> —quién contrata, su correo, su
      RUC— sí respondemos directamente.
    </p>

    <h2>Qué datos se tratan</h2>
    <p>De la empresa y de quien la administra:</p>
    <ul>
      <li>Razón social, RUC, dirección, teléfono y correo.</li>
      <li>Nombre, correo y contraseña, guardada cifrada y nunca en texto legible.</li>
    </ul>
    <p>De los choferes y del personal que la empresa registra:</p>
    <ul>
      <li>Nombre, DNI, teléfono y número de WhatsApp.</li>
      <li>Número de licencia de conducir y su fecha de vencimiento.</li>
      <li>PIN de acceso a la aplicación del chofer, también cifrado.</li>
      <li>Equipo de protección personal asignado.</li>
      <li>
        Fotos y documentos que suben durante la operación: checklists, facturas,
        guías, incidentes y gastos.
      </li>
      <li>Mensajes al bot de WhatsApp, cuando la empresa activa esa función.</li>
    </ul>

    <h2>Para qué</h2>
    <ul>
      <li>Prestar el servicio: viajes, liquidaciones, mantenimiento y documentos.</li>
      <li>Avisar de vencimientos —SOAT, revisión técnica, licencias— antes de que caduquen.</li>
      <li>Emitir comprobantes electrónicos ante SUNAT cuando la empresa lo usa.</li>
      <li>Dar soporte y devolver el acceso a quien olvida su contraseña.</li>
    </ul>
    <p>
      <strong>No vendemos datos a nadie, no los usamos para publicidad</strong> y no
      los cruzamos con los de otras empresas clientes.
    </p>

    <h2>Cómo se separan los datos de una empresa de los de otra</h2>
    <p>
      Cada empresa ve únicamente lo suyo. Esa separación no depende de que el
      programa se acuerde de filtrar: la impone la propia base de datos, de modo
      que una consulta sin empresa devuelve cero filas en lugar de las de otro
      cliente.
    </p>

    <h2>Con quién se comparten</h2>
    <ul>
      <li><strong>SUNAT</strong>, cuando la empresa emite comprobantes electrónicos.</li>
      <li>
        <strong>Proveedores de infraestructura</strong>, que alojan el servicio y
        entregan los correos y los mensajes de WhatsApp.
      </li>
      <li><strong>Autoridades</strong>, ante un requerimiento legal válido.</li>
    </ul>

    <h2>Cuánto tiempo se conservan</h2>
    <p>
      Mientras la empresa tenga cuenta activa. Al cerrarla se eliminan, salvo lo
      que la ley obligue a conservar: la documentación tributaria tiene sus
      propios plazos. Los enlaces de recuperación de contraseña caducan a los 30
      minutos y se borran solos.
    </p>

    <h2>Tus derechos</h2>
    <p>
      Puedes acceder a tus datos, rectificarlos, cancelarlos u oponerte a su
      tratamiento. Si eres chofer de una empresa que usa CargoXprez, lo más rápido
      es pedírselo a tu empresa, que es quien los administra; si prefieres,
      escríbenos y lo canalizamos.
    </p>
    <p>
      Para cualquiera de estas cosas:{' '}
      <a href="mailto:soporte@sisac.pe">soporte@sisac.pe</a>.
    </p>

    <h2>Cambios</h2>
    <p>
      Si esto cambia de forma relevante lo avisamos dentro del sistema antes de
      que aplique. La fecha de arriba dice cuándo se actualizó por última vez.
    </p>
  </Marco>
);

export const TerminosPage = () => (
  <Marco titulo="Términos del servicio">
    <p>
      Al crear una cuenta en CargoXprez aceptas estas condiciones. Están escritas
      para entenderse; si algo no queda claro, pregúntanos antes de contratar.
    </p>

    <h2>Qué es el servicio</h2>
    <p>
      CargoXprez es un sistema en la nube para gestionar flotas de transporte:
      viajes, combustible, llantas, mantenimiento, documentos y comprobantes. Se
      presta como servicio; no se entrega ni se licencia el programa.
    </p>

    <h2>Tu cuenta</h2>
    <ul>
      <li>Los datos que registras deben ser reales, empezando por el RUC.</li>
      <li>
        Respondes por lo que ocurra con tus credenciales. Si crees que alguien
        más las tiene, cámbialas de inmediato.
      </li>
      <li>
        Cada persona debe tener su propio usuario. Compartir una cuenta hace
        imposible saber quién hizo qué, que es medio sentido de llevar registro.
      </li>
    </ul>

    <h2>Planes y pagos</h2>
    <ul>
      <li>La prueba dura <strong>14 días</strong>, sin tarjeta y sin compromiso.</li>
      <li>
        Al terminar eliges plan. <strong>Gratis</strong> admite hasta 3 vehículos;{' '}
        <strong>Pro</strong>, hasta 20; <strong>Empresa</strong> se acuerda según el caso.
      </li>
      <li>
        Los planes se cobran por adelantado. Si dejas de pagar, la cuenta pasa a
        solo lectura antes de suspenderse: no vas a perder tus datos por un
        retraso.
      </li>
      <li>Los precios pueden cambiar avisando con 30 días de antelación.</li>
    </ul>

    {/* Devoluciones. Vender en linea en Peru obliga a publicar las condiciones
        de reversion del pago ANTES de cobrar -es informacion relevante segun la
        Ley 29571- y la pasarela (Izipay) revisa que la web la tenga antes de
        activar el comercio. Sin esto no hay cobro con tarjeta.

        El texto describe lo que el negocio hace de verdad: 14 dias de prueba
        sin tarjeta, cobro mensual por adelantado, y ningun prorrateo. Prometer
        una devolucion mas generosa de la que se va a cumplir seria un
        incumplimiento por escrito. */}
    <h2>Devoluciones y reembolsos</h2>
    <p>
      Antes que nada: <strong>los 14 días de prueba son la devolución</strong>. No
      pedimos tarjeta ni cobramos nada hasta que eliges plan, así que nadie
      compra a ciegas. Cuando llegas al pago ya sabes exactamente qué estás
      pagando.
    </p>
    <p>Aun así, esto es lo que aplica una vez que hay un cobro:</p>
    <ul>
      <li>
        <strong>Desistimiento.</strong> Dentro de los <strong>7 días naturales</strong>{' '}
        desde tu primer pago, si no has usado el servicio de forma sustancial,
        te devolvemos el importe íntegro del mes en curso.
      </li>
      <li>
        <strong>Cancelación.</strong> Puedes cancelar cuando quieras. El servicio
        sigue funcionando hasta que termine el periodo que ya pagaste y no se
        cobra el siguiente. Los meses empezados no se prorratean, salvo el caso
        de desistimiento de arriba.
      </li>
      <li>
        <strong>Cobros duplicados o erróneos.</strong> Se devuelven íntegros
        siempre, sin plazo. Si te cobramos algo que no correspondía, el error es
        nuestro y se corrige.
      </li>
    </ul>
    <p>
      Para pedir una devolución escríbenos a{' '}
      <a href="mailto:soporte@sisac.pe">soporte@sisac.pe</a> indicando el correo
      de la cuenta y el cobro en cuestión. Respondemos en un plazo máximo de{' '}
      <strong>15 días hábiles</strong> y la devolución se hace por el mismo medio
      de pago con el que se cobró.
    </p>
    <p>
      Nada de esto recorta los derechos que te da el{' '}
      <strong>Código de Protección y Defensa del Consumidor (Ley 29571)</strong>.
      Si no quedas conforme con nuestra respuesta, puedes dejarlo por escrito en
      el <Link to="/reclamaciones">Libro de Reclamaciones</Link>.
    </p>

    <h2>Tus datos son tuyos</h2>
    <p>
      Lo que cargas sigue siendo de tu empresa. Puedes exportarlo mientras la
      cuenta esté activa, y puedes pedir que lo eliminemos. No lo usamos para
      nada que no sea prestarte el servicio.
    </p>

    <h2>Uso aceptable</h2>
    <p>
      No se puede usar CargoXprez para actividades ilegales, ni intentar acceder a
      datos de otras empresas, ni sobrecargar el sistema a propósito. Una cuenta
      que haga eso se suspende.
    </p>

    <h2>Disponibilidad y límites</h2>
    <p>
      Trabajamos para que el servicio esté siempre disponible, pero no podemos
      garantizar que nunca falle: hay mantenimientos, y hay cosas que dependen de
      terceros —SUNAT, WhatsApp, tu conexión—.
    </p>
    <p>
      CargoXprez es una herramienta de gestión, <strong>no un sustituto de tus
      obligaciones legales</strong>. Los avisos de vencimiento ayudan, pero tener
      el SOAT al día y la documentación en regla sigue siendo responsabilidad de
      la empresa.
    </p>

    <h2>Cancelación</h2>
    <p>
      Puedes cancelar cuando quieras, sin penalidad. Al cancelar dispones de un
      plazo razonable para exportar tu información antes de que se elimine.
    </p>

    <h2>Ley aplicable</h2>
    <p>Estos términos se rigen por las leyes de la República del Perú.</p>

    <h2>Marcas y propiedad intelectual</h2>
    <p>
      {/* El aviso de marca va en los terminos y no solo en el pie: aqui es
          donde el cliente acepta que el uso del servicio no le transfiere
          ningun derecho sobre ella. */}
      <strong>{MARCA.nombre}®</strong> es marca registrada ante INDECOPI
      (Certificado {MARCA.certificado}, clase {MARCA.clase} de la Clasificación
      de Niza), vigente hasta el {MARCA.vigenciaHasta}. El software, la marca,
      el logotipo y los contenidos del servicio están protegidos. Contratar el
      servicio te da derecho a usarlo mientras dure tu plan, no a usar la marca
      ni a copiar el software.
    </p>
    <p>
      Lo que cargas tú —tus viajes, tu flota, tus documentos, tus fotos— sigue
      siendo tuyo. Ver <Link to="/privacidad">política de privacidad</Link>.
    </p>

    <h2>Quién presta el servicio</h2>
    <p>
      {/* Con quien contrata el cliente, dicho donde se pueda encontrar. Es lo
          que exige identificar la Ley 29571, y lo primero que mira una
          pasarela de pago al validar el comercio. */}
      <strong>{PROVEEDOR.razonSocial}</strong>, RUC {PROVEEDOR.ruc}, con domicilio en{' '}
      {PROVEEDOR.domicilio}. Teléfono {PROVEEDOR.telefono}.
    </p>

    <h2>Contacto</h2>
    <p>
      <a href={`mailto:${PROVEEDOR.email}`}>{PROVEEDOR.email}</a> —{' '}
      {PROVEEDOR.razonSocial}. Ver también la{' '}
      <Link to="/privacidad">política de privacidad</Link> y el{' '}
      <Link to="/reclamaciones">Libro de Reclamaciones</Link>.
    </p>
  </Marco>
);
