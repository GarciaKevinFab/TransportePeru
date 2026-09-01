/**
 * Quien presta el servicio, en un solo sitio.
 *
 * Estos datos NO son decorativos: la Ley 29571 obliga a que el Libro de
 * Reclamaciones identifique al proveedor -razon social, RUC y domicilio-, y
 * los terminos y la politica de privacidad tienen que decir con quien
 * contrata el cliente y a quien reclama. Antes vivian repetidos en tres
 * paginas como texto suelto, que es la forma segura de que un dia digan
 * cosas distintas.
 *
 * CargoXprez es la MARCA del producto; SOLUCIONES INFORMATICAS MDD S.A.C. es la
 * empresa que responde por el. Star Insights IT y SISAC son marcas de la misma
 * casa y se quedan donde son un credito de autoria, no una identificacion
 * legal.
 */
export const PROVEEDOR = {
  razonSocial: 'SOLUCIONES INFORMÁTICAS MDD S.A.C.',
  ruc: '20490042068',
  // Domicilio fiscal segun la ficha RUC. Va completo a proposito: "Puerto
  // Maldonado" a secas no identifica un domicilio para una reclamacion.
  domicilio: 'Av. Madre de Dios N° 1087, Dpto. 201, A.H. Huerto Familiar, Tambopata, Madre de Dios, Perú',
  ciudad: 'Puerto Maldonado, Madre de Dios',
  telefono: '(082) 573844',
  email: 'soporte@sisac.pe',
  web: 'https://sisac.pe',
  // El producto. Se separa de la razon social porque el cliente conoce esto,
  // no aquello.
  producto: 'CargoXprez',
};

/**
 * La marca, con los datos de su registro.
 *
 * Salen del Certificado N° 00165238 de INDECOPI (Resolucion 012389-2025/DSD,
 * 15 de abril de 2025). Se citan tal cual y no de memoria: un aviso de marca
 * que exagera lo que protege es peor que no ponerlo, porque es lo primero que
 * desmonta quien la use.
 *
 * DOS COSAS QUE CONVIENE TENER DELANTE, y por eso estan aqui y no solo en el
 * certificado guardado en un cajon:
 *
 *   - La titularidad es de TRES PERSONAS NATURALES, no de la empresa. Por eso
 *     el aviso NO dice "marca de SOLUCIONES INFORMATICAS MDD S.A.C.": diria
 *     algo que el registro no respalda. Que la titular sea la empresa es una
 *     cesion inscrita ante INDECOPI, no una frase en una web.
 *   - La clase 39 cubre transporte, embalaje, almacenamiento y organizacion de
 *     viajes. NO cubre software, que seria la clase 42. Usar la marca para
 *     nombrar este producto es legitimo, pero no esta protegida en esa clase.
 */
export const MARCA = {
  nombre: 'CargoXprez',
  certificado: 'N° 00165238',
  clase: 39,
  vigenciaHasta: '15 de abril de 2035',
};

/** El aviso de marca, para el pie y los textos legales. */
export const AVISO_DE_MARCA =
  `${MARCA.nombre}® es marca registrada ante INDECOPI (Certificado ` +
  `${MARCA.certificado}, clase ${MARCA.clase}), vigente hasta el ` +
  `${MARCA.vigenciaHasta}. Todos los derechos reservados.`;

/** "CargoXprez, servicio de SOLUCIONES INFORMÁTICAS MDD S.A.C. (RUC 20490042068)" */
export const proveedorEnUnaLinea = () =>
  `${PROVEEDOR.producto}, servicio de ${PROVEEDOR.razonSocial} (RUC ${PROVEEDOR.ruc})`;
