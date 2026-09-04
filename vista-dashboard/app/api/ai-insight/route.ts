import { NextRequest, NextResponse } from "next/server";

// ── Types ──────────────────────────────────────────────────────────────
interface SegmentData {
  tasnit_id: string;
  tasnit_code: string;
  street_name: string;
  nearest_stop: string;
  distance_to_stop_m: number;
  walking_class: string;
  uvi_score: number;
  accessibility_score: number;
  physical_score: number;
  sentiment_score: number;
  gvi: number;
  svf: number;
  sidewalk: number;
  enclosure: number;
  road_width: number;
  n_reviews: number;
  n_places: number;
  avg_rating: number;
  positive_ratio: number;
  poi_pendidikan: number;
  poi_kesehatan: number;
  poi_komersial: number;
  poi_katering: number;
  poi_finansial: number;
  poi_olahraga: number;
  mapid_activity_count: number;
  mapid_activity_sent_score: number | null;
}

interface CCIADiagnosis {
  primary_issue: string;
  primary_pillar: string;
  contributing_indicator: string;
  secondary_indicator: string;
  severity: "critical" | "moderate" | "good";
  severity_label: string;
  uvi_class: string;
}

interface CCIAOutput {
  condition: string;
  cause: string;
  impact: string;
  action: string;
}

