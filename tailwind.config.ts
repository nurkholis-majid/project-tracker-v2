import type { Config } from "tailwindcss";

/**
 * Palet di-reskin mengikuti referensi cme-portal-v2 (gaya "Untitled UI" — terang,
 * bersih, biru sebagai warna utama). Nama token dipertahankan (ink/ocean/sky/sun/
 * alert/mist/paper) supaya SELURUH halaman ikut berubah tanpa perlu menyentuh
 * markup-nya — cukup nilai warnanya yang diganti di sini.
 *
 * Peran tiap token:
 *   ink   = teks (paling gelap → paling terang)
 *   mist  = abu-abu netral untuk border, header tabel, teks sekunder
 *   ocean = biru utama (aksi utama, status Deploy/Done, tautan)
 *   sky   = teal — status "User Testing"/info, dibedakan dari biru utama
 *   sun   = amber — peringatan/status Development
 *   alert = merah — hapus/ditahan/flag FALSE
 *   paper = latar halaman
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink:   { 900: "#101828", 800: "#1D2939", 700: "#344054", 500: "#475467", 300: "#667085" },
        ocean: { 700: "#1443A0", 600: "#1A6AFF", 500: "#2E7BFF", 200: "#C2D7FF", 100: "#EBF2FF" },
        sky:   { 600: "#0E9384", 500: "#15AA98", 400: "#2FC0AF", 200: "#99E6DD", 100: "#F0FDFA" },
        sun:   { 700: "#B54708", 600: "#DC6803", 500: "#F79009", 300: "#FEC84B", 100: "#FFFAEB" },
        alert: { 600: "#B42318", 500: "#F04438", 200: "#FECDCA", 100: "#FEF3F2" },
        mist:  { 600: "#475467", 400: "#98A2B3", 200: "#E4E7EC", 100: "#F2F4F7", 50: "#F9FAFB" },
        paper: "#F7F8FA",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        // Bayangan lebih tipis, sesuai gaya referensi (shadow-sm/md yang halus).
        card: "0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.05)",
      },
    },
  },
  plugins: [],
};
export default config;
