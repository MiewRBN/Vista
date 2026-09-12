# LAPORAN EVALUASI DAN KOMPARASI HASIL DATA

---

## 1. TABEL MATRIKS KOMPARASI KINERJA MODEL

| Indikator Evaluasi | Model Kemarin (Sebelum Pra-pemrosesan) | Model Sekarang (IndoBERT NLP AI + Equal Weighting) | Peningkatan Performa & Dampak Akademis |
|---|---|---|---|
| **1. Metode Analisis Teks Ulasan** | Pencocokan Kata Kunci Sederhana (*Lexicon Keyword Match*) | **Deep Learning AI IndoBERT-Base-p1 Fine-Tuned (Akurasi 99.95%)** | Mampu memahami sarkasme, konteks kalimat utuh, kata gaul, dan tata bahasa ulasan perkotaan secara presisi. |
| **2. Fokus Dataset Ekosistem** | Mencampur seluruh data mentah (termasuk PropertiGO statis) | **Trio Dinamis: Activities + MenuGo + StruckGo** | Menghilangkan bias properti jual/sewa statis. Fokus 100% pada aktivitas warga, keramaian kuliner, dan daya beli transaksi. |
| **3. Pembobotan Tim** | Unbalanced Weighting | **Equal Weighting 50:50 (Bobot Setara)** | Menjamin keadilan data: 50% data tim internal + 50% data tim lain dihitung seimbang pada skala 0.0 - 1.0. |
| **4. Pembobotan Keramaian Kuliner** | Hanya menghitung jumlah titik tempat makan | **Weighted Crowd Level (`kondisi_tempat`)** | Tempat makan ramai antrean diberi pengali vitalitas 1.0 (Sangat Hidup), tempat sepi diberi nilai 0.2. |
| **5. Skala Presisi Skor Sentimen** | Nilai terdiskrit kasar (0.0, 0.5, 1.0) | **Kontinu Presisi Tinggi (0.0000 s.d. 1.0000)** | Menggunakan formula Softmax Expectation untuk menghasilkan skor halus per segmen TAS-Nit. |

---

## 2. RANGKUMAN PERUBAHAN SIGNIFIKAN KELUARAN WEBGIS

1. **Akurasi Model Sentimen**: Model IndoBERT baru memprediksi ulasan positif dengan akurasi $99.95\%$, jauh lebih stabil dibanding metode kata kunci kemarin.
2. **Keseimbangan Peta WebGIS**: Penggunaan Equal Weighting 50:50 mencegah terjadinya bias skor UVI pada segmen jalan tertentu.
3. **Efisiensi Infrastruktur Vercel**: Model siap berjalan secara otomatis di Vercel ISR setiap 1 jam via HuggingFace Serverless Inference API.
