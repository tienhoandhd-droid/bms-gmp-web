# report-templates — Báo cáo WF5 v2 (BMS-GMP)

Báo cáo tuần/tháng/quý — 1 nguồn số liệu duy nhất (`rpc_bao_cao_tong_hop`). **3 sản phẩm** mỗi kỳ
(cập nhật 04/07/2026 theo yêu cầu: email chỉ text — bỏ ảnh nén; dashboard động đính kèm + link):

| File | Dùng cho |
|---|---|
| `email-bao-cao.html` | **Email TÓM TẮT — CHỈ TEXT, KHÔNG ẢNH** (KPI/top phòng/bất thường/AI dạng bảng) + nút "Mở dashboard tương tác". n8n interpolate `{{ }}` + `{{#each}}`. Nhẹ (~17KB). |
| `dashboard-tuong-tac.html` | **Dashboard TƯƠNG TÁC tự chứa** — nhúng JSON kỳ vào `{{DATA_JSON}}`, vanilla JS + SVG. 13 mục: biểu đồ hover + lọc Nhà máy/Khu/AHU, heatmap, top phòng, **bảng TẤT CẢ phòng** (tìm/lọc/sắp/bấm-xem), Sự cố, DQ, SPC/MKT, Baseline, Giới hạn, AI. Danh sách DÀI để trong `<details>` — **thu gọn mặc định, bấm để mở**. Mở offline. Đính kèm email + lưu Drive. Cần `bc.tat_ca_phong` (từ `rpc_tat_ca_phong_ky`, gộp ở node query). |
| `bao-cao-scorecard.html` | HTML → Gotenberg → **PDF ký duyệt GMP** (ALCOA+); ảnh biểu đồ nhúng **data URI base64** (chart-render/SVG). |
| `email-bao-cao.mjml` | ⚠ **Không dùng nữa** — email cũ (MJML/ảnh CID). Giữ để tham khảo; email hiện là `email-bao-cao.html` viết tay text-only. |

---

## Pipeline WF5 v2 — mô tả từng node

```
Schedule ──▶ Postgres (rpc_bao_cao_tong_hop) ──▶ Code (delta + placeholders)
   ──▶ HTTP Request ×5 (chart-render)  ──▶ Code (assemble HTML/MJML)
   ──▶ (a) Drive upload HTML   (b) Gotenberg → PDF → Drive   (c) Send Email (CID)
```

1. **Schedule Trigger** — giữ lịch cũ: thứ 2 07:00 (tuần), ngày 1 07:15 (tháng;
   tháng 1/4/7/10 = quý). Node Code nhỏ tính `p_ky`, `p_tu`, `p_den` theo lịch VN.
2. **Postgres node — gọi RPC** (1 query duy nhất, GMP-critical):
   ```sql
   select rpc_bao_cao_tong_hop($1, $2::date, $3::date) as bao_cao;
   ```
   Chạy bằng credential **service_role** (RPC chỉ grant cho service_role).
   Mọi con số của báo cáo truy vết về đúng query này — KHÔNG tính thêm số
   ở node khác.
3. **Code node — tính delta + build placeholders**: từ `kpi_ky_nay` vs
   `kpi_ky_truoc` tính delta từng KPI; gán mũi tên `▲▼` + màu
   (lưu ý chiều tốt/xấu: tuân thủ tăng = xanh `#0d9488`, giờ OOS tăng = đỏ
   `#b91c1c`); gán màu đèn giao thông (≥95 xanh, 80–95 vàng `#d97706`, <80 đỏ);
   sinh `ma_lan_chay` (vd `WF5-{{$execution.id}}`); xuất object placeholder
   (bảng bên dưới) + payload cho từng biểu đồ.
4. **HTTP Request → chart-render** (5 lượt, POST `http://chart-render:8081/render`,
   Header Auth `Authorization: Bearer <token>`, Response Format = **File**):
   - `type: "line"` — `chuoi_ngay.total` → binary `chart_line`;
   - `type: "calendarHeatmap"` — `chuoi_ngay.total` (ngay/ty_le) → `chart_heat`;
   - `type: "bar"` — `top_phong_rui_ro` → `chart_bar` (dùng ở phụ lục/quý);
   - `type: "sparkline"` ×5 — chạy "Run Once for Each Item" trên
     `top_phong_rui_ro[i].chuoi_ngay` → `spark_<ma_phong>`.
5. **Code node — assemble**:
   - **HTML/PDF**: đọc `bao-cao-scorecard.html`, thay `{{placeholder}}`,
     nhân bản khối `{{#each …}}…{{/each}}` theo mảng, điền ảnh dạng
     `data:image/png;base64,` + `$binary.chart_line.data`…
   - **Email**: đọc `email-bao-cao.html` (đã compile từ MJML), thay placeholder,
     GIỮ nguyên `src="cid:…"` — ảnh gắn ở bước (c).
