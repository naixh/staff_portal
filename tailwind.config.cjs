/** @type {import('tailwindcss').Config} */
const { heroui } = require("@heroui/react");

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            background: "hsl(0 0% 100%)", // White background
            foreground: "hsl(210 22% 10%)", // Dark grey text
            default: {
              DEFAULT: "hsl(210 22% 85%)",
              foreground: "hsl(210 22% 30%)",
            },
            primary: {
              DEFAULT: "hsl(40 80% 60%)", // Warm golden beige
              foreground: "hsl(0 0% 100%)", // White text on primary
            },
          },
        },
        dark: {
          colors: {
            background: "hsl(210 22% 10%)", // Dark background
            foreground: "hsl(0 0% 98%)", // Light text
            default: {
              DEFAULT: "hsl(210 22% 20%)",
              foreground: "hsl(0 0% 90%)",
            },
            primary: {
              DEFAULT: "hsl(40 80% 50%)", // Slightly darker golden beige for dark mode
              foreground: "hsl(0 0% 100%)",
            },
          },
        },
      },
    }),
  ],
};