// ── Rule-Based CCIA Engine ─────────────────────────────────────────────
function cleanMarkdownFormatting(text: string): string {
  if (!text) return "";

  // Pisahkan blok kode (```...```) agar operator matematika (*) atau sintaks tipe (->) tidak rusak
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts
    .map((part) => {
      // Jika bagian ini adalah blok kode, pertahankan isi kode apa adanya
      if (part.startsWith("```") && part.endsWith("```")) {
        return part.replace(/\s*→\s*/g, ", ");
      }

      let cleaned = part;

      // 1. Ubah bullet asterisk di awal baris menjadi tanda strip: '* ' -> '- '
      cleaned = cleaned.replace(/^(\s*)\*\s+/gm, "$1- ");

      // 2. Bersihkan bold markdown: **teks** -> teks
      cleaned = cleaned.replace(/\*\*([^*]+?)\*\*/g, "$1");

      // 3. Bersihkan italic markdown: *teks* -> teks (hanya jika tidak diapit spasi untuk menjaga operasi hitungan)
      cleaned = cleaned.replace(/(^|\s)\*([^\s*][^*]*?[^\s*])\*(\s|$|[.,;:!])/g, "$1$2$3");

      // 4. Bersihkan sisa tanda bintang ganda yang tidak berpasangan
      cleaned = cleaned.replace(/\*\*/g, "");

      // 5. Bersihkan header markdown: misal ### Judul -> Judul
      cleaned = cleaned.replace(/^(\s*)#{1,6}\s+/gm, "$1");

      // 6. Bersihkan blockquote markdown: misal > Kutipan -> Kutipan
      cleaned = cleaned.replace(/^(\s*)>\s+/gm, "$1");

      // 7. Bersihkan simbol panah unicode (→) secara aman tanpa merusak return type Python (->) atau JS (=>)
      cleaned = cleaned
        .replace(/\s*→\s*/g, ", ")
        .replace(/,\s*,/g, ",")
        .replace(/\.\s*,/g, ".")
        .replace(/,\s*\./g, ".");

      return cleaned;
    })
    .join("")
    .trim();
}

function classifyUVI(score: number): string {
  if (score >= 0.7) return "Tinggi";
  if (score >= 0.5) return "Sedang";
  if (score >= 0.3) return "Sedang-Rendah";
  return "Rendah";
}

function diagnose(data: SegmentData): CCIADiagnosis {
  const pillars = [
    { name: "Aksesibilitas", score: data.accessibility_score },
    { name: "Lingkungan Fisik", score: data.physical_score },
    { name: "Aktivitas & Sentimen Warga", score: data.sentiment_score },
  ].filter((p) => Number.isFinite(p.score) && p.score >= 0);

  // Urutkan menaik untuk menemukan pilar dengan performa terendah
  pillars.sort((a, b) => a.score - b.score);
  const weakest = pillars[0] || { name: "Data Belum Tersedia", score: 0 };

  // Tentukan indikator kontributor spesifik berdasarkan data segmen
  let contributing = "Green View Index";
  let secondary = "Sky View Factor";

  if (weakest.name === "Lingkungan Fisik") {
    // Sesuai formula VISTA:
    // SVF, Trotoar, GVI: semakin tinggi semakin baik (skor = nilai)
    // Enclosure: semakin tinggi semakin buruk/canyon effect (skor = 1 - nilai, sesuai formula (1 - Enclosure))
    const indicators = [
      { name: "Sky View Factor (SVF)", score: data.svf, label: `${(data.svf * 100).toFixed(1)}%` },
      { name: "Rasio Trotoar", score: data.sidewalk, label: `${(data.sidewalk * 100).toFixed(1)}%` },
      { name: "Green View Index (GVI)", score: data.gvi, label: `${(data.gvi * 100).toFixed(1)}%` },
      { name: "Tingkat Keterkungkungan (Enclosure)", score: Math.max(0, 1 - data.enclosure), label: `${(data.enclosure * 100).toFixed(1)}%` },
    ].sort((a, b) => a.score - b.score);
    contributing = `${indicators[0].name} (${indicators[0].label})`;
    secondary = `${indicators[1].name} (${indicators[1].label})`;
  } else if (weakest.name === "Aktivitas & Sentimen Warga") {
    const sampleConf =
      data.n_reviews < 10
        ? "Sampel Google Terbatas"
        : data.n_reviews < 30
        ? "Sampel Google Cukup"
        : "Sampel Google Tinggi";
    const mapidDetail =
      data.mapid_activity_count > 0
        ? ` + ${data.mapid_activity_count} Aktivitas MAPID`
        : "";
    contributing = `Sentimen Positif ${(data.positive_ratio * 100).toFixed(0)}% (${sampleConf}${mapidDetail})`;
    secondary = `Rating ${data.avg_rating.toFixed(1)}/5.0 (${data.n_reviews} ulasan dari ${data.n_places} fasilitas)`;
  } else {
    contributing = `Jarak ke Halte ${data.distance_to_stop_m.toFixed(0)}m (${data.walking_class})`;
    const totalPoi =
      data.poi_pendidikan +
      data.poi_kesehatan +
      data.poi_komersial +
      data.poi_katering +
      data.poi_finansial +
      data.poi_olahraga;
    secondary = `Kepadatan Fasilitas: ${totalPoi} POI`;
  }

  // Threshold klasifikasi severity VISTA:
  // score < 0.25 -> critical | score < 0.50 -> moderate | >= 0.50 -> good
  const severity: CCIADiagnosis["severity"] =
    weakest.score < 0.25 ? "critical" : weakest.score < 0.5 ? "moderate" : "good";

  const severity_label =
    severity === "critical"
      ? "Kritis (Prioritas Utama)"
      : severity === "moderate"
      ? "Sedang (Perlu Perhatian)"
      : "Baik";

  return {
    primary_issue: weakest.name,
    primary_pillar: weakest.name,
    contributing_indicator: contributing,
    secondary_indicator: secondary,
    severity,
    severity_label,
    uvi_class: classifyUVI(data.uvi_score),
  };
}

// ── Rule-Based Fallback (no LLM) ──────────────────────────────────────
function generateRuleBasedCCIA(data: SegmentData, diagnosis: CCIADiagnosis): CCIAOutput {
  const streetName = data.street_name || "Koridor Ini";
  const sampleConf =
    data.n_reviews < 10
      ? "sampel ulasan Google terbatas"
      : "jumlah ulasan Google lebih banyak";

  let lowestScore = data.physical_score;
  let impactText = `Keterbatasan pada indikator lingkungan fisik tersebut dapat berpotensi mengurangi kualitas visual koridor jalan dan membatasi ruang yang dialokasikan bagi pergerakan pejalan kaki, sehingga kualitas ruang pedestrian pada segmen ini perlu mendapat perhatian.`;
  let actionText = `Prioritaskan penataan elemen ruang koridor yang berkaitan dengan keterbukaan pandangan ke langit dengan tetap mempertahankan vegetasi hijau yang ada, serta lakukan evaluasi penataan ruang jalan untuk meningkatkan porsi ruang yang dapat digunakan pejalan kaki.`;

  if (diagnosis.primary_issue === "Aktivitas & Sentimen Warga") {
    lowestScore = data.sentiment_score;
    const mapidText =
      data.mapid_activity_count > 0
        ? `, diperkaya oleh ${data.mapid_activity_count} aktivitas warga dari ekosistem MAPID (IndoBERT)`
        : "";
    impactText = `Intensitas aktivitas dan kepuasan publik pada segmen ini menunjukkan data persepsi berbasis ${sampleConf} (${data.n_reviews} ulasan)${mapidText}, sehingga keterwakilan aspirasi warga perlu terus diperkuat melalui partisipasi aktif publik.`;
    actionText = `Tingkatkan aktivasi ruang koridor publik dan dorong partisipasi warga dalam memberikan masukan terhadap fasilitas sekitar baik melalui ulasan Google maupun kontribusi crowdsourcing MAPID.`;
  } else if (diagnosis.primary_issue === "Aksesibilitas") {
    lowestScore = data.accessibility_score;
    impactText = `Jarak tempuh menuju halte transit terdekat berpotensi memengaruhi kemudahan mobilitas harian pejalan kaki yang mengandalkan angkutan umum massal.`;
    actionText = `Prioritaskan integrasi rute pejalan kaki menuju halte transit serta optimalkan fasilitas penunjang kenyamanan pejalan kaki di sepanjang koridor aksesibilitas.`;
  }

  return {
    condition: `Segmen ${streetName} (${data.tasnit_code}) memiliki skor Urban Vitality Index (UVI) sebesar ${data.uvi_score.toFixed(3)} dan termasuk kelas ${diagnosis.uvi_class}. Jarak ke halte transit terdekat (${data.nearest_stop}) tercatat ${data.distance_to_stop_m.toFixed(0)} meter dengan kategori ${data.walking_class}. Pilar dengan nilai terendah adalah ${diagnosis.primary_issue} (${lowestScore.toFixed(3)}), sehingga menjadi aspek yang perlu mendapat perhatian.`,
    cause: `Indikator yang paling perlu diperhatikan pada aspek ${diagnosis.primary_issue} adalah ${diagnosis.contributing_indicator} serta ${diagnosis.secondary_indicator}. Keduanya teridentifikasi sebagai indikator dengan nilai terendah pada segmen ini dengan tingkat urgensi ${diagnosis.severity_label}.`,
    impact: impactText,
    action: actionText,
  };
}

// ── Safety Sanitizer Guard (Defense-in-Depth against Hallucinations) ───
function sanitizeCCIA(output: CCIAOutput, diagnosis: CCIADiagnosis): CCIAOutput {
  let { condition, cause, impact, action } = output;

  // 1. Bersihkan halusinasi bangunan privat / fasad / transparan / setback / tinggi gedung / APBD / desain jalan berlebihan dari Action
  action = action
    .replace(/penyesuaian setback bangunan(\s*(dan|atau)\s*pengurangan ketinggian struktur)?/gi, "penataan koridor ruang jalan dan fasilitas pedestrian")
    .replace(/pengurangan ketinggian struktur/gi, "penataan elemen visual ruang koridor jalan")
    .replace(/setback bangunan/gi, "ruang koridor jalan")
    .replace(/ketinggian (bangunan|struktur)/gi, "keterbukaan ruang jalan")
    .replace(/pengurangan ketinggian/gi, "penataan elemen peneduh jalan")
    .replace(/dapat dibuat zona terbuka visual[^.]*?menambah elemen transparan pada fasad[^.]*\.?/gi, "Prioritaskan penataan elemen ruang koridor yang berkaitan dengan keterbukaan pandangan ke langit, dengan tetap mempertahankan vegetasi hijau yang ada.")
    .replace(/(zona terbuka visual,?\s*)?misalnya dengan (menurunkan elemen penutup visual atau )?menambah elemen transparan pada fasad/gi, "penataan elemen ruang koridor dengan mempertahankan vegetasi yang ada")
    .replace(/(elemen transparan pada )?fasad( bangunan)?/gi, "elemen koridor jalan")
    .replace(/menambah elemen transparan/gi, "menata keterbukaan koridor")
    .replace(/penutup visual/gi, "elemen koridor jalan")
    .replace(/\b\d+\s*lantai\b/gi, "ruang koridor")
    .replace(/memperluas area terbuka( sehingga (SVF|pandangan ke langit) dapat meningkat)?/gi, "penataan elemen ruang koridor yang berkaitan dengan keterbukaan pandangan ke langit")
    .replace(/alokasikan (bagian |lebar )?tambahan (bagi|untuk) trotoar/gi, "lakukan penataan ruang jalan untuk meningkatkan porsi ruang pejalan kaki")
    .replace(/ubah tata letak jalan/gi, "lakukan penataan ruang jalan")
    .replace(/mengatur kembali elemen-elemen non-pejalan kaki( di koridor)?/gi, "lakukan evaluasi penataan ruang jalan")
    .replace(/elemen(-elemen)? non-pejalan kaki/gi, "ruang jalan")
    .replace(/mengatur penempatan elemen (visual )?vertikal( sehingga tidak menghalangi pandangan)?,?\s*/gi, "")
    .replace(/mengurangi lebar lajur kendaraan/gi, "mengoptimalkan penataan ruang koridor jalan")
    .replace(/APBD|RAB|Rp\s*[\d.,]+/gi, "program penataan koridor");

  // 1b. Cegah rekomendasi kontraproduktif yang menyarankan mengurangi/menebang vegetasi demi menaikkan SVF
  action = action
    .replace(/mengurangi penutupan vegetasi(\s*(atau|dan)\s*struktur)?/gi, "menata elemen koridor ruang jalan tanpa mengurangi vegetasi alami")
    .replace(/mengurangi vegetasi/gi, "menata koridor jalan secara optimal")
    .replace(/penebangan pohon/gi, "perlindungan vegetasi koridor")
    .replace(/penataan kanopi/gi, "penataan koridor jalan")
    .replace(/penempatan tiang(\s*(atau|dan)\s*elemen jalan yang lebih rendah)?/gi, "penataan koridor jalan")
    .replace(/tiang atau elemen jalan yang lebih rendah/gi, "elemen koridor jalan")
    .replace(/pengaturan vegetasi agar tetap memberi naungan/gi, "penataan koridor dengan tetap mempertahankan vegetasi")
    .replace(/mendekati standar( yang lebih memadai)?/gi, "mencapai alokasi ruang yang lebih optimal")
    .replace(/sesuai standar/gi, "lebih memadai");

  // 2. Koreksi ketidaksesuaian kata "kritis", kausalitas palsu, dan subjektivitas pengalaman manusia pada Cause
  cause = cause
    .replace(/penyebab utama (rendahnya )?UVI/gi, "indikator yang paling perlu diperhatikan pada aspek UVI")
    .replace(/faktor kausal/gi, "faktor yang perlu mendapat perhatian")
    .replace(/kurang (ber)?napas/gi, "memiliki keterbukaan pandangan ke langit yang terbatas")
    .replace(/terasa tertutup( dan kurang bernapas)?/gi, "keterbukaan visual koridor sangat terbatas")
    .replace(/ruang visual terasa sangat tertutup/gi, "keterbukaan pandangan ke arah langit sangat terbatas")
    .replace(/masih sangat kecil/gi, "masih terbatas")
    .replace(/tergolong sangat kecil/gi, "tergolong terbatas")
    .replace(/sangat kecil/gi, "terbatas")
    .replace(/kurang dari 10 ulasan/gi, "jumlah ulasan relatif sedikit");

  if (diagnosis.severity !== "critical") {
    cause = cause
      .replace(/kondisi fisik yang kritis/gi, "kondisi fisik yang perlu menjadi perhatian")
      .replace(/sangat kritis/gi, "perlu perhatian")
      .replace(/\bkritis\b/gi, "perlu perhatian");
  }

  // 3. Bersihkan halusinasi risiko tabrakan, kelelahan, dan persepsi/kenyamanan manusia dari Impact
  impact = impact
    .replace(/membuat koridor terasa sempit dan kurang nyaman bagi pejalan kaki/gi, "dapat berpotensi membatasi kualitas visual koridor bagi pejalan kaki")
    .replace(/memperburuk mobilitas pedestrian,\s*meningkatkan risiko tabrakan atau kelelahan saat berjalan/gi, "membatasi ruang gerak pejalan kaki di sepanjang koridor")
    .replace(/risiko tabrakan\s*(atau|dan)?\s*kelelahan( saat berjalan)?/gi, "keterbatasan ruang gerak pejalan kaki")
    .replace(/meningkatkan risiko tabrakan/gi, "membatasi ruang gerak pedestrian")
    .replace(/kelelahan saat berjalan/gi, "keterbatasan ruang berjalan")
    .replace(/dapat membuat pejalan kaki merasa tidak nyaman secara visual( dan mengurangi ruang gerak yang aman saat menuju halte)?/gi, "dapat berpotensi membatasi kualitas visual koridor dan ruang gerak pejalan kaki")
    .replace(/membuat pejalan kaki merasa tidak nyaman secara visual/gi, "dapat berpotensi membatasi kualitas visual koridor")
    .replace(/kenyamanan visual pejalan kaki/gi, "keterbukaan visual koridor")
    .replace(/kenyamanan visual/gi, "kualitas visual")
    .replace(/kenyamanan pejalan kaki/gi, "alokasi ruang pejalan kaki")
    .replace(/kenyamanan penggunaan koridor/gi, "kualitas ruang koridor")
    .replace(/Akibatnya,?\s*pengalaman berjalan kaki menjadi kurang menyenangkan dan dapat mengurangi keinginan warga untuk menggunakan jalur tersebut\.?/gi, "Sehingga aspek lingkungan fisik pada segmen ini perlu mendapat perhatian perencanaan.")
    .replace(/dapat mengurangi keinginan warga untuk menggunakan jalur( tersebut)?/gi, "menunjukkan perlunya penataan koridor lingkungan fisik yang lebih baik")
    .replace(/menurunkan kepuasan warga dalam menggunakan jalur pejalan kaki tersebut\.?/gi, "menunjukkan perlunya peningkatan alokasi ruang pedestrian pada koridor tersebut.")
    .replace(
      /Kondisi ini juga dapat mempengaruhi aktivitas ekonomi dan penggunaan ruang publik di sekitar segmen\.?/gi,
      "Kondisi tersebut berpotensi membatasi alokasi ruang mobilitas aktif dan kualitas ruang pejalan kaki di sekitar koridor transit."
    );

  // 4. Bersihkan formatting markdown (*, **, #, >) dan simbol panah agar naratif dan natural
  condition = cleanMarkdownFormatting(condition);
  cause = cleanMarkdownFormatting(cause);
  impact = cleanMarkdownFormatting(impact);
  action = cleanMarkdownFormatting(action);

  return { condition, cause, impact, action };
}

// ── Groq LLM Integration ───────────────────────────────────────────────
async function callGroqLLM(data: SegmentData, diagnosis: CCIADiagnosis): Promise<CCIAOutput> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY not set");
  }

  const systemPrompt = `Kamu adalah VISTA AI Spatial Assistant, yaitu asisten analisis tata ruang yang membantu pengguna memahami kondisi Urban Vitality Index (UVI) pada tingkat segmen jalan/TAS-Nit di Kota Bandung.

PERAN AI:
Kamu BUKAN penghitung UVI dan BUKAN sumber data spasial utama.
Seluruh nilai UVI, skor pilar, dan indikator telah dihitung sebelumnya oleh sistem VISTA.
Tugasmu adalah menerjemahkan diagnosis teknis sistem VISTA ke dalam narasi bahasa Indonesia yang membumi (grass-root), konkret, data-grounded, dan ilmiah tanpa jargon rumit.

==================================================
KAMUS INDIKATOR VISTA (DEFINISI RESMI):
==================================================
Gunakan definisi resmi VISTA berikut tanpa membuat patokan angka threshold fiktif:
- Sky View Factor (SVF):
  Proporsi pandangan ke arah langit terbuka yang terlihat dari koridor jalan. Nilai yang lebih rendah menunjukkan keterbukaan pandangan ke langit yang lebih terbatas.
- Green View Index (GVI):
  Persentase tampilan visual lingkungan koridor jalan yang diisi oleh pepohonan dan vegetasi hijau alami.
- Rasio Trotoar (Sidewalk Ratio):
  Proporsi ruang koridor jalan yang dialokasikan khusus bagi pergerakan pejalan kaki.
- Enclosure:
  Tingkat keterkungkungan visual koridor yang dibentuk oleh batas koridor jalan.
- Aksesibilitas Halte Transit:
  Jarak berjalan kaki nyata dari segmen menuju titik halte angkutan umum terdekat (kategori: Sangat Dekat <200m, Dekat 200-400m, Sedang 400-800m, Jauh >800m).
- Resident & Activity:
  Skor komposit dari penggabungan 50% data Google Places Reviews (fasilitas statis via Lexicon NLP) dan 50% data aktivitas masyarakat MAPID (dinamis crowdsourced via IndoBERT NLP). Keterwakilan sampel Google diukur melalui Sample Confidence (Terbatas jika jumlah ulasan relatif sedikit).

==================================================
ATURAN GROUNDED INTERPRETATION (DISIPLIN ILMIAH & DATA SPASIAL):
==================================================
1. Bedakan tegas antara DATA, INTERPRETASI, dan ASUMSI:
   - DATA: nilai numerik yang tersedia dalam data input segmen.
   - INTERPRETASI: penjelasan objektif yang diturunkan langsung dari indikator spasial.
   - ASUMSI: kondisi fisik mikro, penyebab spesifik, atau fakta yang tidak tersedia dalam input (DILARANG dibuat/diasumsikan!).
2. JANGAN menyatakan asumsi sebagai fakta.
3. Untuk indikator fisik koridor:
   - SVF rendah TIDAK BOLEH dianggap disebabkan oleh pohon, kanopi, bangunan, tiang, atau elemen tertentu kecuali data tersebut tersedia.
   - Sidewalk Ratio rendah TIDAK BOLEH dianggap disebabkan oleh trotoar rusak, parkir liar, pedagang, hambatan fisik, atau kondisi tertentu kecuali data tersebut ada.
   - GVI TIDAK BOLEH digunakan untuk menyimpulkan bahwa vegetasi tertentu harus dikurangi, dipotong, atau dipindahkan. DILARANG menyarankan menebang/memangkas pohon demi menaikkan SVF! Pertahankan vegetasi alami (GVI).
4. DILARANG menggunakan istilah persepsi atau pengalaman psikologis manusia:
   "terasa tertutup", "kurang bernapas", "kurang napas", "nyaman", "tidak nyaman", "kelelahan", "enggan berjalan", atau istilah serupa karena VISTA tidak mengukur pengalaman psikologis.
5. DILARANG membuat threshold, standar, atau target numerik fiktif:
   Jika tidak tersedia dalam data, JANGAN menyebut "sesuai standar", "di bawah standar", "mendekati standar", target rasio baru, atau target meter trotoar.
6. JIKA pengguna meminta penyebab spesifik atau intervensi spesifik yang tidak dapat ditentukan dari data:
   Nyatakan keterbatasan data secara jujur dan ilmiah: "Berdasarkan data VISTA yang tersedia, hal tersebut belum dapat ditentukan secara spesifik karena memerlukan survei lapangan tambahan." Jangan menebak!
7. JANGAN menganggap indikator terendah sebagai hubungan sebab-akibat (kausalitas) mutlak.
   Gunakan istilah: "indikator yang paling perlu diperhatikan", BUKAN "penyebab utama UVI rendah" atau "faktor kausal".
8. TRANSPARANSI DUA SUMBER SENTIMEN:
   - Data sentimen VISTA bersumber dari gabungan Google Places Reviews (fasilitas komersial/layanan) dan MAPID Activities (IndoBERT NLP).
   - Jika ulasan Google sedikit, AI WAJIB transparan menyatakan bahwa keterwakilan sampel masih terbatas karena jumlah ulasan yang tersedia relatif sedikit (sample confidence terbatas), sambil menyebutkan kontribusi aktivitas crowdsourcing MAPID. Jangan mengarang angka aturan threshold sendiri.

==================================================
ATURAN BAHASA GRASS ROOT (KONKRET & DISIPLIN DATA):
==================================================
1. Format penjelasan indikator teknis:
   Susun sebagai kalimat naratif yang utuh dan mengalir: sebutkan nama indikator teknis, jelaskan arti sederhananya, sertakan nilai persentase/angkanya, lalu sampaikan maknanya di lapangan.
   Contoh naratif:
   "Sky View Factor (SVF) sebesar 6,4% berarti hanya sekitar 6,4% pandangan dari koridor jalan yang mengarah ke langit terbuka. Nilai ini menunjukkan keterbukaan pandangan ke langit pada segmen ini sangat terbatas."
2. Hindari kalimat abstrak, dan jangan mengarang penyebab fisik di luar data (misal: jangan sebut "disebabkan oleh gedung tinggi" karena data gedung tidak ada).

==================================================
ATURAN DIAGNOSIS & SEVERITY:
==================================================
1. RULE-BASED DIAGNOSIS adalah diagnosis resmi sistem VISTA.
   LLM TIDAK BOLEH mengganti pilar terlemah, indikator utama, maupun severity.
2. Tingkat urgensi segmen ini adalah: "${diagnosis.severity_label}" (severity code: ${diagnosis.severity}).
   - DILARANG menyebut kondisi ini sebagai "kritis" jika severity berstatus "${diagnosis.severity_label}"!
   - Untuk status "Sedang (Perlu Perhatian)", gunakan frasa: "faktor yang perlu menjadi perhatian pada aspek ${diagnosis.primary_issue}".

==================================================
KERANGKA CCIA:
==================================================
Condition (2-3 kalimat):
- Jelaskan kondisi segmen: nama jalan, skor UVI (${data.uvi_score.toFixed(3)} - kelas ${diagnosis.uvi_class}), jarak ke halte transit terdekat (${data.distance_to_stop_m.toFixed(0)}m - ${data.walking_class}), dan sebutkan pilar terlemah yang membutuhkan perhatian (${diagnosis.primary_issue} ${ (diagnosis.primary_issue === 'Lingkungan Fisik' ? data.physical_score : diagnosis.primary_issue === 'Aksesibilitas' ? data.accessibility_score : data.sentiment_score).toFixed(3) }).

Cause (2-3 kalimat):
- Jelaskan indikator utama dengan kalimat naratif mengalir: sebutkan nama indikator, arti sederhana, nilai aktual, dan makna kondisi di lapangan tanpa mengklaim kausalitas mutlak.
- Contoh naratif: Sky View Factor (SVF) sebesar 6,4% berarti hanya sekitar 6,4% pandangan dari koridor jalan yang mengarah ke langit terbuka, sehingga keterbukaan pandangan ke langit sangat terbatas. Rasio Trotoar sebesar 7,3% menunjukkan bahwa hanya sekitar 7,3% ruang koridor yang dialokasikan untuk pergerakan pejalan kaki, sehingga porsi ruang pedestrian masih terbatas. Kedua indikator tersebut menjadi faktor yang perlu diperhatikan pada aspek Lingkungan Fisik.
- Diksi rasio/proporsi: Gunakan frasa "masih terbatas" (BUKAN "sangat kecil" atau "sangat rendah") agar tidak menimbulkan kesan ambang batas metodologis fiktif.
- DILARANG menggunakan simbol panah (→), tanda (->), atau format skema database dalam output!
- Patuhi aturan severity: jika severity adalah Sedang, sebutkan sebagai "faktor yang perlu mendapat perhatian", BUKAN "kondisi kritis".

Impact (2-3 kalimat):
- Jelaskan implikasi potensial dari indikator yang teridentifikasi terhadap kondisi fisik koridor pejalan kaki. Gunakan frasa "dapat berpotensi" untuk menjaga posisi VISTA sebagai decision-support.
- Contoh terukur: Keterbatasan pandangan ke langit dapat berpotensi mengurangi kualitas visual koridor jalan. Rasio trotoar yang rendah menunjukkan keterbatasan ruang yang dialokasikan untuk pergerakan pejalan kaki, sehingga kualitas ruang pedestrian pada segmen ini perlu mendapat perhatian.
- DILARANG mengklaim risiko tabrakan, kelelahan pejalan kaki, dampak psikologis, penurunan keinginan warga, atau dampak ekonomi makro.

Action (2-3 kalimat):
- Berikan 1-2 arah intervensi penataan ruang koridor jalan yang membumi dan langsung berkaitan dengan indikator bermasalah.
- Jangan melompat ke solusi desain yang tidak didukung data (jangan sebut memperluas area terbuka, alokasi lebar meter trotoar, ubah lajur kendaraan, elemen non-pejalan kaki, elemen vertikal, fasad bangunan, atau dinding transparan).
- Contoh terarah: Fokuskan penataan elemen ruang koridor untuk meningkatkan keterbukaan visual ke langit, sambil tetap mempertahankan vegetasi hijau yang ada (GVI ${ (data.gvi * 100).toFixed(1) }%). Selanjutnya, lakukan evaluasi penataan ruang jalan untuk meningkatkan porsi ruang yang dapat digunakan pejalan kaki, mengingat Rasio Trotoar tercatat sebesar ${ (data.sidewalk * 100).toFixed(1) }%.
- DILARANG menyebut fasad bangunan, dinding transparan, setback, perubahan ketinggian struktur, atau pengurangan pohon.

==================================================
GAYA OUTPUT:
==================================================
- Bahasa Indonesia formal namun membumi, komunikatif, naratif, ringkas, dan konkret (2-3 kalimat per bagian).
- DILARANG KERAS menggunakan simbol panah (→), panah teks (->), bullet teknis, atau format database kaku dalam output. Susun penjelasan sebagai kalimat naratif yang natural dan mudah dipahami.
- Jangan menggunakan emoji.
- DILARANG menggunakan formatting markdown seperti tanda bintang (** atau *) untuk menebalkan/memiringkan teks, tanda pagar (#), atau blockquote (>). Tuliskan seluruh teks narasi dalam plain text yang bersih tanpa simbol bintang.
- Output WAJIB berupa JSON murni dengan struktur:
{
  "condition": "...",
  "cause": "...",
  "impact": "...",
  "action": "..."
}`;

  const contextPayload = {
    segment: {
      tasnit_code: data.tasnit_code,
      street_name: data.street_name,
      nearest_stop: data.nearest_stop,
      distance_to_stop_m: Math.round(data.distance_to_stop_m),
      walking_class: data.walking_class,
    },
    scores: {
      uvi: Number(data.uvi_score.toFixed(3)),
      uvi_class: diagnosis.uvi_class,
      accessibility: Number(data.accessibility_score.toFixed(3)),
      physical_environment: Number(data.physical_score.toFixed(3)),
      resident_and_activity: Number(data.sentiment_score.toFixed(3)),
    },
    physical_indicators: {
      gvi_green_view: `${(data.gvi * 100).toFixed(1)}%`,
      svf_sky_view: `${(data.svf * 100).toFixed(1)}%`,
      sidewalk_ratio: `${(data.sidewalk * 100).toFixed(1)}%`,
      enclosure_ratio: `${(data.enclosure * 100).toFixed(1)}%`,
    },
    resident_activity_indicators: {
      composite_sentiment_score: Number(data.sentiment_score.toFixed(3)),
      google_reviews: {
        source: "Google Places Reviews (Lexicon NLP)",
        n_reviews: data.n_reviews,
        n_places: data.n_places,
        avg_rating: data.avg_rating,
        positive_ratio: `${(data.positive_ratio * 100).toFixed(1)}%`,
        sample_confidence:
          data.n_reviews < 10
            ? "Terbatas (jumlah ulasan relatif sedikit)"
            : data.n_reviews < 30
            ? "Cukup"
            : "Tinggi",
      },
      mapid_activities: {
        source: "Ekosistem Crowdsourcing MAPID (IndoBERT NLP)",
        n_activities: data.mapid_activity_count,
        sentiment_score:
          data.mapid_activity_count > 0 && data.mapid_activity_sent_score !== null
            ? Number(data.mapid_activity_sent_score.toFixed(3))
            : "Tidak tersedia (belum ada aktivitas terdata; ketiadaan data bukan berarti sentimen netral atau negatif)",
      },
      fusion_method: "Bobot Setara 50% Google Reviews + 50% MAPID Crowdsourced Activities",
      poi_distribution: {
        pendidikan: data.poi_pendidikan,
        kesehatan: data.poi_kesehatan,
        komersial: data.poi_komersial,
        katering: data.poi_katering,
        finansial: data.poi_finansial,
        olahraga: data.poi_olahraga,
      },
    },
    rule_based_diagnosis: {
      primary_issue: diagnosis.primary_issue,
      primary_pillar: diagnosis.primary_pillar,
      contributing_indicator: diagnosis.contributing_indicator,
      secondary_indicator: diagnosis.secondary_indicator,
      severity_code: diagnosis.severity,
      severity_label: diagnosis.severity_label,
      uvi_class: diagnosis.uvi_class,
    },
  };

  const userPrompt = `Lakukan analisis AI Spatial Insight untuk segmen TAS-Nit berikut berdasarkan diagnosis sistem VISTA.

DATA SEGMEN & RULE-BASED DIAGNOSIS:
${JSON.stringify(contextPayload, null, 2)}

INSTRUKSI WAJIB (DATA-GROUNDED & DISIPLIN METODOLOGI):
1. Condition: Jelaskan lokasi, skor UVI, kelas UVI, jarak ke halte transit terdekat, dan pilar terendah. (2-3 kalimat)
2. Cause: Jelaskan KEDUA indikator terendah yang teridentifikasi (${diagnosis.contributing_indicator} dan ${diagnosis.secondary_indicator}) secara runtut dalam kalimat naratif yang mengalir (sebutkan nama indikator, jelaskan arti sederhana, cantumkan nilai aktual, dan jelaskan maknanya di lapangan). DILARANG menggunakan simbol panah (→) atau format database! Jika terkait sentimen warga, bedakan antara ulasan fasilitas Google dan aktivitas crowdsourcing MAPID secara transparan. KEDUA indikator ini WAJIB muncul di Cause agar konsisten dan selaras dengan Dampak dan Rekomendasi! Gunakan istilah "indikator yang paling perlu diperhatikan", JANGAN sebut "penyebab utama UVI rendah" atau "kritis" jika statusnya Sedang! (2-3 kalimat)
3. Impact: Jelaskan implikasi potensial dari keterbatasan kedua indikator tersebut pada kualitas visual koridor jalan dan keterbatasan ruang pedestrian dengan kata "dapat berpotensi". DILARANG mengarang risiko tabrakan, kelelahan pejalan kaki, atau perilaku/keinginan warga! (2-3 kalimat)
4. Action: Berikan 1-2 arah penataan ruang koridor yang fokus pada penataan keterbukaan visual koridor (tetap mempertahankan vegetasi hijau/GVI) dan evaluasi penataan ruang jalan untuk porsi pejalan kaki. DILARANG melompat ke desain arsitektural spesifik (jangan sebut memperluas area terbuka, alokasi lebar meter trotoar, ubah lajur kendaraan, elemen non-pejalan kaki, elemen vertikal, fasad bangunan, atau biaya). (2-3 kalimat)

Kembalikan HANYA format JSON valid:
{
  "condition": "...",
  "cause": "...",
  "impact": "...",
  "action": "..."
}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Empty response from Groq");
  }

  const parsed = JSON.parse(content);

  const rawOutput: CCIAOutput = {
    condition: parsed.condition || "Data kondisi tidak tersedia.",
    cause: parsed.cause || "Data penyebab tidak tersedia.",
    impact: parsed.impact || "Data dampak tidak tersedia.",
    action: parsed.action || "Data rekomendasi tidak tersedia.",
  };

  // Validasi dan sanitasi output LLM untuk menjaga kesesuaian
  // dengan data, diagnosis, dan batasan metodologi VISTA.
  return sanitizeCCIA(rawOutput, diagnosis);
}

// ── Follow-up Chat Handler ─────────────────────────────────────────────
async function handleFollowUp(
  question: string,
  data: SegmentData,
  diagnosis: CCIADiagnosis,
  previousCCIA: CCIAOutput,
  history?: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return "Fitur tanya-jawab memerlukan API key Groq. Silakan tambahkan GROQ_API_KEY di environment variables (.env.local).";
  }

  const systemPrompt = `Kamu adalah VISTA AI Spatial Assistant yang membantu pengguna memahami satu segmen jalan berdasarkan data VISTA di Kota Bandung secara membumi (grass-root) dan komunikatif.

