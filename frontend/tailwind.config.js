/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html','./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT:'#E65F2B', dark:'#C2410C', light:'#FFF7ED', mid:'#FDBA74' }, // Warm Coral Brand theme
        fs: {
          green:'#059669', 'green-light':'#ECFDF5',
          amber:'#D97706', 'amber-light':'#FFFBEB',
          red:'#DC2626',   'red-light':'#FEF2F2',
          purple:'#4F46E5','purple-light':'#EEF2FF', // Mapped to Indigo
          teal:'#0D9488',  'teal-light':'#F0FDFA',
        }
      },
      fontFamily: { sans: ['Inter','system-ui','sans-serif'] }
    }
  },
  plugins: []
}
