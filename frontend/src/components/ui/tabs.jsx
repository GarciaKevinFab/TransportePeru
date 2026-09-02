import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      /* POR QUE LLEVA overflow-x-auto Y max-w-full
         "Informes" tiene seis pestanas y "Ajustes" cinco. En un telefono de
         375 px esa fila mide 922, y como la lista es inline-flex arrastraba
         consigo el ancho de TODA la pagina: la cabecera, el contenido y el
         menu se iban a 922 px y el sistema entero se desplazaba de lado.
         Ahora la fila se queda dentro de la pantalla y son las pestanas las
         que se deslizan, que es lo unico que sobra.
         justify-start importa: centradas, la primera pestana nace fuera de
         la vista y nadie sabe que existe. */
      "inline-flex h-auto max-w-full items-center justify-start overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground",
      "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      "sm:h-9 sm:justify-center sm:overflow-visible",
      className
    )}
    {...props} />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      /* min-h-11 y shrink-0: la pestana es una zona tactil como cualquier
         otra, y dentro de una fila deslizable no debe encogerse hasta que
         el texto se parta en dos lineas. */
      "inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium sm:min-h-0 ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
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