DATA VALID SEGMEN VISTA:
- Segmen: ${data.street_name} (${data.tasnit_code})
- UVI Score: ${data.uvi_score.toFixed(3)} (${diagnosis.uvi_class})
- Pilar Aksesibilitas: ${data.accessibility_score.toFixed(3)} | Halte: ${data.nearest_stop} (${data.distance_to_stop_m.toFixed(0)}m, kelas: ${data.walking_class})
- Pilar Lingkungan Fisik: ${data.physical_score.toFixed(3)}
  - GVI: ${(data.gvi * 100).toFixed(1)}% (porsi tampilan hijau dedaunan/pohon)
  - SVF: ${(data.svf * 100).toFixed(1)}% (porsi pandangan ke arah langit terbuka)
  - Rasio Trotoar: ${(data.sidewalk * 100).toFixed(1)}% (porsi ruang jalan untuk pejalan kaki)
  - Enclosure: ${(data.enclosure * 100).toFixed(1)}% (tingkat keterkungkungan koridor)
- Pilar Resident & Activity: ${data.sentiment_score.toFixed(3)} (Fusi 50% Google Reviews + 50% MAPID Crowdsourced Activities)
  - Sumber 1 - Google Places (NLP Lexicon): Rating ${data.avg_rating.toFixed(1)}/5.0, Sentimen Positif ${(data.positive_ratio * 100).toFixed(1)}%, Total Ulasan: ${data.n_reviews} (${data.n_reviews < 10 ? "Tingkat Keterwakilan Sampel Terbatas" : data.n_reviews < 30 ? "Sampel Cukup" : "Sampel Tinggi"}) pada ${data.n_places} POI
  - Sumber 2 - MAPID Activities (NLP IndoBERT): ${data.mapid_activity_count} aktivitas terdata ${data.mapid_activity_count > 0 && data.mapid_activity_sent_score !== null ? `(skor sentimen: ${(data.mapid_activity_sent_score * 100).toFixed(1)}%)` : "(Belum ada aktivitas warga terdata pada segmen ini; ketiadaan data bukan berarti sentimen netral atau negatif)"}

