import { cn } from "@/lib/utils"

/* Bloque de esqueleto. Tinte del grafito de la casa: en claro un gris
   calido; en oscuro un gris claro al 10%, nunca blanco puro. */
function Skeleton({
  className,
  ...props
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-grafito-900/[0.07] dark:bg-grafito-100/10", className)}
      {...props} />
  );
}

export { Skeleton }
