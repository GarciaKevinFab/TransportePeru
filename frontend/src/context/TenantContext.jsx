import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

/**
 * La empresa duena de la direccion por la que se entro, o null.
 *
 * Quien decide es el backend (GET /api/tenant), no el navegador, y es a
 * proposito: las reglas de que subdominio es de un cliente y cual es del
 * servicio -la lista de reservados, el formato, el dominio base- viven en
 * backend/tenant_host.py. Repetirlas aqui garantizaria que un dia dejaran de
 * coincidir, y el sintoma seria de los feos: la landing servida en la
 * direccion de un cliente, o al reves.
 *
 * null NO es un error: es lo que devuelven la landing, fletepro.sisac.pe y el
 * desarrollo en local. Significa "aquí no hay una empresa concreta", y la app
 * se comporta como siempre, resolviendo el inquilino solo por el token.
 */
const TenantContext = createContext({ tenant: null, loading: true });

export const TenantProvider = ({ children }) => {
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    api
      .get('/tenant')
      // Cualquier fallo -404 porque el host no es de nadie, o la red- se trata
      // igual: sin empresa. Es el comportamiento que ya tenia la app antes de
      // que existieran los subdominios, asi que degradar hacia ahi no rompe
      // nada; quedarse cargando para siempre, si.
      .then((r) => vivo && setTenant(r.data))
      .catch(() => vivo && setTenant(null))
      .finally(() => vivo && setLoading(false));
    return () => {
      vivo = false;
    };
  }, []);

  // La pestana del navegador es lo primero que el usuario de un cliente asocia
  // con "su" sistema, y hasta ahora decia el nombre de otra empresa en todas.
  // El titulo estatico de index.html es solo el del producto, para el instante
  // anterior a que /api/tenant responda.
  useEffect(() => {
    if (tenant?.name) document.title = `${tenant.name} | Gestion de Flota`;
  }, [tenant]);

  return (
    <TenantContext.Provider value={{ tenant, loading }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => useContext(TenantContext);

export default TenantContext;
