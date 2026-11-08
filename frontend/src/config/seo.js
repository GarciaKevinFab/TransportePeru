/**
 * Titulo de la pestana de cada pagina publica.
 *
 * El titulo con el que llega cada URL lo pone el SERVIDOR (backend/seo_rutas.py),
 * que es lo que ven los buscadores. Esto solo lo mantiene al navegar dentro de
 * la SPA, donde el index.html no se vuelve a pedir. tests/test_seo.py compara
 * los dos ficheros: si cambias un titulo aqui, cambialo tambien alli.
 */
export const TITULOS = {
  '/': 'Software de gestión de flota para transporte de carga | CargoXprez',
  '/comprar': 'Contratar el plan Pro: S/ 199 al mes | CargoXprez',
  '/registro': 'Crear cuenta gratis | CargoXprez',
  '/login': 'Entrar | CargoXprez',
  '/privacidad': 'Política de privacidad | CargoXprez',
  '/terminos': 'Términos del servicio | CargoXprez',
  '/reclamaciones': 'Libro de Reclamaciones | CargoXprez',
};
