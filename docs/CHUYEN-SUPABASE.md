# Chuyển Supabase: `bms-gmp-v10` (cũ) → project mới

> Mục tiêu: chuyển **toàn bộ** hệ GMP sang project Supabase mới `snjxlsnxrefttupmnkvm`,
> đổi kết nối n8n + web, nghiệm thu, rồi mới ngừng project cũ.
> Dữ liệu GMP (ALCOA+) — **không xóa gì ở project cũ cho tới khi project mới chạy thật OK.**

## 0. Vì sao bước dump/restore phải do bạn chạy

Phiên trợ lý này chỉ quản trị được tài khoản Supabase chứa project **cũ**
(`jfonqwhjhsylruwfllbk`). Project **mới** `snjxlsnxrefttupmnkvm` nằm ở **tài khoản
khác**, và môi trường sandbox bị chặn kết nối trực tiếp tới `supabase.co`, nên trợ lý
**không ghi trực tiếp vào project mới được**. Vì vậy phần chép dữ liệu chạy bằng
`supabase db dump` / `psql` từ **máy của bạn** (có mạng tới cả 2 project). Trợ lý đã
soạn sẵn script + làm giúp phần rewire/nghiệm thu ở các mục sau.

## 1. Quy mô cần chuyển (khảo sát thật 04/07/2026)

| Hạng mục | Số lượng |
|---|---|
| Dung lượng DB | ~265 MB |
| Bảng schema `public` | ~45 (tổng 59 gồm auth/cron/storage) |
| Hàm (RPC) `public` | 61 · View: 19 · Trigger: 28 · RLS policy: 37 · Sequence: 8 |
| Bảng lớn nhất | `du_lieu_gio_archive` 174k · `du_lieu_gio` 134k · `kpi_gio` 52k · `kpi_ngay_phong` 6k |
| pg_cron | **3 job** (xu-huong 18:15, spc 18:45, dọn-dẹp 19:30 — giờ UTC) |
| Auth users | **7** (đăng nhập web) |
| Vault secrets | 0 (không cần chuyển) |
| Storage bucket | chỉ `bao-cao-web` (bucket test, bỏ qua) |
| Extension đã bật | pgcrypto, uuid-ossp, pg_stat_statements, supabase_vault, **pg_cron**, plpgsql |
| Hàm gọi mạng ngoài | Không (DB không tự gọi ra ngoài) |

## 2. Chuẩn bị

- Máy có **Supabase CLI** + **psql/pg_dump phiên bản 17** (cùng server 17.6).
  Kiểm tra: `pg_dump --version` phải là 17.x.
- Lấy 2 **connection string DIRECT** (Dashboard → *Project Settings → Database →
  Connection string → URI*, thay `[YOUR-PASSWORD]`):
  ```bash
  export SRC_DB_URL='postgresql://postgres:PASS@db.jfonqwhjhsylruwfllbk.supabase.co:5432/postgres'
  export DST_DB_URL='postgresql://postgres:PASS@db.snjxlsnxrefttupmnkvm.supabase.co:5432/postgres'
  ```
  (Dùng *Direct connection*; nếu mạng chặn IPv6 thì dùng *Session pooler* port 5432,
  user `postgres.<ref>`. **Không** dùng *Transaction pooler* :6543 cho dump/restore.)
- **BẬT `pg_cron`** trên project mới: Dashboard → *Database → Extensions → pg_cron*.

## 3. Chép schema + dữ liệu (1 lệnh)

```bash
bash scripts/chuyen-supabase.sh
```
Script (`scripts/chuyen-supabase.sh`) làm: dump schema → dump data (COPY) → restore vào
project mới → tạo lại 3 cron job → in đối chiếu row-count CŨ vs MỚI.

<details><summary>Hoặc chạy thủ công từng bước</summary>

