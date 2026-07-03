# Backfill 30 phút — Tiến độ & Lịch sử (TẠM DỪNG)

> Trạng thái: **TẠM DỪNG** ngày 2026-07-03 theo quyết định của QA/Admin.
> Lý do dừng: **FMS chỉ còn phục vụ ~3 phòng từ 01/07** (lỗi hạ tầng FMS) → không thể
> backfill 30 phút cho đủ 57 phòng lúc này. Hướng đã chọn: **sửa FMS trước rồi backfill**.

Tài liệu này ghi lại đầy đủ những gì đã làm, phát hiện, trạng thái hệ thống và
các bước tiếp tục khi FMS đã được khôi phục — để không mất mạch công việc.

---

## 1. Mục tiêu ban đầu (yêu cầu người dùng)

- Web đi **hoàn toàn 30 phút** (làm sau).
- **Xử lý lại (reprocess) dữ liệu Supabase** theo 30 phút.
- **Backfill dữ liệu 30 phút trong 6 tháng gần nhất**.
- (Người dùng ban đầu muốn "xóa dữ liệu cũ" — xem mục 4 vì sao KHÔNG nên xóa lúc này.)

---

## 2. Phát hiện quyết định: FMS hỏng từ 01/07 (chỉ còn 3 phòng)

Đối chiếu bảng archive `du_lieu_gio_archive` (số phòng có dữ liệu theo ngày):

| Ngày | Số phòng có dữ liệu |
|---|---|
| … → **30/06/2026** | **57 phòng** ✅ (đầy đủ, ~1944 dòng/ngày) |
| **01/07 → 03/07** | **chỉ 3 phòng** 🔴 (C1.R20, C1.R21, C1.R30 — ~126–189 dòng/ngày) |

Bằng chứng thêm:
- Node **"Tạo cửa sổ backfill"** trong WF backfill xác nhận FMS endpoint
  `GET /bms-room/rooms` hiện **chỉ trả ~5 phòng** (3 map được + 2 lạ), không phải 57.
- WF1 (live, mỗi 30 phút) cũng chỉ ghi được 3 phòng kể từ 01/07.
- Khớp với chẩn đoán trước đây: **FMS Elasticsearch thiếu index tháng 7**
  (`index_not_found_exception` cho phần lớn phòng).

➡️ Đây là **lỗi hạ tầng phía FMS/BMS, ngoài phạm vi n8n/Supabase**. Backfill chỉ
kéo được các phòng FMS **đang** liệt kê (~3), nên backfill đủ 57 phòng là **bất khả**
cho tới khi FMS khôi phục room-list + index.

---

## 3. Những gì ĐÃ LÀM (đã kiểm chứng, an toàn)

### 3.1 Backend Supabase (project bms-gmp-v10 = `jfonqwhjhsylruwfllbk`)

| Thay đổi | Chi tiết | Trạng thái |
|---|---|---|
| **Archive an toàn** | Migration `archive_du_lieu_gio_truoc_backfill_30phut`: tạo bảng `public.du_lieu_gio_archive` (LIKE du_lieu_gio INCLUDING ALL + `archived_at`, `archive_ly_do`) và sao **toàn bộ 174,346 dòng** hiện có. | ✅ Giữ nguyên |
| **RPC trend 30′** | Migration `trend_rpcs_them_do_phan_giai_30phut`: thêm nhánh `'PHUT'` (bucket 30′, nhãn HH24:MI) cho 3 RPC: `rpc_lay_chuoi_xu_huong_v2`, `rpc_chuoi_xu_huong_da_sensor`, `rpc_chuoi_gia_tri_phong`. **Additive** — `GIO`/`NGAY` giữ nguyên. | ✅ Đã áp dụng |
| **RPC backfill lưu chan_doan** | Migration `rpc_nap_lich_su_luu_chan_doan_dong_nhat_wf1`: `rpc_nap_du_lieu_lich_su` nay lưu `du_lieu_goc = v_sensor->'chan_doan'` (top-level p5/p50/p95/cua_so_phut…) để đồng nhất byte với WF1. | ✅ Đã áp dụng |
| **Reset cấu hình** | `cau_hinh.so_ngay_backfill` đưa về **90** (đã tạm set 2 khi test). `che_do_thu_nghiem=false`. | ✅ Đã reset |

### 3.2 n8n — WF "BMS WF5 — Backfill tối ưu (gắn cờ THẬT)" (`9RUs0R1wickVz4nf`, đang tắt)

- Đã sửa node **"Gom payload theo lô"** từ gom **theo GIỜ** (`hourBucketISO`, expected=60)
  → **cắt lát 30 PHÚT** (bucket 30′, expected=30), thêm khối `chan_doan`
  (σ, P5/P50/P95, số đợt OOS, alert 2 cấp, đứng hình, `cua_so_phut:30`), quy đổi ngưỡng
  cảnh báo theo cửa sổ (×30/60) và tính "10 phút cuối" theo phút-trong-bucket — **giống hệt WF1 v2**.
- Plumbing còn lại giữ nguyên: login FMS → `/bms-room/rooms` → tạo cửa sổ phòng×thời gian →
  loop → `/bms-room/rooms/{id}/sensors-data` → `rpc_nap_du_lieu_lich_su`.
- Điều khiển qua `cau_hinh`: `so_ngay_backfill` (tổng ngày), `backfill_so_ngay_moi_cua_so`
  (7), `backfill_batch_size` (9), `backfill_payload_chunk_size` (250).

