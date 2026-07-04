#!/usr/bin/env bash
# ============================================================================
# chuyen-supabase.sh — Chuyển toàn bộ dữ liệu GMP từ project Supabase CŨ sang MỚI.
# ----------------------------------------------------------------------------
# CÁCH DÙNG (chạy trên máy có mạng tới supabase.co — KHÔNG chạy trong sandbox):
#   1) Cài: Supabase CLI (https://supabase.com/docs/guides/cli) + psql/pg_dump
#      (Postgres 17 client — cùng phiên bản server 17.6). Kiểm tra: pg_dump --version
#   2) Lấy 2 connection string DIRECT (Dashboard → Project Settings → Database →
#      Connection string → "URI", thay [YOUR-PASSWORD] bằng mật khẩu DB):
#        export SRC_DB_URL='postgresql://postgres:PASS@db.jfonqwhjhsylruwfllbk.supabase.co:5432/postgres'
#        export DST_DB_URL='postgresql://postgres:PASS@db.snjxlsnxrefttupmnkvm.supabase.co:5432/postgres'
#   3) BẬT extension pg_cron trên project MỚI (Dashboard → Database → Extensions).
#   4) bash scripts/chuyen-supabase.sh
#
# An toàn: script CHỈ ĐỌC project cũ (dump) và GHI vào project mới. Không xóa gì.
# ============================================================================
set -euo pipefail

: "${SRC_DB_URL:?Thiếu SRC_DB_URL (connection string project CŨ)}"
: "${DST_DB_URL:?Thiếu DST_DB_URL (connection string project MỚI)}"

OUT="./ban-sao-supabase"
mkdir -p "$OUT"
HERE="$(cd "$(dirname "$0")" && pwd)"

echo "==> [1/7] Dump SCHEMA (public) từ project CŨ"
supabase db dump --db-url "$SRC_DB_URL" -f "$OUT/schema.sql"

echo "==> [2/7] Dump DATA (public, COPY) từ project CŨ"
supabase db dump --db-url "$SRC_DB_URL" --data-only --use-copy -f "$OUT/data.sql"

echo "==> [3/7] (tùy chọn) Dump 7 user Auth (auth.users + auth.identities)"
pg_dump "$SRC_DB_URL" --data-only --inserts \
  --table='auth.users' --table='auth.identities' \
  -f "$OUT/auth_users.sql" 2>/dev/null || \
  echo "    (bỏ qua auth — có thể tạo lại user trên Dashboard nếu cần)"

echo "==> [4/7] Restore SCHEMA vào project MỚI (bỏ qua lỗi lành tính, xem log)"
psql "$DST_DB_URL" -v ON_ERROR_STOP=0 -f "$OUT/schema.sql"

echo "==> [5/7] Restore DATA vào project MỚI"
psql "$DST_DB_URL" -v ON_ERROR_STOP=0 -f "$OUT/data.sql"

echo "==> [6/7] Tạo lại 3 job pg_cron (cần đã bật pg_cron)"
psql "$DST_DB_URL" -f "$HERE/tao-lai-cron-project-moi.sql"

echo "==> [7/7] ĐỐI CHIẾU số dòng CŨ vs MỚI (phải KHỚP)"
echo "----- CŨ -----";  psql "$SRC_DB_URL" -f "$HERE/doi-chieu-migration.sql"
echo "----- MỚI -----"; psql "$DST_DB_URL" -f "$HERE/doi-chieu-migration.sql"

cat <<'EOF'

==> XONG phần dữ liệu. TIẾP THEO (không tự động):
    - So 2 bảng row-count ở trên: phải khớp từng bảng.
    - Rewire n8n + web + chạy thử: xem docs/CHUYEN-SUPABASE.md mục 5–7.
    - CHỈ ngừng/xóa project cũ SAU khi nghiệm thu xong.
    - Rotate lại service_role key của project mới (đã lộ trong chat).
EOF
