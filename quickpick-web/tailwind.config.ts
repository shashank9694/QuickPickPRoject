import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#10B981", dark: "#047857", light: "#ECFDF5", border: "#A7F3D0" },
      },
    },
  },
  plugins: [],
};

export default config;
