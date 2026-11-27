#!/usr/bin/env node
// Sinh 20 đề cho Toán 8 · Bài 18. Thu thập và phân loại dữ liệu (đề 1 là đề gốc, đề 2–20 cùng khuôn).
//   node de-thi/toan-8/theo-bai/sinh-de/bai-18.mjs <file-đề-01.json> <file-đề-02-20.json> [hạt-giống]
// Hình ghi vào de-thi/toan-8/theo-bai/hinh/bai-18/.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const HINH = resolve(here, '..', 'hinh', 'bai-18');
mkdirSync(HINH, { recursive: true });
const [out1, out2, seedArg] = process.argv.slice(2);

// ---------- Tiện ích ----------
let seed = Number(seedArg ?? 20261127);
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const sample = (a, k) => shuffle(a).slice(0, k);
const TF = (b) => (b ? 'Đúng' : 'Sai');
const ABCD = 'ABCD';
const vn = (x, d = 0) => x.toFixed(d).replace('.', ','); // số thập phân kiểu Việt Nam (chữ thường, không LaTeX)
const lc = (s) => s[0].toLowerCase() + s.slice(1);
function place(correct, wrongs, idx) {
  const all = [correct, ...wrongs];
  if (new Set(all.map(String)).size !== 4) return null;
  const out = []; let k = 0;
  for (let i = 0; i < 4; i++) out.push(i === idx ? correct : wrongs[k++]);
  return out;
}
const fig = (n, c) => `de-${String(n).padStart(2, '0')}-cau-${c}.svg`;
const imgPath = (n, c) => `../hinh/bai-18/${fig(n, c)}`;
const NAMES = ['An', 'Bình', 'Minh', 'Lan', 'Hà', 'Nam', 'Mai', 'Hùng', 'Linh', 'Khoa', 'Trang', 'Phúc', 'Ngọc', 'Tuấn', 'Vy', 'Quân'];
const CLS = ['8A', '8B', '8C', '8D', '8E', '8G'];

// ---------- Kho dữ liệu ----------
const TYPE = { d: 'số liệu rời rạc', c: 'số liệu liên tục', u: 'dữ liệu không là số, không thể sắp thứ tự', o: 'dữ liệu không là số, có thể sắp thứ tự' };
const DATA = [
  ['Số anh chị em ruột của mỗi bạn trong lớp', 'd'], ['Số bàn thắng của mỗi đội trong một trận đấu', 'd'], ['Số cuốn sách mỗi bạn đọc trong một tháng', 'd'],
  ['Số người dưới 18 tuổi trong mỗi gia đình', 'd'], ['Số chữ cái trong tên của mỗi bạn', 'd'], ['Số lần đi học muộn trong học kì của mỗi bạn', 'd'],
  ['Số xe đạp của mỗi gia đình trong xóm', 'd'], ['Số câu trả lời đúng của mỗi bạn trong bài kiểm tra 10 câu', 'd'], ['Số cây xanh mỗi lớp trồng được', 'd'],
  ['Số môn thể thao mỗi bạn chơi được', 'd'], ['Số huy chương vàng của mỗi đoàn tại một giải đấu', 'd'], ['Số học sinh của mỗi lớp trong trường', 'd'],
  ['Chiều cao của mỗi bạn trong lớp', 'c'], ['Cân nặng của mỗi bạn trong lớp', 'c'], ['Nhiệt độ cao nhất mỗi ngày ở Hà Nội', 'c'],
  ['Thời gian chạy 100 m của mỗi bạn', 'c'], ['Lượng mưa mỗi tháng ở Huế', 'c'], ['Thời gian tự học ở nhà mỗi ngày của mỗi bạn', 'c'],
  ['Quãng đường từ nhà đến trường của mỗi bạn', 'c'], ['Chiều dài của mỗi chiếc lá bàng nhặt được', 'c'], ['Lượng nước mỗi gia đình dùng trong một tháng', 'c'],
  ['Thời gian ngủ mỗi đêm của mỗi bạn', 'c'], ['Chiều cao của mỗi cây đậu sau hai tuần gieo hạt', 'c'], ['Khối lượng của mỗi quả xoài thu hoạch được', 'c'],
  ['Môn thể thao yêu thích của mỗi bạn', 'u'], ['Mạng điện thoại di động mỗi gia đình dùng', 'u'], ['Màu sắc yêu thích của mỗi bạn', 'u'],
  ['Nơi sinh (tỉnh, thành phố) của mỗi bạn', 'u'], ['Phương tiện đến trường của mỗi bạn', 'u'], ['Loại trái cây yêu thích của mỗi bạn', 'u'],
  ['Nhóm máu của mỗi bạn', 'u'], ['Thể loại phim yêu thích của mỗi bạn', 'u'], ['Môn học yêu thích của mỗi bạn', 'u'], ['Món ăn sáng yêu thích của mỗi bạn', 'u'],
  ['Mức độ hài lòng của khách hàng về một sản phẩm (rất hài lòng, hài lòng, bình thường, không hài lòng)', 'o'],
  ['Kết quả học tập của mỗi bạn (Tốt, Khá, Đạt, Chưa đạt)', 'o'], ['Đánh giá độ khó của đề kiểm tra (dễ, trung bình, khó, rất khó)', 'o'],
  ['Cỡ áo đồng phục của mỗi bạn (S, M, L, XL)', 'o'], ['Mức độ yêu thích môn Toán (rất thích, thích, bình thường, không thích)', 'o'],
  ['Mức độ thường xuyên đọc sách (không bao giờ, thỉnh thoảng, thường xuyên)', 'o'], ['Hạng huy chương của mỗi vận động viên đạt huy chương (vàng, bạc, đồng)', 'o'],
  ['Chất lượng không khí mỗi ngày (tốt, trung bình, kém, xấu)', 'o'],
];
const byT = (ts) => DATA.filter((x) => ts.includes(x[1]));
const isNum = (t) => t === 'd' || t === 'c';
// cách thu thập: [mô tả, phương pháp]; 'nguon' = nguồn có sẵn (gián tiếp)
const MET = [
  ['Đếm số xe máy đi qua cổng trường từ 6 giờ 30 đến 7 giờ', 'quan sat'], ['Ghi lại số bạn đi học muộn mỗi ngày trong tuần', 'quan sat'],
  ['Đếm số con chim đậu trên cây bàng ở sân trường vào giờ ra chơi', 'quan sat'], ['Ghi lại màu áo của các bạn đến dự buổi sinh hoạt câu lạc bộ', 'quan sat'],
  ['Trồng 5 cây đậu và đo chiều cao của chúng sau mỗi tuần', 'thi nghiem'], ['Gieo 20 hạt giống và đếm số hạt nảy mầm sau 3 ngày', 'thi nghiem'],
  ['Đun nóng một cốc nước và ghi lại nhiệt độ của nước sau mỗi phút', 'thi nghiem'], ['Thả một quả bóng từ các độ cao khác nhau và đo độ cao bóng nảy lên', 'thi nghiem'],
  ['Phát phiếu hỏi cho các bạn trong lớp về môn thể thao yêu thích', 'bang hoi'], ['Lập phiếu hỏi trực tuyến để các bạn chọn địa điểm tham quan', 'bang hoi'],
  ['Gửi phiếu hỏi cho phụ huynh về giờ đón con sau buổi học', 'bang hoi'], ['Phát phiếu hỏi cho các bạn trong khối về món ăn yêu thích ở căng tin', 'bang hoi'],
  ['Hỏi trực tiếp từng bạn trong tổ về số giờ ngủ mỗi đêm', 'phong van'], ['Gặp và hỏi các bác bán hàng ở chợ về giá rau trong ngày', 'phong van'],
  ['Bấm giờ khi từng bạn chạy 1000 m trong giờ thể dục', 'do'],
  ['Đếm số ô tô dừng chờ đèn đỏ ở ngã tư gần trường trong 10 phút', 'quan sat'], ['Ghi lại số bạn đến thư viện trường trong mỗi giờ ra chơi', 'quan sat'],
  ['Tung một đồng xu 50 lần và ghi lại mặt xuất hiện sau mỗi lần tung', 'thi nghiem'], ['Thả một viên đá lạnh vào cốc nước và đo thời gian viên đá tan hết', 'thi nghiem'],
  ['Phát phiếu hỏi cho các bạn trong câu lạc bộ về thời gian tập luyện mỗi tuần', 'bang hoi'], ['Gửi phiếu hỏi trực tuyến cho các bạn trong khối về bài hát yêu thích', 'bang hoi'],
  ['Tra cứu số dân của các tỉnh trên trang web của Tổng cục Thống kê', 'nguon'], ['Tìm trên Internet tên 10 nước có diện tích lớn nhất thế giới', 'nguon'],
  ['Đọc báo để biết số huy chương của đoàn thể thao Việt Nam tại SEA Games', 'nguon'], ['Tra niên giám thống kê để biết sản lượng lúa của các tỉnh', 'nguon'],
  ['Đọc sách Địa lí để biết chiều dài các con sông lớn ở Việt Nam', 'nguon'], ['Tìm trên Internet nhiệt độ trung bình các tháng trong năm ở Đà Lạt', 'nguon'],
  ['Tra cứu số quận, huyện của các tỉnh vùng Đồng bằng sông Hồng trên Internet', 'nguon'], ['Xem bản tin thời tiết trên truyền hình để ghi lại nhiệt độ các thành phố', 'nguon'],
];
const METNAME = { 'quan sat': 'Quan sát', 'thi nghiem': 'Làm thí nghiệm', 'bang hoi': 'Lập bảng hỏi (phiếu hỏi)', nguon: 'Thu thập từ nguồn có sẵn (sách, báo, Internet)' };
const direct = (m) => m !== 'nguon';