6. **(a) Google Drive node** — Upload file HTML vào thư mục
   `cau_hinh.drive_folder_id_bao_cao` (tên file: `BMS-baocao-{{ky}}-{{tu_ngay}}.html`).
7. **(b) HTTP Request → Gotenberg** — POST `http://gotenberg:3000/forms/chromium/convert/html`,
   body multipart: field `files` = HTML (tên file BẮT BUỘC `index.html`),
   `paperWidth=8.27`, `paperHeight=11.69`, `marginTop/Bottom/Left/Right` ~0.4
   (template đã có `@page`). Nhận binary PDF → Google Drive node upload
   (`BMS-baocao-{{ky}}-{{tu_ngay}}.pdf`) — **bản lưu trữ chính thức GMP**.
8. **(c) Send Email node** — HTML = email đã interpolate; **Attachments** = các
   binary `chart_line`, `chart_heat`, `spark_<ma_phong>`, `logo_cpc1` với
   `Content-ID` trùng tên CID trong template (n8n: option "Attachments" +
   thuộc tính binary; đặt content-id qua trường tuỳ chọn của node). Người nhận
   đọc từ `cau_hinh.email_nhan_bao_cao` (danh sách, phẩy).
9. **Error Handler** — giữ WF4 như hiện tại (mọi node lỗi → báo lỗi tập trung).

**Cảnh báo font tiếng Việt**: container Gotenberg mặc định có thể thiếu font
Việt — build image Gotenberg kèm `fonts-noto-core` (giống Dockerfile của
chart-render) và test chuỗi `"ĐẶNG ỄỆỠ ỰỬ áàảãạ"` ra PDF **trước** khi
nghiệm thu template.

---

## Placeholder (cả 2 template dùng chung, trừ ảnh)

| Placeholder | Nguồn (JSON của RPC) |
|---|---|
| `{{ky_bao_cao}}` | nhãn hiển thị: "tuần 27/2026", "tháng 6/2026", "quý 2/2026" (Code node tự sinh) |
| `{{ky}}` `{{tu_ngay_iso}}` `{{den_ngay_iso}}` | `ky`, `tu_ngay`, `den_ngay` (nguyên ISO — cho footer truy vết) |
| `{{tu_ngay}}` `{{den_ngay}}` | định dạng VN `DD/MM/YYYY` |
| `{{tao_luc}}` `{{ma_lan_chay}}` | `tao_luc` (đổi giờ VN) · `WF5-{{$execution.id}}` |
| `{{kpi_tuan_thu}}` `{{kpi_tuan_thu_mau}}` | `kpi_ky_nay.ty_le_tuan_thu` + màu traffic light |
| `{{delta_tuan_thu}}` `{{delta_tuan_thu_mui_ten}}` `{{delta_tuan_thu_mau}}` | so `kpi_ky_truoc` (▲/▼; tăng = xanh) |
| `{{kpi_gio_oos}}` `{{delta_oos*}}` | `kpi_ky_nay.so_gio_oos` (OOS tăng = đỏ) |
| `{{so_su_co_mo}}` `{{so_su_co_dong}}` `{{mttr_gio}}` `{{delta_su_co*}}` | `su_co.dang_mo/.dong_trong_ky/.mttr_gio/.mo_ky_truoc` |
| `{{so_tin_hieu_spc}}` `{{so_scope_ngoai_ks}}` `{{kpi_spc_mau}}` | `spc.tong_tin_hieu/.so_scope_ngoai_ks` (0 = xanh) |
| `{{#each top_phong_rui_ro}}` — `{{ma_phong}}` `{{ten_phong}}` `{{khu_vuc}}` `{{ty_le_tuan_thu}}` `{{so_gio_oos}}` `{{mau}}` | `top_phong_rui_ro[]` |
| `{{#each spc_chi_tiet}}` — `{{ten_scope}}` `{{sensor_type}}` `{{so_tin_hieu}}` `{{cac_loai}}` | `spc.chi_tiet[]` (chỉ template HTML) |
| `{{nhan_dinh_ai}}` `{{ai_model_dung}}` `{{ai_tao_luc}}` | `nhan_dinh_ai_gan_nhat` |
| `{{link_drive}}` | link file HTML/PDF sau khi upload (chỉ email — node Drive trả về) |
| Ảnh — email | `cid:logo_cpc1`, `cid:chart_line`, `cid:chart_heat`, `cid:spark_{{ma_phong}}` |
| Ảnh — HTML/PDF | `{{logo_src}}`, `{{chart_line_src}}`, `{{chart_heat_src}}`, `{{spark_src}}` (data URI base64) |

