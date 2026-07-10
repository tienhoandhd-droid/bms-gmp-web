# QUY TRÌNH KIỂM TRA HỆ THỐNG BMS — chuyên sâu, chạy lại được

> Mục tiêu: một quy trình **chạy lại bất kỳ lúc nào** (CI hoặc tay) để chứng minh hệ
> thống — **đặc biệt là quy trình xử lý sự cố và thao tác của các bộ phận** — vẫn giữ
> đúng mọi quy tắc. Mỗi phép kiểm sinh ra từ một rủi ro/bug thật; đọc theo cặp
> **CHẨN ĐOÁN** (đo được gì) + **GỢI Ý** (sửa ở đâu).

## 1. Triết lý (4 vòng)

**PHÁT HIỆN → CHẨN ĐOÁN → KIỂM TRA → XỬ LÝ.** Kết hợp *invariant / property-based
testing* (pgTAP) với *kịch bản end-to-end*:

| Lớp | Là gì | Vỡ nghĩa là |
|-----|-------|-------------|
| **Hợp đồng Web↔DB** (W1–W4) | RPC/giao thức/nhãn/import web khớp DB | Web gọi thứ DB không có, hoặc ngược lại |
| **Bất biến** (B1–B22) | Điều PHẢI luôn đúng trên dữ liệu LIVE (chỉ đọc) | Có bug đang âm thầm tồn tại |
| **Kịch bản máy trạng thái** (K1–K7) | Diễn lại đường đi ingest/cụm/quyền, rollback | Một đường đi cũ đã hỏng lại |
| **Quy trình xử lý sự cố** (S1–S10) | Đóng vai từng bộ phận bấm nút thật, rollback | Vòng đời sự cố hoặc phân quyền lệch bảng luật |

## 2. An toàn tuyệt đối

- Toàn bộ chạy trong **MỘT giao dịch, kết thúc ROLLBACK**. KHÔNG BAO GIỜ COMMIT
  (audit `lich_su_su_co` append-only — ghi nhầm phải đính chính theo thủ tục GMP).
- Kịch bản tạo sự cố thử nghiệm rồi tự huỷ; **không chạm dữ liệu thật**.
- Đóng vai người dùng bằng `request.jwt.claims` + `SET LOCAL ROLE authenticated` →
  đi đúng qua RLS + guard như web thật, không phải chạy bằng quyền chủ.

## 3. Bản đồ quy trình xử lý sự cố (nguồn: `quy_tac_chuyen_trang_thai`)

```
IPC phát hiện                         Cơ điện xử lý
┌────────────┐  ipc_bao_co_dien   ┌───────────────┐  mep_tiep_nhan  ┌──────────────────┐
│ Chưa xử lý │──────────────────▶ │ Đã báo Cơ điện│───────────────▶│ Cơ điện đang xử lý│
│  / Mở lại  │                    └───────────────┘                 └───────┬──────────┘
└────────────┘                          ▲  ▲                    mep_xu_ly_xong│ (đóng)
                                        │  │ ipc_bao_co_dien            ▼
                       mep_cho_xu_ly ┌──┴──────────┐          ┌────────────────┐
                       (vệ tinh) ◀───┤ Chờ / Không  │          │  Đã khắc phục  │
                                     │ xử lý được   │          └───────┬────────┘
                                     └─────────────┘         QA đánh giá│ CAPA
                                                                        ▼
                                                            ┌────────────────────┐
                                                            │ QA kết luận (đóng   │
                                                            │  hồ sơ chất lượng)  │
                                                            └────────────────────┘
```

**Ma trận thao tác theo bộ phận** (ai được bấm gì):

| Bộ phận | Nút chính | Từ trạng thái → đến | Ghi chú |
|---------|-----------|---------------------|---------|
| **IPC** | ipc_bao_co_dien | Chưa xử lý/Mở lại/Không-xử-lý-được → Đã báo Cơ điện | leo thang |
| | ipc_da_khac_phuc / ipc_binh_thuong | mọi → đóng | cần lý do (khắc phục) |
| **Cơ điện** | mep_tiep_nhan | Đã báo/Chờ/Không-được → Đang xử lý | |
| | mep_cho_xu_ly / mep_khong_xu_ly_duoc | Đang xử lý → vệ tinh | "không được" cần lý do |
| | mep_xu_ly_xong | Đang xử lý → Đã khắc phục (đóng) | |
| **Trực HSL** | lot_nhac_* / lot_tam_dung_4h | GIỮ trạng thái (chỉ ghi chú/điều phối) | không đổi trạng thái |
| **QA** | qa_da_khac_phuc / qa_mo_lai / rpc_ket_luan_cum | đóng / mở lại / kết luận cụm | cần lý do; CAPA ≥10 ký tự |
| **Quản trị** | admin_dong / admin_mo_lai | mọi → đóng/mở lại | |

