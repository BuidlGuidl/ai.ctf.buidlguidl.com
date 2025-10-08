/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./utils/**/*.{js,ts,jsx,tsx}"],
  plugins: [require("@tailwindcss/typography"), require("daisyui")],
  // DaisyUI theme colors
  daisyui: {
    themes: [
      {
        light: {
          primary: "#00FBFF",
          "primary-content": "#000000",
          secondary: "#008A8C",
          "secondary-content": "#00FBFF",
          accent: "#1DB8AB",
          "accent-content": "#000000",
          neutral: "#1a1a1a",
          "neutral-content": "#00FBFF",
          "base-100": "#000000",
          "base-200": "#0a0a0a",
          "base-300": "#1a1a1a",
          "base-content": "#00FBFF",
          info: "#00ffff",
          success: "#00ff00",
          warning: "#FFBE00",
          error: "#FF5861",

          "--rounded-btn": "9999rem",
          ".tooltip": {
            "--tooltip-tail": "6px",
          },
          ".link": {
            textUnderlineOffset: "2px",
          },
          ".link:hover": {
            opacity: "80%",
          },
        },
      },
    ],
  },
  theme: {
    extend: {
      colors: {
        'theme-color': '#00FBFF',
        'theme-color-500': '#00C4C7',
        'theme-color-700': '#008A8C',
      },
      boxShadow: {
        center: "0 0 12px -2px rgb(0 0 0 / 0.05)",
      },
      animation: {
        "pulse-fast": "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      fontFamily: {
        dotGothic: ["var(--font-dot-gothic)"],
      },
    },
  },
};
