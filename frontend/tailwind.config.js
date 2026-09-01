/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			// La escala de la marca, sacada del logotipo: el rojo del logo es
  			// exactamente #e00000 y aqui es el 500, que es el tono que el codigo
  			// ya usaba como principal (antes era orange-500). El 600 queda como
  			// el estado :hover, igual que antes, asi que el sistema de
  			// interaccion no cambia: cambia el color.
  			//
  			// Se llama 'marca' y no 'red' a proposito. El rojo de tailwind sigue
  			// existiendo y significa OTRA cosa -documento vencido, llanta
  			// critica, eliminar-, y mezclar las dos escalas en un mismo nombre
  			// era garantizar que un dia una alarma se pintara con el color de un
  			// boton.
  			marca: {
  				50:  '#fff1f1',
  				100: '#ffe0e0',
  				200: '#ffc7c7',
  				300: '#ffa0a0',
  				400: '#ff5a5a',
  				500: '#e00000',
  				600: '#c00000',
  				700: '#9e0303',
  				800: '#830909',
  				900: '#6d0d0d',
  				950: '#3c0303'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			brand: {
  				DEFAULT: 'var(--brand-color)',
  				foreground: '#ffffff'
  			},
  			success: 'hsl(var(--success))',
  			warning: 'hsl(var(--warning))',
  			info: 'hsl(var(--info))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		boxShadow: {
  			card: '0 1px 3px rgba(2, 6, 23, 0.06), 0 1px 2px rgba(2, 6, 23, 0.04)',
  			'card-hover': '0 10px 25px -8px rgba(2, 6, 23, 0.12), 0 4px 10px -4px rgba(2, 6, 23, 0.06)',
  			'brand-glow': '0 8px 20px -6px color-mix(in srgb, var(--brand-color) 45%, transparent)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};