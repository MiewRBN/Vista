# VISTA (Vitality Intelligence System for Transit Accessibility)
> **MAPID Catalyst Competition 2026 (FiveHonk! Team)**  
> Platform analitik geospasial kecerdasan buatan untuk mengukur, menganalisis, dan memvisualisasikan **Urban Vitality Index (UVI)** di 5.876 segmen jalan TOD (*Transit-Oriented Development*) Kota Bandung.

---

## 1. Arsitektur & 3 Pilar Urban Vitality Index (UVI)

UVI dihitung berbasis data mikro-segmen jalan **TAS-Nit** (*Transit Accessibility Segment Unit*), menggabungkan 3 pilar:

1. **Pilar 1: Aktivitas & Fungsi Kawasan (Aksesibilitas TOD)**
   - **Sumber**: OSM (*OpenStreetMap*) + GTFS Trans Metro Bandung.
   - **Metrik**: Skor Aksesibilitas Transit (jarak ke halte), Skor Layanan (kepadatan POI dalam radius jalan kaki 400m: Pendidikan, Kesehatan, Komersial, Katering, Finansial, Olahraga).
   - **Integrasi MAPID Missions**: Mengakomodasi aktivitas ekonomi mikro MenuGo dan StrukGo dari ekosistem MAPID sebagai bobot penguat.

2. **Pilar 2: Lingkungan Fisik & Persepsi Visual (AI SegFormer)**
   - **Sumber**: Citra Google Street View (GSV) yang dianalisis dengan model deep learning *SegFormer B4* (*Cityscapes Fine-Tuned*).
   - **Metrik**: Green View Index (GVI), Sky View Factor (SVF), Rasio Trotoar (*Sidewalk Ratio*), *Street Canyon Enclosure*, dan Indeks Lebar Jalan (*Road Width*).
   - **Corridor Spatial Fallback**: Untuk segmen yang tidak memiliki GSV langsung (40.5% awal), dihitung menggunakan rata-rata koridor nama jalan yang sama sehingga cakupan visual mencapai **99,3%** (`is_phys_estimated: true/false`).

3. **Pilar 3: Sentimen Warga & Persepsi Komunitas (IndoBERT + MAPID Activities)**
   - **Sumber Data Internal**: 43.500+ ulasan Google Places yang diklasifikasikan menggunakan fine-tuned **IndoBERT** (positif, netral, negatif, skor 0.0 - 1.0) dengan *walking buffer* spasial 450 meter ke 5.483 segmen TAS-Nit (**93,3% cakupan**).
   - **Sumber Ekosistem MAPID**: Data crowdsource MAPID Activities (postingan warga, likes, skor sentimen komunitas).
   - **Equal Weighting (Bobot Setara 50:50)**: Jika kedua data tersedia, pilar sentimen memadukan 50% IndoBERT + 50% MAPID Community Activities secara transparan.

---

## 2. Fitur Unggulan & Fitur Opsional (PRD Bagian 3)

### A. Expandable UVI Component Drilldown (Fitur Opsional)
- **Lokasi**: `vista-dashboard/components/StatsPanel.tsx`
- **Fungsi**: Accordion interaktif independen pada masing-masing dari 3 pilar UVI di panel detail kanan saat segmen diklik.
  - **Aktivitas & Fungsi**: Breakdown jumlah POI per kategori 400m + integrasi MAPID Missions.
  - **Lingkungan Fisik**: 5 metrik visual SegFormer + status estimasi koridor + badge metodologi AI.
  - **Sentimen Warga**: Rata-rata rating, total ulasan, rasio positif/negatif, sub-kartu MAPID Activities, dan **Feed Ulasan Warga Asli** (*verbatim raw review feed*) lengkap dengan filter chip (Semua, Positif, Negatif), star rating, label IndoBERT, nama tempat, dan jarak ke segmen.

### B. Custom Exportable Report (Fitur Opsional)
- **Lokasi**: `vista-dashboard/components/ExportReportModal.tsx` (diakses via tombol Ekspor di `Sidebar.tsx` dan `StatsPanel.tsx`).
- **Fungsi**: Modal ekspor kustom format `.geojson` dan `.csv`.
  - Pemilihan cakupan segmen (semua 5.876 TAS-Nit atau segmen terpilih).
  - Bobot dinamis pilar (bisa menyertakan/mengecualikan pilar tertentu atau mengatur slider bobot kustom).
  - Dilengkapi narasi **AI Reasoning (CCIA Framework)**: *Condition, Cause, Impact, Actionable Recommendation*.

---

## 3. Aturan Desain & Koding Wajib (Strict Rules)

1. **LARANGAN EMOTICON / EMOJI UNICODE**:
   - **Dilarang keras** memakai karakter emoji seperti 📍, 💡, ✕, ⭐, 🚗, dll. di antarmuka web.
   - **Wajib menggunakan** icon resmi dari `lucide-react` (seperti `<MapPin />`, `<Lightbulb />`, `<X />`, `<Star />`, `<Activity />`, `<Building2 />`, `<MessageSquare />`, `<Download />`, dll.).
2. **KONSISTENSI DATA**:
   - Semua angka di kartu ringkasan atas dan feed ulasan mentah di bawah harus saling konsisten.
   - Variabel di `StatsPanel.tsx` secara reaktif menghitung ulang nilai efektif jika ada feed ulasan mentah yang dimuat.
3. **PENCEGAHAN CACHE**:
   - API `/api/tas-nits` disetel dengan header `no-store, no-cache, must-revalidate` dan pemanggilan `fetch` memakai timestamp query `?v=Date.now()`.

---

## 4. Struktur Direktori & Dataset Kunci

- `vista-dashboard/`: Next.js 14 App Router (Tailwind CSS + Deck.GL / Mapbox)
  - `app/api/tas-nits/route.ts`: Master GeoJSON builder yang menggabungkan seluruh CSV dan menghitung UVI.
  - `app/api/tas-nits/reviews/route.ts`: API on-demand penyedia feed ulasan mentah per ID segmen.
  - `components/Map.tsx`: Deck.GL ScatterplotLayer + PathLayer + Popup hover/click.
  - `components/StatsPanel.tsx`: Panel analitik kanan dengan Linked Views & accordion drilldown 3 pilar.
  - `components/ExportReportModal.tsx`: Modal ekspor GeoJSON/CSV + CCIA AI reasoning.
  - `public/data/`:
    - `accessibility_score.csv`: 5.876 baris master segmen TAS-Nit.
    - `physical_environment_tasnit.csv`: Data SegFormer visual AI.
    - `sentiment_score.csv`: 5.483 baris data sentimen IndoBERT spasial (93,3% cakupan).
    - `tasnit_reviews_index.json`: 43.591 ulasan terpetakan ke TAS-Nit (12 MB).
    - `mapid_activities_score.csv` & `mapid_missions_score.csv`: Data crowdsource ekosistem MAPID.
    - `tas_nits_lines.json` & `tas_nits_polygons.json`: Geometri garis koridor dan poligon zona 400m.

---

## 5. Menjalankan Aplikasi & Testing

- **Jalankan Dev Server**:
  ```bash
  cd vista-dashboard
  npm run dev
  # Berjalan di http://localhost:3000
  ```
- **Type Check / Validasi Kode**:
  ```bash
  cd vista-dashboard
  npx tsc --noEmit
  ```
