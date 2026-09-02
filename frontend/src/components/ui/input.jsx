import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        /* Los campos median 34 px de alto en el telefono. En un formulario de
         once campos como el de "Nuevo vehiculo", eso es once objetivos
         estrechos seguidos: se acierta en el de al lado y se escribe la
         marca en el modelo. Igual que los botones, 44 en movil y 36 a
         partir de `sm`. */
      "flex h-11 sm:h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-[color,box-shadow,border-color] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-grafito-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:border-brand disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
