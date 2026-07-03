#!/usr/bin/env sh
# ============================================================================
# Tải font Be Vietnam Pro (giấy phép OFL) từ repo google/fonts về thư mục này
# để build vào container chart-render (và copy sang gotenberg/fonts/ nếu muốn PDF
# cùng font thương hiệu). KHÔNG bắt buộc — mặc định container đã có Noto Sans.
#
#   sh services/chart-render/fonts/tai-be-vietnam-pro.sh
#   docker compose -f services/docker-compose.yml build chart-render
# ============================================================================
set -eu
cd "$(dirname "$0")"

BASE="https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro"
for w in Regular Medium SemiBold Bold; do
  f="BeVietnamPro-$w.ttf"
  echo "Tải $f ..."
  curl -fsSL "$BASE/$f" -o "$f"
done

echo "Xong. Đã có: $(ls BeVietnamPro-*.ttf 2>/dev/null | tr '\n' ' ')"
echo "→ (tuỳ chọn) copy sang PDF: cp BeVietnamPro-*.ttf ../../gotenberg/fonts/"
echo "→ build lại: docker compose -f services/docker-compose.yml build"
