/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        bg: "#0b0d12",
        surface: "#12151c",
        "surface-raised": "#171b24",
        border: "#242833",
        "border-hover": "#323847",
        text: {
          DEFAULT: "#e7e9ef",
          muted: "#8a90a3",
          faint: "#565c6e",
        },
        accent: {
          DEFAULT: "#6c5ce7",
          hover: "#7c6ef0",
          muted: "#6c5ce71a",
        },
        success: {
          DEFAULT: "#22c55e",
          muted: "#22c55e1a",
        },
        danger: {
          DEFAULT: "#ef4444",
          muted: "#ef44441a",
        },
        warning: {
          DEFAULT: "#f5a524",
          muted: "#f5a5241a",
        },
      },
    },
  },
  plugins: [],
};
