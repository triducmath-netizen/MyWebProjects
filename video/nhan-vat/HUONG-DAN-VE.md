# Vẽ nhân vật thầy Đức kiểu Pixar (làm 1 lần)

Dùng **Gemini** miễn phí: https://gemini.google.com (đăng nhập tài khoản Google). Vẽ **8 ảnh**, lưu vào thư mục này: `D:\MyWebProjects\video\nhan-vat\thay-duc\` với **đúng tên file** ở bảng dưới (đuôi `.png` hoặc `.jpg` đều được).

## Bước 1 — Vẽ ảnh gốc từ ảnh thật của thầy
Mở một cuộc trò chuyện mới trong Gemini, bấm **+ / Tải tệp lên** và chọn ảnh thật của thầy (`D:\MyWebProjectsideo\Ảnh thầy đức.jpg`), rồi dán câu lệnh sau vào cùng tin nhắn:

```
Using the man in this photo as the reference, create a 3D animated character of him in the style of a Pixar movie. Keep his real likeness: his face shape, short black hair swept to the side, friendly smile, slim build. No glasses. He is a Vietnamese math teacher. Outfit: crisp white long-sleeve dress shirt with sleeves slightly rolled up, dark navy trousers, white sneakers. No bag, no car, nothing in his hands. Full body, standing, facing the viewer at a slight three-quarter angle, both feet visible, centered, with generous empty space around him. Pure plain white background (#FFFFFF), no floor, no shadow, no text, no other objects. Soft studio lighting, high detail, vertical image 3:4.
```

Nếu chưa giống, nhắn thêm (ví dụ "make the face look more like the photo", "a bit slimmer face", "warmer smile") đến khi ưng. **Lưu ảnh** (bấm vào ảnh → nút tải xuống ⬇) và đặt tên `binh-thuong.png`.

## Bước 2 — Vẽ 7 ảnh cử chỉ (giữ nguyên nhân vật)
**Trong cùng cuộc trò chuyện đó**, gửi lần lượt từng câu dưới đây (mỗi câu một tin nhắn), tải ảnh về và đặt đúng tên:

| Tên file | Câu lệnh gửi Gemini |
|---|---|
| `vay-tay.png` | `Same character, same outfit, same style and white background. Now he is waving hello cheerfully with his right hand raised, big friendly smile. Full body.` |
| `giang-giai.png` | `Same character, same outfit, same style and white background. Now he is explaining something, one hand open in front of his chest, palm up, talking with a gentle smile. Full body.` |
| `chi-bang.png` | `Same character, same outfit, same style and white background. Now he is pointing with his right index finger to the right side of the image, as if pointing at a board, looking that way, smiling. Full body.` |
| `suy-nghi.png` | `Same character, same outfit, same style and white background. Now he is thinking, one hand on his chin, eyes looking up, slightly curious expression. Full body.` |
| `vui.png` | `Same character, same outfit, same style and white background. Now he gives an enthusiastic thumbs up with a big happy smile. Full body.` |
| `ngac-nhien.png` | `Same character, same outfit, same style and white background. Now he looks pleasantly surprised, eyebrows raised, mouth slightly open, both hands open at shoulder height. Full body.` |
| `viet-bang.png` | `Same character, same outfit, same style and white background. Now he holds a marker in his right hand, raised as if about to write, focused friendly look, turned slightly to the right. Full body.` |

## Lưu ý
- Nền phải **trắng trơn**, không có sàn, không bóng đổ, không chữ — máy sẽ tự làm nền trắng hoà vào video.
- Nếu một ảnh bị khác mặt / khác quần áo nhiều, gửi lại câu lệnh hoặc nhắn "keep exactly the same face and outfit as the first image".
- Chỉ cần tối thiểu `binh-thuong.png`; ảnh nào thiếu, máy dùng ảnh gần nhất thay thế.
- Video có nhân vật do AI tạo: khi đăng TikTok / YouTube / Facebook nên bật nhãn **"Nội dung do AI tạo"** (đã ghi sẵn trong file `dang-mxh.md`).
