# 📘 Proyek VISTA — Dokumentasi Lengkap
## Urban Vitality Index untuk Kawasan Transit-Oriented Development (TOD)
**Kompetisi MAPID 2026 | Tim VISTA | Kota Bandung, Indonesia**

Dokumen ini adalah **dokumentasi teknis lengkap** dari seluruh alur kerja proyek VISTA.
Tujuannya agar **semua anggota tim** (baik yang berlatar Informatika maupun Perencanaan Wilayah dan Kota) dapat memahami apa yang sudah dibangun, bagaimana cara kerjanya, dan apa langkah selanjutnya.


---

## 📍 Daftar Isi
1. [Peta Jalan (Roadmap) & Status](#-peta-jalan-roadmap--status-saat-ini)
2. [Arsitektur Sistem & Daftar File](#-arsitektur-sistem--daftar-file)
3. [Tahap 1: Akuisisi Data Jaringan Jalan & Halte](#-tahap-1-akuisisi-data-jaringan-jalan--halte)
4. [Tahap 1B: Pembentukan TAS-Nits](#-tahap-1b-pembentukan-tas-nits-transit-access-segment-units)
5. [Tahap 2: AI Computer Vision (Google Street View)](#-tahap-2-ai-computer-vision-google-street-view)
6. [Tahap 3: Aksesibilitas Fasilitas Publik](#-tahap-3-aksesibilitas-fasilitas-publik)
7. [Tahap 4: Sentimen Warga (NLP)](#-tahap-4-sentimen-warga-nlp)
8. [Tahap 5: Kalkulasi UVI](#-tahap-5-kalkulasi-urban-vitality-index-uvi)
9. [Tahap 6: WebGIS Dashboard](#-tahap-6-webgis-dashboard)
10. [Penjelasan Algoritma Inti](#-penjelasan-algoritma-inti)
11. [Cara Menjalankan Pipeline](#-cara-menjalankan-pipeline)
12. [Manajemen Biaya API Key](#-manajemen-biaya-google-maps-api-key)

---

## 📍 Peta Jalan (Roadmap) & Status Saat Ini
Sesuai dengan **6 Tahapan Implementasi** di Proposal VISTA (Halaman 10, Bagian 4.1).

| Tahap | Deskripsi | Status | Keterangan |
| :--- | :--- | :---: | :--- |
| **Tahap 1** | Akuisisi Data Jaringan Jalan & Halte | ✅ **Selesai** | 844 halte + 17.193 titik jalan diekstrak dari OpenStreetMap |
| **Tahap 1B** | Pembentukan TAS-Nits | ✅ **Selesai** | 5.876 segmen jalan (TAS-Nits) terbentuk via Stop-Point Line Split |
| **Tahap 2** | AI Computer Vision (Visual Fisik) | ✅ **Uji Coba (5 gambar)** | Scraper GSV + SegFormer berhasil. Menunggu pemrosesan massal |
| **Tahap 3** | Aksesibilitas Fasilitas Publik | ✅ **Selesai** | 3.602 POI diekstrak, Buffer 400m dihitung per TAS-Nit |
| **Tahap 4** | Sentimen Warga (NLP) | ⏳ **Pending** | Menunggu akses data mentah dari panitia MAPID |
| **Tahap 5** | Kalkulasi Urban Vitality Index (UVI) | ⏳ **Pending** | Menunggu ketiga pilar terkumpul utuh |
| **Tahap 6** | WebGIS Dashboard | 🚀 **Next Step** | Tech Stack: Next.js / React / PostGIS / Leaflet |

---

## 🏗️ Arsitektur Sistem & Daftar File

### Struktur Folder
```
ai_pipeline/
├── 1_extract_street_network.py    ← Tahap 1: Ekstrak jalan & halte dari OSM
├── 1b_build_tas_nits.py           ← Tahap 1B: Pembentukan TAS-Nits (KD-Tree)
├── 2_scrape_gsv.py                ← Tahap 2: Download gambar Google Street View
├── 2b_run_segmentation_local.py   ← Tahap 2B: Jalankan AI SegFormer di lokal
├── 3_accessibility_analysis.py    ← Tahap 3: Hitung skor aksesibilitas
├── 3_semantic_segmentation_colab.ipynb ← Tahap 2 (Colab): AI SegFormer di cloud
└── data/
    ├── bus_stops.csv                   ← 844 halte/bus stop se-Bandung
    ├── sample_points_gsv.csv           ← 17.193 titik jalan (setiap 50m)
    ├── sample_points_with_tas_nits.csv ← Titik jalan + assignment ke TAS-Nit
    ├── tas_nits_summary.csv            ← 5.876 ringkasan statistik TAS-Nit
    ├── pois_bandung.csv                ← 3.602 fasilitas publik (POI)
    ├── accessibility_score.csv         ← Skor aksesibilitas per TAS-Nit
    ├── physical_environment_score.csv  ← Skor lingkungan fisik (dari AI)
    ├── proposal_text.txt               ← Teks proposal yang sudah diekstrak
    └── images/                         ← Folder gambar Google Street View
        ├── gsv_25432842_1849525914_0.jpg
        ├── gsv_25432842_1849907073_1.jpg
        └── ... (gambar lainnya)
```

### Alur Data (Data Flow)
```
OpenStreetMap ──→ [Tahap 1] ──→ bus_stops.csv + sample_points_gsv.csv
                                        │
                                        ▼
                               [Tahap 1B: KD-Tree] ──→ tas_nits_summary.csv
                                        │
                          ┌─────────────┼─────────────┐
                          ▼             ▼             ▼
                    [Tahap 2]     [Tahap 3]     [Tahap 4]
                   GSV Images    Accessibility   NLP Sentiment
                       │             │               │
                       ▼             ▼               ▼
                  [SegFormer]   accessibility_   sentiment_
                       │        score.csv        score.csv
                       ▼
              physical_environment_score.csv
                          │             │               │
                          └─────────────┼─────────────┘
                                        ▼
                              [Tahap 5: UVI Calculation]
                                        │
                                        ▼
                              [Tahap 6: WebGIS Dashboard]
```

---

## 🔬 Tahap 1: Akuisisi Data Jaringan Jalan & Halte

### Tujuan
Mengekstrak seluruh **jaringan jalan utama** (koridor transportasi massal) dan **titik halte/bus stop** di Kota Bandung secara otomatis.

### Sumber Data
**OpenStreetMap (OSM)** — database peta kolaboratif terbesar di dunia. Data diakses secara programatik melalui library Python bernama **OSMnx** (dibuat oleh Geoff Boeing, professor Urban Planning di USC).

### Apa yang Diekstrak?

#### A. Halte Bus / Simpul Transportasi (844 titik)
Script mengunduh semua POI di Bandung yang memiliki tag OpenStreetMap:
- `highway = bus_stop` (halte bus konvensional)
- `public_transport = platform` (platform angkutan umum)

Ini mencakup halte Trans Metro Bandung (TMB), shelter BRT, dan titik pemberhentian angkot resmi.

**File output**: `data/bus_stops.csv`
| Kolom | Penjelasan |
|---|---|
| `name` | Nama halte (contoh: "Gasibu", "Alun-alun Bandung") |
| `lat` | Latitude (garis lintang) |
| `lon` | Longitude (garis bujur) |

#### B. Jaringan Jalan Koridor Utama (17.193 titik)
Script mengunduh graf jaringan jalan dari OSM dengan **filter ketat**. Hanya jalan berikut yang diambil:

| Kode OSM | Tipe Jalan | Contoh di Bandung |
|---|---|---|
| `primary` | Jalan utama / arteri | Jl. Soekarno-Hatta, Jl. Asia Afrika |
| `secondary` | Jalan sekunder / kolektor | Jl. Dipatiukur, Jl. Cihampelas |
| `tertiary` | Jalan tersier / penghubung | Jl. Cihapit, Jl. Sulanjana |
| `trunk` | Jalan batang / nasional | Jl. Ir. H. Djuanda (Dago) |

> **Penting**: Jalan tipe `residential` (gang perumahan), `service`, dan `footway` **TIDAK diambil** karena di situ bukan rute transportasi massal. Ini sesuai fokus proposal VISTA pada kawasan TOD.

Setelah graf jalan diunduh, sistem melakukan **interpolasi titik setiap 50 meter** di sepanjang setiap ruas jalan. Caranya:
1. Seluruh geometri jalan diproyeksikan ke sistem koordinat UTM (agar satuan dalam meter, bukan derajat).
2. Untuk setiap ruas jalan, sistem membuat titik baru setiap 50 meter menggunakan fungsi `geometry.interpolate(distance)`.
3. Titik-titik tersebut dikonversi kembali ke koordinat WGS84 (Latitude, Longitude).

**File output**: `data/sample_points_gsv.csv`
| Kolom | Penjelasan |
|---|---|
| `edge_id` | ID ruas jalan (format: `nodeA_nodeB`) |
| `name` | Nama jalan (contoh: "Jalan Soekarno-Hatta") |
| `highway` | Tipe jalan (primary/secondary/tertiary/trunk) |
| `lat` | Latitude titik sampel |
| `lon` | Longitude titik sampel |

### Script
**File**: `ai_pipeline/1_extract_street_network.py`
**Cara menjalankan**:
```bash
cd ai_pipeline
python 1_extract_street_network.py
```

---

## 🔬 Tahap 1B: Pembentukan TAS-Nits (Transit-Access Segment Units)

### Apa itu TAS-Nits?
Sesuai Proposal VISTA (Halaman 4):
> *"Transit-Access Segment Units (TAS-Nits) merupakan unit analisis spasial yang dibentuk dengan membagi jaringan jalan berdasarkan lokasi halte transportasi publik dan simpang jalan."*

Dalam tata kota, kita tidak bisa menganalisis jalan per 50 meter karena terlalu granular dan tidak bermakna secara perencanaan. TAS-Nit adalah **"Zona Layanan Halte"** — yaitu kumpulan titik-titik jalan yang paling dekat dengan halte yang sama.

### Cara Kerja Algoritma (Stop-Point Line Split Analysis)

#### Langkah 1: Siapkan Data
- Muat 844 halte dari `bus_stops.csv`
- Muat 17.193 titik jalan dari `sample_points_gsv.csv`
- Bersihkan data (buang halte tanpa koordinat valid)

#### Langkah 2: Bangun Spatial KD-Tree dari Halte
Sistem membangun struktur data **KD-Tree** (K-Dimensional Tree) dari koordinat 844 halte. KD-Tree adalah struktur data pohon biner yang mempartisi ruang multidimensi sehingga pencarian *Nearest Neighbor* (tetangga terdekat) bisa dilakukan dalam waktu **O(log n)** — sangat cepat! (Lihat bagian [Penjelasan Algoritma](#-penjelasan-algoritma-inti) untuk detail teknis KD-Tree.)

```python
from scipy.spatial import cKDTree

bus_coords = np.column_stack([bus_stops['lat'], bus_stops['lon']])
tree = cKDTree(bus_coords)  # Bangun tree dari 844 halte
```

#### Langkah 3: Query Nearest Neighbor
Untuk **setiap** dari 17.193 titik jalan, sistem bertanya ke KD-Tree: *"Halte mana yang paling dekat dengan titik ini?"*

```python
sample_coords = np.column_stack([sample_points['lat'], sample_points['lon']])
distances, indices = tree.query(sample_coords)
# distances = jarak ke halte terdekat (dalam derajat)
# indices = indeks halte terdekat (0-843)
```

Operasi ini memproses 17.193 titik dalam **kurang dari 1 detik** berkat efisiensi KD-Tree. Jika menggunakan metode *brute force* (bandingkan setiap titik ke semua 844 halte), dibutuhkan 17.193 × 844 = **14,5 juta** operasi perbandingan.

#### Langkah 4: Konversi Jarak
Jarak hasil query KD-Tree awalnya dalam **satuan derajat** (karena inputnya Lat/Lon). Kita konversi ke meter:
```python
distances_meters = distances * 111320  
# 1 derajat latitude ≈ 111.320 meter (di sekitar ekuator/Indonesia)
```

#### Langkah 5: Clustering — Bentuk TAS-Nit
Setiap titik jalan di-*assign* ke halte terdekatnya. ID TAS-Nit dibuat dari gabungan ID ruas jalan + ID halte:
```
TAS-Nit ID = edge_id + "_STOP" + stop_id
Contoh: 10101152065_1849525943_STOP41 
        (Ruas jalan 10101152065→1849525943, halte terdekat #41 = "Riau Cihapit")
```

Titik-titik yang memiliki TAS-Nit ID yang **sama** disatukan menjadi 1 segmen. Itulah mengapa 17.193 titik **mengerucut** menjadi **5.876 TAS-Nits**.

#### Langkah 6: Klasifikasi Walking Distance
Setiap TAS-Nit diklasifikasikan berdasarkan jarak rata-ratanya ke halte (standar internasional TOD):

| Kelas | Jarak | Estimasi Jalan Kaki | Jumlah TAS-Nit | Persentase |
|---|---|---|---|---|
| Sangat Dekat | < 200m | ~2 menit | **4.319** | **73.5%** |
| Dekat | 200 - 400m | 3-5 menit | 1.108 | 18.9% |
| Sedang | 400 - 800m | 5-10 menit | 405 | 6.9% |
| Jauh | > 800m | > 10 menit | 44 | 0.7% |

> **Temuan Riset**: 73.5% jalan utama di Bandung berjarak < 200 meter dari halte. Artinya, secara spasial, infrastruktur Bandung **sudah sangat ideal** untuk TOD. Tapi pertanyaannya: *kenapa warga masih enggan naik angkutan umum?* Nah, itulah yang dijawab VISTA melalui pilar Physical Environment dan Sentimen!

### File Output
- `data/sample_points_with_tas_nits.csv` — 17.193 titik + kolom assignment TAS-Nit
- `data/tas_nits_summary.csv` — 5.876 baris ringkasan statistik per TAS-Nit

| Kolom Penting di `tas_nits_summary.csv` | Penjelasan |
|---|---|
| `tas_nit_id` | ID unik segmen |
| `n_points` | Jumlah titik jalan dalam segmen ini |
| `avg_distance_to_stop` | Rata-rata jarak ke halte (meter) |
| `nearest_stop_name` | Nama halte terdekat |
| `street_name` | Nama jalan |
| `walking_class` | Klasifikasi jarak jalan kaki |

### Script
**File**: `ai_pipeline/1b_build_tas_nits.py`
```bash
python 1b_build_tas_nits.py
```

---

## 🔬 Tahap 2: AI Computer Vision (Google Street View)

### Tujuan
Mengubah **persepsi visual jalanan** yang subjektif menjadi **angka matematis** yang objektif dan terukur, sesuai Proposal Tabel 3 No. 9 dan Tabel 4.

### Sub-Tahap 2A: Download Gambar Google Street View

#### Bagaimana Cara Kerja Google Street View Static API?
Google menyediakan API resmi untuk mendownload foto panoramik jalanan dari server mereka. Kita mengirim *HTTP request* ke endpoint:
```
https://maps.googleapis.com/maps/api/streetview
  ?size=640x480              ← Resolusi gambar
  &location=-6.91105,107.627 ← Koordinat (lat, lon)
  &fov=90                    ← Field of View (sudut pandang)
  &heading=0                 ← Arah kamera (0°=Utara, 90°=Timur, ...)
  &pitch=0                   ← Kemiringan kamera (0°=horizontal)
  &key=API_KEY               ← Kunci autentikasi
```

Google akan merespons dengan **file JPEG** berisi foto jalanan pada koordinat tersebut.

#### API Key
- **Apa itu API Key?** Kunci autentikasi unik yang dikeluarkan oleh Google Cloud Platform untuk mengidentifikasi proyek kita dan menagih biaya penggunaan.
- **Cara mendapatkan**: Buat project di [Google Cloud Console](https://console.cloud.google.com/) → aktifkan "Street View Static API" → buat API Key di bagian Credentials.
- **API Key proyek kita**: `YOUR_API_KEY_HERE` (Ganti dengan API Key Anda)

#### Validasi Gambar
Tidak semua koordinat memiliki foto Street View (misal: jalan pelosok, jalan baru). Sistem melakukan pengecekan:
```python
if len(response.content) > 5000:  # Gambar asli biasanya > 5KB
    # Simpan gambar → ini gambar valid
else:
    # Skip → Google mengirim placeholder "No Image Available"
```

#### Fitur Tambahan
- **Mode 4 Arah**: Dengan flag `--four-directions`, sistem mendownload 4 gambar per titik (heading 0°, 90°, 180°, 270°) untuk mendapatkan pandangan 360°.
- **Resume Download**: Jika proses terputus, sistem otomatis melewatkan gambar yang sudah berhasil didownload sebelumnya.
- **Rate Limiting**: Jeda 0.1 detik antar request agar tidak melebihi batas Google (1.000 request/menit).

#### Script
**File**: `ai_pipeline/2_scrape_gsv.py`
```bash
# Download 5 gambar (test billing)
python 2_scrape_gsv.py --api-key YOUR_API_KEY_HERE --max-images 5

# Download 50 gambar
python 2_scrape_gsv.py --api-key YOUR_API_KEY_HERE --max-images 50

# Download 50 gambar, 4 arah per titik (total 200 gambar)
python 2_scrape_gsv.py --api-key YOUR_API_KEY_HERE --max-images 50 --four-directions
```

**File output**: Gambar disimpan di `data/images/` dengan format nama:
```
gsv_{edgeID}_{index}.jpg
Contoh: gsv_25432842_1849907073_1.jpg
```

---

### Sub-Tahap 2B: AI Semantic Segmentation (SegFormer)

#### Apa itu Semantic Segmentation?
Semantic Segmentation adalah teknik Computer Vision yang mengklasifikasikan **setiap piksel** dalam sebuah gambar ke dalam kategori tertentu. Berbeda dengan Object Detection (yang hanya mendeteksi bounding box objek), Semantic Segmentation memberikan label ke **seluruh** area gambar.

#### Model yang Digunakan: SegFormer-b2
- **Nama lengkap**: `nvidia/segformer-b2-finetuned-cityscapes-1024-1024`
- **Dibuat oleh**: NVIDIA Research
- **Arsitektur**: Berbasis **Transformer** (teknologi yang sama dengan GPT/ChatGPT, tapi untuk gambar). SegFormer menggunakan *Mix Transformer (MiT)* encoder.
- **Dataset training**: **Cityscapes** — dataset benchmark perkotaan dari kota-kota di Eropa yang berisi 30 kelas objek urban (jalan, trotoar, pohon, mobil, pejalan kaki, bangunan, dll).
- **Kenapa SegFormer, bukan U-Net/YOLO?** SegFormer lebih modern (2021) dan memberikan akurasi lebih tinggi pada scene perkotaan dengan kompleksitas arsitektur yang lebih rendah (tidak perlu decoder yang berat).

#### 5 Indikator VISTA yang Diekstrak

| No | Indikator | Cityscapes Class ID | Warna di Peta Segmentasi | Penjelasan |
|---|---|---|---|---|
| 1 | **Road Width Index** | 0 (road) | Ungu gelap | Proporsi lebar jalan aspal terhadap total gambar. Semakin lebar → semakin besar indeks. |
| 2 | **Sidewalk Ratio** | 1 (sidewalk) | Pink/Magenta | Proporsi trotoar. Indikator paling penting untuk *walkability* menuju halte. |
| 3 | **Street Canyon Enclosure** | 2 (building) | Abu-abu/Hitam | Proporsi bangunan yang mengurung jalan. Skor tinggi = jalan terasa sempit dan tertutup. |
| 4 | **Green View Index (GVI)** | 8 (vegetation) | Hijau | Proporsi vegetasi/pohon. Literatur membuktikan GVI tinggi meningkatkan keinginan warga untuk berjalan kaki. |
| 5 | **Sky View Factor (SVF)** | 10 (sky) | Biru muda | Proporsi langit yang terlihat. Berkorelasi terbalik dengan GVI (semakin rimbun pohon, semakin sedikit langit terlihat). |

#### Rumus Visual Perception Score
Kelima indikator digabungkan dengan pembobotan:
```
Visual Perception Score = 
    GVI × 0.30          (Penghijauan — bobot terbesar karena paling berpengaruh)
  + SVF × 0.25          (Keterbukaan langit)
  + Sidewalk × 0.20     (Ketersediaan trotoar)
  + (1 - Enclosure) × 0.15  (Semakin rendah enclosure = semakin baik)
  + Road Width × 0.10   (Lebar jalan)
```

#### Hasil Uji Coba (5 Gambar — Jl. L.L. RE. Martadinata / Jl. Riau)

| Gambar | Road Width | Sidewalk | Enclosure | GVI | SVF | **Score** |
|---|---|---|---|---|---|---|
| gsv_..._0.jpg | 0.3492 | 0.0447 | 0.0006 | **0.5255** | 0.0067 | **0.3531** |
| gsv_..._1.jpg | 0.3493 | 0.0447 | 0.0010 | **0.5260** | 0.0068 | **0.3532** |
| gsv_..._2.jpg | 0.4201 | 0.0135 | 0.0919 | 0.3800 | 0.0631 | 0.3107 |
| gsv_..._3.jpg | 0.3156 | 0.0644 | 0.0412 | 0.2932 | **0.1949** | **0.3249** |
| gsv_..._4.jpg | 0.3388 | 0.0595 | 0.1010 | 0.2919 | 0.1454 | 0.3046 |

> **Insight**: Gambar 0 dan 1 (posisi di bawah pohon rindang Jl. Riau) memiliki GVI sangat tinggi (52%) dan SVF sangat rendah (0.6%), menunjukkan AI berhasil menangkap kanopi pohon yang menutupi langit. Gambar 3 (posisi lebih terbuka) memiliki SVF tertinggi (19%) karena langit mulai terlihat.

##### Visualisasi Hasil Segmentasi & Distribusi Skor
![Visualisasi Hasil Segmentasi AI](ai_pipeline/data/images/segmentasi.png)

![Distribusi Indikator Physical Environment](ai_pipeline/data/images/distribusi.png)

#### Cara Menjalankan
**Opsi A — Di Google Colab (Rekomendasi untuk pemrosesan massal)**:
1. Upload folder `ai_pipeline` ke Google Drive
2. Buka `3_semantic_segmentation_colab.ipynb` di Colab
3. Klik Runtime → Run all

**Opsi B — Di Komputer Lokal (untuk testing kecil, perlu install PyTorch)**:
```bash
python 2b_run_segmentation_local.py
```

**File output**: `data/physical_environment_score.csv`

---

## 🔬 Tahap 3: Aksesibilitas Fasilitas Publik

### Tujuan
Sesuai Proposal (Tabel 4): Mengukur aksesibilitas **fasilitas pendidikan, kesehatan, olahraga, komersial, finansial, dan katering** menggunakan *Network Service Area Analysis*.

### Sumber Data Fasilitas (POI)
Data diambil secara otomatis dari **OpenStreetMap** menggunakan library **OSMnx**. Query yang digunakan:

| Kategori | Tag OSM yang Dicari | Jumlah Ditemukan |
|---|---|---|
| 🍽️ Katering | `amenity = restaurant, cafe, fast_food, food_court` | **1.397** |
| 🛍️ Komersial | `shop = *` (semua toko) | **1.319** |
| 🏦 Finansial | `amenity = bank, atm` | **585** |
| 🏫 Pendidikan | `amenity = school, university, college, kindergarten` | **144** |
| 🏥 Kesehatan | `amenity = hospital, clinic, doctors, pharmacy` | **130** |
| ⚽ Olahraga | `leisure = sports_centre, stadium, swimming_pool, fitness_centre` | **27** |
| | **Total POI** | **3.602** |

### Cara Kerja (2 Komponen Skor)

#### Komponen A: Transit Accessibility (Jarak ke Halte)
Mengukur seberapa dekat segmen jalan ke halte terdekat.
```
Transit Accessibility = 1 - (jarak_rata_rata_ke_halte / 800)
```
- Jarak 0 meter → skor 1.0 (sempurna)
- Jarak 400 meter → skor 0.5
- Jarak 800 meter → skor 0.0 (batas maksimal)
- Jarak > 800 meter → di-*clip* ke 0.0

#### Komponen B: Service Accessibility (Kepadatan Fasilitas)
Untuk setiap kategori fasilitas, sistem menghitung:

1. **Jumlah POI dalam Buffer 400 Meter**:
   Sistem membangun **KD-Tree kedua** dari koordinat 3.602 fasilitas. Lalu menggunakan `query_ball_point(center, radius)` untuk menghitung berapa banyak fasilitas yang masuk ke dalam lingkaran 400m dari pusat TAS-Nit.
   ```python
   buffer_radius_deg = 400 / 111320  # Konversi 400m ke derajat
   counts = poi_tree.query_ball_point(tas_coords, buffer_radius_deg)
   ```
   > **Mengapa 400 meter?** Ini adalah standar internasional *Transit-Oriented Development* untuk jarak jalan kaki yang nyaman (~5 menit). Referensi: Cervero & Kockelman (1997), Ewing & Cervero (2010).

2. **Jarak Absolut ke Fasilitas Terdekat** (Nearest Neighbor):
   ```python
   distances, _ = poi_tree.query(tas_coords)
   dist_meters = distances * 111320
   ```

3. **Normalisasi**:
   Jumlah POI dinormalisasi ke skala 0-1 menggunakan *Percentile-95 Normalization* (agar tidak bias terhadap outlier seperti area mall yang memiliki ratusan toko):
   ```python
   max_val = tas_nits[col].quantile(0.95)
   normalized = clip(count / max_val, 0, 1)
   ```

4. **Rata-rata Service Accessibility**:
   ```
   Service Accessibility = rata-rata(norm_pendidikan, norm_kesehatan, 
                                     norm_komersial, norm_katering, 
                                     norm_finansial, norm_olahraga)
   ```

#### Skor Akhir Aksesibilitas (Composite)
```
Accessibility Score = 0.5 × Transit Accessibility + 0.5 × Service Accessibility
```

### Hasil Analisis

**Top 5 TAS-Nits (Paling Aksesibel):**
| Jalan | Halte Terdekat | Skor | Jarak ke Halte |
|---|---|---|---|
| Jl. Raden Adipati | RS Advent | **0.9399** | 67.6 m |
| Jl. Dipatiukur | Seberang UNIKOM | **0.9257** | 29.9 m |
| Jl. Dipatiukur | Masjid Baiturrahman | **0.9210** | 37.5 m |
| Jl. Cihampelas | Cihampelas Eyckman | **0.8935** | 37.1 m |
| Jl. Siliwangi | UNIKOM Pascasarjana | **0.8667** | 63.0 m |

**Bottom 5 TAS-Nits (Paling Kurang Aksesibel):**
| Jalan | Halte Terdekat | Skor | Jarak ke Halte |
|---|---|---|---|
| Jl. Gedebage Utama | Pasar Sinpasa | **0.00** | 853 m |
| Jl. Cibolerang | DPKP Kota Bandung | **0.00** | 893 m |

> **Insight**: Area pusat kota (Dipatiukur, Cihampelas, Siliwangi) sangat aksesibel karena dikelilingi kampus, toko, dan cafe. Area pinggiran (Gedebage, Cibolerang) sangat kurang aksesibel karena jauh dari halte dan minim fasilitas.

### Script
**File**: `ai_pipeline/3_accessibility_analysis.py`
```bash
python 3_accessibility_analysis.py
```
**File output**: `data/accessibility_score.csv` (5.876 baris, 31 kolom)

---

## 🔬 Tahap 4: Sentimen Warga (NLP)
**Status: ⏳ Menunggu Data MAPID**

Tahap ini akan menganalisis sentimen warga terhadap lingkungan mereka menggunakan data dari aplikasi MAPID (Activity, Properti GO, Menu GO). Teknik NLP (Natural Language Processing) akan digunakan untuk mengekstrak opini positif/negatif dari komentar warga.

---

## 🔬 Tahap 5: Kalkulasi Urban Vitality Index (UVI)
**Status: ⏳ Menunggu Pilar Lengkap**

Sesuai Proposal, UVI akan dihitung dari gabungan 3 pilar:
```
UVI = w1 × Physical Environment Score    ← Dari Tahap 2 (AI SegFormer)
    + w2 × Accessibility Score            ← Dari Tahap 3 (KD-Tree + Buffer)
    + w3 × Resident Sentiment Score       ← Dari Tahap 4 (NLP)
```
Bobot (w1, w2, w3) akan ditentukan menggunakan metode **AHP (Analytical Hierarchy Process)** atau bobot yang setara.

---

## 🔬 Tahap 6: WebGIS Dashboard
**Status: 🚀 Siap Dikerjakan**

Dashboard peta interaktif yang akan menampilkan UVI di atas peta Bandung. Rencana Tech Stack (sesuai kompetensi tim di proposal):
- **Frontend**: Next.js / React.js + Leaflet (peta interaktif)
- **Backend**: FastAPI / Express.js
- **Database**: PostgreSQL + PostGIS (geospasial) / Supabase
- **Styling**: Tailwind CSS

---

## 🧠 Penjelasan Algoritma Inti

### Algoritma KD-Tree (K-Dimensional Tree)
KD-Tree adalah algoritma yang digunakan **berulang kali** di proyek ini (di Tahap 1B dan Tahap 3).

#### Apa Masalah yang Dipecahkan?
**Nearest Neighbor Search** — Diberikan sekumpulan titik referensi (misal: 844 halte) dan sebuah titik query (misal: 1 titik jalan), temukan titik referensi mana yang paling dekat ke titik query tersebut.

#### Cara Naif (Brute Force) — LAMBAT
Bandingkan titik query ke **semua** titik referensi, hitung jarak Euclidean, pilih yang terkecil.
- Kompleksitas: **O(n)** per query
- Untuk 17.193 titik query × 844 referensi = **14.506.892 operasi** → lambat!

#### Cara Cerdas (KD-Tree) — CEPAT
1. **Build Phase**: Susun 844 halte menjadi struktur pohon biner:
   - Pilih dimensi (Lat atau Lon) secara bergantian
   - Cari median, bagi data menjadi 2 bagian
   - Ulangi secara rekursif
2. **Query Phase**: Untuk mencari halte terdekat dari sebuah titik jalan:
   - Turunkan pohon ke cabang yang sesuai (kiri/kanan berdasarkan koordinat)
   - Bandingkan hanya dengan kandidat-kandidat yang relevan
   - Pangkas (*prune*) cabang yang mustahil mengandung jawaban lebih baik
   - Kompleksitas: **O(log n)** per query

**Hasil**: Memproses 17.193 titik query dalam **< 1 detik** (vs. mungkin puluhan detik dengan brute force).

Library yang digunakan: `scipy.spatial.cKDTree` (implementasi C yang sangat cepat dari SciPy).

---

## ▶️ Cara Menjalankan Pipeline

### Prasyarat (Install Dependencies)
```bash
pip install osmnx pandas numpy scipy requests geopandas shapely
```

### Urutan Eksekusi
```bash
cd ai_pipeline

# Tahap 1: Ekstrak jalan & halte dari OpenStreetMap
python 1_extract_street_network.py

# Tahap 1B: Bentuk TAS-Nits
python 1b_build_tas_nits.py

# Tahap 2A: Download gambar GSV (ganti API_KEY dengan key asli)
python 2_scrape_gsv.py --api-key API_KEY --max-images 50

# Tahap 2B: Jalankan AI SegFormer di Google Colab
# → Upload ke Drive, buka 3_semantic_segmentation_colab.ipynb, Run All

# Tahap 3: Hitung skor aksesibilitas
python 3_accessibility_analysis.py
```

---

## 💰 Manajemen Biaya Google Maps API Key

### Skema Harga Street View Static API
| Tier | Jumlah Request/Bulan | Harga per 1.000 Request |
|---|---|---|
| Free Tier | 0 – 10.000 | **Gratis** (US$0) |
| Tier 1 | 10.001 – 100.000 | US$7 |
| Tier 2 | 100.001+ | US$5.6 |

### Estimasi Biaya untuk 17.193 Gambar
```
17.193 total request
- 10.000 (free tier)
= 7.193 request berbayar
× US$7 / 1.000
= ~US$50.35 (~Rp800.000)
```

### Strategi Penghematan
1. ✅ **Test 5 gambar** (sudah dilakukan, biaya Rp0)
2. ⬜ Test 50 gambar → cek kualitas + billing
3. ⬜ Test 500 gambar → cek distribusi skor
4. ⬜ Full 17.193 gambar → hanya jika budget sudah siap

### Tips Keamanan
- **Set Daily Quota** di Google Cloud Console agar tidak ada lonjakan biaya tak terduga
- **Jangan** commit API Key ke Git/repository publik!
- Billing Google biasanya **bukan realtime** — bisa terlambat hingga 24 jam

---

*Dokumen ini dibuat dan di-maintain oleh AI Pipeline VISTA.*
*Terakhir diperbarui: 10 Agustus 2026 — Setelah berhasil menyelesaikan Tahap 1, 1B, 2 (uji coba), dan 3.*
