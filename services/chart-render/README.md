# chart-render — Dịch vụ render biểu đồ ECharts → PNG (BMS-GMP)

Microservice nhỏ cho **mục B2** của kế hoạch nâng cấp báo cáo
(`docs/KE-HOACH-NANG-CAP-BIEU-DO-BAO-CAO.md`): render biểu đồ **ECharts SSR
(SVG) → PNG** để nhúng vào email MJML / báo cáo HTML / PDF Gotenberg.
Biểu đồ email **giống hệt dashboard** (cùng markLine 80%, cùng bảng màu
traffic light), PNG an toàn với mọi mail client, dữ liệu GMP **không rời hạ tầng**.

## Loại biểu đồ hỗ trợ (`type`)

| type | Mô tả | Kích thước mặc định |
|---|---|---|
| `line` | Tuân thủ theo ngày: đường + area gradient + markLine 80% đứt nét | 720×300 |
| `bar` | Top phòng rủi ro (bar ngang, màu đèn giao thông ≥95 / 80–95 / <80) | 720×300 |
| `sparkline` | Đường mini cho từng dòng bảng top phòng | 120×36 |
| `calendarHeatmap` | Lịch: ô = ngày, màu = % tuân thủ (đỏ→vàng→teal) | 760×220 |
| `spc` | Levey-Jennings: giá trị + TB + ±1σ/2σ/3σ, điểm ngoài 3σ tô đỏ | 720×320 |

Màu chuẩn: teal `#0d9488` (đạt), đỏ đậm `#b91c1c` (không đạt), sky `#0284c7`,
sand `#d97706` (ngưỡng). Font: `Be Vietnam Pro, Noto Sans, sans-serif`.

## Chạy (Docker, cạnh n8n)

```bash
cd services/chart-render
docker build -t bms-chart-render .

# cùng network với n8n để n8n gọi bằng tên container
docker run -d --name chart-render \
  --network n8n_default \
  -e CHART_RENDER_TOKEN='doi-mat-khau-nay' \
  -p 8081:8081 \
  --restart unless-stopped \
  bms-chart-render
```

Chạy dev không Docker: `npm install && node server.js` (cần font tiếng Việt
trên máy — Linux: `apt-get install fonts-noto-core`).

- `GET /healthz` → `{ok:true,…}` — dùng cho healthcheck/uptime.
- Auth: nếu đặt env `CHART_RENDER_TOKEN`, mọi request `POST /render` phải kèm
  header `Authorization: Bearer <token>`. Không đặt → bỏ kiểm tra (chỉ chấp
  nhận khi service nằm hoàn toàn trong mạng nội bộ Docker).

## Ví dụ curl

```bash
# Line: tuân thủ theo ngày
curl -s http://localhost:8081/render \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer doi-mat-khau-nay' \
  -d '{
    "type": "line",
    "width": 720, "height": 300,
    "options": {"title": "Tỉ lệ tuân thủ theo ngày (%)"},
    "data": [
      {"ngay": "24/06", "ty_le": 96.2}, {"ngay": "25/06", "ty_le": 94.1},
      {"ngay": "26/06", "ty_le": 78.5}, {"ngay": "27/06", "ty_le": 88.0},
      {"ngay": "28/06", "ty_le": 97.3}, {"ngay": "29/06", "ty_le": 98.1},
      {"ngay": "30/06", "ty_le": 95.6}
    ]
  }' -o line.png

# SPC Levey-Jennings
curl -s http://localhost:8081/render -H 'Content-Type: application/json' \
  -d '{
    "type": "spc",
    "options": {"title": "SPC — C1.R28 · RH"},
    "data": {
      "mean": 92.5, "sigma": 2.1,
      "diem": [
        {"ngay": "24/06", "gia_tri": 93.0}, {"ngay": "25/06", "gia_tri": 91.8},
        {"ngay": "26/06", "gia_tri": 85.1}, {"ngay": "27/06", "gia_tri": 92.2},
        {"ngay": "28/06", "gia_tri": 99.4}
      ]
    }
  }' -o spc.png

# Sparkline 120×36 cho bảng top phòng
curl -s http://localhost:8081/render -H 'Content-Type: application/json' \
  -d '{"type":"sparkline","data":[96,94,79,88,97,98,95]}' -o spark.png

# Heatmap lịch của kỳ
curl -s http://localhost:8081/render -H 'Content-Type: application/json' \
  -d '{
    "type": "calendarHeatmap",
    "options": {"tu": "2026-06-01", "den": "2026-06-30", "title": "Lịch tuân thủ tháng 6"},
    "data": [
      {"ngay": "2026-06-01", "ty_le": 97}, {"ngay": "2026-06-02", "ty_le": 91},
      {"ngay": "2026-06-03", "ty_le": 76}, {"ngay": "2026-06-04", "ty_le": 95}
    ]
  }' -o heatmap.png
```

