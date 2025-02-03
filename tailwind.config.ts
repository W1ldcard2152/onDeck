import type { Config } from "tailwindcss";



export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'navy': {
          900: '#1a1f2c'}
      },
    },
  },
  plugins: [],
} satisfies Config;
