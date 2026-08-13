import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VISTA — Urban Vitality Index Dashboard",
  description:
    "Sistem Visualisasi Indeks Vitalitas Perkotaan untuk Kawasan Transit-Oriented Development (TOD) Kota Bandung. Kompetisi MAPID 2026.",
  keywords: ["VISTA", "Urban Vitality", "TOD", "WebGIS", "Bandung", "MAPID"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
