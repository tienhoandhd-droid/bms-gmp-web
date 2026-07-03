-- ============================================================================
-- Người nhận báo cáo WF5 (tuần/tháng/quý) — quản lý trong DB thay vì hardcode
-- trong workflow. ĐÃ ÁP DỤNG lên project bms-gmp-v10 (migration
-- `nguoi_nhan_bao_cao_wf5`, 03/07/2026).
--
-- 3 dòng placeholder tạo sẵn (kich_hoat=false) — NGƯỜI DÙNG điền email thật
-- vào Supabase Studio rồi bật kich_hoat=true là WF5 v2 tự dùng.
-- Fallback: nếu KHÔNG có người nhận nào kich_hoat, WF5 v2 dùng
-- cau_hinh.email_bao_cao_thang / email_bao_cao_tuan như cũ.
-- ============================================================================
create table if not exists public.nguoi_nhan_bao_cao (
  id           bigint generated always as identity primary key,
  ho_ten       text not null,
  email        text not null unique,
  vai_tro      text,                       -- QA / IPC / Cơ điện / BGĐ…
  nhan_tuan    boolean not null default true,
  nhan_thang   boolean not null default true,
  nhan_quy     boolean not null default true,
  kich_hoat    boolean not null default false,  -- bật SAU KHI điền email thật
  ghi_chu      text,
  tao_luc      timestamptz not null default now(),
  cap_nhat_luc timestamptz not null default now()
);

comment on table public.nguoi_nhan_bao_cao is
  'Người nhận email báo cáo WF5 v2 (tuần/tháng/quý). Chỉ dòng kich_hoat=true '
  'và cờ nhan_<ky> tương ứng mới được gửi. Server-side only (n8n).';

-- RLS bật, KHÔNG tạo policy → anon/authenticated không đọc/ghi được;
-- n8n kết nối bằng role postgres (chủ bảng) nên không bị chặn.
alter table public.nguoi_nhan_bao_cao enable row level security;

insert into public.nguoi_nhan_bao_cao (ho_ten, email, vai_tro, kich_hoat, ghi_chu) values
  ('Người nhận 1', 'nguoi-nhan-1@example.com', 'QA',      false, 'PLACEHOLDER — thay email thật rồi đặt kich_hoat=true'),
  ('Người nhận 2', 'nguoi-nhan-2@example.com', 'IPC',     false, 'PLACEHOLDER — thay email thật rồi đặt kich_hoat=true'),
  ('Người nhận 3', 'nguoi-nhan-3@example.com', 'Cơ điện', false, 'PLACEHOLDER — thay email thật rồi đặt kich_hoat=true')
on conflict (email) do nothing;

-- URL webhook cho nút "Gửi báo cáo bù" trên web (WF5 v2 lắng nghe path này)
-- + URL các service phụ trợ (WF5 v2 đọc từ đây, KHÔNG dùng $env vì instance chặn $env)
insert into public.cau_hinh (key, value, mo_ta) values
  ('wf5_webhook_bao_cao_bu', 'https://n8n.cpc1hn.com/webhook/wf5-bao-cao-bu',
   'URL webhook WF5 v2 — web gọi để gửi báo cáo bù (tháng trước/tuần trước/quý trước) theo yêu cầu'),
  ('gotenberg_url', 'http://gotenberg:3000',
   'WF5 v2 — URL service Gotenberg (HTML→PDF). Cùng docker network với n8n; đổi nếu host khác.'),
  ('chart_render_url', 'http://chart-render:8081',
   'WF5 v2 — URL service chart-render (biểu đồ ECharts PNG). Rỗng/không phản hồi → n8n tự vẽ SVG.'),
  ('chart_render_token', '',
   'WF5 v2 — Bearer token chart-render (khớp CHART_RENDER_TOKEN). Rỗng = không gửi header (mạng nội bộ).')
on conflict (key) do update set value = excluded.value, mo_ta = excluded.mo_ta;