```bash
mkdir -p ban-sao-supabase
supabase db dump --db-url "$SRC_DB_URL"                   -f ban-sao-supabase/schema.sql
supabase db dump --db-url "$SRC_DB_URL" --data-only --use-copy -f ban-sao-supabase/data.sql
# (đã bật pg_cron trên project mới)
psql "$DST_DB_URL" -v ON_ERROR_STOP=0 -f ban-sao-supabase/schema.sql
psql "$DST_DB_URL" -v ON_ERROR_STOP=0 -f ban-sao-supabase/data.sql
psql "$DST_DB_URL" -f scripts/tao-lai-cron-project-moi.sql
```
Vài lỗi "already exists" khi restore schema là **bình thường** (object mặc định của
Supabase). Cần để ý lỗi liên quan tới bảng/hàm của app.
</details>

## 4. Auth users (7 tài khoản đăng nhập web)

Hai lựa chọn:
- **Chép nguyên** (giữ nguyên user + mật khẩu): script đã dump `ban-sao-supabase/auth_users.sql`.
  Nạp: `psql "$DST_DB_URL" -f ban-sao-supabase/auth_users.sql` (bỏ qua lỗi trùng).
- **Tạo lại** (đơn giản, chắc chắn cho 7 user): Dashboard project mới → *Authentication →
  Add user*, đặt lại mật khẩu. Khuyến nghị cách này nếu không cần giữ nguyên `user_id`.

## 5. Đối chiếu (BẮT BUỘC trước khi rewire)

```bash
psql "$SRC_DB_URL" -f scripts/doi-chieu-migration.sql   # CŨ
psql "$DST_DB_URL" -f scripts/doi-chieu-migration.sql   # MỚI
```
So 2 bảng row-count: **phải khớp từng bảng** + `tong_dong_public` bằng nhau. Gọi thử 1
RPC trên project mới để chắc số liệu khớp:
```sql
select rpc_bao_cao_tong_hop('TUAN','2026-06-22','2026-06-28') -> 'kpi_ky_nay';
```

## 6. Đổi kết nối (rewire) — trợ lý làm được phần này khi bạn xong mục 5

**n8n (WF1–WF7):**
- Sửa credential **"Supabase Postgres"** (`id 4Zc8ZMCq7qPoSMtF`) → Host/DB/Password của
  project mới (`db.snjxlsnxrefttupmnkvm.supabase.co`). Mọi workflow dùng credential này
  tự trỏ sang DB mới — không phải sửa từng node.
- Nếu có node HTTP gọi thẳng URL Supabase cũ (vd gọi AI/PostgREST) → đổi sang URL + khóa
  của project mới. (Đã kiểm: **`cau_hinh` không chứa URL Supabase** nào — webhook là URL n8n.)

**Web app:**
- Đổi 2 biến build của Vite sang project mới rồi **build + deploy lại**:
  - `VITE_SUPABASE_URL = https://snjxlsnxrefttupmnkvm.supabase.co`
  - `VITE_SUPABASE_ANON_KEY = <anon key project mới>` (Dashboard → API → anon public)
  - Nơi đặt: secret của workflow `.github/workflows/deploy.yml` (biến đọc ở `web/src/lib/config.js`).

## 7. Nghiệm thu

- Chạy thử **WF5** (nút "Gửi báo cáo bù" hoặc `execute`): email + dashboard đúng số liệu.
- Đăng nhập web bằng 1 user, kiểm tra đọc/ghi dữ liệu thật.
- Kiểm 3 cron job: `select jobname, active from cron.job;` trên project mới.

## 8. Ngừng project cũ (chỉ khi mục 5–7 đều OK)

- **Giữ project cũ làm backup** ít nhất vài ngày (dữ liệu GMP). Có thể *Pause* trước
  (Dashboard → Settings → Pause project), theo dõi project mới chạy ổn, rồi mới xóa hẳn.
- Giữ lại bản dump `ban-sao-supabase/*.sql` như backup ngoại tuyến.

## 9. Bảo mật (làm ngay)

- **Rotate `service_role` key** của project mới (đã bị dán ra chat): Dashboard → *API →
  Rotate*. Đổi lại khóa mới ở mọi nơi dùng (n8n, server).
- Không commit connection string / khóa vào repo.

## 10. Rollback

Chưa đổi kết nối n8n/web thì hệ thống vẫn chạy trên project cũ — chỉ cần bỏ project mới,
không ảnh hưởng gì. Nếu đã đổi mà lỗi: trỏ credential n8n + biến web **về lại project cũ**
(vẫn còn nguyên) là khôi phục ngay.
