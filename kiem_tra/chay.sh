#!/usr/bin/env bash
# =============================================================================
# BỘ KIỂM HỆ THỐNG BMS — chạy: bash kiem_tra/chay.sh
#
# Vòng: PHÁT HIỆN (bất biến vỡ) → CHẨN ĐOÁN (in số đo) → KIỂM TRA (kịch bản
# rollback) → XỬ LÝ (mỗi phép vỡ kèm gợi ý sửa). Exit code ≠ 0 khi có phép vỡ
# ⇒ cắm được vào CI.
#
# Mật khẩu Postgres: tìm sb.env ở scratchpad phiên (quy ước của dự án).
# =============================================================================
set -uo pipefail
cd "$(dirname "$0")/.."

SB=$(ls -t /private/tmp/claude-501/-Users-iphone9-Projects-BMS/*/scratchpad/sb.env 2>/dev/null | head -1)
if [ -z "${SB:-}" ]; then echo "❌ Không tìm thấy sb.env (mật khẩu Postgres)"; exit 2; fi
set -a; . "$SB"; set +a
CONN="host=aws-1-ap-southeast-1.pooler.supabase.com port=5432 user=postgres.snjxlsnxrefttupmnkvm dbname=postgres sslmode=require"
PSQL(){ PGPASSWORD="$PGPASSWORD" psql "$CONN" "$@"; }

VO=0
echo "══════════════════════════════════════════════════════════════"
echo "  BỘ KIỂM BMS · $(date '+%d/%m/%Y %H:%M:%S')"
echo "══════════════════════════════════════════════════════════════"

# ── HỢP ĐỒNG WEB ↔ DB (SQL thuần không grep được mã web) ─────────────────────
echo ""
echo "── HỢP ĐỒNG WEB ↔ DB ──"

# W1: mọi RPC web gọi phải tồn tại, đúng MỘT chữ ký, authenticated chạy được
RPCS=$(grep -rhoE "goiRPC\(\s*'[a-z0-9_]+'" web/src | sed -E "s/.*'([a-z0-9_]+)'/('\1')/" | sort -u | paste -sd, -)
W1=$(PSQL -qtA -c "
WITH can(ten) AS (VALUES $RPCS),
kq AS (SELECT c.ten, count(p.oid) so_ban,
        coalesce(bool_or(has_function_privilege('authenticated',p.oid,'EXECUTE')),false) chay
   FROM can c LEFT JOIN pg_proc p ON p.proname=c.ten AND p.pronamespace='public'::regnamespace AND p.prokind='f'
  GROUP BY c.ten)
SELECT string_agg(ten||'['||so_ban||' bản,auth='||chay||']', ' · ') FROM kq WHERE so_ban<>1 OR NOT chay;")
if [ -z "$W1" ]; then
  echo "✅ W1 · $(echo "$RPCS" | tr ',' '\n' | wc -l | tr -d ' ') RPC web gọi: tồn tại, 1 chữ ký, authenticated chạy được"
else
  echo "❌ W1 · RPC lệch hợp đồng: $W1"
  echo "     → XỬ LÝ: RPC thiếu = migration chưa áp (bug 'Nhật ký audit'); >1 bản = overload PGRST203 — DROP bản cũ"
  VO=$((VO+1))
fi

# W2: chuỗi hợp đồng giao thức khớp giữa DB và web
PB_WEB=$(grep -oE "PHIEN_BAN_GIAO_THUC = '[^']+'" web/src/lib/supabaseData.js | sed "s/.*'\(.*\)'/\1/")
PB_DB=$(PSQL -qtA -c "SELECT value FROM public.cau_hinh WHERE key='phien_ban_giao_thuc';")
if [ "$PB_WEB" = "$PB_DB" ]; then
  echo "✅ W2 · phien_ban_giao_thuc khớp: $PB_DB (nhớ: WF8 node đầu cũng phải mang chuỗi này)"
else
  echo "❌ W2 · LỆCH GIAO THỨC: DB='$PB_DB' · web='$PB_WEB'"
  echo "     → XỬ LÝ: cập nhật cả BA nơi cùng lúc: cau_hinh + supabaseData.js + node 'Đọc cấu hình + sự cố' của WF8"
  VO=$((VO+1))
fi

# W3 (lớp lỗi 4 — hard-code lệch bảng luật): hành động trong audit 30 ngày
#     phải có nhãn trong ACTION_CODE_TO_LABEL của web
DB_ACTS=$(PSQL -qtA -c "SELECT DISTINCT hanh_dong FROM public.lich_su_su_co WHERE thoi_diem>now()-interval '30 day';")
THIEU=""
for a in $DB_ACTS; do
  grep -qE "(^|[^a-z_])${a}:" web/src/lib/supabaseData.js || THIEU="$THIEU $a"
done
if [ -z "$THIEU" ]; then
  echo "✅ W3 · Mọi hành động trong audit 30 ngày đều có nhãn trên web"
else
  echo "❌ W3 · Hành động KHÔNG có nhãn (nhật ký sẽ hiện mã thô):$THIEU"
  echo "     → XỬ LÝ: thêm vào ACTION_CODE_TO_LABEL (web/src/lib/supabaseData.js) — lần thứ N của lớp lỗi 4"
  VO=$((VO+1))
fi

# W4 (lớp lỗi mới 10/07 tối): component DÙNG trong App.jsx mà KHÔNG import/định nghĩa.
#   Vite build KHÔNG bắt (nổ runtime). Bug "Sơ đồ xử lý crash": <SoDoLuatCard/> undefined.
W4=$(python3 kiem_tra/kiem_import.py)
if [ -z "$W4" ]; then
  echo "✅ W4 · Mọi component JSX trong App.jsx đều có import/định nghĩa"
else
  echo "❌ W4 · Component DÙNG mà KHÔNG import (crash runtime, build vẫn xanh): $W4"
  echo "     → XỬ LÝ: thêm import — lớp lỗi patch-quên-import (Sơ đồ xử lý crash 10/07)"
  VO=$((VO+1))
fi

# ── BẤT BIẾN + KỊCH BẢN (toàn bộ trong một giao dịch, tự ROLLBACK) ───────────
echo ""
echo "── BẤT BIẾN + KỊCH BẢN (rollback, không chạm dữ liệu thật) ──"
OUT=$(PSQL -qtA -F' │ ' -f kiem_tra/bo_kiem.sql 2>&1)
echo "$OUT" | grep -v '^KQ_MAY_DOC:' | grep -v '^ROLLBACK$' | grep -v '^BEGIN$' | sed 's/^/  /'
SQL_VO=$(echo "$OUT" | grep '^KQ_MAY_DOC:' | cut -d: -f2)
if [ -z "${SQL_VO:-}" ]; then
  echo "❌ Bộ kiểm SQL không chạy trọn (giao dịch bị abort giữa chừng?) — đọc lỗi ở trên"
  VO=$((VO+1))
else
  VO=$((VO+SQL_VO))
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
if [ "$VO" -eq 0 ]; then
  echo "  ✅ TẤT CẢ ĐẠT — hệ giữ đúng mọi bất biến đã học từ các bug cũ"
else
  echo "  ❌ $VO PHÉP KIỂM VỠ — mỗi dòng ❌ ở trên kèm gợi ý xử lý"
fi
echo "══════════════════════════════════════════════════════════════"
exit $([ "$VO" -eq 0 ] && echo 0 || echo 1)
