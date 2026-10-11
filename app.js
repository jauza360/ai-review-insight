/**
 * AI Review Insight — App Logic
 * ===============================
 * Mengelola UI, input, analisis, rendering dashboard,
 * grafik, filter, pencarian, pagination, dan ekspor CSV.
 */

'use strict';

// ─────────────────────────────────────────────────────
// KONSTANTA & STATE
// ─────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const AppState = {
  results: [],        // Semua hasil analisis
  filtered: [],       // Hasil setelah filter/search
  currentFilter: 'all',
  searchQuery: '',
  currentPage: 1,
  csvData: null,      // File CSV yang di-upload
  chartPie: null,     // Referensi Chart.js
  chartBar: null,
};

// ─────────────────────────────────────────────────────
// DOM HELPERS
// ─────────────────────────────────────────────────────

const $ = id => document.getElementById(id);
const qs = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function showEl(el) {
  if (typeof el === 'string') el = $(el);
  if (el) el.style.display = '';
}
function hideEl(el) {
  if (typeof el === 'string') el = $(el);
  if (el) el.style.display = 'none';
}

// ─────────────────────────────────────────────────────
// TOAST NOTIFIKASI
// ─────────────────────────────────────────────────────

function showToast(message, type = 'info', duration = 3500) {
  const container = $('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// ─────────────────────────────────────────────────────
// LOADING OVERLAY
// ─────────────────────────────────────────────────────

function showLoading(text = 'Memuat data') {
  $('loadingOverlay').classList.add('show');
  $('loadingProgress').textContent = text;
}
function hideLoading() {
  $('loadingOverlay').classList.remove('show');
}

// ─────────────────────────────────────────────────────
// INPUT TABS
// ─────────────────────────────────────────────────────

function initTabs() {
  qsa('.input-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('.input-tab').forEach(b => b.classList.remove('active'));
      qsa('.input-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $(`panel-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

// ─────────────────────────────────────────────────────
// CSV PARSING
// ─────────────────────────────────────────────────────

/**
 * Parse CSV sederhana — mendukung quoted fields dengan koma di dalamnya.
 * @param {string} text - Konten file CSV
 * @returns {string[][]} Baris & kolom
 */
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines
    .map(line => {
      const cols = [];
      let current = '';
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
          else { inQuote = !inQuote; }
        } else if (ch === ',' && !inQuote) {
          cols.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      cols.push(current.trim());
      return cols;
    })
    .filter(row => row.some(c => c.length > 0));
}

/**
 * Ekstrak kolom ulasan dari CSV.
 * Deteksi otomatis kolom bernama: ulasan, review, text, teks, komentar, comment, feedback
 * Fallback ke kolom pertama jika tidak ditemukan.
 */
function extractReviewsFromCSV(rows) {
  if (rows.length === 0) return { reviews: [], column: null, warnings: [] };

  const warnings = [];
  const header = rows[0].map(h => h.toLowerCase().trim());
  const targetCols = ['ulasan', 'review', 'teks', 'text', 'komentar', 'comment', 'feedback', 'isi'];
  let colIndex = targetCols.reduce((found, name) => {
    if (found !== -1) return found;
    const idx = header.indexOf(name);
    return idx !== -1 ? idx : -1;
  }, -1);

  const hasHeader = colIndex !== -1 || header.some(h => /[a-z_]/i.test(h));
  const dataRows = hasHeader ? rows.slice(1) : rows;

  if (colIndex === -1) {
    colIndex = 0;
    if (hasHeader) {
      warnings.push(`Kolom ulasan tidak ditemukan (dicari: ${targetCols.join(', ')}). Menggunakan kolom pertama: "${rows[0][0]}".`);
    }
  }

  const reviews = dataRows
    .map(row => (row[colIndex] || '').trim())
    .filter(r => r.length > 0);

  return { reviews, column: hasHeader ? rows[0][colIndex] : `Kolom ${colIndex + 1}`, warnings };
}

// ─────────────────────────────────────────────────────
// FILE UPLOAD
// ─────────────────────────────────────────────────────

function initFileUpload() {
  const uploadArea = $('uploadArea');
  const fileInput = $('csvFileInput');

  uploadArea.addEventListener('click', () => fileInput.click());

  uploadArea.addEventListener('dragover', e => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener('change', e => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  $('btnRemoveFile').addEventListener('click', () => {
    AppState.csvData = null;
    $('fileInfo').classList.remove('show');
    $('csvError').innerHTML = '';
    fileInput.value = '';
    showToast('File dihapus', 'info');
  });
}

function handleFile(file) {
  $('csvError').innerHTML = '';

  if (!file.name.endsWith('.csv')) {
    $('csvError').innerHTML = `<div class="error-msg">❌ File harus berformat CSV (.csv). File yang dipilih: ${file.name}</div>`;
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    $('csvError').innerHTML = `<div class="error-msg">❌ Ukuran file terlalu besar (maks. 5 MB). Ukuran file: ${(file.size / 1024).toFixed(1)} KB</div>`;
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const text = e.target.result;
      const rows = parseCSV(text);
      const { reviews, column, warnings } = extractReviewsFromCSV(rows);

      if (reviews.length === 0) {
        $('csvError').innerHTML = `<div class="error-msg">❌ Tidak ada data ulasan yang dapat dibaca dari file ini. Pastikan file CSV memiliki kolom ulasan yang tidak kosong.</div>`;
        return;
      }

      AppState.csvData = { reviews, column, fileName: file.name, rowCount: rows.length };

      $('fileInfoName').textContent = file.name;
      $('fileInfoSize').textContent = `${reviews.length} ulasan terdeteksi dari kolom "${column}" • ${(file.size / 1024).toFixed(1)} KB`;
      $('fileInfo').classList.add('show');

      warnings.forEach(w => {
        $('csvError').innerHTML += `<div class="success-msg" style="background:#fff7ed;border-color:#fed7aa;color:#c2410c">⚠️ ${w}</div>`;
      });

      showToast(`${reviews.length} ulasan berhasil dimuat dari CSV`, 'success');
    } catch (err) {
      $('csvError').innerHTML = `<div class="error-msg">❌ Gagal membaca file: ${err.message}</div>`;
    }
  };
  reader.readAsText(file, 'UTF-8');
}

// ─────────────────────────────────────────────────────
// CONTOH DATA
// ─────────────────────────────────────────────────────

const SAMPLE_REVIEWS = [
  'Produk sangat bagus dan berkualitas! Pengiriman cepat, packing aman. Sangat recommended!',
  'Kualitas bahan kurang bagus, tidak sesuai dengan foto di toko. Saya kecewa.',
  'Harga terjangkau, kualitas standar. Pengiriman agak lama tapi masih bisa ditoleransi.',
  'Penjual sangat responsif dan ramah, produk sesuai deskripsi. Akan beli lagi!',
  'Barang sampai dalam kondisi rusak. Sangat mengecewakan.',
  'Ukuran sesuai, warna persis seperti gambar. Puas dengan pembelian ini.',
  'Kurir lambat, paket baru sampai setelah 2 minggu. Produknya sih oke.',
  'Tidak sesuai ekspektasi sama sekali. Kualitas sangat buruk untuk harganya.',
  'Lumayan bagus, worth it lah untuk harganya. Pengiriman oke.',
  'Jahitan produk rapi, bahan terasa premium. 5 bintang!',
  'Penjual tidak respon saat ada keluhan. Sangat tidak profesional.',
  'Produk ori dan asli, sama persis dengan yang di gambar. Mantap!',
  'Warna luntur setelah dicuci pertama kali. Kecewa banget.',
  'Fast response, pengiriman kilat, produk oke. Terima kasih!',
  'Biasa saja, tidak ada yang spesial. Sesuai harga memang.',
  'Kemasan sangat bagus, produk tidak lecet sama sekali. Senang!',
  'Bahan terasa murah padahal harganya mahal. Tidak worth it.',
  'Sudah beli 3 kali di sini, selalu puas! Produk konsisten bagus.',
  'Admin cs galak dan tidak membantu. Akan komplain ke marketplace.',
  'Sesuai deskripsi, pengiriman cepat, harga kompetitif. Oke banget!',
  'Produk patah saat dibuka dari dus. Pengemasan sangat buruk.',
  'Kualitas bagus, tapi ongkir mahal. Overall masih puas.',
  'Penjual jujur, produk asli, harga wajar. Rekomen!',
  'Ukuran tidak sesuai, sudah pilih L tapi seperti M. Kecewa.',
  'Pengiriman aman, produk tidak penyok. Bintang 5 untuk packing!',
];

function loadSampleData() {
  const activeTab = qs('.input-tab.active').dataset.tab;
  if (activeTab === 'manual') {
    $('reviewTextarea').value = SAMPLE_REVIEWS.join('\n');
    showToast('25 contoh ulasan dimuat ke form manual', 'success');
  } else {
    // Switch ke tab manual otomatis
    qs('[data-tab="manual"]').click();
    $('reviewTextarea').value = SAMPLE_REVIEWS.join('\n');
    showToast('25 contoh ulasan dimuat ke form manual', 'success');
  }
}

// ─────────────────────────────────────────────────────
// ANALISIS UTAMA
// ─────────────────────────────────────────────────────

async function runAnalysis() {
  const activeTab = qs('.input-tab.active').dataset.tab;
  let reviews = [];

  // Validasi input
  if (activeTab === 'manual') {
    $('manualError').innerHTML = '';
    const raw = $('reviewTextarea').value.trim();
    if (!raw) {
      $('manualError').innerHTML = '<div class="error-msg">❌ Kolom ulasan tidak boleh kosong. Masukkan minimal satu ulasan.</div>';
      return;
    }
    reviews = raw.split('\n').map(r => r.trim()).filter(r => r.length > 0);
    if (reviews.length === 0) {
      $('manualError').innerHTML = '<div class="error-msg">❌ Tidak ada ulasan yang valid. Pastikan setiap baris mengandung teks ulasan.</div>';
      return;
    }
  } else {
    $('csvError').innerHTML = '';
    if (!AppState.csvData) {
      $('csvError').innerHTML = '<div class="error-msg">❌ Belum ada file CSV yang diupload. Pilih file terlebih dahulu.</div>';
      return;
    }
    reviews = AppState.csvData.reviews;
    if (reviews.length === 0) {
      $('csvError').innerHTML = '<div class="error-msg">❌ File CSV tidak mengandung ulasan yang valid.</div>';
      return;
    }
  }

  // Batasi maksimum ulasan
  const MAX_REVIEWS = 1000;
  if (reviews.length > MAX_REVIEWS) {
    showToast(`Hanya ${MAX_REVIEWS} ulasan pertama yang diproses (total: ${reviews.length})`, 'warning');
    reviews = reviews.slice(0, MAX_REVIEWS);
  }

  // Jalankan analisis
  showLoading(`Menganalisis ${reviews.length} ulasan...`);
  $('btnAnalyze').disabled = true;

  try {
    // Simulasi async (agar loading overlay terlihat)
    await new Promise(resolve => setTimeout(resolve, 400 + Math.min(reviews.length * 2, 800)));

    const results = AnalysisEngine.analyzeBatch(reviews);
    const summary = AnalysisEngine.generateSummary(results);
    const recommendations = AnalysisEngine.generateRecommendations(summary);

    AppState.results = results;
    AppState.filtered = [...results];
    AppState.currentFilter = 'all';
    AppState.searchQuery = '';
    AppState.currentPage = 1;

    // Reset filter UI
    qsa('.filter-btn').forEach(b => b.className = 'filter-btn');
    qs('[data-filter="all"]').classList.add('active-all');
    $('searchInput').value = '';

    // Render semua bagian
    renderStats(summary);
    renderCharts(summary, results);
    renderTable();
    renderSummary(summary);
    renderRecommendations(recommendations);

    showEl('dashboardSection');
    showEl('btnClearAll');
    showEl('btnExportCSV');

    // Scroll ke dashboard
    $('dashboardSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast(`Analisis selesai: ${results.length} ulasan diproses`, 'success');

  } catch (err) {
    console.error('[App] Analisis gagal:', err);
    showToast('Terjadi kesalahan saat analisis: ' + err.message, 'error', 5000);
  } finally {
    hideLoading();
    $('btnAnalyze').disabled = false;
  }
}

// ─────────────────────────────────────────────────────
// RENDER: STATISTIK
// ─────────────────────────────────────────────────────

function renderStats(summary) {
  $('statTotal').textContent = summary.total;
  $('statPos').textContent = summary.positive;
  $('statNeu').textContent = summary.neutral;
  $('statNeg').textContent = summary.negative;
  $('statPosPct').textContent = `${summary.positivePct}%`;
  $('statNeuPct').textContent = `${summary.neutralPct}%`;
  $('statNegPct').textContent = `${summary.negativePct}%`;
  $('statScore').textContent = summary.avgScore > 0
    ? '+' + summary.avgScore
    : summary.avgScore;
}

// ─────────────────────────────────────────────────────
// RENDER: GRAFIK
// ─────────────────────────────────────────────────────

function renderCharts(summary, results) {
  renderPieChart(summary);
  renderBarChart(summary);
}

function renderPieChart(summary) {
  const ctx = $('chartPie').getContext('2d');
  if (AppState.chartPie) AppState.chartPie.destroy();

  AppState.chartPie = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Positif', 'Netral', 'Negatif'],
      datasets: [{
        data: [summary.positive, summary.neutral, summary.negative],
        backgroundColor: ['#16a34a', '#7c3aed', '#dc2626'],
        borderColor: ['#fff', '#fff', '#fff'],
        borderWidth: 3,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16,
            font: { size: 12, family: '-apple-system, "Segoe UI", sans-serif' },
            usePointStyle: true,
          },
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const val = ctx.parsed;
              const total = summary.total;
              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
              return ` ${val} ulasan (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

function renderBarChart(summary) {
  const ctx = $('chartBar').getContext('2d');
  if (AppState.chartBar) AppState.chartBar.destroy();

  const labels = summary.topAspects.map(a => a.aspect);
  const data = summary.topAspects.map(a => a.count);

  if (labels.length === 0) {
    // Kosongkan chart jika tidak ada aspek
    AppState.chartBar = new Chart(ctx, {
      type: 'bar',
      data: { labels: ['Tidak ada data aspek'], datasets: [{ data: [0], backgroundColor: '#F3D4E3' }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
    return;
  }

  AppState.chartBar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Jumlah Ulasan',
        data,
        backgroundColor: [
          '#BE185D', '#DB2777', '#EC4899', '#F472B6', '#F9A8D4',
        ].slice(0, labels.length),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.x} ulasan membahas topik ini`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#F3D4E3' },   // pink border color
          ticks: { font: { size: 11 }, stepSize: 1 },
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 11 } },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────
// RENDER: TABEL
// ─────────────────────────────────────────────────────

function applyFilterAndSearch() {
  const q = AppState.searchQuery.toLowerCase();
  const f = AppState.currentFilter;

  AppState.filtered = AppState.results.filter(r => {
    const matchSentiment = f === 'all' || r.sentiment === f;
    const matchSearch = !q || r.text.toLowerCase().includes(q);
    return matchSentiment && matchSearch;
  });

  AppState.currentPage = 1;
  renderTable();
}

function renderTable() {
  const { filtered, currentPage } = AppState;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, total);
  const pageData = filtered.slice(start, end);

  // Update count
  $('resultCount').textContent = `Menampilkan ${total} ulasan`;

  const tbody = $('tableBody');
  if (total === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <span class="empty-icon">🔍</span>
          <div class="empty-title">Tidak Ada Hasil</div>
          <div class="empty-sub">Coba ubah filter atau kata kunci pencarian.</div>
        </div>
      </td></tr>`;
    $('paginationInfo').textContent = '';
    $('paginationControls').innerHTML = '';
    return;
  }

  const sentimentLabel = {
    positive: '<span class="badge badge-positive">😊 Positif</span>',
    neutral:  '<span class="badge badge-neutral">😐 Netral</span>',
    negative: '<span class="badge badge-negative">😞 Negatif</span>',
  };

  tbody.innerHTML = pageData.map((r, i) => {
    const globalIdx = start + i + 1;
    const scoreClass = r.sentiment === 'positive' ? 'score-pos' : r.sentiment === 'negative' ? 'score-neg' : 'score-neu';
    const scoreDisplay = r.score > 0 ? `+${r.score}` : r.score;

    const reasonsHtml = r.reasons.length > 0
      ? `<ul class="reason-list">${r.reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>`
      : '<span style="color:var(--muted);font-size:12px">—</span>';

    const aspectsHtml = r.aspects.length > 0
      ? `<div class="aspect-tags">${r.aspects.map(a => `<span class="aspect-tag">${escapeHtml(a)}</span>`).join('')}</div>`
      : '<span style="color:var(--muted);font-size:12px">—</span>';

    // Bug fix: data-full harus menyimpan teks mentah (raw), bukan escaped HTML.
    // textContent akan otomatis handle karakter khusus saat diset.
    // Gunakan escapeHtml hanya untuk atribut title (di dalam HTML).
    const rawText = r.text;
    const shortText = escapeHtml(rawText.length > 120 ? rawText.slice(0, 120) + '…' : rawText);
    // data-full menyimpan raw text — perlu encode hanya karakter yg rusak di atribut HTML
    const dataFull = rawText.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

    return `
      <tr>
        <td style="color:var(--muted);font-size:12px;white-space:nowrap">${globalIdx}</td>
        <td>
          <div class="review-text-cell" title="${escapeHtml(rawText)}" data-full="${dataFull}">
            ${shortText}
          </div>
          ${rawText.length > 120 ? `<button class="btn btn-outline btn-sm" style="margin-top:4px;font-size:11px" onclick="toggleExpand(this)">Selengkapnya</button>` : ''}
        </td>
        <td>${sentimentLabel[r.sentiment] || r.sentiment}</td>
        <td class="score-cell ${scoreClass}">${scoreDisplay}</td>
        <td>${reasonsHtml}</td>
        <td>${aspectsHtml}</td>
      </tr>`;
  }).join('');

  // Pagination
  $('paginationInfo').textContent = `Halaman ${currentPage} dari ${totalPages} (${total} ulasan)`;
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const ctrl = $('paginationControls');
  const cur = AppState.currentPage;
  let html = '';

  html += `<button class="page-btn" onclick="goToPage(${cur - 1})" ${cur === 1 ? 'disabled' : ''}>‹ Prev</button>`;

  // Halaman
  const range = getPaginationRange(cur, totalPages);
  range.forEach(p => {
    if (p === '...') {
      html += `<span class="page-btn" style="cursor:default;color:var(--muted)">…</span>`;
    } else {
      html += `<button class="page-btn ${p === cur ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`;
    }
  });

  html += `<button class="page-btn" onclick="goToPage(${cur + 1})" ${cur === totalPages ? 'disabled' : ''}>Next ›</button>`;
  ctrl.innerHTML = html;
}

function getPaginationRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, '...', total);
  } else if (current >= total - 3) {
    pages.push(1, '...', total - 4, total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, '...', current - 1, current, current + 1, '...', total);
  }
  return pages;
}

function goToPage(page) {
  const totalPages = Math.ceil(AppState.filtered.length / PAGE_SIZE);
  if (page < 1 || page > totalPages) return;
  AppState.currentPage = page;
  renderTable();
  $('reviewTable').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function toggleExpand(btn) {
  const cell = btn.previousElementSibling;
  // dataset.full berisi raw text (hanya & dan " yang di-encode sebagai entity).
  // Decode kembali untuk tampil di textContent (browser akan auto-render teks biasa).
  const rawText = cell.dataset.full
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');

  if (cell.classList.contains('expanded')) {
    cell.classList.remove('expanded');
    cell.textContent = rawText.slice(0, 120) + '…';
    btn.textContent = 'Selengkapnya';
  } else {
    cell.classList.add('expanded');
    cell.textContent = rawText;
    btn.textContent = 'Sembunyikan';
  }
}

// ─────────────────────────────────────────────────────
// RENDER: RINGKASAN
// ─────────────────────────────────────────────────────

function renderSummary(summary) {
  // Kelebihan
  const strEl = $('summaryStrengths');
  if (summary.strengths[0] === 'Data tidak mencukupi') {
    strEl.innerHTML = '<p style="font-size:12.5px;color:var(--muted);padding:8px 0">Belum cukup data ulasan positif untuk menentukan kelebihan.</p>';
  } else {
    strEl.innerHTML = summary.strengths.map(s =>
      `<div class="summary-item"><div class="summary-item-dot dot-positive"></div>${escapeHtml(s)}</div>`
    ).join('');
  }

  // Keluhan
  const comEl = $('summaryComplaints');
  if (summary.complaints[0] === 'Tidak ada keluhan signifikan') {
    comEl.innerHTML = '<p style="font-size:12.5px;color:var(--positive);padding:8px 0">✅ Tidak ada keluhan signifikan yang terdeteksi.</p>';
  } else if (summary.complaints[0] === 'Perlu analisis lebih dalam') {
    comEl.innerHTML = '<p style="font-size:12.5px;color:var(--muted);padding:8px 0">Terdapat ulasan negatif namun aspek spesifik tidak dapat ditentukan secara otomatis.</p>';
  } else {
    comEl.innerHTML = summary.complaints.map(c =>
      `<div class="summary-item"><div class="summary-item-dot dot-negative"></div>${escapeHtml(c)}</div>`
    ).join('');
  }

  // Topik/Aspek
  const aspEl = $('summaryAspects');
  if (summary.topAspects.length === 0) {
    aspEl.innerHTML = '<p style="font-size:12.5px;color:var(--muted);padding:8px 0">Tidak ada topik spesifik yang terdeteksi dari ulasan ini.</p>';
  } else {
    const maxCount = summary.topAspects[0].count;
    // Bug fix: aspEl sudah memiliki class aspect-bar-wrap di HTML,
    // tidak perlu wrapper div tambahan di sini.
    aspEl.innerHTML = summary.topAspects.map(a => `
      <div class="aspect-bar-row">
        <div class="aspect-bar-header">
          <span class="aspect-bar-label">${escapeHtml(a.aspect)}</span>
          <span class="aspect-bar-count">${a.count} ulasan (${a.pct}%)</span>
        </div>
        <div class="aspect-bar-track">
          <div class="aspect-bar-fill" style="width:${Math.round((a.count / maxCount) * 100)}%"></div>
        </div>
      </div>`).join('');
  }
}

// ─────────────────────────────────────────────────────
// RENDER: REKOMENDASI
// ─────────────────────────────────────────────────────

function renderRecommendations(recommendations) {
  const recList = $('recList');
  if (recommendations.length === 0) {
    recList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">💡</span>
        <div class="empty-title">Tidak Ada Rekomendasi</div>
        <div class="empty-sub">Data tidak cukup untuk menghasilkan rekomendasi.</div>
      </div>`;
    return;
  }

  recList.innerHTML = recommendations.map(rec => `
    <div class="rec-item">
      <div class="rec-icon">${rec.icon}</div>
      <div class="rec-content">
        <div class="rec-title">
          ${escapeHtml(rec.title)}
          <span class="priority-badge priority-${rec.priority}">
            ${rec.priority === 'high' ? 'Prioritas Tinggi' : rec.priority === 'medium' ? 'Sedang' : 'Rendah'}
          </span>
        </div>
        <div class="rec-detail">${escapeHtml(rec.detail)}</div>
      </div>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────
// EKSPOR CSV
// ─────────────────────────────────────────────────────

function exportToCSV() {
  if (AppState.results.length === 0) {
    showToast('Tidak ada data untuk diekspor. Jalankan analisis terlebih dahulu.', 'warning');
    return;
  }

  const headers = ['No', 'Ulasan', 'Sentimen', 'Skor', 'Alasan', 'Aspek'];
  const rows = AppState.results.map((r, i) => [
    i + 1,
    `"${r.text.replace(/"/g, '""')}"`,
    r.sentiment === 'positive' ? 'Positif' : r.sentiment === 'negative' ? 'Negatif' : 'Netral',
    r.score,
    `"${r.reasons.join('; ').replace(/"/g, '""')}"`,
    `"${r.aspects.join('; ').replace(/"/g, '""')}"`,
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM untuk Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-review-insight-${new Date().toISOString().slice(0,10)}.csv`;
  // Bug fix: harus append ke DOM agar klik berfungsi di Firefox
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`${AppState.results.length} hasil analisis diekspor ke CSV`, 'success');
}

// ─────────────────────────────────────────────────────
// CLEAR ALL
// ─────────────────────────────────────────────────────

function clearAll() {
  AppState.results = [];
  AppState.filtered = [];
  AppState.csvData = null;
  AppState.currentPage = 1;

  $('reviewTextarea').value = '';
  $('csvFileInput').value = '';
  $('fileInfo').classList.remove('show');
  $('manualError').innerHTML = '';
  $('csvError').innerHTML = '';
  $('searchInput').value = '';

  hideEl('dashboardSection');
  hideEl('btnClearAll');
  hideEl('btnExportCSV');

  if (AppState.chartPie) { AppState.chartPie.destroy(); AppState.chartPie = null; }
  if (AppState.chartBar) { AppState.chartBar.destroy(); AppState.chartBar = null; }

  showToast('Semua data telah dihapus', 'info');
}

// ─────────────────────────────────────────────────────
// UTILITAS
// ─────────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─────────────────────────────────────────────────────
// INISIALISASI
// ─────────────────────────────────────────────────────

function init() {
  // Tabs
  initTabs();

  // File Upload
  initFileUpload();

  // Tombol Analisis
  $('btnAnalyze').addEventListener('click', runAnalysis);

  // Tombol Contoh Data
  $('btnLoadSample').addEventListener('click', loadSampleData);

  // Tombol Hapus Semua
  $('btnClearAll').addEventListener('click', clearAll);

  // Tombol Ekspor (keduanya)
  $('btnExportCSV').addEventListener('click', exportToCSV);
  $('btnExportCSV2').addEventListener('click', exportToCSV);

  // Pencarian
  $('searchInput').addEventListener('input', e => {
    AppState.searchQuery = e.target.value;
    applyFilterAndSearch();
  });

  // Filter tombol
  qsa('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.dataset.filter;
      AppState.currentFilter = f;
      qsa('.filter-btn').forEach(b => {
        b.className = 'filter-btn';
      });
      btn.classList.add(`active-${f}`);
      applyFilterAndSearch();
    });
  });

  // Responsif: collapse summary-rec grid on mobile
  function adjustLayout() {
    const grid = $('summaryRecGrid');
    if (grid) {
      grid.style.gridTemplateColumns = window.innerWidth < 768 ? '1fr' : '1fr 1fr';
    }
  }
  adjustLayout();
  window.addEventListener('resize', adjustLayout);
}

// Jalankan saat DOM siap
document.addEventListener('DOMContentLoaded', init);
