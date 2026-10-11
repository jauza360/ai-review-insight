/**
 * AI Review Insight — Analysis Engine
 * =====================================
 * Saat ini menggunakan pendekatan BERBASIS KATA KUNCI (rule-based) untuk
 * analisis sentimen, bukan model AI/ML sesungguhnya.
 *
 * KETERBATASAN:
 *  - Tidak memahami konteks, sarkasme, atau frasa kompleks
 *  - Akurasi bergantung pada kelengkapan daftar kata kunci
 *  - Hanya mendukung teks Bahasa Indonesia dan sebagian Bahasa Inggris
 *
 * PENGEMBANGAN SELANJUTNYA:
 *  - Metode analyzeWithAPI() sudah disiapkan untuk integrasi model AI
 *    melalui backend proxy (agar API key tidak terekspos di frontend)
 *  - Ganti implementasi analyzeSingle() untuk memanggil API tersebut
 */

const AnalysisEngine = (() => {

  // ─────────────────────────────────────────────
  // 1. KAMUS KATA KUNCI
  // ─────────────────────────────────────────────

  const POSITIVE_WORDS = [
    // Kualitas produk
    'bagus','baik','berkualitas','premium','kuat','awet','tahan','halus','mulus','rapi',
    'cantik','indah','elegan','stylish','modern','keren','mantap','oke','ok','jos',
    // Pengiriman
    'cepat','kilat','tepat waktu','sesuai','aman','terlindungi','terbungkus',
    // Harga
    'murah','terjangkau','worth it','worthit','hemat','ekonomis','sepadan','sesuai harga',
    // Penjual
    'ramah','responsif','helpful','memuaskan','puas','senang','bahagia','suka','cinta','love',
    // Umum positif
    'recommended','rekomen','rekomendasi','mantul','top','luar biasa','luar biasa',
    'memuaskan','satisfied','great','good','excellent','perfect','amazing','awesome',
    'terbaik','best','sempurna','wah','hebat','kece','sip','bintang',
    // Produk sesuai
    'sesuai deskripsi','sesuai gambar','sesuai foto','original','asli','ori',
    'persis','sama','cocok','pas','ukuran pas','ukuran sesuai',
  ];

  const NEGATIVE_WORDS = [
    // Kualitas buruk
    'jelek','buruk','rusak','cacat','lecet','penyok','retak','pecah','patah','robek',
    'sobek','luntur','pudar','kusam','bau','kotor','kotor','tidak bagus','kurang bagus',
    'mengecewakan','kecewa','kecewakan','gagal','bohong','tipu','menipu','palsu',
    // Pengiriman
    'lambat','lama','telat','terlambat','delay','tidak sampai','hilang','nyasar',
    'salah kirim','salah alamat','kerusakan',
    // Harga
    'mahal','kemahalan','tidak worth','tidak worthit','tidak sebanding','rugi',
    // Penjual
    'tidak responsif','tidak respon','tidak balas','tidak ramah','galak','jutek',
    // Kondisi
    'tidak sesuai','tidak sama','beda','berbeda','tidak original','kw','palsu','tiruan',
    'tidak sesuai deskripsi','tidak sesuai foto','tidak sesuai gambar',
    // Umum negatif
    'tidak puas','tidak memuaskan','tidak recommended','tidak rekomen','batal','refund',
    'komplain','keluhan','masalah','bermasalah','bad','poor','terrible','awful','worst',
    'terburuk','sangat kecewa','sangat buruk','tidak berguna','sampah','buang uang',
  ];

  const NEGATION_WORDS = [
    'tidak','tak','bukan','belum','jangan','kurang','tanpa','anti','non','gak','nggak',
    'enggak','kagak','ndak','nda','ga','g','tdk',
  ];

  const INTENSIFIER_WORDS = [
    'sangat','banget','sekali','benar-benar','sungguh','amat','terlalu','super',
    'ultra','maha','paling','parah','abis','habis','poll','bet',
  ];

  // Topik/aspek produk
  const ASPECT_KEYWORDS = {
    'Kualitas Produk': ['kualitas','bahan','material','tekstur','warna','ukuran','berat','kekuatan','daya tahan','awet','tahan lama'],
    'Pengiriman': ['kirim','pengiriman','paket','kurir','ekspedisi','tiba','sampai','tracking','resi','packing','kemasan','bungkus'],
    'Harga': ['harga','biaya','ongkos','murah','mahal','diskon','promo','cashback','worth','bayar'],
    'Pelayanan Penjual': ['penjual','seller','admin','cs','customer service','respon','balas','ramah','fast respon','fast response'],
    'Kesesuaian Produk': ['sesuai','sama','cocok','pas','deskripsi','foto','gambar','asli','original','ori'],
  };

  // ─────────────────────────────────────────────
  // 2. UTILITAS TEXT
  // ─────────────────────────────────────────────

  function normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // hapus tanda baca
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(text) {
    return normalizeText(text).split(' ').filter(t => t.length > 0);
  }

  function containsWord(tokens, wordList) {
    return wordList.some(w => {
      const wTokens = w.split(' ');
      if (wTokens.length === 1) return tokens.includes(w);
      // multi-word phrase matching
      const joined = tokens.join(' ');
      return joined.includes(w);
    });
  }

  // ─────────────────────────────────────────────
  // 3. SCORING SENTIMEN
  // ─────────────────────────────────────────────

  function scoreSentiment(text) {
    const tokens = tokenize(text);
    let score = 0;
    const reasons = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const prevToken = i > 0 ? tokens[i - 1] : '';
      const prev2Token = i > 1 ? tokens[i - 2] : '';
      const isNegated = NEGATION_WORDS.includes(prevToken) || NEGATION_WORDS.includes(prev2Token);
      const isIntensified = INTENSIFIER_WORDS.includes(prevToken) || INTENSIFIER_WORDS.includes(prev2Token);
      const multiplier = isIntensified ? 1.5 : 1.0;

      if (POSITIVE_WORDS.includes(token)) {
        const delta = isNegated ? -1.5 * multiplier : 1.0 * multiplier;
        score += delta;
        if (Math.abs(delta) >= 1) {
          reasons.push(isNegated ? `Kata "${token}" dinegasikan` : `Kata positif: "${token}"`);
        }
      }

      if (NEGATIVE_WORDS.includes(token)) {
        const delta = isNegated ? 1.5 * multiplier : -1.0 * multiplier;
        score += delta;
        if (Math.abs(delta) >= 1) {
          reasons.push(isNegated ? `Keluhan "${token}" dinegasikan` : `Kata negatif: "${token}"`);
        }
      }
    }

    // Multi-word phrase check
    const joined = tokens.join(' ');
    POSITIVE_WORDS.forEach(w => {
      if (w.includes(' ') && joined.includes(w)) { score += 1.5; reasons.push(`Frasa positif: "${w}"`); }
    });
    NEGATIVE_WORDS.forEach(w => {
      if (w.includes(' ') && joined.includes(w)) { score -= 1.5; reasons.push(`Frasa negatif: "${w}"`); }
    });

    // Star rating boost (if text contains rating pattern like "5/5" or "bintang 5")
    const starMatch = text.match(/(\d)[\/\s]*(?:bintang|star|\/5)/i);
    if (starMatch) {
      const stars = parseInt(starMatch[1]);
      if (stars >= 4) { score += 2; reasons.push(`Rating tinggi: ${stars} bintang`); }
      else if (stars <= 2) { score -= 2; reasons.push(`Rating rendah: ${stars} bintang`); }
    }

    return { score: parseFloat(score.toFixed(2)), reasons: [...new Set(reasons)].slice(0, 3) };
  }

  function classifySentiment(score) {
    if (score > 0.5) return 'positive';
    if (score < -0.5) return 'negative';
    return 'neutral';
  }

  // ─────────────────────────────────────────────
  // 4. DETEKSI ASPEK
  // ─────────────────────────────────────────────

  function detectAspects(text) {
    const lower = text.toLowerCase();
    const found = [];
    Object.entries(ASPECT_KEYWORDS).forEach(([aspect, keywords]) => {
      if (keywords.some(kw => lower.includes(kw))) found.push(aspect);
    });
    return found;
  }

  // ─────────────────────────────────────────────
  // 5. ANALISIS SATU ULASAN
  // ─────────────────────────────────────────────

  function analyzeSingle(reviewText) {
    if (!reviewText || reviewText.trim().length === 0) {
      return {
        text: reviewText,
        sentiment: 'neutral',
        score: 0,
        reasons: ['Ulasan kosong'],
        aspects: [],
      };
    }

    const { score, reasons } = scoreSentiment(reviewText);
    const sentiment = classifySentiment(score);
    const aspects = detectAspects(reviewText);

    // Buat alasan default jika tidak ada kata kunci terdeteksi
    const defaultReasons = {
      positive: ['Ulasan mengandung ekspresi kepuasan'],
      neutral: ['Tidak ditemukan kata kunci sentimen yang kuat'],
      negative: ['Ulasan mengandung ekspresi ketidakpuasan'],
    };
    const finalReasons = reasons.length > 0 ? reasons : defaultReasons[sentiment];

    return {
      text: reviewText.trim(),
      sentiment,
      score,
      reasons: finalReasons,
      aspects,
    };
  }

  // ─────────────────────────────────────────────
  // 6. ANALISIS BATCH (BANYAK ULASAN)
  // ─────────────────────────────────────────────

  function analyzeBatch(reviews) {
    return reviews
      .filter(r => r && r.trim().length > 0)
      .map(r => analyzeSingle(r));
  }

  // ─────────────────────────────────────────────
  // 7. RINGKASAN & REKOMENDASI
  // ─────────────────────────────────────────────

  function generateSummary(results) {
    const total = results.length;
    if (total === 0) return null;

    const positive = results.filter(r => r.sentiment === 'positive');
    const neutral = results.filter(r => r.sentiment === 'neutral');
    const negative = results.filter(r => r.sentiment === 'negative');

    // Kumpulkan aspek yang muncul
    const aspectCount = {};
    results.forEach(r => {
      r.aspects.forEach(a => { aspectCount[a] = (aspectCount[a] || 0) + 1; });
    });
    const topAspects = Object.entries(aspectCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([aspect, count]) => ({ aspect, count, pct: Math.round((count / total) * 100) }));

    // Kelebihan (dari ulasan positif, aspek yang sering muncul)
    const posAspects = {};
    positive.forEach(r => r.aspects.forEach(a => { posAspects[a] = (posAspects[a] || 0) + 1; }));
    const strengths = Object.entries(posAspects)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([a]) => a);

    // Keluhan (dari ulasan negatif, aspek yang sering muncul)
    const negAspects = {};
    negative.forEach(r => r.aspects.forEach(a => { negAspects[a] = (negAspects[a] || 0) + 1; }));
    const complaints = Object.entries(negAspects)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([a]) => a);

    // Skor rata-rata
    const avgScore = parseFloat((results.reduce((s, r) => s + r.score, 0) / total).toFixed(2));

    return {
      total,
      positive: positive.length,
      neutral: neutral.length,
      negative: negative.length,
      positivePct: Math.round((positive.length / total) * 100),
      neutralPct: Math.round((neutral.length / total) * 100),
      negativePct: Math.round((negative.length / total) * 100),
      avgScore,
      topAspects,
      strengths: strengths.length > 0 ? strengths : ['Data tidak mencukupi'],
      complaints: complaints.length > 0 ? complaints : (negative.length > 0 ? ['Perlu analisis lebih dalam'] : ['Tidak ada keluhan signifikan']),
    };
  }

  function generateRecommendations(summary) {
    if (!summary) return [];
    const recs = [];

    // Berdasarkan sentimen negatif
    if (summary.negativePct >= 30) {
      recs.push({
        priority: 'high',
        icon: '🚨',
        title: 'Tingkat Kepuasan Rendah',
        detail: `${summary.negativePct}% ulasan bersifat negatif. Segera tinjau keluhan utama pelanggan dan lakukan perbaikan menyeluruh.`,
      });
    } else if (summary.negativePct >= 15) {
      recs.push({
        priority: 'medium',
        icon: '⚠️',
        title: 'Ada Keluhan yang Perlu Ditangani',
        detail: `${summary.negativePct}% ulasan negatif. Identifikasi pola keluhan dan buat rencana perbaikan bertahap.`,
      });
    }

    // Berdasarkan aspek keluhan
    if (summary.complaints.includes('Pengiriman')) {
      recs.push({
        priority: 'high',
        icon: '📦',
        title: 'Perbaiki Layanan Pengiriman',
        detail: 'Banyak pelanggan mengeluhkan pengiriman. Pertimbangkan untuk bermitra dengan kurir yang lebih andal atau memperbaiki proses pengemasan.',
      });
    }
    if (summary.complaints.includes('Kualitas Produk')) {
      recs.push({
        priority: 'high',
        icon: '🔍',
        title: 'Tingkatkan Kontrol Kualitas',
        detail: 'Keluhan kualitas produk ditemukan. Lakukan quality control lebih ketat sebelum pengiriman.',
      });
    }
    if (summary.complaints.includes('Pelayanan Penjual')) {
      recs.push({
        priority: 'medium',
        icon: '💬',
        title: 'Responsivitas Layanan Pelanggan',
        detail: 'Tingkatkan waktu respons dan keramahan dalam melayani pelanggan. Pertimbangkan template balasan cepat.',
      });
    }
    if (summary.complaints.includes('Kesesuaian Produk')) {
      recs.push({
        priority: 'high',
        icon: '📸',
        title: 'Perbarui Foto & Deskripsi Produk',
        detail: 'Pelanggan melaporkan produk tidak sesuai deskripsi/foto. Pastikan foto dan spesifikasi produk akurat dan up-to-date.',
      });
    }
    if (summary.complaints.includes('Harga')) {
      recs.push({
        priority: 'low',
        icon: '💰',
        title: 'Evaluasi Strategi Harga',
        detail: 'Beberapa pelanggan merasa harga tidak sebanding. Pertimbangkan program bundling, diskon loyalitas, atau komunikasi nilai produk yang lebih baik.',
      });
    }

    // Berdasarkan sentimen positif (peluang)
    if (summary.positivePct >= 70) {
      recs.push({
        priority: 'low',
        icon: '⭐',
        title: 'Manfaatkan Ulasan Positif',
        detail: `${summary.positivePct}% ulasan positif — jadikan sebagai social proof di halaman produk dan media sosial untuk meningkatkan konversi.`,
      });
    }

    // Berdasarkan netral
    if (summary.neutralPct >= 40) {
      recs.push({
        priority: 'medium',
        icon: '📊',
        title: 'Konversi Ulasan Netral',
        detail: `${summary.neutralPct}% ulasan bersifat netral. Follow-up pelanggan ini untuk memahami pengalaman mereka dan dorong pembelian ulang.`,
      });
    }

    // Default jika belum ada rekomendasi
    if (recs.length === 0) {
      recs.push({
        priority: 'low',
        icon: '✅',
        title: 'Pertahankan Kualitas',
        detail: 'Ulasan pelanggan secara keseluruhan baik. Terus pertahankan standar layanan dan kualitas produk.',
      });
    }

    return recs;
  }

  // ─────────────────────────────────────────────
  // 8. STUB UNTUK INTEGRASI API AI (PENGEMBANGAN SELANJUTNYA)
  // ─────────────────────────────────────────────

  /**
   * Metode ini disiapkan untuk integrasi dengan model AI melalui backend proxy.
   * JANGAN panggil API AI langsung dari frontend — gunakan backend sebagai perantara
   * agar API key tidak terekspos ke pengguna.
   *
   * Contoh endpoint backend: POST /api/analyze
   * Body: { reviews: string[] }
   * Response: { results: AnalysisResult[] }
   *
   * @param {string[]} reviews - Array ulasan
   * @returns {Promise<object[]>} - Array hasil analisis dari AI
   */
  async function analyzeWithAPI(reviews) {
    // TODO: Ganti URL dengan endpoint backend Anda
    // const response = await fetch('/api/analyze', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ reviews }),
    // });
    // if (!response.ok) throw new Error('Gagal menghubungi API analisis');
    // return response.json();

    // Fallback ke rule-based jika API belum tersedia
    console.warn('[AnalysisEngine] analyzeWithAPI() dipanggil tanpa backend — menggunakan rule-based fallback.');
    return analyzeBatch(reviews);
  }

  // ─────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────

  return {
    analyzeSingle,
    analyzeBatch,
    generateSummary,
    generateRecommendations,
    analyzeWithAPI,
    // Expose untuk keperluan debug/pengujian
    _internal: { scoreSentiment, classifySentiment, detectAspects, normalizeText },
  };

})();