DIAGNOSIS AWAL SISTEM (RULE-BASED CCIA):
- Pilar Terlemah: ${diagnosis.primary_issue}
- Indikator Utama: ${diagnosis.contributing_indicator}
- Indikator Sekunder: ${diagnosis.secondary_indicator}
- Tingkat Urgensi: ${diagnosis.severity_label}

HASIL ANALISIS CCIA SEBELUMNYA:
- Condition: ${previousCCIA.condition}
- Cause: ${previousCCIA.cause}
- Impact: ${previousCCIA.impact}
- Action: ${previousCCIA.action}

ATURAN GROUNDED INTERPRETATION (DISIPLIN ILMIAH & BATAS DATA SPASIAL):
1. Bedakan tegas antara DATA, INTERPRETASI, dan ASUMSI:
   - DATA adalah nilai numerik yang tersedia dalam data valid segmen VISTA di atas.
   - INTERPRETASI adalah penjelasan objektif yang diturunkan langsung dari data spasial.
   - ASUMSI adalah kondisi fisik mikro, penyebab detail lapangan, atau fakta yang tidak ada dalam data (DILARANG dibuat/diasumsikan!).
2. JANGAN menyatakan asumsi sebagai fakta.
3. Untuk indikator fisik koridor:
   - SVF rendah TIDAK BOLEH dianggap disebabkan oleh pohon, kanopi, bangunan, tiang, atau elemen tertentu kecuali data tersebut ada dalam data segmen di atas.
   - Sidewalk Ratio rendah TIDAK BOLEH dianggap disebabkan oleh trotoar rusak, parkir liar, pedagang, hambatan fisik, atau kondisi tertentu kecuali data tersebut ada.
   - GVI TIDAK BOLEH digunakan untuk menyimpulkan bahwa vegetasi tertentu harus dikurangi, dipangkas, atau dipindahkan.
   - JIKA ditanya apakah pohon perlu ditebang untuk menaikkan SVF: Jawab secara tegas bahwa TIDAK DAPAT disimpulkan bahwa pohon perlu ditebang hanya berdasarkan nilai SVF. Segmen ini memiliki GVI (vegetasi) yang tetap perlu dipertahankan, dan nilai SVF hanya menunjukkan keterbukaan langit makro tanpa menunjukkan vegetasi sebagai penyebabnya. Elemen fisik spesifik penyebab rendahnya nilai tersebut memerlukan data atau survei lapangan tambahan.
