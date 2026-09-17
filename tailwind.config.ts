import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Manrope", "ui-sans-serif", "sans-serif"],
        sans: ["Public Sans", "ui-sans-serif", "sans-serif"],
      },
      colors: {
        accent: {
          DEFAULT: "#4338CA",
          hover: "#362FA8",
          soft: "#EEF0FF",
        },
        ink: {
          DEFAULT: "#171A21",
          secondary: "#667085",
          tertiary: "#98A2B3",
        },
        line: "#E3E6EC",
        surface: {
          DEFAULT: "#FFFFFF",
          sunk: "#F5F6F8",
          panel: "#FAFAFB",
        },
        status: {
          onTrackBg: "#E6F4EA",
          onTrackText: "#1E7B34",
          onTrackDot: "#2FA84F",
          atRiskBg: "#FEF3E0",
          atRiskText: "#92400E",
          atRiskDot: "#F59E0B",
          offTrackBg: "#FCEAEA",
          offTrackText: "#B42318",
          offTrackDot: "#E5484D",
          doneBg: "#EAF1FE",
          doneText: "#1849A9",
          doneDot: "#3B82F6",
          notStartedBg: "#F2F4F7",
          notStartedText: "#475467",
          notStartedDot: "#98A2B3",
        },
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
};
export default config;
