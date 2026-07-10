# DANH SÁCH KỊCH BẢN TEST VẬN HÀNH — đầy đủ nhất (BMS GMP)

> Bản đồ TOÀN BỘ mặt trận vận hành và trạng thái phủ test. Ký hiệu:
> **W**=hợp đồng web↔DB · **B**=bất biến · **K**=kịch bản máy trạng thái ·
> **S**=quy trình bộ phận · **T**=mặt trận vận hành · **U**=vận hành đầy đủ.
> Chạy tất cả: `bash kiem_tra/chay.sh`. Kết quả gần nhất: **54/55 đạt** (1 "vỡ" =
> B13 cờ log WF6 trễ dữ liệu đợt FMS chết — hệ ghi ĐÚNG, không phải bug).

## A. Thu thập & chất lượng dữ liệu
| Kịch bản | Test | TT |
|---|---|---|
| Ingest OOS → mở sự cố CRITICAL (phòng sạch 0→1) | **U1** | ✅ |
| WF1 sống: bucket ≤2h + đủ 81 cảm biến | B18 | ✅ |
| Lỗ hổng dữ liệu cục bộ chưa lấp (FMS lỗi một phần) | B22 | ✅ |
| Cảm biến ĐỨNG HÌNH ≥3h in-scope ⇒ phải có sự cố | B14 | ✅ |
| Cảm biến chết 3h → SUPPRESSED, không phán xét "trong dải" | K3 | ✅ |
| WF1 "xanh giả" (0 phòng vẫn success) → cổng ném lỗi | *n8n* | ✅ (đã vá #1) |
| Backfill WF1b idempotent khi FMS hồi | *thực địa* | ✅ (đã chứng) |

## B. Mở & phân mức sự cố
| Kịch bản | Test | TT |
|---|---|---|
| OOS vượt ngưỡng → CRITICAL; nhẹ → WARNING/NOTICE | U1 (một phần) | ✅ |
| Phạm vi cảnh báo: P1/P2 hoặc canh_bao_bat_buoc mới alert | *trong_pham_vi* | ➖ gián tiếp |
| SUPPRESSED không bao giờ vào email | B15 | ✅ |
| Luật kích hoạt trỏ trạng thái hợp lệ (CHECK) | B6 | ✅ |

## C. Vòng đời & thao tác bộ phận
| Kịch bản | Test | TT |
|---|---|---|
| Đường vàng IPC→Cơ điện→khắc phục | **S1** | ✅ |
| Nhánh chờ / không xử lý được / IPC leo thang lại | **S2** | ✅ |
| Cơ điện chờ↔đang xử lý (vệ tinh) | S2 | ✅ |
| IPC báo nhầm (bình thường) đóng thẳng | **U4** | ✅ |
| Trực HSL __GIU__ (ghi chú, không đổi trạng thái) | **S8** | ✅ |
| QA đóng có lý do / QA kết luận cụm | S8, S9 | ✅ |
| Admin override đóng/mở lại mọi trạng thái | **U5** | ✅ |
| Guard vai trò (bộ phận sai bị chặn) | **S3**, K6 | ✅ |
| Guard trạng thái (không nhảy cóc bước) | **S4** | ✅ |
| Bắt buộc lý do | **S5** | ✅ |
| ap_dung_khi (mở-lại chỉ khi ĐÓNG) | **S6** | ✅ |

## D. Cụm sự cố
| Kịch bản | Test | TT |
|---|---|---|
| Sự cố mở nào cũng có cụm; vòng đời cụm khớp | B1, B2 | ✅ |
| Không hai cụm mở cùng khoá | B3 | ✅ |
| Gán cụm chống đua (ON CONFLICT DO UPDATE) | K5 | ✅ |
| Mở lại nhập cụm đang mở, không nổ duplicate | K4 | ✅ |
| Cụm nhiều sự cố: đóng theo sự cố CUỐI | **U3** | ✅ |
| Cụm đóng-kỹ-thuật vẫn ở hàng QA tới khi có disposition | **S9** | ✅ (đã vá) |

## E. Tự động hoá
| Kịch bản | Test | TT |
|---|---|---|
| Tự phân tuyến SYSTEM sau 240' im lặng | **U2** | ✅ |
| Tự đóng đúng luật 2 giờ sạch | K1 | ✅ |
| 1 giờ sạch CHƯA đóng | K1 | ✅ |
| Tái phát kế thừa đồng hồ nhắc (WF6 không báo giả) | K2 | ✅ |
| Hàm dọn dẹp bật cờ bypass trước DELETE | B9 | ✅ |

## F. Cảnh báo, leo thang & email
| Kịch bản | Test | TT |
|---|---|---|
| Định tuyến email: CRITICAL có vai trò nhận | **U6** | ✅ |
| SUPPRESSED không lọt email | B15 | ✅ |
| Mọi sự cố mở đều trong hàng trách nhiệm (quá hạn) | B16 | ✅ |
| WF6 đếm đình trệ = 0 lúc này | B19 | ✅ |
| SLA quá hạn tiếp nhận: hiện cờ rồi tự hết khi tiếp nhận | **T5** | ✅ |
| Email không kẹt DANG_GUI >2h · khoá idempotency không trùng | B10,B11 | ✅ |
| Tạm dừng cảnh báo: chốt quyền + trần 4h + lý do | **T3** | ✅ |

## G. Vé email / token
| Kịch bản | Test | TT |
|---|---|---|
| Vé hợp lệ→ok · dùng lại→chặn · hết hạn→chặn | **T1** | ✅ |
| Vé mới TTL ≤ 12 giờ | B17 | ✅ |
| Double-click chỉ tác dụng 1 lần | **T2** | ✅ |

## H. Phân quyền & bảo mật
| Kịch bản | Test | TT |
|---|---|---|
| Phân quyền KHU trên THAO TÁC (phong_duoc_xem) | **S7** | ✅ |
| VIEWER chỉ-xem: mọi thao tác bị chặn | **U7**, B21 | ✅ |
| View: authenticated đọc hết, anon chặn chỗ nhạy cảm | K7 | ✅ |
| Rò dữ liệu đổi tài khoản (web) | *web #2* | ✅ (đã vá) |
| TVMode "không xác minh được" ≠ xanh | *web #3* | ✅ (đã vá) |

## I. Toàn vẹn & audit (ALCOA+)
| Kịch bản | Test | TT |
|---|---|---|
| Mỗi thao tác 1 dòng audit đúng người/vai | **S10** | ✅ |
| Chuỗi hash audit liền mạch (tamper-evident) | B20, S10 | ✅ |
| Trạng thái khớp cờ đóng/mở | B4 | ✅ |
| Không sự cố nào da_tat_canh_bao (công tắc vĩnh viễn đã tử) | B5 | ✅ |
| Mở lại xoá dấu đóng + tạm dừng + cụm sống lại | **T4** | ✅ |

## J. Hạ tầng & hợp đồng
| Kịch bản | Test | TT |
|---|---|---|
| RPC web gọi tồn tại, 1 chữ ký, authenticated chạy | W1 | ✅ |
| Phiên bản giao thức khớp DB↔web | W2 | ✅ |
| Hành động audit 30 ngày có nhãn web | W3 | ✅ |
| Component JSX dùng mà chưa import (crash runtime) | W4 | ✅ |
| Mọi khoá cfg_* được đọc đều tồn tại | B8 | ✅ |
| pg_cron 24h không lần nào failed | B12 | ✅ |
| Lỗi workflow 24h (cờ để duyệt) | B13 | ⚠ log WF6 (benign) |

## Còn chưa test (đề xuất bổ sung sau — rủi ro thấp/cần bối cảnh)
- **Phạm vi/airlock trực diện:** OOS ở phòng P3 KHÔNG canh_bao_bat_buoc → không mở CRITICAL (hiện chỉ gián tiếp qua trong_pham_vi_canh_bao).
- **Phục hồi reset đồng hồ:** OOS→1h sạch→OOS lại → so_gio_sach_lien_tiep về 0 (K1 test hướng đóng, chưa test reset ngược).
- **Định tuyến email theo KHU:** sự cố Q2 không lọt người nhận khu khác (phụ thuộc cấu hình người nhận).
- **Cấu hình đổi ngưỡng qua web:** RPC sửa ngưỡng kiểm min/max theo severity (liên quan audit #14 — chính sách SOP).
- **Mở lại reset SLA:** quyết định SOP (xem quan sát T4).

> Mỗi khi thêm luật/bộ phận/nút mới: thêm một kịch bản kiểm CẢ đường-đúng lẫn
> ma-trận-từ-chối, và (nếu là bug thật mới) một bất biến B. Luôn ROLLBACK.