4. DILARANG menggunakan istilah persepsi atau pengalaman psikologis manusia:
   "terasa tertutup", "kurang bernapas", "kurang napas", "nyaman", "tidak nyaman", "kelelahan", "enggan berjalan", atau istilah serupa karena VISTA tidak mengukur pengalaman psikologis.
5. DILARANG membuat threshold, standar, atau target numerik fiktif:
   Jika tidak ada data standar dalam konteks, JANGAN menyebut "sesuai standar", "di bawah standar", "mendekati standar", target persentase trotoar baru, atau target meter trotoar resmi.
   - JIKA ditanya berapa meter trotoar yang harus ditambah:
     Jelaskan bahwa data segmen mencatat Rasio Trotoar sebesar ${(data.sidewalk * 100).toFixed(1)}%. Karena VISTA belum menetapkan target rasio trotoar yang harus dicapai, kebutuhan penambahan dalam meter belum dapat ditentukan sebagai rekomendasi VISTA. Penentuan kebutuhan fisik memerlukan target perencanaan kebijakan kota dan data dimensi koridor teknis yang sesuai.
6. JIKA pengguna meminta penyebab spesifik atau intervensi mikro spesifik yang tidak dapat ditentukan dari data:
   Katakan dengan jujur dan ilmiah: "Berdasarkan data VISTA yang tersedia, hal tersebut belum dapat ditentukan secara spesifik." Jangan menebak!
