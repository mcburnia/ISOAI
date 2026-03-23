import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0F3D7C', foreground: '#ffffff' },
        secondary: { DEFAULT: '#F5F7FA', foreground: '#2D3748' },
        muted: { DEFAULT: '#F5F7FA', foreground: '#718096' },
        accent: { DEFAULT: '#0EA5E9', foreground: '#ffffff' },
        destructive: { DEFAULT: '#E53E3E', foreground: '#ffffff' },
        border: '#E6EAEE',
        input: '#E6EAEE',
        ring: '#0F3D7C',
        background: '#F5F7FA',
        foreground: '#2D3748',
        card: { DEFAULT: '#ffffff', foreground: '#2D3748' },
        popover: { DEFAULT: '#ffffff', foreground: '#2D3748' },
        success: '#22C55E',
        warning: '#DD6B20',
        error: '#E53E3E',
        sidebar: { DEFAULT: '#0F3D7C', foreground: '#F5F7FA', accent: '#2E4A71' },
        kmi: {
          dark: '#0F3D7C',
          primary: '#2E4A71',
          bright: '#0EA5E9',
          indigo: '#2E4A71',
          orange: '#DD6B20',
          light: '#F5F7FA',
          text: '#2D3748',
          muted: '#718096',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
