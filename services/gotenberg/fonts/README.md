# gotenberg/fonts/ — font tuỳ chọn nhúng vào Gotenberg (PDF)

Thư mục này được `COPY` vào `/usr/share/fonts/truetype/custom/` khi build image
`bms-gotenberg` (xem `../Dockerfile`).

- **Mặc định** image đã thêm **Noto Sans** (`fonts-noto-core` + `fonts-noto-ui-core`)
  — phủ đủ dấu tiếng Việt, PDF hiển thị đúng ngay cả khi thư mục này trống.
- **Muốn đúng font thương hiệu Be Vietnam Pro** (đồng nhất với dashboard + chart-render):
  chạy `../chart-render/fonts/tai-be-vietnam-pro.sh` để tải, rồi COPY các file `.ttf`
  sang đây (hoặc tải trực tiếp `ofl/bevietnampro/*.ttf` từ repo `google/fonts`):
  - `BeVietnamPro-Regular.ttf` · `BeVietnamPro-Medium.ttf`
  - `BeVietnamPro-SemiBold.ttf` · `BeVietnamPro-Bold.ttf`

Kiểm tra font sau khi build:

```bash
docker exec gotenberg fc-list | grep -i "vietnam\|noto sans"
```

Test PDF có dấu (cần Gotenberg đang chạy):

```bash
printf '<!doctype html><meta charset=utf-8><h1>ĐẶNG ỄỆỠ ỰỬ áàảãạ</h1>' > /tmp/t.html
curl -s --form 'files=@/tmp/t.html' \
  http://localhost:3000/forms/chromium/convert/html -o /tmp/t.pdf
# Mở /tmp/t.pdf — mọi ký tự phải đủ dấu, không có ô vuông (□).
```