## Gọi từ n8n (HTTP Request node)

- **Method**: POST · **URL**: `http://chart-render:8081/render`
  (tên container, cùng docker network — KHÔNG đi qua internet).
- **Authentication**: Generic → Header Auth: name `Authorization`,
  value `Bearer <CHART_RENDER_TOKEN>` (lưu trong n8n Credentials, không hardcode).
- **Body**: JSON — ráp từ output của `rpc_bao_cao_tong_hop` bằng Code node, ví dụ
  `{{ { type: 'line', data: $json.chuoi_ngay.total.map(d => ({ngay: d.ngay.slice(5), ty_le: d.ty_le})) } }}`.
- **Response**: đặt **Response Format = File** → nhận binary PNG, đưa thẳng vào
  node Send Email làm **attachment CID** (`cid:chart_line`) hoặc upload Drive.
- Sparkline cho bảng top 5 phòng: chạy node HTTP Request ở chế độ
  "Run Once for Each Item" trên mảng `top_phong_rui_ro` → 5 ảnh
  `cid:spark_<ma_phong>`.

## ⚠️ Font tiếng Việt — kiểm tra TRƯỚC khi làm template

Bẫy số 1 của cả pipeline (PNG lẫn PDF Gotenberg): **thiếu font → dấu tiếng Việt
thành ô vuông**. Container đã cài `fonts-noto-core` + `fonts-noto-ui-core`
(Noto Sans phủ đủ tiếng Việt); muốn đúng font thương hiệu **Be Vietnam Pro**,
thả file `.ttf` (OFL) vào `fonts/` trước khi build — xem `fonts/README.md`.

Test bắt buộc sau khi build, dùng chuỗi đủ dấu khó:

```bash
curl -s http://localhost:8081/render -H 'Content-Type: application/json' \
  -d '{"type":"line","options":{"title":"ĐẶNG ỄỆỠ ỰỬ áàảãạ"},"data":[{"ngay":"ĐẶNG ỄỆỠ","ty_le":95},{"ngay":"ỰỬ áàảãạ","ty_le":88}]}' \
  -o test-font.png && open test-font.png   # Linux: xdg-open
```

Mở `test-font.png`: mọi ký tự phải hiển thị đủ dấu, không có ô vuông (□).
Nhớ test tương tự với Gotenberg (PDF) — đó là container khác, phải cài font riêng.

## API

`POST /render` — body JSON:

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `type` | string | bắt buộc — xem bảng trên |
| `data` | array/object | dữ liệu biểu đồ (hình dạng linh hoạt: `[{ngay, ty_le}]`, `{labels, values}`, `[số…]`; SPC: `{diem, mean, sigma}`) |
| `options` | object | `title`, `nguong` (mặc định 80), `min/max` (heatmap), `pixelRatio` (mặc định 2), `backgroundColor` |
| `width`, `height` | number | ghi đè kích thước mặc định theo `type` |
| `theme` | string | theme ECharts (tuỳ chọn) |

Trả về `image/png` (đã render ×2 pixelRatio, nén palette — nhẹ cho email,
tránh Gmail cắt mail >102KB). Lỗi trả JSON `{error, message}`.
