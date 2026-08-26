import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://vista-webgis.vercel.app"),
  title: "VISTA — Urban Vitality Index Dashboard",
  description:
    "Sistem Visualisasi Indeks Vitalitas Perkotaan untuk Kawasan Transit-Oriented Development (TOD) Kota Bandung. Kolaborasi ITB & Universitas Siliwangi — MAPID Competition 2026.",
  keywords: ["VISTA", "Urban Vitality", "TOD", "WebGIS", "Bandung", "MAPID", "AI", "SegFormer"],
  icons: {
    icon: [
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: "/icon.png",
  },
  openGraph: {
    title: "VISTA — Urban Vitality Index Dashboard",
    description: "Sistem Visualisasi Indeks Vitalitas Perkotaan untuk Kawasan Transit-Oriented Development (TOD) Kota Bandung.",
    images: [{ url: "/Logo Vista.png", width: 614, height: 440, alt: "VISTA Logo" }],
    siteName: "VISTA WebGIS",
    locale: "id_ID",
    type: "website",
  },
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
