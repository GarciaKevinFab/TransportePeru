import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { suscripcionApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Aviso del plan Gratis, arriba de cada pantalla de la cuenta.
 *
 * Sin pago vigente (prueba vencida, o un plan vencido tras la gracia) la
 * empresa no queda en solo consulta: pasa al plan Gratis, con hasta 3
 * vehiculos activos y sin las funciones del plan Pro (suscripciones.plan_efectivo
 * y _exigir_suscripcion_al_dia en el backend). Este aviso lo dice, y si hay mas
 * de 3 vehiculos activos explica la regla: se consulta todo, y para registrar
 * algo nuevo hay que dejar 3 activos o activar el plan Pro.
 *
 * Se vuelve a preguntar al cambiar de pantalla: marcar un vehiculo como fuera
 * de servicio cambia la cuenta.
 */
const GESTORES = ['owner', 'admin'];

const AvisoPlanGratis = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    if (!user || user.role === 'superadmin') return undefined;
    let vivo = true;
    suscripcionApi
      .plan()
      .then(({ data }) => vivo && setPlan(data))
      .catch(() => vivo && setPlan(null));
    return () => { vivo = false; };
  }, [user, pathname]);

  if (!plan?.gratis) return null;
  const gestor = GESTORES.includes(user?.role);

  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-3 border-b px-4 py-3 text-sm md:px-6 ${
        plan.excedido
          ? 'border-amber-300 bg-amber-50 text-amber-900'
          : 'border-sky-200 bg-sky-50 text-sky-900'
      }`}
      data-testid="aviso-plan-gratis"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        {plan.excedido ? (
          <>
            <strong>Tu empresa está en el plan Gratis</strong>, que admite hasta {plan.tope_gratis} vehículos
            activos, y tienes {plan.activos}. Puedes consultar todo; para registrar algo nuevo, marca como
            Fuera de servicio los que no uses hasta dejar {plan.tope_gratis} activos, o activa el plan Pro.
            No se borra nada.
          </>
        ) : (
          <>
            <strong>Tu empresa está en el plan Gratis</strong>: hasta {plan.tope_gratis} vehículos activos,
            sin SUNAT, detracciones, bot de WhatsApp, lectura automática de facturas ni reportes. Tus datos
            siguen todos ahí.
          </>
        )}
      </p>
      {gestor && (
        <Link
          to="/comprar?plan=pro"
          className="shrink-0 rounded-full bg-marca-500 px-4 py-1.5 font-bold text-white transition hover:bg-marca-400"
          data-testid="aviso-plan-gratis-comprar"
        >
          Activar el plan Pro
        </Link>
      )}
    </div>
  );
};

export default AvisoPlanGratis;
