import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

/* Mide si la fila de pestanas tiene mas contenido del que cabe y por que
   lado, y lo deja en data-desborde para que el CSS pinte el fundido solo en
   el borde que de verdad esconde algo. Se recalcula al desplazar y al
   cambiar de tamano; sin ResizeObserver (navegadores viejos) queda el
   estado inicial, que ya es correcto para la carga. */
const usarDesborde = (ref) => {
  const [desborde, setDesborde] = React.useState('ninguno');
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const medir = () => {
      const sobra = el.scrollWidth - el.clientWidth;
      if (sobra <= 1) return setDesborde('ninguno');
      const izq = el.scrollLeft > 1;
      const der = el.scrollLeft < sobra - 1;
      setDesborde(izq && der ? 'ambos' : izq ? 'izquierda' : der ? 'derecha' : 'ninguno');
    };
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(medir);
      ro.observe(el);
    } else {
      window.addEventListener('resize', medir);
    }
    return () => {
      el.removeEventListener('scroll', medir);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', medir);
    };
  }, [ref]);
  return desborde;
};

const TabsList = React.forwardRef(({ className, ...props }, refExterno) => {
  const refInterno = React.useRef(null);
  const ref = React.useCallback((nodo) => {
    refInterno.current = nodo;
    if (typeof refExterno === 'function') refExterno(nodo);
    else if (refExterno) refExterno.current = nodo;
  }, [refExterno]);
  const desborde = usarDesborde(refInterno);

  return (
    <TabsPrimitive.List
      ref={ref}
      data-desborde={desborde}
      className={cn(
        /* POR QUE LLEVA overflow-x-auto Y max-w-full
           "Informes" tiene seis pestanas y "Ajustes" cinco. En un telefono de
           375 px esa fila mide 922, y como la lista es inline-flex arrastraba
           consigo el ancho de TODA la pagina: la cabecera, el contenido y el
           menu se iban a 922 px y el sistema entero se desplazaba de lado.
           Ahora la fila se queda dentro de la pantalla y son las pestanas las
           que se deslizan, que es lo unico que sobra. El fundido del borde
           (data-desborde) avisa de que hay mas.
           justify-start importa: centradas, la primera pestana nace fuera de
           la vista y nadie sabe que existe. */
        "inline-flex h-auto max-w-full items-center justify-start overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden [-webkit-overflow-scrolling:touch]",
        "data-[desborde=derecha]:[mask-image:linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)]",
        "data-[desborde=izquierda]:[mask-image:linear-gradient(to_left,#000_calc(100%-2.5rem),transparent)]",
        "data-[desborde=ambos]:[mask-image:linear-gradient(to_right,transparent,#000_2.5rem,#000_calc(100%-2.5rem),transparent)]",
        "sm:h-9 sm:justify-center",
        className
      )}
      {...props} />
  );
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      /* min-h-11 y shrink-0: la pestana es una zona tactil como cualquier
         otra, y dentro de una fila deslizable no debe encogerse hasta que
         el texto se parta en dos lineas. */
      "inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium sm:min-h-0 ring-offset-background transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
      className
    )}
    {...props} />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props} />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
