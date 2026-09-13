# VISTA WebGIS Dashboard — Transit-Oriented Development Analytics
> **MAPID Catalyst Competition 2026 (FiveHonk! Team)**  
> Antarmuka visual analitik geospasial berbasis WebGL untuk eksplorasi **Urban Vitality Index (UVI)** di 5.876 unit analisis mikro-segmen jalan (*TAS-Nit*) Kota Bandung.

---

## 🚀 Memulai (Quick Start)

### Prasyarat
- **Node.js**: Versi 18.17.0 atau lebih baru
- **npm**: Versi 9 atau lebih baru

### Instalasi & Menjalankan Server Lokal
```bash
# 1. Masuk ke direktori dashboard
cd vista-dashboard

# 2. Install dependensi
npm install

# 3. Jalankan server pengembangan
npm run dev
```

Buka peramban Anda di **[http://localhost:3000](http://localhost:3000)**.

### Validasi Kode & Type Checking
```bash
npx tsc --noEmit
```

---

## 🏛️ Arsitektur Antarmuka (Layout 4-Zona)

Antarmuka dirancang mengikuti kaidah kartografi modern dan sesi *coaching clinic MAPID*:
1. **Primary Zone (~70% Kanvas)**: Peta interaktif berbasis **Deck.gl v9** dan **MapLibre GL JS v6** dengan performa WebGL akselerasi GPU.
2. **Supporting Zone (~25% Sisi Kanan)**: Panel analitik statistik ([`StatsPanel.tsx`](file:///E:/Latief/Vista/vista-dashboard/components/StatsPanel.tsx)) dengan *dynamic histogram*, visualisasi 3 pilar UVI, *linked view drill-down*, dan feed ulasan warga riil.
3. **Control Zone (Sidebar & Floating Controls)**: Navigasi samping ([`Sidebar.tsx`](file:///E:/Latief/Vista/vista-dashboard/components/Sidebar.tsx)), toggle layer spasial (TAS-Nit, Halte Bus, POI), *color mode selector*, dan tombol multi-seleksi titik.
4. **Info Zone (Bawah & Legend)**: *Floating Legend* kartografis sequential gradient dan status bar ringkasan data.

---

## 📥 Fitur Multi-Pilih Titik & Ekspor Laporan Spasial Kustom

Dashboard VISTA dilengkapi modal ekspor spasial terpadu ([`ExportReportModal.tsx`](file:///E:/Latief/Vista/vista-dashboard/components/ExportReportModal.tsx)) yang memungkinkan pengguna memilih titik, menyesuaikan bobot pilar analitik, dan mengunduh laporan spasial lengkap.

### 1. Cara Memilih Titik (Multi-Select Points)
- **Tombol Mode Multi-Pilih**: Klik ikon centang (`CheckSquare`) di bar kontrol navigasi kanan atas peta.
- **Shortcut Keyboard**: Tahan tombol **`Shift + Klik`** langsung pada titik-titik segmen jalan di kanvas peta.
- **Floating Action Bar**: Bilah aksi di bagian atas tengah peta menampilkan:
  - Jumlah titik yang dipilih (klik untuk melihat popover flyout daftar titik, zoom ke koordinat, atau hapus).
  - Tombol **"Pilih Koridor"** untuk memilih seluruh titik dalam ruas jalan yang sama sekaligus.
  - Tombol **"Ekspor"** untuk langsung membuka modal laporan dengan titik-titik terpilih.
- **StatsPanel**: Tombol *"Pilih Titik untuk Ekspor"* pada panel detail kanan segmen.
- **Pencarian Terpadu**: Cari kode TASnit atau nama jalan langsung di dalam modal ekspor.

### 2. Nilai Bawaan (*Default*) & Fleksibilitas Kustomisasi
- **Cakupan Ekspor (*Scope*)**:
  - `selected`: Default jika terdapat titik multi-select aktif.
  - `single`: Default jika membuka modal dari 1 segmen aktif.
  - `corridor`: Mengekspor seluruh ruas jalan koridor.
  - `all`: Mengekspor seluruh 5.876 TAS-Nit Kota Bandung.
- **Pilar Analitik Dinamis**:
  - Aksesibilitas & Fungsi TOD (*Default: Aktif*)
  - Lingkungan Fisik AI SegFormer (*Default: Aktif*)
  - Sentimen Warga IndoBERT + MAPID (*Default: Aktif*)
  - *Custom UVI* otomatis menghitung rata-rata proporsional dari pilar-pilar yang diaktifkan pengguna.
- **Explainable AI Reasoning (CCIA)**:
  - Default: *Aktif*. Menghasilkan narasi terstruktur: Kondisi, Penyebab, Dampak, dan Tindakan Rekomendasi.

### 3. Ragam Format Keluaran (Output)
Pengguna dapat mengunduh data dalam dua format standar industri:
1. **GeoJSON Spasial (`.geojson`)**: Format RFC 7946 `FeatureCollection` dengan geometri `Point` presisi WGS84, metadata ekspor, metrik fisik SegFormer, densitas POI 400m, dan properti CCIA AI reasoning. Siap dibuka di **QGIS, ArcGIS, Mapbox, Deck.gl, GeoPandas**, atau **MAPID Studio**.
2. **Tabel Data Tabular (`.csv`)**: Format CSV dengan sanitasi escaping ber-enkoding UTF-8. Siap diolah langsung di **Microsoft Excel, Google Sheets, R, SPSS**, atau skrip **Python Pandas**.

---

## 🛠️ Tech Stack Frontend

- **Framework**: Next.js 16 (App Router + Turbopack)
- **Library UI**: React 19, Tailwind CSS, Lucide React
- **Spatial Engine**: Deck.gl v9 (Uber WebGL), MapLibre GL JS v6
- **Basemap Vector**: MAPID Vector Basemap Tiles API v2 (Dark, Street, Light, Satellite)
- **Data Visualizer**: Recharts (Histogram Distribusi & Progress Bar)
