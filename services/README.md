# services/ — dịch vụ phụ trợ báo cáo WF5 v2

Hai container chạy **cạnh n8n** (cùng docker network), do WF5 v2 gọi để làm báo cáo đẹp hơn.
**Không bắt buộc** — thiếu chúng, workflow tự fallback (biểu đồ SVG nội bộ + đính kèm HTML thay PDF).

| Service | Vai trò | n8n gọi (mặc định `cau_hinh`) |
|---|---|---|
| `chart-render` | ECharts SSR → PNG (line/bar/sparkline/heatmap/SPC) | `chart_render_url` = `http://chart-render:8081/render-batch` |
| `gotenberg` | HTML → PDF (Chromium), font tiếng Việt | `gotenberg_url` = `http://gotenberg:3000/forms/chromium/convert/html` |

## Dựng cả hai — một lệnh

```bash
cd services
cp .env.example .env          # sửa N8N_NETWORK nếu mạng n8n khác 'n8n_default'
docker compose up -d --build
docker compose ps             # STATUS phải "healthy" (chờ ~20s)
```

- Tìm tên mạng n8n: `docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' <container-n8n>`
  rồi đặt `N8N_NETWORK` trong `.env`.
- Không chung mạng được (n8n không chạy docker)? Cổng đã publish ra host (8081/3000):
  đổi `cau_hinh.chart_render_url` / `gotenberg_url` sang `http://<IP-host>:8081` / `:3000`.

## Kiểm tra nhanh

```bash
# chart-render sống?
curl -s http://localhost:8081/healthz          # {ok:true,...}
# gotenberg sống?
curl -s http://localhost:3000/health           # {"status":"up",...}
# PDF có dấu tiếng Việt?
printf '<!doctype html><meta charset=utf-8><h1>ĐẶNG ỄỆỠ ỰỬ áàảãạ</h1>' > /tmp/t.html
curl -s --form 'files=@/tmp/t.html' http://localhost:3000/forms/chromium/convert/html -o /tmp/t.pdf
```

## Font tiếng Việt (BẪY SỐ 1)

Cả PNG (sharp/librsvg) lẫn PDF (Chromium) render bằng font hệ thống. Ảnh Docker đã cài
**Noto Sans** (`fonts-noto-core`) phủ đủ dấu. Muốn đúng **Be Vietnam Pro** (đồng nhất dashboard):

```bash
sh chart-render/fonts/tai-be-vietnam-pro.sh      # tải .ttf (OFL) từ google/fonts
cp chart-render/fonts/BeVietnamPro-*.ttf gotenberg/fonts/   # (tuỳ chọn) cho cả PDF
docker compose build && docker compose up -d
```

Chi tiết từng service: `chart-render/README.md`, `gotenberg/fonts/README.md`.
