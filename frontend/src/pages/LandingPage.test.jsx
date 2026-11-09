/**
 * La portada se monta, dice lo que promete y no arrastra el panel.
 *
 * Sin @testing-library a proposito: react-dom y el act de React bastan para
 * esto, y no hace falta sumar dependencias solo para una prueba.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import fs from 'fs';
import path from 'path';
import LandingPage from './LandingPage';
import { adoptarPrerender } from '../lib/prerender';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const montar = () => {
  const root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
  const reactRoot = createRoot(root);
  act(() => {
    reactRoot.render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
  });
  return { root, reactRoot };
};

afterEach(() => {
  document.body.innerHTML = '';
});

test('la portada muestra la propuesta, los planes y las preguntas frecuentes', () => {
  const { root, reactRoot } = montar();
  const texto = root.textContent;
  expect(root.querySelector('h1').textContent).toMatch(/Tu flota ya genera los datos/);
  expect(texto).toContain('S/ 199');
  expect(texto).toContain('Hasta 3 vehículos');
  expect(texto).toContain('Cómo se contrata');
  expect(texto).toContain('¿Necesito tarjeta para probar?');
  act(() => reactRoot.unmount());
});

test('el enlace de la cabecera dice a donde lleva', () => {
  const { root, reactRoot } = montar();
  const enlaces = [...root.querySelectorAll('a[href="/registro"]')].map((a) => a.textContent.trim());
  expect(enlaces.length).toBeGreaterThan(0);
  enlaces.forEach((t) => expect(t).not.toBe('Empezar'));
  act(() => reactRoot.unmount());
});

test('las imagenes de la portada llevan width y height', () => {
  const { root, reactRoot } = montar();
  root.querySelectorAll('img').forEach((img) => {
    expect(img.getAttribute('width')).toBeTruthy();
    expect(img.getAttribute('height')).toBeTruthy();
  });
  act(() => reactRoot.unmount());
});

test('el texto del servidor se quita cuando la portada de React ya esta pintada', () => {
  const root = document.createElement('div');
  root.id = 'root';
  root.innerHTML = '<div class="pre" data-prerender="1"><h1>Del servidor</h1></div>';
  document.body.appendChild(root);

  expect(adoptarPrerender(root)).toBe(true);
  // Mientras React monta, el bloque queda a la vista fuera de #root.
  expect(root.hidden).toBe(true);
  expect(document.querySelector('[data-prerender]')).not.toBeNull();

  const reactRoot = createRoot(root);
  act(() => {
    reactRoot.render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
  });
  expect(document.querySelector('[data-prerender]')).toBeNull();
  expect(root.hidden).toBe(false);
  act(() => reactRoot.unmount());
});

test('App.js no importa de golpe las pantallas del panel', () => {
  const fuente = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');
  const estaticos = [...fuente.matchAll(/^import (\w+) from '\.\/(pages|layouts)\//gm)].map((m) => m[1]);
  expect(estaticos).toEqual(['LandingPage']);
});

test('PostHog no se carga desde index.html', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  expect(html).not.toMatch(/posthog\.init/);
  expect(html).not.toMatch(/static\/array\.js/);
});
