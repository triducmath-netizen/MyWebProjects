// Kết xuất đề / đáp án ra file PDF và tải về máy (dùng chung cho giáo viên, học sinh, phụ huynh).
// Dựng một "tờ đề" A4 bằng HTML (công thức qua KaTeX), chụp bằng html2pdf rồi lưu file.
import { el, fmtNum, toast } from './common.js?v=20261202a';
import { rich, KIND_LABEL, LETTERS, TF_LETTERS } from './quiz-common.js?v=20261202a';

const LIB_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
const LEVEL_NAME = { tb: 'Mức độ 1', kha: 'Mức độ 2', gioi: 'Mức độ 3' };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const SECTION = { mcq: 'Trắc nghiệm nhiều phương án lựa chọn', tf: 'Trắc nghiệm đúng sai', short: 'Trắc nghiệm trả lời ngắn' };

let libPromise = null;
function loadLib() {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  libPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = LIB_URL;
    s.onload = () => (window.html2pdf ? resolve(window.html2pdf) : reject(new Error('no html2pdf')));
    s.onerror = () => { libPromise = null; reject(new Error('Không tải được thư viện PDF')); };
    document.head.append(s);
  });
  return libPromise;
}

const CSS = `
.pdf-paper { width: 180mm; margin: 0 auto; background: #fff; color: #111; font-family: 'Be Vietnam Pro', system-ui, sans-serif; font-size: 12.5px; line-height: 1.55; }
.pdf-paper * { box-sizing: border-box; }
.pdf-paper .pdf-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #12284a; padding-bottom: 8px; }
.pdf-paper .pdf-brand { font-weight: 700; color: #12284a; font-size: 14px; letter-spacing: .02em; }
.pdf-paper .pdf-brand small { display: block; font-weight: 500; color: #555; font-size: 11px; letter-spacing: 0; }
.pdf-paper .pdf-meta { text-align: right; font-size: 11.5px; color: #333; }
.pdf-paper h1 { font-size: 17px; text-align: center; margin: 12px 0 2px; color: #12284a; text-transform: uppercase; }
.pdf-paper .pdf-sub { text-align: center; font-size: 12px; color: #333; margin: 0 0 8px; }
.pdf-paper .pdf-student { display: flex; gap: 24px; margin: 6px 0 4px; font-size: 12.5px; }
.pdf-paper .pdf-student span { flex: 1; border-bottom: 1px dotted #555; padding-bottom: 2px; }
.pdf-paper .pdf-desc { margin: 6px 0; font-style: italic; color: #333; }
.pdf-paper h2 { font-size: 13px; margin: 14px 0 6px; color: #12284a; text-transform: uppercase; }
.pdf-paper .pdf-q { margin: 0 0 10px; page-break-inside: avoid; break-inside: avoid; }
.pdf-paper .pdf-q-head b { color: #12284a; }
.pdf-paper .pdf-q-head .pts { color: #666; font-size: 11px; }
.pdf-paper .pdf-q .rich { line-height: 1.6; }
.pdf-paper .pdf-q .rich.inline { display: inline; }
.pdf-paper .pdf-q img { max-width: 120mm; max-height: 80mm; display: block; margin: 6px auto; }
.pdf-paper .pdf-opts { display: grid; grid-template-columns: 1fr; gap: 2px 16px; margin: 4px 0 0 14px; }
.pdf-paper .pdf-opts.cols2 { grid-template-columns: 1fr 1fr; }
.pdf-paper .pdf-opts.cols4 { grid-template-columns: repeat(4, 1fr); }
.pdf-paper .pdf-opts b { color: #12284a; margin-right: 4px; }
.pdf-paper .pdf-tf { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; margin: 4px 0 0 14px; align-items: baseline; }
.pdf-paper .pdf-tf .box { font-size: 11px; color: #444; white-space: nowrap; }
.pdf-paper .pdf-short { margin: 6px 0 0 14px; }
.pdf-paper .pdf-short span { display: inline-block; min-width: 50mm; border-bottom: 1px dotted #555; }
.pdf-paper .pdf-key-table { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 6px 0 4px; font-size: 12px; }
.pdf-paper .pdf-key-table td, .pdf-paper .pdf-key-table th { border: 1px solid #999; padding: 3px 6px; text-align: center; }
.pdf-paper .pdf-key-table th { background: #eef1f6; color: #12284a; }
.pdf-paper .pdf-ans { margin: 4px 0 0 14px; }
.pdf-paper .pdf-ans b { color: #0b6b2f; }
.pdf-paper .pdf-sol { margin: 4px 0 0 14px; padding: 6px 10px; border-left: 3px solid #c9a23f; background: #fbf8ef; }
.pdf-paper .pdf-sol .lbl { font-weight: 700; color: #8a6d1d; display: block; font-size: 11.5px; }
.pdf-paper .pdf-end { text-align: center; margin-top: 14px; font-weight: 600; color: #333; }
.pdf-paper .katex { font-size: 1.05em; }
.pdf-paper .math-block { margin: 4px 0; }
`;

