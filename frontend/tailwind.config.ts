import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0A5C26', foreground: '#ffffff' },
        secondary: { DEFAULT: '#f1f5f9', foreground: '#0A0B19' },
        muted: { DEFAULT: '#f8fafc', foreground: '#586A6E' },
        accent: { DEFAULT: '#50AD33', foreground: '#ffffff' },
        destructive: { DEFAULT: '#ef4444', foreground: '#ffffff' },
        border: '#dce5e8',
        input: '#dce5e8',
        ring: '#0A5C26',
        background: '#E4EDF7',
        foreground: '#0A0B19',
        card: { DEFAULT: '#ffffff', foreground: '#0A0B19' },
        popover: { DEFAULT: '#ffffff', foreground: '#0A0B19' },
        success: '#50AD33',
        warning: '#FFA50F',
        error: '#ef4444',
        sidebar: { DEFAULT: '#00300F', foreground: '#E4EDF7', accent: '#0A5C26' },
        gibbs: {
          dark: '#00300F',
          primary: '#0A5C26',
          bright: '#50AD33',
          lime: '#72B529',
          orange: '#FFA50F',
          light: '#E4EDF7',
          text: '#0A0B19',
          muted: '#313233',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
