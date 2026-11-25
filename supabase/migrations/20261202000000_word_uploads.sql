-- Cho phép giáo viên tải file Word (.doc, .docx) làm đề bài / bài làm.
-- Trước đây kho 'tdm' chỉ nhận ảnh và PDF nên tải file Word luôn báo lỗi
-- "mime type ... is not supported". Giới hạn 10 MB mỗi file giữ nguyên.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
where id = 'tdm';