## 4. Bộ kịch bản sâu S1–S10 (`quy_trinh_su_co.sql`)

| # | Kiểm điều gì | Khẳng định |
|---|--------------|-----------|
| S1 | Đường vàng trọn vẹn | IPC→Cơ điện tiếp nhận→khắc phục; đóng đúng + 3 dòng audit |
| S2 | Nhánh chờ/không-được/leo thang lại | mọi cạnh vệ tinh Cơ điện + IPC leo thang chạy đúng |
| S3 | **Guard vai trò** | IPC/Trực KHÔNG bấm được nút Cơ điện; Cơ điện bấm được nút mình |
| S4 | **Guard trạng thái** | không cho nhảy cóc (mep_xu_ly_xong khi chưa "đang xử lý") |
| S5 | **Bắt buộc lý do** | mep_khong_xu_ly_duoc thiếu lý do → THIEU_LY_DO |
| S6 | **ap_dung_khi** | mở-lại chỉ khi ĐÓNG; thao tác thường chỉ khi MỞ |
| S7 | **Phân quyền KHU** | IPC chỉ-Q2 bị chặn khi thao tác sự cố C1 (`phong_duoc_xem`) |
| S8 | Trực HSL __GIU__ + QA đóng | Trực ghi chú KHÔNG đổi trạng thái; QA đóng có lý do |
| S9 | **Cụm ↔ hàng chờ QA** (#4) | đóng kỹ thuật KHÔNG đá cụm khỏi hàng QA tới khi có disposition |
| S10 | **Audit + hash** | mỗi thao tác 1 dòng đúng người/vai; chuỗi hash liền mạch |

> **Bug S9 đã phát hiện & vá (11/07/2026):** view `xem_cum_su_co` tính
> `da_co_ket_luan_qa` theo `qa_ket_luan` — trường "kết luận" **tùy chọn** của
> `rpc_ket_luan_cum`. QA điền đủ nguyên nhân+CAPA nhưng bỏ trống ô đó → cụm **kẹt
> mãi** trong hàng chờ QA. Sửa: dùng `qa_luc IS NOT NULL` (QA đã disposition).
> Migration `20260711_sua_da_co_ket_luan_qa.sql`. → Đây là giá trị của kiểm SÂU.

## 5. Chạy

```bash
bash kiem_tra/chay.sh            # TOÀN DIỆN: W + B + K + S, exit≠0 nếu có phép vỡ
# hoặc riêng phần quy trình sự cố:
psql "$CONN" -f kiem_tra/quy_trinh_su_co.sql
```

Cần `sb.env` (mật khẩu Postgres) ở scratchpad phiên. Runner tự tìm.

## 6. Mở rộng khi thêm luật/bộ phận

1. Thêm luật vào `quy_tac_chuyen_trang_thai` → thêm một kịch bản S kiểm cả **đường
   đi ĐÚNG** (bộ phận đúng bấm được) lẫn **ma trận TỪ CHỐI** (vai/khu/trạng thái/lý do sai).
2. Mỗi bug thật mới → một bất biến B mới (điều lẽ ra phải luôn đúng).
3. Giữ nguyên tắc: mỗi phép kiểm mang **CHẨN ĐOÁN + GỢI Ý**, và **luôn ROLLBACK**.

> Lưu ý phạm vi (chủ hệ thống, 07/2026): hệ mới triển khai — **chưa thêm vòng kiểm
> tra bắt buộc cho IPC/Cơ điện** (vd người-đóng ≠ người-kết-luận). Bộ kiểm này chỉ
> xác minh quy trình HIỆN CÓ, chưa ép quy tắc tách vai; sẽ tăng cường khi phát triển.