7. JANGAN mengklaim hubungan sebab-akibat (kausalitas) mutlak; gunakan frasa "indikator yang paling perlu diperhatikan", bukan "penyebab utama UVI rendah".
8. TRANSPARANSI DUA SUMBER SENTIMEN: Bedakan secara jelas antara data Google Places Reviews (fasilitas statis via analisis lexicon) dan MAPID Activities (laporan dinamis warga via IndoBERT). Jika ulasan Google sedikit, sampaikan bahwa indikasi sentimen positif yang ada tingkat keterwakilannya masih terbatas karena jumlah ulasan yang tersedia relatif sedikit (sample confidence terbatas), tanpa membuat aturan batas angka buatan (jangan sebut aturan '<10 ulasan'). Ketiadaan data MAPID (0 aktivitas) bukan berarti sentimen netral atau negatif.
9. BATASAN FUNGSI AI SPATIAL INSIGHT:
   - Fokus utama AI adalah memberikan interpretasi terhadap data dan diagnosis spasial yang tersedia pada WebGIS VISTA.
   - AI BUKAN general-purpose coding assistant, kalkulator teknis, perancang teknis trotoar, atau estimator konstruksi fisik.
   - Jika pengguna meminta kode Python, skrip pemrograman, kalkulasi teknis, atau estimasi dimensi fisik mikro di luar fungsi analisis VISTA, JANGAN mengalihkan peran menjadi asisten pemrograman atau pembuat skrip. Tarik kembali pembahasan ke konteks WebGIS VISTA.
   - Jawab berdasarkan konteks data segmen VISTA dan jelaskan apakah informasi tersebut tersedia dalam data.
   - Sampaikan secara lugas: VISTA mencatat indikator makro spasial (seperti Rasio Trotoar ${(data.sidewalk * 100).toFixed(1)}%). VISTA tidak menetapkan target rasio trotoar dan tidak menghitung kebutuhan penambahan dimensi meter fisik secara sepihak.
   - Jika perhitungan membutuhkan parameter atau data teknis yang belum tersedia di sistem VISTA (seperti target perencanaan resmi atau survei koridor lapangan), jelaskan keterbatasannya secara singkat, ilmiah, dan objektif.
   - Jangan membuat nilai baru hanya agar perhitungan dapat dilakukan.
   - Jangan mengubah indikator VISTA menjadi ukuran fisik atau rekomendasi teknis tanpa dasar data yang jelas.
