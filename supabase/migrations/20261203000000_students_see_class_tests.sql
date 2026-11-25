-- Học sinh / phụ huynh thấy bài kiểm tra của lớp (tên bài + file đề) ngay khi giáo viên giao,
-- không phải chờ đến khi có điểm. Trước đây chỉ thấy bài đã có dòng kết quả, nên đề
-- giáo viên vừa tải lên không hiện ở trang học sinh.
-- Vẫn giữ quyền xem bài cũ đã có kết quả (khi học sinh chuyển lớp).
-- File đề (assessment_files, kho 'tdm' thư mục assessments/) dùng can_view_assessment nên cũng mở theo.
-- Điểm và bài làm (results, result_files) không đổi: chỉ của chính em.
create or replace function public.parent_can_view_assessment(aid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.results r
                 where r.assessment_id = aid and public.is_parent_of(r.student_id))
      or exists (select 1 from public.assessments a
                 join public.students s on s.class_id = a.class_id
                 where a.id = aid and public.is_parent_of(s.id));
$$;
