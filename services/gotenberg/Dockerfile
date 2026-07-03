# ============================================================================
# Gotenberg (PDF) cho BMS-GMP — thêm FONT TIẾNG VIỆT + curl (cho healthcheck).
#
# BẪY SỐ 1 (giống chart-render): Chromium trong Gotenberg render HTML→PDF bằng
# font HỆ THỐNG. Thiếu font có dấu → "ĐẶNG ỄỆỠ ỰỬ" thành ô vuông trong PDF.
# fonts-noto-core + fonts-noto-ui-core phủ đủ tiếng Việt (Noto Sans — khớp
# fallback của template). Muốn ĐÚNG Be Vietnam Pro: thả .ttf vào gotenberg/fonts/
# trước khi build (xem fonts/README.md).
#
# Build qua docker compose (khuyến nghị) hoặc trực tiếp:
#   docker build -t bms-gotenberg services/gotenberg
#   docker run -d --name gotenberg --network n8n_default bms-gotenberg
# ============================================================================
FROM gotenberg/gotenberg:8

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        fonts-noto-core \
        fonts-noto-ui-core \
        fontconfig \
        curl \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f

# Font thương hiệu tuỳ chọn (Be Vietnam Pro .ttf) — thư mục có thể chỉ chứa README
COPY fonts/ /usr/share/fonts/truetype/custom/
RUN fc-cache -f

USER gotenberg