// ---------- Hình: phiếu khảo sát ----------
function sheetFig(file, qs) {
  const W = 760, H = 70 + qs.length * 62 + 20;
  let g = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Times New Roman" font-size="18">
  <rect width="${W}" height="${H}" fill="#fff"/>
  <rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="8" fill="#f7fbff" stroke="#1f4fa8" stroke-width="2"/>
  <text x="${W / 2}" y="46" text-anchor="middle" font-weight="bold" font-size="20" fill="#1f4fa8">PHIẾU KHẢO SÁT</text>`;
  qs.forEach(([q, opt], i) => {
    const y = 84 + i * 62;
    g += `\n  <text x="32" y="${y}">Câu ${i + 1}. ${q}</text>`;
    g += `\n  <text x="56" y="${y + 26}" font-size="16" fill="#444">${opt ? opt : 'Trả lời: ......................................'}</text>`;
  });
  writeFileSync(resolve(HINH, file), g + '\n</svg>\n');
}
const SURVEY = {
  d: [['Gia đình em có bao nhiêu người?'], ['Em có bao nhiêu anh chị em ruột?'], ['Tháng trước em đọc được bao nhiêu cuốn sách?'], ['Em chơi được bao nhiêu môn thể thao?'], ['Tuần trước em đi xe buýt bao nhiêu lần?']],
  c: [['Chiều cao của em là bao nhiêu xăng-ti-mét?'], ['Mỗi đêm em ngủ bao nhiêu giờ?'], ['Cân nặng của em là bao nhiêu ki-lô-gam?'], ['Quãng đường từ nhà em đến trường dài bao nhiêu ki-lô-mét?'], ['Mỗi ngày em dành bao nhiêu thời gian để tự học?']],
  u: [['Em thích môn thể thao nào nhất?'], ['Em thường đến trường bằng phương tiện gì?'], ['Màu sắc yêu thích của em là gì?'], ['Em thích loại trái cây nào nhất?'], ['Gia đình em dùng mạng điện thoại di động nào?']],
  o: [['Em thích môn Toán ở mức độ nào?', '□ Rất thích   □ Thích   □ Bình thường   □ Không thích'], ['Em đánh giá bữa ăn bán trú ở mức nào?', '□ Rất ngon   □ Ngon   □ Bình thường   □ Chưa ngon'],
    ['Em có thường xuyên đọc sách không?', '□ Thường xuyên   □ Thỉnh thoảng   □ Không bao giờ'], ['Em thấy bài tập về nhà ở mức nào?', '□ Dễ   □ Vừa sức   □ Khó   □ Rất khó'],
    ['Em hài lòng với thư viện trường ở mức nào?', '□ Rất hài lòng   □ Hài lòng   □ Không hài lòng']],
};

// ---------- Khuôn từng câu ----------
const T = {};
const lead = () => pick([`Trong tiết Thống kê, lớp ${pick(CLS)} liệt kê bốn loại dữ liệu dưới đây.`, `Nhóm của bạn ${pick(NAMES)} sưu tầm bốn loại dữ liệu dưới đây cho bài thuyết trình.`, `Bạn ${pick(NAMES)} lớp ${pick(CLS)} ghi vào vở bốn loại dữ liệu dưới đây.`, `Cô giáo đưa ra bốn loại dữ liệu dưới đây để lớp ${pick(CLS)} phân loại.`]);
function typeQ(idx, goodT, badT, ask) {
  const c = pick(byT(goodT)), w = sample(byT(badT), 3);
  const o = place(c, w, idx); if (!o) return null;
  return { options: o.map((x) => x[0]), answer: idx, _key: o.map((x) => x[0]).sort().join('|'),
    verify: `(()=>{const t=${JSON.stringify(o.map((x) => x[1]))};return t.findIndex(x=>${JSON.stringify(goodT)}.includes(x));})()`,
    prompt: `${lead()} Loại dữ liệu nào là ${ask}?`,
    explanation: o.map((x, i) => `${ABCD[i]}. ${x[0]}: ${TYPE[x[1]]}.`).join(' ') + ` Vậy chọn ${ABCD[idx]}.` };
}
T[1] = (n, idx) => typeQ(idx, ['u', 'o'], ['d', 'c'], 'dữ liệu không là số');
T[2] = (n, idx) => typeQ(idx, ['c'], ['d', 'u', 'o'], 'số liệu liên tục');
T[3] = (n, idx) => typeQ(idx, ['d'], ['c', 'c', 'u', 'o'], 'số liệu rời rạc');
T[4] = (n, idx) => typeQ(idx, ['o'], ['u'], 'dữ liệu không là số, có thể sắp thứ tự');
// 5. cách thu thập gián tiếp
T[5] = (n, idx) => {
  const c = pick(MET.filter((m) => !direct(m[1]))), w = sample(MET.filter((m) => direct(m[1])), 3);
  const o = place(c, w, idx); if (!o) return null;
  return { options: o.map((x) => x[0] + '.'), answer: idx, _key: o.map((x) => x[0]).sort().join('|'),
    verify: `${JSON.stringify(o.map((x) => x[1]))}.indexOf('nguon')`,
    prompt: `Để chuẩn bị cho tiết học Thống kê, bạn ${pick(NAMES)} lớp ${pick(CLS)} đề xuất bốn cách thu thập dữ liệu. Cách nào là thu thập dữ liệu gián tiếp?`,
    explanation: `Thu thập gián tiếp là lấy dữ liệu từ nguồn có sẵn (sách, báo, Internet, trang web thống kê…). Cách ${ABCD[idx]} lấy dữ liệu có sẵn nên là gián tiếp; ba cách còn lại đều do người thu thập tự quan sát, đo đạc, làm thí nghiệm hoặc hỏi trực tiếp nên là thu thập trực tiếp.` };
};
// 6. nhận ra phương pháp
const WHAT6 = ['Bạn', 'Nhóm của bạn', 'Tổ của bạn'];
T[6] = (n, idx) => {
  const c = pick(MET.filter((m) => METNAME[m[1]]));
  const rest = Object.keys(METNAME).filter((k) => k !== c[1]);
  const o = place(c[1], shuffle(rest), idx); if (!o) return null;
  return { options: o.map((k) => METNAME[k]), answer: idx, _key: c[0],
    verify: `${JSON.stringify(o)}.indexOf(${JSON.stringify(c[1])})`, _core: c[0],
    prompt: `${pick(WHAT6)} ${pick(NAMES)} thu thập dữ liệu bằng cách: ${lc(c[0])}. Đó là phương pháp thu thập dữ liệu nào?`,
    explanation: `Việc "${lc(c[0])}" là ${{ 'quan sat': 'quan sát rồi ghi chép lại', 'thi nghiem': 'tự tiến hành thí nghiệm rồi đo, đếm kết quả', 'bang hoi': 'dùng phiếu hỏi để người được hỏi tự trả lời', nguon: 'lấy dữ liệu đã có sẵn từ sách, báo, Internet' }[c[1]]}, nên phương pháp là: ${lc(METNAME[c[1]])}.` };
};
// số liệu đo có một giá trị không hợp lí
const MEAS = [
  { ten: 'cân nặng', dv: 'kg', lo: 38, hi: 60, d: 0, bad: [[4, 'nhỏ hơn rất nhiều so với cân nặng của học sinh lớp 8'], [145, 'lớn hơn rất nhiều so với cân nặng của học sinh lớp 8'], [150, 'lớn hơn rất nhiều so với cân nặng của học sinh lớp 8']], ai: 'các bạn trong tổ' },
  { ten: 'chiều cao', dv: 'cm', lo: 142, hi: 172, d: 0, bad: [[16, 'quá thấp, không thể là chiều cao của học sinh lớp 8'], [255, 'cao hơn cả người cao nhất thế giới'], [15, 'quá thấp, không thể là chiều cao của học sinh lớp 8']], ai: 'các bạn trong tổ' },
  { ten: 'thời gian chạy 100 m', dv: 'giây', lo: 130, hi: 189, d: 1, bad: [[2, 'không ai chạy 100 m trong 2 giây (kỉ lục thế giới gần 10 giây)'], [1, 'không ai chạy 100 m trong 1 giây (kỉ lục thế giới gần 10 giây)'], [3, 'không ai chạy 100 m trong 3 giây (kỉ lục thế giới gần 10 giây)']], ai: 'các bạn trong lớp' },
  { ten: 'thời gian ngủ mỗi đêm', dv: 'giờ', lo: 60, hi: 100, d: 1, bad: [[26, 'một ngày đêm chỉ có 24 giờ'], [30, 'một ngày đêm chỉ có 24 giờ'], [25, 'một ngày đêm chỉ có 24 giờ']], ai: 'các bạn trong tổ' },
  { ten: 'nhiệt độ cao nhất trong ngày ở Hà Nội vào tháng 6', dv: '°C', lo: 300, hi: 390, d: 1, bad: [[85, 'nhiệt độ không khí không thể lên tới 85 °C'], [90, 'nhiệt độ không khí không thể lên tới 90 °C'], [2, 'tháng 6 ở Hà Nội không thể lạnh tới 2 °C']], ai: 'các ngày trong tuần' },
];
const measVals = (m, k) => { const s = new Set(); while (s.size < k) s.add(int(m.lo, m.hi)); return shuffle([...s]); }; // đơn vị 1/10 khi d = 1
const mval = (m, v) => (m.d ? vn(v / 10, 1) : String(v));
// 7. chọn giá trị không hợp lí
T[7] = (n, idx) => {
  const m = pick(MEAS), [bad, why] = pick(m.bad), vals = measVals(m, 6);
  const badS = m.d ? vn(bad, 0) : String(bad);
  const list = shuffle([...vals.map((v) => mval(m, v)), badS]);
  const sorted = [...vals].sort((a, b) => a - b);
  const w = [sorted[0], sorted[5], sorted[int(1, 4)]].map((v) => mval(m, v));
  const o = place(badS, w, idx); if (!o) return null;
  const who = pick(NAMES);
  return { options: o.map((x) => `${x} ${m.dv}`), answer: idx, _key: list.join(';'),
    verify: `(()=>{const o=${JSON.stringify(o)}.map(s=>Number(s.replace(',','.')));const lo=${m.d ? m.lo / 10 : m.lo},hi=${m.d ? m.hi / 10 : m.hi};return o.findIndex(v=>v<lo||v>hi);})()`,
    prompt: `Bạn ${who} ghi lại ${m.ten} (${m.dv}) của ${m.ai} như sau: ${list.join('; ')}. Giá trị nào trong dãy là không hợp lí?`,
    explanation: `Giá trị ${badS} ${m.dv} là không hợp lí vì ${why}. Các giá trị còn lại đều nằm trong khoảng thông thường; giá trị lớn nhất ${w[1]} ${m.dv} hay nhỏ nhất ${w[0]} ${m.dv} của dãy vẫn hợp lí.` };
};
// 8. dữ liệu không là số có một giá trị không hợp lí
const CATS = [
  ['món ăn sáng yêu thích', ['phở', 'bánh mì', 'xôi', 'bún bò', 'cháo', 'bánh cuốn'], ['nước cam', 'sữa đậu nành', 'trà sữa'], 'là đồ uống, không phải món ăn'],
  ['môn thể thao yêu thích', ['bóng đá', 'cầu lông', 'bơi lội', 'bóng rổ', 'cờ vua', 'điền kinh'], ['Ngữ văn', 'Lịch sử', 'Tiếng Anh'], 'là môn học, không phải môn thể thao'],
  ['loại trái cây yêu thích', ['cam', 'xoài', 'chuối', 'dưa hấu', 'nho', 'ổi'], ['cà rốt', 'bắp cải', 'su hào'], 'là rau củ, không phải trái cây'],
  ['vật nuôi trong nhà', ['chó', 'mèo', 'cá vàng', 'vẹt', 'thỏ', 'chim sáo'], ['hổ', 'voi', 'cá mập'], 'là động vật hoang dã, không nuôi trong nhà được'],
  ['màu sắc yêu thích', ['đỏ', 'xanh lam', 'vàng', 'tím', 'hồng', 'trắng'], ['cái bàn', 'quả bóng', 'bút chì'], 'là đồ vật, không phải màu sắc'],
  ['phương tiện đi đến trường hằng ngày', ['xe đạp', 'xe buýt', 'đi bộ', 'xe máy', 'xe đạp điện'], ['máy bay', 'khinh khí cầu'], 'không thể là phương tiện đi học hằng ngày của học sinh'],
];
T[8] = (n, idx) => {
  const [ten, ok, bads, why] = pick(CATS), bad = pick(bads), three = sample(ok, 3), k = int(7, 9);
  const list = shuffle([...three, ...Array.from({ length: k - 4 }, () => pick(three)), bad]);
  const o = place(bad, shuffle(three), idx); if (!o) return null;
  return { options: o.map((x) => x[0].toUpperCase() + x.slice(1)), answer: idx, _key: list.join(';'),
    verify: `${JSON.stringify(o)}.indexOf(${JSON.stringify(bad)})`,
    prompt: `Bạn ${pick(NAMES)} hỏi ${k} bạn trong lớp về ${ten} và ghi lại: ${list.join('; ')}. Giá trị nào là không hợp lí?`,
    explanation: `"${bad[0].toUpperCase() + bad.slice(1)}" ${why}, nên đây là giá trị không hợp lí. Các giá trị còn lại đều đúng là ${ten}.` };
};
// 9. tính đại diện
const TOP9 = [['thời gian sử dụng điện thoại mỗi ngày', 'câu lạc bộ Tin học'], ['môn thể thao yêu thích', 'câu lạc bộ Bóng đá'], ['thời gian tự học mỗi ngày', 'đội tuyển học sinh giỏi'],
  ['số cuốn sách đọc trong một tháng', 'câu lạc bộ Đọc sách'], ['món ăn yêu thích ở căng tin', 'đội bóng rổ của trường'], ['thời gian ngủ mỗi đêm', 'câu lạc bộ Cờ vua']];
T[9] = (n, idx) => {
  const [top, club] = pick(TOP9), k = int(3, 6), sch = pick(['Lê Lợi', 'Nguyễn Trãi', 'Quang Trung', 'Chu Văn An', 'Trần Phú', 'Lý Thường Kiệt']);
  const good = `Chọn ngẫu nhiên ở mỗi lớp trong trường ${k} học sinh để hỏi.`;
  const W = [`Chỉ hỏi tất cả học sinh lớp ${pick(CLS)}.`, `Chỉ hỏi các bạn trong ${club}.`, `Chỉ hỏi các bạn nữ của khối 9.`, `Chỉ hỏi ${k * 4} bạn đến thư viện vào giờ ra chơi.`, `Chỉ hỏi các bạn khối 6 vì đó là khối đông nhất.`];
  const o = place(good, sample(W, 3), idx); if (!o) return null;
  return { options: o, answer: idx, _key: o.slice().sort().join('|'),
    verify: `${JSON.stringify(o)}.findIndex(s=>s.startsWith('Chọn ngẫu nhiên'))`,
    prompt: `Để tìm hiểu ${top} của học sinh Trường THCS ${sch} (gồm các khối 6, 7, 8, 9), cách chọn học sinh để hỏi nào dưới đây đảm bảo tính đại diện nhất?`,
    explanation: `Mẫu phải bao quát mọi khối, mọi lớp, cả nam và nữ thì mới đại diện cho học sinh toàn trường. Cách ${ABCD[idx]} chọn ngẫu nhiên ở mọi lớp nên đảm bảo tính đại diện; các cách còn lại chỉ hỏi một nhóm riêng (một lớp, một khối, một câu lạc bộ, một giới tính…), kết quả không phản ánh được toàn trường.` };
};
// 10. chọn mẫu tỉ lệ (khối 8)
T[10] = (n, idx) => {
  const r = pick([4, 5, 8, 10]), m = [int(30, 60), int(30, 60), int(30, 60), int(30, 60)];
  if (new Set(m).size < 4) return null;
  const sz = m.map((x) => x * r), N = m.reduce((a, b) => a + b, 0), tot = N * r;
  const w = [N / 4, m[1], m[3]]; if (w.some((x) => !Number.isInteger(x))) return null;
  const o = place(m[2], w, idx); if (!o) return null;
  const top = pick(['thời gian tự học ở nhà', 'thời gian sử dụng mạng xã hội', 'số giờ ngủ mỗi đêm', 'quãng đường từ nhà đến trường']);
  return { options: o.map(String), answer: idx,
    verify: `(()=>{const s=[${sz}],N=${N};return N*s[2]/s.reduce((a,b)=>a+b,0);})()`,
    prompt: `Một trường THCS có ${sz[0]} học sinh khối 6, ${sz[1]} học sinh khối 7, ${sz[2]} học sinh khối 8 và ${sz[3]} học sinh khối 9. Để tìm hiểu ${top} của học sinh toàn trường, nhà trường chọn ${N} học sinh để khảo sát sao cho số học sinh được chọn ở mỗi khối tỉ lệ với số học sinh của khối đó. Số học sinh khối 8 được chọn là`,
    explanation: `Tổng số học sinh: ${sz.join(' + ')} = ${tot}. Tỉ số ${N} : ${tot} = 1 : ${r}, tức cứ ${r} học sinh thì chọn 1. Khối 8 được chọn ${sz[2]} : ${r} = ${m[2]} học sinh. Phương án ${N / 4} là chia đều ${N} cho 4 khối, không đảm bảo tỉ lệ nên mẫu kém đại diện.` };
};
// 11. đếm số liệu liên tục trong danh sách
T[11] = (n, idx) => {
  const c = int(1, 4), items = shuffle([...sample(byT(['c']), c), ...sample(byT(['d', 'u', 'o']), 6 - c)]);
  const pool = shuffle([0, 1, 2, 3, 4, 5].filter((x) => x !== c)).slice(0, 3);
  const o = place(c, pool, idx); if (!o) return null;
  return { options: o.map(String), answer: idx, _key: items.map((x) => x[0]).sort().join('|'),
    verify: `${JSON.stringify(items.map((x) => x[1]))}.filter(t=>t==='c').length`,
    prompt: `Cho sáu loại dữ liệu sau: ${items.map((x, i) => `(${i + 1}) ${lc(x[0])}`).join('; ')}. Trong sáu loại dữ liệu trên, có bao nhiêu loại là số liệu liên tục?`,
    explanation: items.map((x, i) => `(${i + 1}) ${TYPE[x[1]]}`).join('; ') + `. Số liệu liên tục là số liệu đo được (chiều dài, khối lượng, thời gian, nhiệt độ…), nhận mọi giá trị trong một khoảng. Có ${c} loại là số liệu liên tục.` };
};
// 12. dữ liệu có thứ tự: phần trăm từ một mức trở lên
const SCALE12 = [[['Rất hài lòng', 'Hài lòng', 'Bình thường', 'Không hài lòng'], 'chất lượng bữa ăn bán trú'], [['Rất thích', 'Thích', 'Bình thường', 'Không thích'], 'môn Toán'],
  [['Rất hay', 'Hay', 'Bình thường', 'Không hay'], 'buổi ngoại khóa vừa qua'], [['Rất dễ hiểu', 'Dễ hiểu', 'Hơi khó hiểu', 'Khó hiểu'], 'bài giảng trực tuyến môn Khoa học tự nhiên']];
T[12] = (n, idx) => {
  const [lv, top] = pick(SCALE12), N = pick([20, 25, 40, 50]), u = 100 / N;
  const a = [int(2, 14), int(4, 16), int(2, 10)]; const d = N - a[0] - a[1] - a[2]; if (d < 1 || d > 10) return null;
  const cnt = [...a, d], pc = (x) => x * u; if (!Number.isInteger(pc(1)) && cnt.some((x) => !Number.isInteger(pc(x)))) return null;
  const ans = pc(cnt[0] + cnt[1]), w = [pc(cnt[1]), pc(cnt[0] + cnt[1] + cnt[2]), pc(cnt[1] + cnt[2])];
  if ([ans, ...w].some((x) => !Number.isInteger(x))) return null;
  const o = place(ans, w, idx); if (!o) return null;
  const order = shuffle([0, 1, 2, 3]);
  return { options: o.map((x) => `${x}%`), answer: idx,
    verify: `(()=>{const c=[${cnt}];return ${JSON.stringify(o)}.indexOf((c[0]+c[1])*100/${N});})()`,
    prompt: `Lớp ${pick(CLS)} có ${N} học sinh. Kết quả khảo sát ý kiến của cả lớp về ${top} như sau: ${order.map((i) => `${lv[i]}: ${cnt[i]} bạn`).join('; ')}. Số bạn đánh giá từ mức "${lv[1]}" trở lên chiếm bao nhiêu phần trăm số học sinh cả lớp?`,
    explanation: `Các mức sắp thứ tự từ cao xuống thấp: ${lv.join(' > ')}. Từ mức "${lv[1]}" trở lên gồm "${lv[0]}" và "${lv[1]}": ${cnt[0]} + ${cnt[1]} = ${cnt[0] + cnt[1]} bạn, chiếm ${cnt[0] + cnt[1]} : ${N} · 100% = ${ans}%. Phương án ${w[0]}% chỉ tính riêng mức "${lv[1]}", quên mức cao hơn.` };
};
// 13. Đúng/Sai: phiếu khảo sát (hình)
const CONF = { d: ['c', 'c', 'u'], c: ['d', 'd', 'o'], u: ['o', 'o', 'd'], o: ['u', 'u', 'c'] };
T[13] = (n, pat) => {
  const ts = shuffle(['d', 'c', 'u', 'o']), qs = ts.map((t) => pick(SURVEY[t]));
  const claim = ts.map((t, i) => (pat[i] ? t : pick(CONF[t])));
  const file = fig(n, '13');
  return { options: claim.map((c, i) => `${'abcd'[i]}) Câu ${i + 1} của phiếu thu được ${TYPE[c]}.`), answer: pat, image: imgPath(n, '13'), _fig: () => sheetFig(file, qs), _key: qs.map((q) => q[0]).join('|'),
    verify: `(()=>{const t=${JSON.stringify(ts)},c=${JSON.stringify(claim)};return t.map((x,i)=>x===c[i]);})()`,
    prompt: `Bạn ${pick(NAMES)} lớp ${pick(CLS)} lập phiếu khảo sát các bạn trong lớp như hình bên. Xét tính đúng, sai của các khẳng định sau.`,
    explanation: ts.map((t, i) => `${'abcd'[i]}) ${TF(pat[i])}. Câu ${i + 1} ("${qs[i][0]}") thu được ${TYPE[t]}${t === 'd' ? ' (kết quả đếm, là số tự nhiên)' : t === 'c' ? ' (kết quả đo, nhận mọi giá trị trong một khoảng)' : t === 'o' ? ' (các mức độ sắp được từ cao đến thấp)' : ' (các câu trả lời không so sánh hơn kém được)'}.`).join(' ') };
};
// 14. Đúng/Sai: cách thu thập của các nhóm
T[14] = (n, pat) => {
  const ab = sample(MET, 2), cd = sample(MET.filter((m) => ['quan sat', 'thi nghiem', 'bang hoi'].includes(m[1]) && !ab.includes(m)), 2);
  const it = [...ab, ...cd];
  const opt = it.map((m, i) => {
    if (i < 2) { const d = pat[i] ? direct(m[1]) : !direct(m[1]); return [`Nhóm ${i + 1} thu thập dữ liệu ${d ? 'trực tiếp' : 'gián tiếp'}.`]; }
    const k = pat[i] ? m[1] : pick(['quan sat', 'thi nghiem', 'bang hoi'].filter((x) => x !== m[1]));
    return [`Nhóm ${i + 1} dùng phương pháp ${lc(METNAME[k])}.`, k];
  });
  return { options: opt.map((x, i) => `${'abcd'[i]}) ${x[0]}`), answer: pat, _key: it.map((m) => m[0]).join('|'),
    verify: `(()=>{const m=${JSON.stringify(it.map((x) => x[1]))},o=${JSON.stringify(opt.map((x) => x[0]))};return m.map((x,i)=>i<2?(o[i].includes('trực tiếp')===(x!=='nguon')):(o[i].includes(${JSON.stringify(lc(METNAME['quan sat']))})?x==='quan sat':o[i].includes(${JSON.stringify(lc(METNAME['thi nghiem']))})?x==='thi nghiem':x==='bang hoi'));})()`,
    prompt: `Lớp ${pick(CLS)} làm dự án "Em tìm hiểu cuộc sống quanh em". Bốn nhóm thu thập dữ liệu như sau. Nhóm 1: ${lc(it[0][0])}. Nhóm 2: ${lc(it[1][0])}. Nhóm 3: ${lc(it[2][0])}. Nhóm 4: ${lc(it[3][0])}. Xét tính đúng, sai của các khẳng định sau.`,
    explanation: it.map((m, i) => `${'abcd'[i]}) ${TF(pat[i])}. ` + (i < 2 ? `Nhóm ${i + 1} ${direct(m[1]) ? `tự ${{ 'quan sat': 'quan sát, ghi chép', 'thi nghiem': 'làm thí nghiệm', 'bang hoi': 'lập phiếu hỏi', 'phong van': 'phỏng vấn', do: 'đo đạc' }[m[1]]} để có dữ liệu nên thu thập trực tiếp` : 'lấy dữ liệu có sẵn (sách, báo, Internet) nên thu thập gián tiếp'}.` : `Nhóm ${i + 1} dùng phương pháp ${lc(METNAME[m[1]])}.`)).join(' ') };
};
// 15. Đúng/Sai: dãy số đo có giá trị không hợp lí
const MEAS15 = [
  { ten: 'thời gian chạy 100 m', dv: 'giây', lo: 130, hi: 189, bad: [15, 20], t: 150, cmp: 'dưới', ai: '10 bạn nam trong lớp' },
  { ten: 'thời gian ngủ đêm qua', dv: 'giờ', lo: 60, hi: 100, bad: [260, 300], t: 80, cmp: 'từ', ai: '10 bạn trong tổ' },
  { ten: 'chiều dài', dv: 'cm', lo: 150, hi: 280, bad: [1500, 2000], t: 200, cmp: 'từ', ai: '10 chiếc lá bàng nhặt được ở sân trường' },
  { ten: 'chiều cao', dv: 'cm', lo: 80, hi: 250, bad: [2500, 3000], t: 150, cmp: 'từ', ai: '10 cây đậu sau ba tuần gieo hạt' },
];
T[15] = (n, pat) => {
  const m = pick(MEAS15), bad = pick(m.bad), s = new Set(); while (s.size < 9) s.add(int(m.lo, m.hi));
  const vals = [...s], list = shuffle([...vals, bad]), f = (v) => vn(v / 10, 1), cl = pick(CLS);
  const thr = m.t, ok = (v) => (m.cmp === 'dưới' ? v < thr : v >= thr);
  const cnt = vals.filter(ok).length, cntAll = list.filter(ok).length;
  const rng = Math.max(...vals) - Math.min(...vals), rngAll = Math.max(...list) - Math.min(...list);
  const sorted = [...vals].sort((a, b) => a - b);
  const bClaim = pat[1] ? bad : (bad > thr ? sorted[8] : sorted[0]);
  const cClaim = pat[2] ? cnt : (cntAll !== cnt ? cntAll : cnt + 1);
  const dClaim = pat[3] ? rng : (rngAll !== rng ? rngAll : rng + 10);
  if (cnt === 0 || cnt === 9) return null;
  const cmpTxt = m.cmp === 'dưới' ? `dưới ${f(thr)} ${m.dv}` : `từ ${f(thr)} ${m.dv} trở lên`;
  return { answer: pat, _key: list.join(';'),
    options: [`a) Dữ liệu thu được là ${pat[0] ? 'số liệu liên tục' : 'số liệu rời rạc'}.`, `b) Giá trị không hợp lí trong dãy là ${f(bClaim)} ${m.dv}.`,
      `c) Sau khi loại bỏ giá trị không hợp lí, có ${cClaim} giá trị ${cmpTxt}.`, `d) Sau khi loại bỏ giá trị không hợp lí, hiệu giữa giá trị lớn nhất và giá trị nhỏ nhất là ${f(dClaim)} ${m.dv}.`],
    verify: `(()=>{const v=[${list}].filter(x=>x>=${m.lo}&&x<=${m.hi});return [${pat[0]}, ${bClaim}===${bad}, v.filter(x=>${m.cmp === 'dưới' ? `x<${thr}` : `x>=${thr}`}).length===${cClaim}, Math.max(...v)-Math.min(...v)===${dClaim}];})()`,
    prompt: `Một nhóm học sinh lớp ${cl} ghi lại ${m.ten} (đơn vị: ${m.dv}) của ${m.ai} như sau: ${list.map(f).join('; ')}. Xét tính đúng, sai của các khẳng định sau.`,
    explanation: `a) ${TF(pat[0])}. Đây là kết quả đo nên là số liệu liên tục. b) ${TF(pat[1])}. Giá trị ${f(bad)} ${m.dv} là không hợp lí (${bad > thr ? 'lớn' : 'nhỏ'} bất thường so với các giá trị còn lại và với thực tế)${pat[1] ? '' : `, còn ${f(bClaim)} ${m.dv} vẫn hợp lí`}. c) ${TF(pat[2])}. Sau khi loại ${f(bad)}, các giá trị ${cmpTxt} là: ${vals.filter(ok).sort((a, b) => a - b).map(f).join('; ')}, gồm ${cnt} giá trị. d) ${TF(pat[3])}. Giá trị lớn nhất ${f(sorted[8])}, nhỏ nhất ${f(sorted[0])}, hiệu là ${f(rng)} ${m.dv}.` };
};
// 16. Đúng/Sai: khảo sát toàn trường
const TOP16 = [['thời gian ngủ mỗi đêm', 'c', '26 giờ', '8 giờ'], ['số cuốn sách đọc trong tháng', 'd', '3,5 cuốn', '4 cuốn'], ['thời gian đi từ nhà đến trường', 'c', '25 giờ', '15 phút'],
  ['số lần đi bơi trong tháng', 'd', '2,5 lần', '6 lần'], ['số giờ tự học mỗi ngày', 'c', '30 giờ', '2 giờ'], ['số bộ phim xem trong tháng', 'd', '1,5 bộ phim', '3 bộ phim']];
T[16] = (n, pat) => {
  const [top, t, bad, ok] = pick(TOP16), r = pick([4, 5, 6, 8, 10]), m = [int(30, 55), int(30, 55), int(30, 55), int(30, 55)];
  if (new Set(m).size < 4) return null;
  const sz = m.map((x) => x * r), N = m.reduce((a, b) => a + b, 0);
  const wrongC = Number.isInteger(N / 4) && N / 4 !== m[3] ? N / 4 : m[3] + r;
  const cClaim = pat[2] ? m[3] : wrongC, cl = pick(CLS);
  const aLab = pat[0] ? TYPE[t] : TYPE[t === 'c' ? 'd' : 'c'];
  return { answer: pat,
    options: [`a) Dữ liệu thu được là ${aLab}.`, `b) Nếu chỉ hỏi các bạn lớp ${cl} thì mẫu ${pat[1] ? 'không đảm bảo' : 'vẫn đảm bảo'} tính đại diện cho học sinh toàn trường.`,
      `c) Nếu chọn ${N} học sinh sao cho số học sinh được chọn ở mỗi khối tỉ lệ với số học sinh của khối đó thì khối 9 có ${cClaim} học sinh được chọn.`,
      `d) Câu trả lời "${pat[3] ? bad : ok}" là giá trị không hợp lí.`],
    verify: `(()=>{const s=[${sz}];return [${JSON.stringify(aLab)}===${JSON.stringify(TYPE[t])}, ${pat[1]}, ${N}*s[3]/s.reduce((a,b)=>a+b,0)===${cClaim}, ${pat[3]}];})()`,
    prompt: `Một trường THCS có ${sz[0]} học sinh khối 6, ${sz[1]} học sinh khối 7, ${sz[2]} học sinh khối 8 và ${sz[3]} học sinh khối 9. Liên đội muốn tìm hiểu ${top} của học sinh toàn trường. Xét tính đúng, sai của các khẳng định sau.`,
    explanation: `a) ${TF(pat[0])}. ${top[0].toUpperCase() + top.slice(1)} là ${TYPE[t]}${t === 'c' ? ' (đại lượng đo được)' : ' (kết quả đếm, là số tự nhiên)'}. b) ${TF(pat[1])}. Chỉ hỏi một lớp thì không bao quát các khối khác nên mẫu không đảm bảo tính đại diện. c) ${TF(pat[2])}. Tổng số học sinh ${sz.join(' + ')} = ${N * r}; tỉ số ${N} : ${N * r} = 1 : ${r}; khối 9 được chọn ${sz[3]} : ${r} = ${m[3]} học sinh. d) ${TF(pat[3])}. "${bad}" không hợp lí vì ${t === 'c' ? 'một ngày chỉ có 24 giờ' : 'kết quả đếm phải là số tự nhiên'}; còn "${ok}" là hợp lí.` };
};
// 17. đếm dữ liệu không là số
T[17] = (n) => {
  const c = int(2, 6), items = shuffle([...sample(byT(['u', 'o']), c), ...sample(byT(['d', 'c']), 8 - c)]);
  return { answer: [String(c)], _key: items.map((x) => x[0]).sort().join('|'),
    verify: `${JSON.stringify(items.map((x) => x[1]))}.filter(t=>t==='u'||t==='o').length`,
    prompt: `Cho tám loại dữ liệu sau: ${items.map((x, i) => `(${i + 1}) ${lc(x[0])}`).join('; ')}. Có bao nhiêu loại dữ liệu trong tám loại trên là dữ liệu không là số?`,
    explanation: `Dữ liệu không là số: ${items.map((x, i) => [x, i]).filter(([x]) => !isNum(x[1])).map(([, i]) => `(${i + 1})`).join(', ')}; các loại còn lại là số liệu (kết quả đếm hoặc đo). Đáp số: ${c}.` };
};
// 18. đếm cách thu thập trực tiếp
T[18] = (n) => {
  const c = int(2, 5), items = shuffle([...sample(MET.filter((m) => direct(m[1])), c), ...sample(MET.filter((m) => !direct(m[1])), 7 - c)]);
  return { answer: [String(c)], _key: items.map((x) => x[0]).sort().join('|'),
    verify: `${JSON.stringify(items.map((x) => x[1]))}.filter(t=>t!=='nguon').length`,
    prompt: `Cho bảy cách thu thập dữ liệu sau: ${items.map((x, i) => `(${i + 1}) ${lc(x[0])}`).join('; ')}. Có bao nhiêu cách là thu thập dữ liệu trực tiếp?`,
    explanation: `Thu thập trực tiếp (quan sát, đo, làm thí nghiệm, lập phiếu hỏi, phỏng vấn): ${items.map((x, i) => [x, i]).filter(([x]) => direct(x[1])).map(([, i]) => `(${i + 1})`).join(', ')}. Các cách còn lại lấy từ nguồn có sẵn nên là gián tiếp. Đáp số: ${c}.` };
};
// 19. đếm giá trị không hợp lí (số liệu rời rạc có giới hạn)
const CNT19 = [
  { ten: 'số học sinh của mỗi lớp khối 8 trong một trường (mỗi lớp có không quá 45 học sinh)', lo: 32, hi: 45, bad: [['48', 'vượt quá 45'], ['52', 'vượt quá 45'], ['40,5', 'số học sinh phải là số tự nhiên'], ['38,5', 'số học sinh phải là số tự nhiên'], ['46', 'vượt quá 45']], k: 9 },
  { ten: 'số câu trả lời đúng của mỗi bạn trong bài kiểm tra gồm 10 câu', lo: 3, hi: 10, bad: [['12', 'bài chỉ có 10 câu'], ['15', 'bài chỉ có 10 câu'], ['7,5', 'số câu phải là số tự nhiên'], ['6,5', 'số câu phải là số tự nhiên'], ['−1', 'số câu không thể âm']], k: 10 },
  { ten: 'số anh chị em ruột của mỗi bạn trong tổ', lo: 0, hi: 3, bad: [['1,5', 'số người phải là số tự nhiên'], ['2,5', 'số người phải là số tự nhiên'], ['−1', 'số người không thể âm'], ['−2', 'số người không thể âm']], k: 10 },
  { ten: 'số bàn thắng của mỗi đội trong các trận đấu của giải bóng đá học sinh', lo: 0, hi: 5, bad: [['2,5', 'số bàn thắng phải là số tự nhiên'], ['0,5', 'số bàn thắng phải là số tự nhiên'], ['−2', 'số bàn thắng không thể âm'], ['1,5', 'số bàn thắng phải là số tự nhiên']], k: 10 },
];
T[19] = (n) => {
  const m = pick(CNT19), nb = int(2, 3), bads = sample(m.bad, nb);
  const goods = Array.from({ length: m.k - nb }, () => String(int(m.lo, m.hi)));
  const list = shuffle([...goods, ...bads.map((b) => b[0])]);
  return { answer: [String(nb)], _key: list.join(';'),
    verify: `${JSON.stringify(list)}.map(s=>Number(s.replace(',','.').replace('−','-'))).filter(v=>!Number.isInteger(v)||v<${m.lo}||v>${m.hi}).length`,
    prompt: `Bạn ${pick(NAMES)} ghi lại ${m.ten} như sau: ${list.join('; ')}. Trong dãy trên có bao nhiêu giá trị không hợp lí?`,
    explanation: `Các giá trị không hợp lí: ${bads.map((b) => `${b[0]} (${b[1]})`).join('; ')}. Các giá trị còn lại đều là số tự nhiên trong phạm vi thực tế. Đáp số: ${nb}.` };
};
// 20. đếm dữ liệu có thứ tự từ một mức trở lên
const SCALE20 = [[['Tốt', 'Khá', 'Đạt', 'Chưa đạt'], 'kết quả học tập học kì I của các bạn trong tổ', 'đạt mức "Khá" trở lên'],
  [['Rất khó', 'Khó', 'Trung bình', 'Dễ'], 'đánh giá của các bạn về độ khó của đề kiểm tra', 'đánh giá đề từ mức "Khó" trở lên'],
  [['XL', 'L', 'M', 'S'], 'cỡ áo đồng phục mà các bạn trong tổ đăng kí (S < M < L < XL)', 'đăng kí cỡ áo từ cỡ L trở lên'],
  [['Thường xuyên', 'Thỉnh thoảng', 'Hiếm khi', 'Không bao giờ'], 'mức độ đọc sách ngoài giờ học của các bạn', 'đọc sách từ mức "Thỉnh thoảng" trở lên']];
T[20] = (n) => {
  const [lv, ten, ask] = pick(SCALE20), N = int(12, 16);
  const list = Array.from({ length: N }, () => pick(lv)), ans = list.filter((x) => x === lv[0] || x === lv[1]).length;
  if (ans < 3 || ans > N - 3 || !lv.every((x) => list.includes(x))) return null;
  return { answer: [String(ans)], _key: list.join(';'),
    verify: `${JSON.stringify(list)}.filter(x=>${JSON.stringify(lv.slice(0, 2))}.includes(x)).length`,
    prompt: `Bạn ${pick(NAMES)} ghi lại ${ten} như sau: ${list.join('; ')}. Có bao nhiêu bạn ${ask}?`,
    explanation: `Đây là dữ liệu không là số, có thể sắp thứ tự: ${lv.join(' > ')}. Các bạn ${ask} gồm hai mức "${lv[0]}" và "${lv[1]}": có ${list.filter((x) => x === lv[0]).length} + ${list.filter((x) => x === lv[1]).length} = ${ans} bạn.` };
};
// 21. chọn mẫu tỉ lệ ngược: biết số người được chọn ở một nhóm
const CTX21 = [['nhà máy', 'phân xưởng', 'công nhân', 'thời gian đi làm mỗi ngày'], ['bệnh viện', 'khoa', 'nhân viên', 'số giờ làm việc mỗi tuần'], ['công ty', 'phòng', 'nhân viên', 'phương tiện đi làm'], ['khu dân cư', 'tổ dân phố', 'hộ gia đình', 'lượng điện tiêu thụ mỗi tháng']];
T[21] = (n) => {
  const [org, part, ppl, top] = pick(CTX21), r = pick([5, 6, 8, 10, 12]), m = [int(6, 30), int(6, 30), int(6, 30)];
  if (new Set(m).size < 3) return null;
  const sz = m.map((x) => x * r), ans = m[0] + m[1] + m[2], L = org === 'trường THCS' ? ['6', '7', '8'] : ['A', 'B', 'C'];
  if (sz.some((x) => x > 999)) return null;
  return { answer: [String(ans)],
    verify: `(()=>{const s=[${sz}],a=${m[0]};return a*(s[0]+s[1]+s[2])/s[0];})()`,
    prompt: `Một ${org} có ba ${part} ${L.join(', ')} lần lượt có ${sz.join(', ')} ${ppl}. Để tìm hiểu ${top} của ${ppl}, người ta chọn một số ${ppl} để khảo sát sao cho số ${ppl} được chọn ở mỗi ${part} tỉ lệ với số ${ppl} của ${part} đó. Biết ${part} ${L[0]} có ${m[0]} ${ppl} được chọn. Hỏi tổng cộng có bao nhiêu ${ppl} được chọn?`,
    explanation: `${part[0].toUpperCase() + part.slice(1)} ${L[0]}: ${sz[0]} : ${m[0]} = ${r}, tức cứ ${r} ${ppl} chọn 1. ${part[0].toUpperCase() + part.slice(1)} ${L[1]} chọn ${sz[1]} : ${r} = ${m[1]}; ${part} ${L[2]} chọn ${sz[2]} : ${r} = ${m[2]}. Tổng cộng: ${m[0]} + ${m[1]} + ${m[2]} = ${ans} ${ppl}.` };
};
// 22. phần trăm sau khi loại giá trị không hợp lí
T[22] = (n) => {
  const Nv = pick([20, 25]), thr = pick([2, 3]);
  const goods = Array.from({ length: Nv }, () => pick([1, 2, 3, 4, 5, 6, 7, 8]) / 2); // 0,5 … 4
  const bads = sample([25, 26, 28, 30, 32], 2);
  const cnt = goods.filter((v) => v >= thr).length, ans = cnt * 100 / Nv;
  if (cnt < 4 || cnt > Nv - 4) return null;
  const list = shuffle([...goods, ...bads]), f = (v) => vn(v, Number.isInteger(v) ? 0 : 1);
  return { answer: [String(ans)], _key: list.join(';'),
    verify: `(()=>{const v=[${list}].filter(x=>x>=0&&x<=24);return v.filter(x=>x>=${thr}).length*100/v.length;})()`,
    prompt: `Để tìm hiểu thời gian tự học ở nhà mỗi ngày, bạn ${pick(NAMES)} lập phiếu hỏi trực tuyến và nhận được ${Nv + 2} câu trả lời (đơn vị: giờ): ${list.map(f).join('; ')}. Sau khi loại bỏ các giá trị không hợp lí, số bạn tự học ít nhất ${thr} giờ mỗi ngày chiếm bao nhiêu phần trăm số câu trả lời còn lại?`,
    explanation: `Một ngày chỉ có 24 giờ nên ${bads.map(f).join(' và ')} là không hợp lí; loại đi còn ${Nv} câu trả lời. Số câu trả lời từ ${thr} giờ trở lên: ${cnt}. Tỉ lệ: ${cnt} : ${Nv} · 100% = ${ans}%.` };
};

// ---------- Thông tin câu ----------
const META = [
  ['mcq', 'NB', false], ['mcq', 'NB', false], ['mcq', 'NB', false], ['mcq', 'NB', false], ['mcq', 'NB', false], ['mcq', 'NB', false],
  ['mcq', 'TH', true], ['mcq', 'TH', false], ['mcq', 'TH', true], ['mcq', 'VD', true], ['mcq', 'VD', false], ['mcq', 'VD', true],
  ['tf', 'NB', false], ['tf', 'TH', true], ['tf', 'VD', true], ['tf', 'TH', true],
  ['short', 'NB', false], ['short', 'NB', false], ['short', 'TH', false], ['short', 'TH', false], ['short', 'VD', true], ['short', 'VD', true],
];
const PTS = { mcq: 0.25, tf: 1, short: 0.5 };
const MCQ_BASE = [0, 1, 2, 3, 2, 0, 3, 1, 0, 2, 3, 1];
const PATTERNS = [[1, 0, 1, 1], [1, 0, 1, 0], [1, 1, 0, 0], [1, 1, 0, 1], [0, 1, 1, 0], [0, 1, 0, 1], [1, 0, 0, 1], [0, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 0], [0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]].map((p) => p.map(Boolean));
const qkey = (q) => q.prompt.replace(/\s+/g, '') + (q._key ?? '');
const seen = new Set();
const seenPrompt = META.map(() => new Set());
const shortSeen = META.map(() => new Set());
const coreSeen = META.map(() => new Set());
const exams = [];
for (let n = 1; n <= 20; n++) {
  const qs = META.map(([kind, muc, thuc_te], i) => {
    for (let tries = 0; tries < 6000; tries++) {
      const key = kind === 'mcq' ? (MCQ_BASE[i] + n - 1) % 4 : kind === 'tf' ? PATTERNS[(n * 3 + (i - 12) * 5) % PATTERNS.length] : null;
      const q = T[i + 1](n, key); if (!q) continue;
      const k = qkey(q); if (seen.has(k) || seenPrompt[i].has(q.prompt)) continue; delete q._key;
      if (kind === 'short' && shortSeen[i].has(q.answer[0]) && tries < 300) continue;
      if (q._core && coreSeen[i].has(q._core) && tries < 3000) continue; if (q._core) coreSeen[i].add(q._core); delete q._core;
      seen.add(k); seenPrompt[i].add(q.prompt); if (kind === 'short') shortSeen[i].add(q.answer[0]);
      const fg = q._fig; delete q._fig; if (fg) fg();
      return { kind, muc, thuc_te, bam_may: false, prompt: q.prompt, ...(q.image ? { image: q.image } : {}),
        ...(q.options ? { options: q.options } : {}), answer: q.answer, points: PTS[kind], verify: q.verify, explanation: q.explanation };
    }
    throw new Error(`Đề ${n} câu ${i + 1}: không tìm được bộ số`);
  });
  const nn = String(n).padStart(2, '0');
  exams.push({ slug: `toan8-bai18-thu-thap-va-phan-loai-du-lieu-${nn}`, title: `Bài 18. Thu thập và phân loại dữ liệu — Đề ${n}`, sort_order: n, time_limit_min: 90,
    description: 'Đề bài tập về nhà Bài 18 (Thu thập và phân loại dữ liệu), cấu trúc THPT: 12 trắc nghiệm, 4 Đúng/Sai, 6 trả lời ngắn.', questions: qs });
}
const head = { grade: 8, chapter: 'Chương V. Dữ liệu và biểu đồ', topic: 'Bài 18. Thu thập và phân loại dữ liệu', level: 'kha' };
writeFileSync(out1, JSON.stringify({ ...head, exams: exams.slice(0, 1) }, null, 2) + '\n', 'utf8');
writeFileSync(out2, JSON.stringify({ ...head, exams: exams.slice(1) }, null, 2) + '\n', 'utf8');
console.log(`Đã sinh ${exams.length} đề (${exams.length * 22} câu): ${out1}, ${out2}`);
