# ============================================================================
# chart-render — ECharts SSR → PNG cho báo cáo/email BMS-GMP
# Chạy cạnh n8n (cùng docker network) — xem README.md
#
# BẪY SỐ 1: font tiếng Việt. sharp rasterize SVG bằng librsvg/pango → dùng font
# HỆ THỐNG qua fontconfig. Thiếu font có dấu → "ĐẶNG ỄỆỠ ỰỬ" thành ô vuông.
# fonts-noto-core + fonts-noto-ui-core phủ đủ tiếng Việt (Noto Sans).
# Muốn ĐÚNG font thương hiệu Be Vietnam Pro: thả file .ttf (OFL, tải từ
# google/fonts trên GitHub) vào thư mục fonts/ trước khi build — xem fonts/README.md
# ============================================================================
FROM node:22-slim

# Font tiếng Việt + fontconfig (bắt buộc cho sharp/librsvg)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        fonts-noto-core \
        fonts-noto-ui-core \
        fontconfig \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cài deps trước (tận dụng layer cache)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# Font tuỳ chọn (Be Vietnam Pro .ttf) — thư mục có thể chỉ chứa README
COPY fonts/ /usr/share/fonts/truetype/custom/
RUN fc-cache -f -v

COPY server.js ./

ENV PORT=8081 NODE_ENV=production
EXPOSE 8081

# CHART_RENDER_TOKEN truyền lúc chạy: docker run -e CHART_RENDER_TOKEN=…
USER node
CMD ["node", "server.js"]
