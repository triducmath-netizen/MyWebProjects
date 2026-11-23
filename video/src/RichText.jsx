// Chữ + công thức $...$ (KaTeX). Nội dung lấy từ kịch bản đã được chủ website duyệt.
import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function richHtml(text) {
  const s = String(text ?? '');
  const re = /\$\$([\s\S]+?)\$\$|\$((?:\\\$|[^$\n])+?)\$/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(s))) {
    out += esc(s.slice(last, m.index));
    const display = m[1] != null;
    out += katex.renderToString(display ? m[1] : m[2], { displayMode: display, throwOnError: false, strict: 'ignore' });
    last = re.lastIndex;
  }
  return out + esc(s.slice(last));
}

export function Rich({ text, style }) {
  return <span style={style} dangerouslySetInnerHTML={{ __html: richHtml(text) }} />;
}
