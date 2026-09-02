import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  /* Transicion con propiedades explicitas (nunca `all`), 150 ms con la curva
     de salida del sistema, y el pulsado encoge al 97%: la misma respuesta
     tactil en toda la aplicacion. Con movimiento reducido no encoge. */
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[transform,background-color,box-shadow,color,border-color,opacity] duration-150 ease-[cubic-bezier(.16,1,.3,1)] active:scale-[.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "btn-brand",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      /* Las alturas van de movil hacia arriba, no al reves.
         Un boton de 32 o 36 px es comodo con raton y estrecho con el dedo:
         la guia de zona tactil pide 44. Antes TODOS los tamanos se quedaban
         por debajo, asi que en un telefono se fallaba el "Actualizar" del
         panel o el "Configurar" de facturacion tanto como se acertaba.
         A partir de `sm` (640 px) vuelven a su altura de escritorio, donde
         apretar de mas solo estorba. */
      size: {
        default: "h-11 px-4 py-2 sm:h-9",
        sm: "h-11 rounded-md px-3 text-xs sm:h-8",
        lg: "h-11 rounded-lg px-8 sm:h-10",
        icon: "h-11 w-11 sm:h-9 sm:w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
