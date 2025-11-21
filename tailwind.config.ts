
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				action: {
					primary: 'hsl(var(--action-primary))',
					'primary-foreground': 'hsl(var(--action-primary-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				// Whisperoo Brand Colors
				whisperoo: {
					primary: '#4A6FA5',
					light: '#E8F2FF', 
					accent: '#6B8BC7',
					dark: '#2C4870'
				},
				brand: {
					primary: '#4A6FA5',
					light: '#E8F2FF',
					accent: '#6B8BC7',
					dark: '#2C4870'
				},
				// Updated grays for Whisperoo
				gray: {
					50: '#F8F9FA',
					100: '#F5F6F7',
					200: '#E2E8F0',
					300: '#CBD5E0',
					400: '#A0AEC0',
					500: '#8A8A8A',
					600: '#718096',
					700: '#4A5568',
					800: '#2D3748',
					900: '#1A202C'
				},
				// Legacy colors for backward compatibility
				peach: {
					500: '#F4BFA6'
				},
				// Purple/Indigo mapped to action primary color
				indigo: {
					50: '#E8F0FF',
					100: '#D1E2FF',
					600: '#2E54A5',
					700: '#2E54A5',
					800: '#1E3A73'
				},
				purple: {
					50: '#E8F0FF',
					100: '#D1E2FF',
					600: '#2E54A5',
					700: '#2E54A5',
					900: '#1E3A73'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				'2xl': '1.5rem',
				'3xl': '1.875rem'
			},
			fontFamily: {
				sans: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
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
				},
				'fade-in': {
					'0%': {
						opacity: '0',
						transform: 'translateY(10px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.6s ease-out'
			}
		}
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;