10. Gunakan bahasa Indonesia formal, ramah, komunikatif, dan lugas khas perencana tata kota. Jawaban harus ringkas dan terarah. DILARANG menggunakan simbol panah (→). DILARANG KERAS menggunakan simbol formatting markdown asteris (** atau *) untuk penekanan kata/bold, tanda pagar (#), atau blockquote (>). Tuliskan narasi dalam plain text bersih tanpa simbol bintang. Gunakan tanda strip (-) untuk daftar poin.`;

  const chatMessages = [
    { role: "system" as const, content: systemPrompt },
    ...(Array.isArray(history)
      ? history.slice(-6).map((msg) => ({
          role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
          content: msg.content,
        }))
      : []),
    { role: "user" as const, content: question },
  ];

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: chatMessages,
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const result = await response.json();
  let answer = result.choices?.[0]?.message?.content || "Maaf, tidak dapat memproses pertanyaan saat ini.";

  // Sanitize follow-up answers from hallucinated terms
  answer = answer
    .replace(/penyesuaian setback bangunan(\s*(dan|atau)\s*pengurangan ketinggian struktur)?/gi, "penataan koridor ruang jalan")
    .replace(/pengurangan ketinggian struktur/gi, "penataan elemen visual koridor")
    .replace(/setback bangunan/gi, "ruang koridor jalan")
    .replace(/ketinggian (bangunan|struktur)/gi, "keterbukaan ruang jalan")
    .replace(/penyebab utama (rendahnya )?UVI/gi, "indikator yang paling perlu diperhatikan pada aspek UVI")
    .replace(/faktor kausal/gi, "faktor yang perlu mendapat perhatian")
    .replace(/memperluas area terbuka/gi, "penataan keterbukaan visual koridor")
    .replace(/alokasikan lebar tambahan/gi, "penataan ruang pejalan kaki")
    .replace(/kurang (ber)?napas/gi, "memiliki keterbukaan pandangan ke langit yang terbatas")
    .replace(/terasa tertutup( dan kurang bernapas)?/gi, "memiliki keterbukaan visual yang terbatas")
    .replace(/menurunkan kenyamanan visual pejalan kaki/gi, "menjadi indikator yang perlu diperhatikan")
    .replace(/kenyamanan visual/gi, "keterbukaan visual koridor")
    .replace(/kenyamanan pejalan kaki/gi, "alokasi ruang pejalan kaki")
    .replace(/penataan kanopi/gi, "penataan koridor jalan")
    .replace(/penempatan tiang(\s*(atau|dan)\s*elemen jalan yang lebih rendah)?/gi, "penataan koridor jalan")
    .replace(/tiang atau elemen jalan yang lebih rendah/gi, "elemen koridor jalan")
    .replace(/pengaturan vegetasi agar tetap memberi naungan/gi, "penataan koridor dengan tetap mempertahankan vegetasi")
    .replace(/mendekati standar( yang lebih memadai)?/gi, "mencapai alokasi ruang yang lebih optimal")
    .replace(/sesuai standar/gi, "lebih memadai")
    .replace(/kurang dari 10 ulasan/gi, "jumlah ulasan relatif sedikit")
    .replace(/menurunkan fleksibilitas pergerakan/gi, "membatasi ruang gerak pejalan kaki")
    .replace(/memengaruhi keselamatan serta kenyamanan/gi, "memengaruhi alokasi ruang jalan")
    .replace(/keselamatan serta kenyamanan/gi, "alokasi ruang koridor")
    .replace(/keselamatan pengguna jalan/gi, "alokasi ruang pejalan kaki")
    .replace(/warga sangat puas/gi, "ulasan terdata menunjukkan sentimen positif");

  answer = cleanMarkdownFormatting(answer);

  return answer;
}

