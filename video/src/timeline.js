// Tính thời gian từng cảnh / từng câu từ độ dài file giọng đọc (giây).
// Dùng chung cho Remotion (dựng hình) và script Node (xuất phụ đề .srt).
export const FPS = 30;
const GAP = 0.3;          // nghỉ giữa hai câu
const PAD_START = 0.5;    // đầu mỗi cảnh
const PAD_END = 0.7;      // cuối mỗi cảnh
const INTRO_HOLD = 1.6;   // giữ thẻ tiêu đề trước khi thầy nói
const OUTRO_HOLD = 3.0;   // giữ màn kết

export const sec2f = (s) => Math.round(s * FPS);

export function buildTimeline(kichBan, durations) {
  let t = 0;
  const scenes = kichBan.canh.map((c, si) => {
    const start = t;
    t += c.loai === 'mo-dau' ? INTRO_HOLD : PAD_START;
    const lines = c.loi.map((l, li) => {
      const dur = Math.max(0.6, Number(durations?.[si]?.[li]) || estimate(l.cau));
      const line = { ...l, si, li, start: t, dur };
      t += dur + GAP;
      return line;
    });
    t += c.loai === 'ket-thuc' ? OUTRO_HOLD : PAD_END;
    return { ...c, si, start, end: t, lines };
  });
  return { scenes, total: t };
}

// Ước lượng khi chưa có file giọng (xem thử): ~3 chữ/giây
export function estimate(text) {
  return Math.max(1.2, String(text || '').trim().split(/\s+/).length / 3);
}

export function toSrt(timeline) {
  const ts = (s) => {
    const ms = Math.round(s * 1000);
    const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
    const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
    const sec = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
    return `${h}:${m}:${sec},${String(ms % 1000).padStart(3, '0')}`;
  };
  let n = 0;
  return timeline.scenes.flatMap((s) => s.lines).map((l) =>
    `${++n}\n${ts(l.start)} --> ${ts(l.start + l.dur)}\n${l.nguoi === 'duc' ? 'Thầy Đức' : 'Minh'}: ${l.cau}\n`).join('\n');
}