function slug(s) {
  return String(s || 'de').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'de';
}

function subtitle(z, questions) {
  const parts = [];
  if (z.grade) parts.push(`Toán ${z.grade}`);
  if (z.topic) parts.push(z.topic);
  if (z.level) parts.push(LEVEL_NAME[z.level] ?? z.level);
  parts.push(`${questions.length} câu`);
  if (z.time_limit_min) parts.push(`Thời gian làm bài: ${z.time_limit_min} phút`);
  return parts.join(' · ');
}

// Ảnh tải lại với crossOrigin để html2canvas vẽ được (Supabase Storage cho phép CORS).
function pdfImage(path, urls, alt) {
  const url = path && urls?.get(path);
  if (!url) return null;
  return el('img', { crossorigin: 'anonymous', src: url, alt });
}

function optCols(options) {
  const longest = Math.max(...options.map((o) => String(o).replace(/\$[^$]*\$/g, 'xxxx').length));
  if (longest <= 14) return 'cols4';
  if (longest <= 38) return 'cols2';
  return '';
}

function answerText(q, key) {
  if (!key) return 'Chưa có đáp án';
  if (q.kind === 'mcq') return LETTERS[key.answer] ?? '?';
  if (q.kind === 'tf') return key.answer.map((v, k) => `${TF_LETTERS[k]}) ${v ? 'Đ' : 'S'}`).join('  ');
  return (key.answer || []).join(' hoặc ');
}

function questionBlock(q, i, urls, key, withKey) {
  const head = el('div', { class: 'pdf-q-head' },
    el('b', { text: `Câu ${i + 1}. ` }),
    el('span', { class: 'pts', text: `(${fmtNum(q.points)} điểm) ` }));
  const body = [head, rich(q.prompt), pdfImage(q.image_path, urls, `Hình câu ${i + 1}`)];
  if (q.kind === 'mcq') {
    body.push(el('div', { class: `pdf-opts ${optCols(q.options)}` }, q.options.map((o, k) =>
      el('div', {}, el('b', { text: `${LETTERS[k]}.` }), rich(o, 'rich inline')))));
  } else if (q.kind === 'tf') {
    body.push(el('div', { class: 'pdf-tf' }, q.options.flatMap((o, k) => [
      el('div', {}, el('b', { text: `${TF_LETTERS[k]}) ` }), rich(o, 'rich inline')),
      el('span', { class: 'box', text: withKey ? '' : '☐ Đúng   ☐ Sai' }),
    ])));
  } else if (!withKey) {
    body.push(el('div', { class: 'pdf-short' }, 'Trả lời: ', el('span', { text: ' ' })));
  }
  if (withKey) {
    body.push(el('div', { class: 'pdf-ans' }, 'Đáp án: ', el('b', { text: answerText(q, key) })));
    if (key && (key.explanation || key.explanation_image_path)) {
      body.push(el('div', { class: 'pdf-sol' }, el('span', { class: 'lbl', text: 'Lời giải' }),
        key.explanation ? rich(key.explanation) : null,
        pdfImage(key.explanation_image_path, urls, `Lời giải câu ${i + 1}`)));
    }
  }
  return el('div', { class: 'pdf-q' }, ...body);
}

function keyTable(questions, keyMap) {
  const rows = [];
  for (let s = 0; s < questions.length; s += 8) {
    const chunk = questions.slice(s, s + 8);
    const pad = Array.from({ length: 8 - chunk.length }, () => el('td', {}));
    rows.push(el('tr', {}, el('th', { text: 'Câu' }), chunk.map((q, k) => el('th', { text: String(s + k + 1) })), pad));
    rows.push(el('tr', {}, el('th', { text: 'Đáp án' }), chunk.map((q) => el('td', { text: answerText(q, keyMap.get(q.id)) })),
      pad.map(() => el('td', {}))));
  }
  return el('table', { class: 'pdf-key-table' }, el('tbody', {}, rows));
}

