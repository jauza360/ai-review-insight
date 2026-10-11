# AI Review Insight

**Analisis Ulasan Pelanggan untuk UMKM** — Aplikasi web berbasis HTML/CSS/JavaScript untuk membantu pemilik toko online memahami sentimen pelanggan secara otomatis.

---

## Daftar Isi

1. [Gambaran Umum](#gambaran-umum)
2. [Struktur Proyek](#struktur-proyek)
3. [Cara Menjalankan](#cara-menjalankan)
4. [Fitur Utama](#fitur-utama)
5. [Alur Kerja Sistem](#alur-kerja-sistem)
6. [Format File CSV](#format-file-csv)
7. [Keterbatasan Sistem](#keterbatasan-sistem)
8. [Pengembangan Selanjutnya (API AI)](#pengembangan-selanjutnya)
9. [Skenario Pengujian](#skenario-pengujian)
10. [Teknologi yang Digunakan](#teknologi-yang-digunakan)

---

## Gambaran Umum

AI Review Insight adalah alat bantu analisis ulasan pelanggan yang dirancang untuk pemilik UMKM. Alih-alih membaca ratusan ulasan satu per satu, sistem ini secara otomatis:

- Mengklasifikasikan setiap ulasan menjadi **positif, netral, atau negatif**
- Mendeteksi **aspek produk** yang dibahas (kualitas, pengiriman, harga, pelayanan, kesesuaian)
- Merangkum **kelebihan dan keluhan** utama pelanggan
- Memberikan **rekomendasi perbaikan** berdasarkan data

> ⚠️ **Penting:** Sistem ini menggunakan pendekatan *rule-based keyword matching*, bukan model AI/ML sesungguhnya. Lihat bagian [Keterbatasan Sistem](#keterbatasan-sistem).

---

## Struktur Proyek

```
ai-review-insight/
│
├── index.html              # Halaman utama (antarmuka dashboard)
│
├── css/
│   └── style.css           # Stylesheet (tema navy/putih/biru, responsif)
│
├── js/
│   ├── analyzer.js         # Engine analisis (sentiment scoring, aspek, ringkasan)
│   └── app.js              # Logika UI (input, render, filter, ekspor)
│
├── data/
│   └── sample_data.csv     # Dataset contoh (50 ulasan, 3 kategori produk)
│
└── README.md               # Dokumentasi ini
```

---

## Cara Menjalankan

### Cara 1: Buka Langsung (Paling Mudah)

Karena aplikasi ini berjalan sepenuhnya di browser tanpa backend:

1. **Buka file explorer** dan navigasi ke folder `ai-review-insight/`
2. **Klik dua kali** file `index.html`
3. Browser akan membuka aplikasi secara otomatis

> Catatan: Pastikan koneksi internet tersedia saat pertama membuka, karena Chart.js dimuat dari CDN. Setelah itu bisa offline.

### Cara 2: Via Live Server (Direkomendasikan untuk Development)

Jika menggunakan VS Code:

1. Install ekstensi **Live Server** (Ritwick Dey)
2. Klik kanan `index.html` → **"Open with Live Server"**
3. Browser akan membuka `http://127.0.0.1:5500`

### Cara 3: Via Python HTTP Server

```bash
# Masuk ke folder proyek
cd ai-review-insight

# Python 3
python -m http.server 8080

# Buka browser: http://localhost:8080
```

### Cara 4: Via Node.js

```bash
# Install serve secara global (sekali saja)
npm install -g serve

# Jalankan dari folder proyek
cd ai-review-insight
serve .

# Buka browser: http://localhost:3000
```

---

## Fitur Utama

### 1. Input Ulasan

| Metode | Deskripsi |
|--------|-----------|
| **Input Manual** | Ketik atau paste ulasan langsung di textarea (satu baris = satu ulasan) |
| **Upload CSV** | Upload file CSV dengan kolom `ulasan` atau `review` |
| **Contoh Data** | Muat 25 ulasan demo dengan satu klik |

### 2. Analisis Sentimen

Setiap ulasan dianalisis dan dikategorikan:
- 😊 **Positif** — Skor > 0.5
- 😐 **Netral** — Skor antara -0.5 dan 0.5
- 😞 **Negatif** — Skor < -0.5

Setiap hasil disertai **alasan klasifikasi** (kata kunci yang terdeteksi).

### 3. Deteksi Aspek

Sistem mendeteksi 5 aspek produk:
- 🔵 Kualitas Produk
- 📦 Pengiriman
- 💰 Harga
- 💬 Pelayanan Penjual
- ✅ Kesesuaian Produk

### 4. Dashboard

- **Statistik ringkas**: total ulasan, jumlah & persentase per sentimen, skor rata-rata
- **Grafik Donut**: distribusi sentimen
- **Grafik Bar Horizontal**: aspek yang paling banyak dibahas
- **Tabel ulasan**: lengkap dengan sentimen, skor, alasan, dan aspek

### 5. Filter & Pencarian

- Cari ulasan berdasarkan kata kunci (real-time)
- Filter tabel berdasarkan sentimen (Semua / Positif / Netral / Negatif)
- Pagination otomatis (10 ulasan per halaman)

### 6. Ringkasan & Rekomendasi

- Kelebihan produk (dari ulasan positif)
- Keluhan pelanggan (dari ulasan negatif)
- Topik yang sering muncul dengan progress bar
- Rekomendasi perbaikan dengan tingkat prioritas

### 7. Ekspor CSV

Ekspor seluruh hasil analisis ke file CSV (siap dibuka di Excel).

---

## Alur Kerja Sistem

```
[Pengguna Input Ulasan]
         │
         ▼
[Validasi Input] ──── Kosong/Invalid ──→ [Tampilkan Pesan Error]
         │
         ▼
[Parsing Teks] → tokenize(), normalizeText()
         │
         ▼
[Scoring Sentimen] → scoreSentiment()
  • Hitung kemunculan kata positif/negatif
  • Terapkan negasi (tidak, bukan, gak...)
  • Terapkan intensifier (sangat, banget...)
  • Deteksi pola rating bintang
         │
         ▼
[Klasifikasi] → classifySentiment()
  • score > 0.5  → Positif
  • score < -0.5 → Negatif
  • selainnya    → Netral
         │
         ▼
[Deteksi Aspek] → detectAspects()
  • Cocokkan kata kunci per kategori aspek
         │
         ▼
[Agregasi] → generateSummary()
  • Hitung statistik per sentimen
  • Ranking aspek berdasarkan frekuensi
  • Identifikasi kelebihan & keluhan
         │
         ▼
[Rekomendasi] → generateRecommendations()
  • Aturan berbasis threshold persentase sentimen
  • Mapping aspek keluhan → saran spesifik
         │
         ▼
[Render Dashboard]
  • Stats cards
  • Chart.js (donut + bar)
  • Tabel dengan filter/search/pagination
  • Ringkasan + rekomendasi
```

---

## Format File CSV

### Format yang Didukung

File CSV harus memiliki kolom dengan nama salah satu dari:
`ulasan`, `review`, `text`, `teks`, `komentar`, `comment`, `feedback`, `isi`

Jika tidak ada kolom dengan nama tersebut, **kolom pertama akan digunakan secara otomatis**.

### Contoh Format Minimal

```csv
ulasan
"Produk bagus, pengiriman cepat!"
"Kualitas mengecewakan, tidak sesuai foto."
"Biasa saja, standar."
```

### Contoh Format Lengkap (Seperti sample_data.csv)

```csv
ulasan,kategori_produk,rating
"Produk sangat bagus!",Fashion,5
"Kecewa dengan kualitasnya.",Elektronik,2
"Pengiriman lama tapi produk oke.",Kuliner,3
```

### Aturan CSV

- Encoding: **UTF-8** (disarankan)
- Separator: **koma (`,`)**
- Quoted fields: tanda kutip ganda (`"`) untuk teks yang mengandung koma
- Ukuran maksimum: **5 MB**
- Jumlah ulasan maksimum diproses: **1000 baris**

---

## Keterbatasan Sistem

| Keterbatasan | Penjelasan |
|---|---|
| Tidak memahami konteks | "Tidak bagus" terdeteksi sebagai negatif ✓, tapi "tidak seburuk yang saya kira" mungkin salah klasifikasi |
| Sarkasme tidak terdeteksi | "Bagus banget, sampai rusak setelah 1 hari" mungkin salah diklasifikasi sebagai positif |
| Hanya Bahasa Indonesia + sedikit Inggris | Ulasan dalam bahasa lain tidak akan teranalisis dengan baik |
| Kata gaul/slang terbatas | Tidak semua variasi penulisan informal tercakup |
| Tidak belajar dari data baru | Sistem tidak adaptif — tidak membaik seiring waktu |

---

## Pengembangan Selanjutnya

### Integrasi Model AI via Backend Proxy

File [`js/analyzer.js`](js/analyzer.js) telah menyertakan metode stub `analyzeWithAPI()`:

```javascript
async function analyzeWithAPI(reviews) {
  // Contoh integrasi backend:
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviews }),
  });
  return response.json();
}
```

**Langkah implementasi:**
1. Buat backend (Node.js/Python/dsb.) dengan endpoint `POST /api/analyze`
2. Backend memanggil API AI (OpenAI GPT, IndoBERT, Gemini, dsb.) menggunakan API key yang **tersimpan di server** (bukan di frontend)
3. Backend mengembalikan hasil dalam format yang sama dengan `analyzeBatch()`
4. Ganti pemanggilan `analyzeBatch()` di `app.js` dengan `await AnalysisEngine.analyzeWithAPI(reviews)`

**Model AI yang direkomendasikan untuk Bahasa Indonesia:**
- [IndoBERT](https://huggingface.co/indolem/indobert-base-uncased) — Model BERT khusus Bahasa Indonesia
- [indobenchmark/indobert-base-p1](https://huggingface.co/indobenchmark) — Fine-tuned untuk sentiment analysis
- GPT-4o dengan prompt bahasa Indonesia
- Google Gemini API

---

## Skenario Pengujian

### TC-01: Input Manual Normal
**Langkah:**
1. Klik tab "✍️ Input Manual"
2. Ketik: `Produk bagus, pengiriman cepat!`
3. Klik "Analisis Sekarang"

**Hasil yang Diharapkan:**
- Dashboard muncul dengan 1 ulasan teranalisis
- Sentimen: Positif
- Skor > 0

---

### TC-02: Input Manual Multi-Ulasan
**Langkah:**
1. Ketik 5 ulasan berbeda (satu per baris)
2. Klik "Analisis Sekarang"

**Hasil yang Diharapkan:**
- Total = 5, tabel menampilkan 5 baris
- Grafik donut menunjukkan distribusi yang sesuai

---

### TC-03: Muat Contoh Data
**Langkah:**
1. Klik "📋 Muat Contoh Data"
2. Klik "Analisis Sekarang"

**Hasil yang Diharapkan:**
- 25 ulasan dimuat otomatis
- Dashboard menampilkan hasil analisis lengkap

---

### TC-04: Upload CSV
**Langkah:**
1. Klik tab "📂 Upload CSV"
2. Upload file `data/sample_data.csv`
3. Klik "Analisis Sekarang"

**Hasil yang Diharapkan:**
- "50 ulasan terdeteksi dari kolom "ulasan""
- Dashboard menampilkan 50 hasil analisis

---

### TC-05: Input Kosong
**Langkah:**
1. Kosongkan textarea
2. Klik "Analisis Sekarang"

**Hasil yang Diharapkan:**
- Pesan error merah: "Kolom ulasan tidak boleh kosong"
- Dashboard tidak muncul

---

### TC-06: Upload File Non-CSV
**Langkah:**
1. Tab CSV → upload file `.txt` atau `.xlsx`

**Hasil yang Diharapkan:**
- Pesan error: "File harus berformat CSV"

---

### TC-07: Filter Sentimen
**Langkah:**
1. Setelah analisis, klik tombol "😞 Negatif"

**Hasil yang Diharapkan:**
- Tabel hanya menampilkan ulasan dengan sentimen negatif
- Jumlah ulasan berubah sesuai filter

---

### TC-08: Pencarian Kata Kunci
**Langkah:**
1. Setelah analisis, ketik "pengiriman" di kotak pencarian

**Hasil yang Diharapkan:**
- Tabel hanya menampilkan ulasan yang mengandung kata "pengiriman"

---

### TC-09: Ekspor CSV
**Langkah:**
1. Setelah analisis, klik "⬇️ Ekspor CSV"

**Hasil yang Diharapkan:**
- File CSV terunduh otomatis
- File dapat dibuka di Excel dengan kolom: No, Ulasan, Sentimen, Skor, Alasan, Aspek

---

### TC-10: Hapus Semua Data
**Langkah:**
1. Setelah analisis, klik "🗑️ Hapus Semua"

**Hasil yang Diharapkan:**
- Dashboard tersembunyi
- Input dikosongkan
- Notifikasi "Semua data telah dihapus"

---

## Teknologi yang Digunakan

| Teknologi | Versi | Kegunaan |
|---|---|---|
| HTML5 | — | Struktur halaman |
| CSS3 | — | Styling & responsif |
| JavaScript (ES6+) | — | Logika aplikasi |
| [Chart.js](https://www.chartjs.org/) | 4.4.3 | Visualisasi grafik |

**Tidak ada:**
- Framework JavaScript (React, Vue, Angular)
- Build tools (Webpack, Vite)
- Backend/server
- Database
- Dependensi npm

Proyek ini berjalan sepenuhnya di browser, cocok untuk pembelajaran Teknik Informatika tingkat dasar hingga menengah.

---

*AI Review Insight — Dibuat untuk membantu UMKM Indonesia*