// ── API Route Handler ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { segmentData, mode, question, previousCCIA, history } = body;

    if (!segmentData) {
      return NextResponse.json({ error: "segmentData is required" }, { status: 400 });
    }

    // Parse segment data with safe defaults
    const data: SegmentData = {
      tasnit_id: String(segmentData.id || segmentData.tas_nit_id || ""),
      tasnit_code: String(segmentData.tas_nit_code || "TASnit"),
      street_name: String(segmentData.street_name || "Koridor"),
      nearest_stop: String(segmentData.nearest_stop || "N/A"),
      distance_to_stop_m: Number(segmentData.avg_distance_to_stop) || 0,
      walking_class: String(segmentData.walking_class || "N/A"),
      uvi_score: Number(segmentData.uvi_score) || 0,
      accessibility_score: Number(segmentData.accessibility_score) || 0,
      physical_score: Number(segmentData.physical_score) || 0,
      sentiment_score: Number(segmentData.sentiment_score) || 0,
      gvi: Number(segmentData.gvi) || 0,
      svf: Number(segmentData.svf) || 0,
      sidewalk: Number(segmentData.sidewalk) || 0,
      enclosure: Number(segmentData.enclosure) || 0,
      road_width: Number(segmentData.road_width) || 0,
      n_reviews: Number(segmentData.n_reviews) || 0,
      n_places: Number(segmentData.n_places) || 0,
      avg_rating: Number(segmentData.avg_rating) || 0,
      positive_ratio: Number(segmentData.positive_ratio) || 0,
      mapid_activity_count: Number(segmentData.mapid_activity_count) || 0,
      mapid_activity_sent_score:
        Number(segmentData.mapid_activity_count) > 0 &&
        segmentData.mapid_activity_sent_score !== undefined &&
        segmentData.mapid_activity_sent_score !== null
          ? Number(segmentData.mapid_activity_sent_score)
          : null,
      poi_pendidikan: Number(segmentData.poi_pendidikan) || 0,
      poi_kesehatan: Number(segmentData.poi_kesehatan) || 0,
      poi_komersial: Number(segmentData.poi_komersial) || 0,
      poi_katering: Number(segmentData.poi_katering) || 0,
      poi_finansial: Number(segmentData.poi_finansial) || 0,
      poi_olahraga: Number(segmentData.poi_olahraga) || 0,
    };

    // Step 1: Rule-Based CCIA Diagnosis (always runs)
    const diagnosis = diagnose(data);

    // Follow-up chat mode
    if (mode === "chat" && question && previousCCIA) {
      try {
        const answer = await handleFollowUp(question, data, diagnosis, previousCCIA, history);
        return NextResponse.json({ answer, source: "groq" });
      } catch {
        return NextResponse.json({
          answer: "Maaf, layanan AI sedang tidak tersedia. Silakan coba lagi nanti.",
          source: "fallback",
        });
      }
    }

    // Initial analysis mode
    try {
      const ccia = await callGroqLLM(data, diagnosis);
      return NextResponse.json({
        ccia,
        diagnosis,
        source: "groq",
      });
    } catch {
      // Fallback to rule-based CCIA
      const ccia = generateRuleBasedCCIA(data, diagnosis);
      return NextResponse.json({
        ccia,
        diagnosis,
        source: "rule-based",
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