function buildPaper(z, questions, urls, keyMap, withKey) {
  const paper = el('div', { class: 'pdf-paper' },
    el('style', { text: CSS }),
    el('div', { class: 'pdf-top' },
      el('div', { class: 'pdf-brand', text: 'TRÍ ĐỨC MATH' }, el('small', { text: 'triducmath.vn · 0904 440 886' })),
      el('div', { class: 'pdf-meta', text: withKey ? 'ĐÁP ÁN & LỜI GIẢI' : 'ĐỀ LUYỆN TẬP' })),
    el('h1', { text: z.title || 'Đề luyện tập' }),
    el('p', { class: 'pdf-sub', text: subtitle(z, questions) }),
    withKey ? null : el('div', { class: 'pdf-student' }, el('span', { text: 'Họ và tên:' }), el('span', { text: 'Lớp:' })),
    !withKey && z.description ? rich(z.description, 'rich pdf-desc') : null);

  if (withKey && questions.length) {
    paper.append(el('h2', { text: 'Bảng đáp án' }), keyTable(questions, keyMap));
  }
  let lastKind = null;
  let sec = 0;
  questions.forEach((q, i) => {
    const block = questionBlock(q, i, urls, keyMap?.get(q.id), withKey);
    if (q.kind !== lastKind) {
      // Tiêu đề phần nằm chung khối với câu đầu tiên để không bị tách sang trang trước.
      block.prepend(el('h2', { text: `Phần ${ROMAN[sec] ?? sec + 1}. ${SECTION[q.kind] ?? KIND_LABEL[q.kind]}` }));
      sec += 1;
      lastKind = q.kind;
    }
    paper.append(block);
  });
  paper.append(el('p', { class: 'pdf-end', text: '— HẾT —' }));
  return paper;
}

async function waitImages(node) {
  await Promise.all([...node.querySelectorAll('img')].map((img) => (img.complete ? null
    : new Promise((r) => { img.onload = r; img.onerror = r; }))));
}

let busy = false;
/**
 * Tải đề (withKey=false) hoặc đáp án & lời giải (withKey=true) thành file PDF.
 * z: thông tin đề (title, description, grade, topic, level, time_limit_min)
 * questions: các câu (kind, prompt, options, points, image_path) theo thứ tự
 * urls: Map đường dẫn hình → link tạm (từ imageUrls)
 * keyMap: Map question_id → đáp án (chỉ cần khi withKey)
 */
export async function downloadQuizPdf(z, questions, urls, { keyMap = null, withKey = false, button = null } = {}) {
  if (busy) return;
  if (!questions?.length) { toast('Đề chưa có câu hỏi nào.', 'error'); return; }
  busy = true;
  const oldText = button?.textContent;
  if (button) { button.disabled = true; button.textContent = 'Đang tạo PDF…'; }
  // Khung tạm nằm ngoài màn hình để hình và công thức tải xong trước khi chụp.
  const holder = el('div', { style: 'position:fixed;left:-10000px;top:0;z-index:-1;background:#fff', 'aria-hidden': 'true' });
  // Thanh cuộn và vị trí cuộn của trang làm ảnh chụp bị lệch sang phải (mất mép phải tờ đề):
  // tạm ẩn thanh cuộn, đưa trang về đầu trong lúc chụp, xong thì trả lại như cũ.
  const root = document.documentElement;
  const saved = { x: window.scrollX, y: window.scrollY, overflow: root.style.overflow };
  try {
    const html2pdf = await loadLib();
    const paper = buildPaper(z, questions, urls || new Map(), keyMap || new Map(), withKey);
    holder.append(paper);
    document.body.append(holder);
    if (document.fonts?.ready) await document.fonts.ready;
    await waitImages(paper);
    const filename = `${slug(z.title)}${withKey ? '-dap-an' : ''}.pdf`;
    root.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    await html2pdf().set({
      margin: [12, 12, 14, 12],
      filename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: {
        scale: 2, useCORS: true, backgroundColor: '#ffffff',
        scrollX: 0, scrollY: 0,
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['.pdf-q', 'tr', 'h2'] },
    }).from(paper).toPdf().get('pdf').then((pdf) => {
      const n = pdf.internal.getNumberOfPages();
      const w = pdf.internal.pageSize.getWidth();
      const h = pdf.internal.pageSize.getHeight();
      pdf.setFontSize(9);
      pdf.setTextColor(120);
      for (let p = 1; p <= n; p += 1) {
        pdf.setPage(p);
        pdf.text(`Trang ${p}/${n}`, w / 2, h - 6, { align: 'center' });
      }
    }).save();
    toast(withKey ? 'Đã tải đáp án về máy.' : 'Đã tải đề về máy.');
  } catch (err) {
    console.error(err);
    toast(`Chưa tạo được PDF: ${err?.message || err}`, 'error');
  } finally {
    holder.remove();
    root.style.overflow = saved.overflow;
    window.scrollTo(saved.x, saved.y);
    busy = false;
    if (button) { button.disabled = false; button.textContent = oldText; }
  }
}
