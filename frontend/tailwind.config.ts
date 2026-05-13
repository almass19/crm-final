import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#197fe6",
          50:  "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          400: "#60a5fa",
          600: "#1a6cc7",
          700: "#1558a8",
        },
        success: { DEFAULT: "#16a34a", light: "#dcfce7", text: "#15803d" },
        warning: { DEFAULT: "#d97706", light: "#fef3c7", text: "#b45309" },
        danger:  { DEFAULT: "#dc2626", light: "#fee2e2", text: "#b91c1c" },
        sidebar: {
          bg:            "#0f172a",
          hover:         "#1e293b",
          active:        "#1d3557",
          border:        "#1e293b",
          text:          "#94a3b8",
          "text-active": "#e2e8f0",
          "text-muted":  "#475569",
        },
        "background-light": "#f6f7f8",
      },
      fontFamily: {
        display: ["'Plus Jakarta Sans'", "Manrope", "sans-serif"],
        sans:    ["Manrope", "sans-serif"],
      },
      borderRadius: {
        sm:      "0.375rem",
        DEFAULT: "0.5rem",
        md:      "0.625rem",
        lg:      "0.75rem",
        xl:      "1rem",
        "2xl":   "1.25rem",
        "3xl":   "1.5rem",
        full:    "9999px",
      },
      boxShadow: {
        card:           "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        "card-hover":   "0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.06)",
        modal:          "0 20px 60px -10px rgb(0 0 0 / 0.25)",
        "primary-glow": "0 4px 14px 0 rgb(25 127 230 / 0.25)",
      },
    },
  },
  plugins: [],
};
export default config;