### 3.3 Test đã chạy (execution `1643333`, success 53s)

- Set `so_ngay_backfill=2`, xóa 434 dòng real 2 ngày gần nhất (đã có trong archive), chạy backfill.
- Kết quả: **3 phòng** (C1.R20/R21/R30), 602 dòng, **bucket :00 và :30 cân bằng (301/301)**,
  `cua_so_phut=30`, `chan_doan` đầy đủ, `oos_rate_pct`/`muc_canh_bao` đúng.
- ✅ Xác nhận: **pipeline 30 phút hoạt động đúng**; FMS **có** trả raw 1 phút cho các phòng nó còn phục vụ.
- ⚠️ Nhưng chỉ 3 phòng — vì FMS chỉ liệt kê 3 phòng (mục 2).

---

## 4. Vì sao KHÔNG xóa dữ liệu cũ lúc này

Backfill hiện chỉ phủ 3 phòng. Nếu xóa toàn bộ lịch sử giờ 57 phòng (Mar–Jun) để thay
bằng 30 phút, ta **chỉ khôi phục được 3 phòng** → mất 54 phòng lịch sử trên bảng live
(dù archive vẫn giữ). Do đó **giữ nguyên lịch sử giờ 57 phòng**, chờ FMS.

Lưu ý: việc xóa+backfill 2 ngày khi test **không gây mất mát thêm**, vì 01–03/07 vốn đã
chỉ có 3 phòng; 3 phòng đó nay đã ở dạng 30 phút.

---

## 5. Trạng thái hệ thống tại thời điểm dừng (2026-07-03)

- `du_lieu_gio` (real): **174,394 dòng** — lịch sử giờ 57 phòng (Mar–30/06) nguyên vẹn +
  3 phòng (01–03/07) đã ở 30 phút.
- `du_lieu_gio_archive`: **174,346 dòng** (snapshot đầy đủ, khôi phục được).
- `cau_hinh.so_ngay_backfill = 90`, `che_do_thu_nghiem = false`.
- WF backfill: **đang TẮT** (không tự chạy). WF1 live vẫn chạy mỗi 30 phút (chỉ ghi được 3 phòng do FMS).
- Cờ `app.tg_bypass_append_only`: KHÔNG còn treo (mỗi lệnh SQL/RPC tự bật-tắt trong phạm vi của nó).

---

## 6. Bước TIẾP TỤC khi FMS đã được khôi phục

**Điều kiện tiên quyết (đội BMS/FMS làm):** khôi phục Elasticsearch index tháng 7 +
đảm bảo `GET /bms-room/rooms` trả **đủ 57 phòng**.

**Kiểm tra FMS đã đủ phòng chưa** (chạy WF backfill 1 ngày rồi xem node "Tạo cửa sổ backfill":
`so_window`/`phong_rieng` phải ~57, `skipped` nhỏ).

Khi FMS đủ 57 phòng, chạy backfill 30 phút 6 tháng:

1. **Archive lại** (an toàn) snapshot hiện tại nếu muốn mốc mới.
2. Đặt `cau_hinh.so_ngay_backfill = 180` (6 tháng), `backfill_so_ngay_moi_cua_so = 7`,
   `backfill_batch_size = 9`.
3. **Xóa dữ liệu giờ cũ trong phạm vi backfill** (để bucket :00 không đụng `ON CONFLICT DO NOTHING`).
   Nhớ bật cờ bypass append-only:
   ```sql
   select set_config('app.tg_bypass_append_only','on', false);
   delete from du_lieu_gio
   where thuoc_thu_nghiem = co_thu_nghiem()
     and bucket_utc >= now() - interval '180 days';
   ```
4. **Chạy** WF "BMS WF5 — Backfill tối ưu" (`9RUs0R1wickVz4nf`) ở chế độ manual.
5. **Đối chiếu**: mỗi ngày ~57 phòng × 48 bucket 30′/sensor; `cua_so_phut=30`; `chan_doan` đủ.
6. **Reprocess dẫn xuất**: KPI ngày (RPC tự gọi), MKT (`rpc_tinh_mkt`), SPC
   (`rpc_tinh_spc` + `rpc_capnhat_spc_dac_trung`), xu hướng đêm (`rpc_tinh_xu_huong_hang_ngay`).
7. Sau khi đạt: làm nốt **Web đi hoàn toàn 30 phút** (đổi donVi sang `PHUT` cho khung 24h,
   nhãn 1h→30′, OOS theo %) — xem Task #21.

**Khôi phục khẩn (nếu cần)** — phục hồi từ archive:
```sql
select set_config('app.tg_bypass_append_only','on', false);
-- (tuỳ chọn) xóa dữ liệu hiện tại trong phạm vi cần phục hồi, rồi:
insert into du_lieu_gio (<danh sách cột gốc, KHÔNG gồm archived_at/archive_ly_do>)
select <danh sách cột gốc> from du_lieu_gio_archive
on conflict (thuoc_thu_nghiem, bucket_utc, ma_phong, loai_cam_bien) do nothing;
```

---

## 7. Việc cần người dùng / đội hạ tầng

- [ ] **Đội BMS/FMS**: khôi phục index Elasticsearch tháng 7 + room-list 57 phòng cho FMS.
- [ ] Khi xong, báo lại để chạy backfill 30 phút 6 tháng theo mục 6.
