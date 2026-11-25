-- Học sinh tự gửi bài làm (ảnh chụp / PDF) cho bài kiểm tra của lớp mình.
--   * Gọi start_submission(bài, học sinh) → có dòng kết quả (điểm để trống) để gắn file.
--   * Chỉ gửi / xóa file khi bài CHƯA được chấm; chấm rồi thì khóa.
--   * Học sinh không sửa được điểm, nhận xét (results vẫn chỉ giáo viên ghi trực tiếp).
-- Đường dẫn trong kho: results/<id kết quả>/<tên file>, như file giáo viên tải lên.

-- Tài khoản hiện tại (học sinh / phụ huynh liên kết) được gửi file vào kết quả này không.
create or replace function public.can_submit_result(rid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.results r
    where r.id = rid and r.score is null
      and public.is_parent_of(r.student_id)
      and public.student_in_assessment_class(r.student_id, r.assessment_id)
  );
$$;

create or replace function public.storage_can_submit(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (storage.foldername(object_name))[1] = 'results'
     and coalesce((storage.foldername(object_name))[2] ~ '^[0-9]+$', false)
     and public.can_submit_result(((storage.foldername(object_name))[2])::bigint);
$$;

-- Lấy (hoặc tạo) dòng kết quả để học sinh gắn bài làm.
create or replace function public.start_submission(p_assessment bigint, p_student bigint) returns bigint
language plpgsql volatile security definer set search_path = '' as $$
declare r public.results;
begin
  if not public.is_parent_of(p_student) then raise exception 'Không có quyền'; end if;
  if not public.student_in_assessment_class(p_student, p_assessment) then
    raise exception 'Bài kiểm tra không thuộc lớp của học sinh';
  end if;
  select * into r from public.results where assessment_id = p_assessment and student_id = p_student;
  if not found then
    insert into public.results (assessment_id, student_id) values (p_assessment, p_student)
    on conflict (assessment_id, student_id) do nothing;
    select * into r from public.results where assessment_id = p_assessment and student_id = p_student;
  end if;
  if r.score is not null then raise exception 'Bài đã được chấm, không gửi thêm bài làm được'; end if;
  return r.id;
end $$;

drop policy if exists "rfiles_student_insert" on public.result_files;
create policy "rfiles_student_insert" on public.result_files for insert to authenticated
  with check (public.can_submit_result(result_id));
drop policy if exists "rfiles_student_delete" on public.result_files;
create policy "rfiles_student_delete" on public.result_files for delete to authenticated
  using (public.can_submit_result(result_id));

drop policy if exists "tdm_student_insert" on storage.objects;
create policy "tdm_student_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'tdm' and public.storage_can_submit(name));
drop policy if exists "tdm_student_delete" on storage.objects;
create policy "tdm_student_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'tdm' and public.storage_can_submit(name));

revoke execute on function public.can_submit_result(bigint), public.storage_can_submit(text),
  public.start_submission(bigint, bigint) from public, anon;
grant execute on function public.can_submit_result(bigint), public.storage_can_submit(text),
  public.start_submission(bigint, bigint) to authenticated, service_role;
