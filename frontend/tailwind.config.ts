import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  // darkMode: "class" یعنی حالت تاریک با اضافه‌شدن کلاس "dark" روی یه
  // عنصر والد فعال میشه (نه با تنظیمات سیستم‌عامل کاربر) — این‌جوری
  // میشه یه دکمه‌ی تغییر حالت توی پنل مدیریت گذاشت و انتخاب کاربر رو
  // ذخیره کرد، بدون اینکه صفحات ورود/پورتال بیمار رو تحت تاثیر بذاره
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        vazir: ["var(--font-vazir)", "IranSans", "Tahoma", "sans-serif"],
      },
      colors: {
        primary: { DEFAULT: "#2563eb", foreground: "#ffffff" },
        secondary: { DEFAULT: "#10b981", foreground: "#ffffff" },
        accent: { DEFAULT: "#f59e0b" },
        background: "#f1f5f9",
        card: "#ffffff",
        border: "#e2e8f0",
        muted: "#64748b",
      },
      borderRadius: { xl: "0.75rem", "2xl": "1rem", "3xl": "1.5rem" },
      boxShadow: {
        soft: "0 2px 15px rgba(0,0,0,0.06)",
        card: "0 4px 25px rgba(0,0,0,0.08)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};

export default config;
