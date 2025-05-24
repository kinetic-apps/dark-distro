/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Geist', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'sans-serif'],
        'geist': ['Geist', 'sans-serif'],
      },
      fontWeight: {
        'thin': '100',
        'extralight': '200', 
        'light': '300',
        'normal': '400',
        'medium': '500',
        'semibold': '600',
        // Explicitly exclude bold (700) and black (900) to prevent usage
      },
      colors: {
        gray: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
        // iOS-style dark mode colors
        dark: {
          50: '#f8f9fa',
          100: '#f1f3f4',
          200: '#e8eaed',
          300: '#dadce0',
          400: '#9aa0a6',
          500: '#5f6368',
          600: '#3c4043',
          700: '#2d3136',
          800: '#1f2124',
          850: '#1a1d21',
          900: '#161a1d',
          950: '#0f1419',
        },
      },
    },
  },
  plugins: [],
} 