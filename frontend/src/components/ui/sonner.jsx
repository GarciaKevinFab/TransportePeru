import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(max-width: 640px)')
    const update = () => setIsMobile(mql.matches)
    update()
    mql.addEventListener?.('change', update)
    return () => mql.removeEventListener?.('change', update)
  }, [])
  return isMobile
}

const Toaster = ({
  ...props
}) => {
  const { theme = "system" } = useTheme()
  const isMobile = useIsMobile()

  return (
    <Sonner
      theme={theme}
      richColors
      closeButton
      position={isMobile ? 'top-center' : 'top-right'}
      duration={4000}
      visibleToasts={4}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white/95 group-[.toaster]:text-grafito-900 group-[.toaster]:border group-[.toaster]:border-grafito-200 group-[.toaster]:shadow-xl group-[.toaster]:rounded-xl group-[.toaster]:backdrop-blur-md",
          title: "group-[.toast]:font-semibold group-[.toast]:text-sm",
          description: "group-[.toast]:text-grafito-500 group-[.toast]:text-xs",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-md",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-md",
        },
      }}
      {...props} />
  );
}

export { Toaster, toast }
