// Dùng chung cho trang giáo viên và trang học sinh: hiển thị công thức, hình, xem lại bài.
import { el, sb, BUCKET, fmtNum } from './common.js?v=20261202a';

let katex = null;
try {
  katex = (await import('https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.mjs')).default;
} catch { /* không tải được KaTeX: hiện công thức dạng chữ */ }

export const KIND_LABEL = { mcq: 'Trắc nghiệm', tf: 'Đúng/Sai', short: 'Trả lời ngắn' };
export const DEFAULT_POINTS = { mcq: 0.25, tf: 1, short: 0.5 };
export const LETTERS = ['A', 'B', 'C', 'D'];
export const TF_LETTERS = ['a', 'b', 'c', 'd'];

// Hiển thị chữ + công thức: $...$ (trong dòng) và $$...$$ (dòng riêng).
// An toàn: chữ thường đi qua text node; công thức do KaTeX dựng (trust: false).
export function rich(text, cls = 'rich') {
  const root = el('div', { class: cls });
  const s = String(text ?? '');
  const re = /\$\$([\s\S]+?)\$\$|\$((?:\\\$|[^$\n])+?)\$/g;
  let last = 0;
  let m;
  const pushText = (t) => {
    t.split('\n').forEach((line, i) => {
      if (i) root.append(el('br'));
      if (line) root.append(document.createTextNode(line));
    });
  };
  while ((m = re.exec(s))) {
    pushText(s.slice(last, m.index));
    const display = m[1] != null;
    const tex = display ? m[1] : m[2];
    const node = el(display ? 'div' : 'span', { class: display ? 'math-block' : 'math' });
    if (katex) {
      try { katex.render(tex, node, { displayMode: display, throwOnError: false, trust: false, strict: 'ignore' }); }
      catch { node.textContent = tex; }
    } else {
      node.textContent = display ? `$$${tex}$$` : `$${tex}$`;
    }
    root.append(node);
    last = re.lastIndex;
  }
  pushText(s.slice(last));
  return root;
}

// Lấy link tạm cho nhiều hình một lúc: Map(path → url).
export async function imageUrls(paths) {
  const list = [...new Set(paths.filter(Boolean))];
  const map = new Map();
  if (!list.length) return map;
  const { data } = await sb.storage.from(BUCKET).createSignedUrls(list, 3600);
  (data || []).forEach((d) => { if (d.signedUrl) map.set(d.path, d.signedUrl); });
  return map;
}

export function qImage(path, urls, alt) {
  const url = path && urls.get(path);
  return url ? el('img', { class: 'q-img', src: url, alt, loading: 'lazy' }) : null;
}

export function isAnswered(q, a) {
  if (a == null) return false;
  if (q.kind === 'mcq') return Number.isInteger(a);
  if (q.kind === 'tf') return Array.isArray(a) && a.some((v) => typeof v === 'boolean');
  return typeof a === 'string' && a.trim() !== '';
}

export function fmtDeadline(ts) {
  return new Date(ts).toLocaleString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Xem lại một câu sau khi nộp: câu trả lời của học sinh, đáp án đúng, điểm, lời giải.
// keyOnly: bài giấy giáo viên chấm tay — không có câu trả lời từng câu, chỉ hiện đáp án và lời giải.
export function reviewQuestion(q, index, answer, key, earned, urls, { keyOnly = false } = {}) {
  const full = earned != null && Number(earned) >= Number(q.points);
  const zero = earned == null || Number(earned) === 0;
  const status = keyOnly ? '' : full ? 'ok' : zero ? 'bad' : 'part';
  const head = el('div', { class: 'q-head' },
    el('span', { class: 'q-num', text: `Câu ${index + 1}` }),
    el('span', { class: 'q-kind', text: KIND_LABEL[q.kind] }),
    el('span', { class: `q-pts ${status}`, text: keyOnly ? `${fmtNum(q.points)} điểm` : `${fmtNum(earned ?? 0)} / ${fmtNum(q.points)} điểm` }));

  const body = [rich(q.prompt), qImage(q.image_path, urls, `Hình câu ${index + 1}`)];

  if (keyOnly) {
    if (q.kind === 'mcq') {
      body.push(el('div', { class: 'opts review' }, q.options.map((o, i) => el('div', { class: `opt${key && key.answer === i ? ' correct' : ''}` },
        el('b', { text: `${LETTERS[i]}.` }), rich(o, 'rich inline'),
        key && key.answer === i ? el('span', { class: 'tag-mini ok', text: 'Đáp án' }) : null))));
    } else if (q.kind === 'tf') {
      body.push(el('table', { class: 'tf-table review' },
        el('thead', {}, el('tr', {}, el('th', { text: 'Ý' }), el('th', { text: 'Nội dung' }), el('th', { text: 'Đáp án' }))),
        el('tbody', {}, q.options.map((o, i) => el('tr', {},
          el('td', { text: `${TF_LETTERS[i]})` }), el('td', {}, rich(o, 'rich inline')),
          el('td', { text: key ? (key.answer[i] ? 'Đúng' : 'Sai') : '?' }))))));
    } else if (key) {
      body.push(el('div', { class: 'short-review' }, el('div', {}, 'Đáp án: ', el('b', { text: key.answer.join('  hoặc  ') }))));
    }
  } else if (q.kind === 'mcq') {
    body.push(el('div', { class: 'opts review' }, q.options.map((o, i) => {
      const chosen = answer === i;
      const correct = key && key.answer === i;
      return el('div', { class: `opt${correct ? ' correct' : ''}${chosen && !correct ? ' wrong' : ''}${chosen ? ' chosen' : ''}` },
        el('b', { text: `${LETTERS[i]}.` }), rich(o, 'rich inline'),
        chosen ? el('span', { class: 'tag-mini', text: 'Em chọn' }) : null,
        correct ? el('span', { class: 'tag-mini ok', text: 'Đáp án' }) : null);
    })));
  } else if (q.kind === 'tf') {
    body.push(el('table', { class: 'tf-table review' },
      el('thead', {}, el('tr', {}, el('th', { text: 'Ý' }), el('th', { text: 'Nội dung' }), el('th', { text: 'Em chọn' }), el('th', { text: 'Đáp án' }))),
      el('tbody', {}, q.options.map((o, i) => {
        const mine = Array.isArray(answer) ? answer[i] : null;
        const right = key ? key.answer[i] : null;
        const good = key && mine === right;
        return el('tr', { class: key ? (good ? 'correct' : 'wrong') : '' },
          el('td', { text: `${TF_LETTERS[i]})` }), el('td', {}, rich(o, 'rich inline')),
          el('td', { text: mine === true ? 'Đúng' : mine === false ? 'Sai' : '—' }),
          el('td', { text: right === true ? 'Đúng' : right === false ? 'Sai' : '?' }));
      }))));
  } else {
    body.push(el('div', { class: 'short-review' },
      el('div', {}, 'Em trả lời: ', el('b', { text: typeof answer === 'string' && answer.trim() ? answer : '(bỏ trống)' })),
      key ? el('div', {}, 'Đáp án: ', el('b', { text: key.answer.join('  hoặc  ') })) : null));
  }

  if (key && (key.explanation || key.explanation_image_path)) {
    body.push(el('div', { class: 'explain' },
      el('span', { class: 'lbl', text: 'Lời giải' }),
      key.explanation ? rich(key.explanation) : null,
      qImage(key.explanation_image_path, urls, `Lời giải câu ${index + 1}`)));
  }
  return el('article', { class: `q-card review${status ? ` ${status}` : ''}` }, head, ...body);
}
