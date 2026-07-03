# fonts/ — font tuỳ chọn nhúng vào container

Thư mục này được `COPY` vào `/usr/share/fonts/truetype/custom/` khi build Docker.

- **Mặc định** container đã có **Noto Sans** (gói `fonts-noto-core` + `fonts-noto-ui-core`)
  — phủ đủ dấu tiếng Việt, biểu đồ hiển thị đúng ngay cả khi thư mục này trống.
- **Muốn đúng font thương hiệu Be Vietnam Pro** (đồng nhất với dashboard):
  tải các file `.ttf` (giấy phép OFL) từ repo GitHub `google/fonts`
  (thư mục `ofl/bevietnampro/`) và thả vào đây trước khi `docker build`:
  - `BeVietnamPro-Regular.ttf`
  - `BeVietnamPro-Medium.ttf`
  - `BeVietnamPro-SemiBold.ttf`
  - `BeVietnamPro-Bold.ttf`

Sau khi build, kiểm tra font trong container:

```bash
docker exec chart-render fc-list | grep -i "vietnam\|noto sans"
```

Và test render chuỗi có dấu: `"ĐẶNG ỄỆỠ ỰỬ áàảãạ"` (xem README.md của service).
