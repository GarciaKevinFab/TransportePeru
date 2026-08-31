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
 * FletePro es la MARCA del producto; SOLUCIONES INFORMATICAS MDD S.A.C. es la
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
  producto: 'FletePro',
  // Marca registrada ante INDECOPI a nombre de la empresa. Decirlo por escrito
  // en la web no es presumir: es lo que constituye el aviso publico de que la
  // marca esta protegida, y lo que hace falta alegar despues si alguien la usa.
  marcaRegistrada: 'CargoXprez',
};

/** El aviso de marca, para el pie y los textos legales. */
export const AVISO_DE_MARCA =
  `${PROVEEDOR.marcaRegistrada}® es marca registrada de ${PROVEEDOR.razonSocial} ` +
  'ante INDECOPI (Perú). Todos los derechos reservados.';

/** "FletePro, servicio de SOLUCIONES INFORMÁTICAS MDD S.A.C. (RUC 20490042068)" */
export const proveedorEnUnaLinea = () =>
  `${PROVEEDOR.producto}, servicio de ${PROVEEDOR.razonSocial} (RUC ${PROVEEDOR.ruc})`;