Lưu ý khối lặp `{{#each}}…{{/each}}`: n8n Code node tự cắt-nhân bản chuỗi giữa
2 mốc này (regex đơn giản) — không cần cài thư viện Handlebars, nhưng nếu tiện
thì `npm` của n8n có sẵn `handlebars` qua Code node (tuỳ cấu hình
`NODE_FUNCTION_ALLOW_EXTERNAL`).

---

## Checklist key `cau_hinh` cần điền trước khi chạy WF5 v2

- [ ] `drive_folder_id_bao_cao` — ID thư mục Drive nhận HTML + PDF (đang có, kiểm tra lại).
- [ ] `email_nhan_bao_cao` — danh sách email quản lý nhận scorecard (key MỚI, phẩy ngăn cách).
- [ ] `chart_render_url` — URL nội bộ chart-render, vd `http://chart-render:8081` (key MỚI).
- [ ] `chart_render_token` — Bearer token khớp env `CHART_RENDER_TOKEN` của container (key MỚI; hoặc lưu bằng n8n Credentials).
- [ ] `gotenberg_url` — vd `http://gotenberg:3000` (key MỚI).
- [ ] `bat_bieu_do_bao_cao` — giữ `true`; khi chart-render lỗi có thể tạm `false`.
- [ ] `quickchart_base_url` — CHỈ còn là fallback (nếu giữ đường cũ); trỏ instance tự host.
- [ ] Ngưỡng đèn giao thông (chốt với QA): xanh ≥95, vàng 80–95, đỏ <80 — nếu QA đổi, sửa ở Code node bước 3 VÀ ở `services/chart-render/server.js` (`trafficColor`).
- [ ] Khóa AI (`gemini_api_key`, `groq_api_key`) — cho nhận định AI (WF3 đã dùng).
- [ ] Đổi tên workflow backfill trùng tên "WF5" thành WF9 (tránh nhầm, xem mục 6 kế hoạch).

**Nghiệm thu**: chạy tay WF5 v2 với kỳ có dữ liệu lịch sử (≤30/06, trước sự cố
FMS); kiểm tra (1) số trên email = số trong JSON RPC, (2) PDF hiển thị đủ dấu
tiếng Việt, (3) email <102KB phần HTML (ảnh là attachment CID nên không tính),
(4) footer có mã lần chạy + câu lệnh RPC. Nghiệm thu cuối chờ FMS phục hồi 57 phòng.

---

## v2 (2026-07-03) — theo góp ý quản lý + nghiên cứu chuẩn GMP (Annex 1 / ISO 14644-2 / Part 11)

Template chi tiết `bao-cao-scorecard.html` thêm: hàng 6 KPI (thêm DQ + MKT), tóm tắt điều hành,
xu hướng Khu/AHU (small multiples ảnh `khu_*`/`ahu_*` từ /render-batch), top phòng TỐT + XẤU,
**mục 6 "Bất thường trong kỳ khảo sát"** (phòng xấu đi bất thường theo 3 tiêu chí + ngoại lệ dữ liệu
+ sổ excursion), kết luận trạng thái kiểm soát, bảng giới hạn cấu hình 2 cấp, MKT/ICH Q1A,
DQ/ALCOA+, khối ký duyệt 3 chữ ký, phụ lục giải thích thuật ngữ.

Email `email-bao-cao.mjml` chuyển chiến lược: **thân thư = tóm tắt điều hành** (1 line chart base64
+ bảng top + khối bất thường rút gọn, giữ < 102KB Gmail), **báo cáo chi tiết = PDF đính kèm**.
`email-bao-cao.html` là bản compile sẵn (mjml CLI) để n8n interpolate trực tiếp — chạy lại
`npx mjml email-bao-cao.mjml -o email-bao-cao.html` sau mỗi lần sửa MJML.

Workflow import sẵn: `n8n/WF5-v2-bao-cao-quan-tri.json` (đọc `n8n/README.md`).

Chuẩn GMP chưa nhét vào v2 (cần thêm nguồn dữ liệu — lộ trình v3):
tình trạng hiệu chuẩn đầu đo; sổ excursion đầy đủ trường (peak value, người xác nhận,
số deviation/CAPA); phụ lục min/max/mean/SD từng phòng × chỉ tiêu; so sánh cùng kỳ năm trước
(mùa vụ RH/T); chỉ số "biên an toàn tới giới hạn hành động" (% điểm đo trong vùng ±X% giới hạn).
