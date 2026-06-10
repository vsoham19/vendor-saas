import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms"; // Resolves the "require" syntax compilation error

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#012425",
        secondary: "#80543c",
        background: "#faf9f8",
        outline: "#717878",
        "outline-variant": "#c1c8c7",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f4f3f3",
        "surface-container": "#eeeeed",
        "surface-container-high": "#e8e8e7",
        "surface-container-highest": "#e3e2e2",
        "on-surface": "#1a1c1c",
        "on-surface-variant": "#414848",
        "ink-main": "#121212",
        "ink-muted": "#6B7280",
        "status-paid": "#2D6A4F",
        "status-due": "#9B2226",
        "status-partial": "#B07D05",
        "secondary-fixed": "#ffdbca",
        "secondary-container": "#ffc5a7",
        "on-secondary-container": "#7a5037",
      },
      fontFamily: {
        serif: ["var(--font-libre-caslon)", "serif"],
        sans: ["var(--font-inter)", "sans-serif"],
      },
      spacing: {
        unit: "4px",
        "stack-sm": "8px",
        "stack-md": "16px",
        "stack-lg": "24px",
        gutter: "16px",
        "section-gap": "40px",
        "edge-margin-desktop": "40px",
        "edge-margin-mobile": "16px",
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem",
      }
    },
  },
  plugins: [forms], // Using the imported forms variable directly
};

export default config;
