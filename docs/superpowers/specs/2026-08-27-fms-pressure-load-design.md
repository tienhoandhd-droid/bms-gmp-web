# Thiết kế tải chênh áp theo người đang xem

**Ngày:** 2026-08-27

**Trạng thái:** Đã duyệt thiết kế; chờ duyệt lại đặc tả bằng văn bản

**Phạm vi:** Tab Chênh áp, Edge Function `capnhat-phut-8h`, trạng thái người xem và lịch Supabase

## 1. Bối cảnh và bằng chứng

FMS lưu một mẫu chênh áp mỗi phút. BMS hiện có hai đường cùng kích hoạt việc đọc FMS:

1. Cron phía Supabase chạy mỗi phút, kể cả khi không ai xem tab Chênh áp.
2. Mỗi trình duyệt mở tab gọi Edge Function ngay và gọi lại mỗi 180 giây.

Mỗi lượt Edge Function đăng nhập FMS, lấy danh sách phòng rồi gọi API dữ liệu cho khoảng 57 phòng, hiện chạy sáu phòng song song. Tải ước tính:

- cron một phút: khoảng `60 × 57 = 3.420` request phòng mỗi giờ;
- mỗi trình duyệt mở tab: thêm khoảng `20 × 57 = 1.140` request phòng mỗi giờ;
- một tab tạo tổng khoảng 4.560 request phòng/giờ;
- năm tab có thể tạo khoảng 9.120 request phòng/giờ.

Tải tăng theo số người xem và tiếp tục tồn tại khi không ai cần dữ liệu. Đây là nguyên nhân phù hợp với hiện tượng RAM FMS tăng rồi API ngừng trả lời.

## 2. Mục tiêu

- Không gọi FMS khi không có người thực sự xem tab Chênh áp.
- Khi có người xem, tải ngay dữ liệu 10 phút gần nhất rồi cập nhật mỗi phút.
- Một hay nhiều người xem vẫn dùng chung tối đa một lượt thu thập FMS mỗi phút.
- Giảm đồng thời từ sáu xuống ba request phòng.
- Không cho hai lượt thu thập chạy chồng hoặc retry dồn.
- Giữ từng mẫu một phút FMS trả về; không lấy trung bình và không bỏ điểm trong cửa sổ 10 phút.
- Cho phép xem và tải mới cả ngoài khung 05:00–21:00.

## 3. Ngoài phạm vi và đánh đổi đã chấp nhận

- FMS vẫn là nguồn dữ liệu gốc và vẫn tự ghi mỗi phút.
- Khi không ai xem, BMS không sao chép dữ liệu phút từ FMS sang Supabase.
- Khi mở lại, BMS chỉ lấy bù tối đa 10 phút gần nhất. Khoảng cũ hơn 10 phút không được tự backfill trong luồng này.
- Nếu có người giữ tab hiển thị liên tục 24/7, tải cơ sở vẫn khoảng 3.420 request phòng/giờ vì yêu cầu cập nhật từng phút.
- Không thay đổi workflow n8n thu thập theo giờ.
- Không deploy, push, merge hoặc sửa hệ sản xuất nếu chưa có lệnh rõ ràng của người dùng.

## 4. Phương án được chọn

### 4.1. Định nghĩa “đang xem”

Một phiên chỉ được tính là đang xem khi đồng thời thỏa mãn:

- người dùng đang chọn đúng tab Chênh áp trong BMS;
- trang web có `document.visibilityState === "visible"`;
- heartbeat của phiên còn mới trong 90 giây.

Khi người dùng chuyển sang tab BMS khác, chuyển sang tab trình duyệt khác, thu nhỏ trình duyệt, khóa màn hình hoặc đưa ứng dụng xuống nền, client dừng heartbeat ngay và gửi lệnh kết thúc phiên theo kiểu best effort. Phía máy chủ không phụ thuộc vào lệnh kết thúc: heartbeat hết hạn sau tối đa 90 giây, nên ứng dụng bị tắt hoặc treo cũng không giữ FMS chạy mãi.

Giới hạn của Web Visibility API: nếu cửa sổ chỉ bị một cửa sổ khác che lên nhưng trình duyệt vẫn coi trang là `visible`, phiên vẫn được tính là đang xem. Không dùng camera, theo dõi chuột hoặc cơ chế xâm phạm riêng tư để đo người dùng có nhìn màn hình hay không.

### 4.2. Heartbeat người xem

Mỗi lần component tab Chênh áp hoạt động và trang visible, client tạo một `viewer_id` ngẫu nhiên cho phiên và gọi RPC heartbeat ngay, sau đó mỗi 30 giây. RPC chỉ cập nhật trạng thái Supabase; nó không gọi FMS.

Trạng thái người xem nằm trong một bảng điều phối, chỉ truy cập qua RPC giới hạn quyền và cơ chế xác thực/ủy quyền hiện có của BMS. Client không được ghi trực tiếp vào bảng. Các hàng hết hạn được bỏ qua khi kiểm tra và được dọn định kỳ. Không lưu nội dung nhạy cảm hoặc thông tin nhận dạng người dùng trong bảng này.

### 4.3. Tải ngay khi mở tab

Sau heartbeat đầu tiên, client gọi Edge Function một lần để yêu cầu tải ngay. Edge Function thực hiện theo thứ tự:

1. Xác nhận có ít nhất một heartbeat còn hiệu lực.
2. Kiểm tra freshness guard: nếu một lượt thành công đã hoàn tất trong 45 giây gần nhất, trả `SKIPPED_FRESH` và không gọi FMS.
3. Claim lease dùng chung; nếu lượt khác đang chạy, trả `SKIPPED_LOCKED`.
4. Nếu được phép, gọi FMS và ghi dữ liệu.

Nhờ freshness guard và lease, nhiều người mở tab cùng lúc chỉ tạo một lượt thực sự chạm FMS.

### 4.4. Cập nhật mỗi phút khi còn người xem

Cron Supabase phát trigger mỗi phút, cả ngày. Trước khi gọi FMS, đường server kiểm tra có heartbeat người xem còn hiệu lực:

- không có người xem: trả `SKIPPED_NO_VIEWER`, không đăng nhập và không gọi bất kỳ API FMS nào;
- có người xem: đi qua freshness guard, lease và thực hiện tối đa một lượt thu thập.

Cron/Edge có thể vẫn tạo một request nội bộ Supabase mỗi phút khi không ai xem, nhưng số request tới FMS từ đường chênh áp thời gian gần thực bằng 0. Workflow n8n theo giờ vẫn hoạt động độc lập.

### 4.5. Cửa sổ dữ liệu 10 phút

Khi bắt đầu một phiên xem sau thời gian ngừng, `fromDate` không được sớm hơn `now - 10 phút`. Mỗi phòng chỉ nhận một request API với khoảng thời gian 10 phút; không tạo 10 request riêng cho 10 mẫu.

Mọi record FMS trả về trong khoảng này được ánh xạ thành từng row riêng và upsert theo timestamp. Ví dụ 10 mẫu cách nhau một phút phải tạo đủ 10 row, không chỉ giữ mẫu cuối và không tạo một giá trị trung bình 10 phút.

Trong khi phiên xem tiếp tục, mốc lấy tiếp là điểm mới nhất đã lưu nhưng vẫn bị chặn bởi cửa sổ 10 phút. Vì vậy lỗi ngắn có thể chèn bù, còn backlog cũ không tạo payload lớn làm FMS quá tải.

### 4.6. Giới hạn đồng thời và khóa một-lượt

Số phòng gọi song song giảm từ sáu xuống ba.

Một migration tạo trạng thái điều phối singleton và RPC nguyên tử:

- `claim`: chỉ cấp token khi có người xem, dữ liệu chưa đủ mới, không có lease còn hiệu lực và không trong cooldown;
- `finish`: chỉ token sở hữu lease được ghi kết quả, giải phóng lease và cập nhật trạng thái.

Lease có hạn 90 giây và được giải phóng ngay khi lượt chạy kết thúc. Nếu lượt trước bị treo, lượt phút tiếp theo không được chạm FMS cho đến khi lease hết hạn.

### 4.7. Backoff khi FMS lỗi

- Một lỗi: kết thúc lượt, không retry ngay; chờ trigger phút sau.
- Hai lỗi liên tiếp: cooldown 5 phút.
- Bốn lỗi liên tiếp: cooldown 15 phút.
- Một lượt thành công: xóa bộ đếm lỗi và cooldown.
- `SKIPPED_NO_VIEWER`, `SKIPPED_FRESH` và `SKIPPED_LOCKED` không tính là lỗi.

Lỗi đăng nhập, lỗi danh sách phòng hoặc ít nhất 20% request phòng thất bại được tính là một lượt lỗi. Tỷ lệ thấp hơn ghi trạng thái `DEGRADED`, giữ dữ liệu phòng thành công và không retry tức thì.

### 4.8. Hiển thị trên tab

Tab Chênh áp:

- hiển thị trạng thái “Đang tải 10 phút gần nhất” khi bắt đầu phiên;
- nhận dữ liệu qua Supabase Realtime, gom burst trong 1,2 giây;
- đọc RPC Supabase dự phòng mỗi 60 giây khi tab visible;
- dùng đồng hồ cục bộ 10 giây cho nhãn tuổi, không gọi mạng;
- cảnh báo vàng nếu mẫu mới nhất cũ hơn 3 phút;
- cảnh báo đỏ nếu cũ hơn 7 phút;
- không có nút hoặc timer nào cho phép bỏ qua freshness guard/lease.

Khi trang bị ẩn, tab giữ số cuối để hiển thị nhanh nhưng không tiếp tục heartbeat hoặc yêu cầu FMS. Khi visible trở lại, client mở lại phiên, tải tối đa 10 phút gần nhất và tiếp tục cập nhật mỗi phút.

## 5. Luồng dữ liệu

```text
Mở + visible tab Chênh áp
        │
        ├─ heartbeat Supabase ngay, rồi mỗi 30 giây
        └─ yêu cầu tải ngay
                 │
                 ├─ không có viewer / dữ liệu <45 giây / đang khóa ─> bỏ qua FMS
                 └─ claim thành công
                        ├─ lấy tối đa 10 phút gần nhất
                        ├─ tối đa 3 phòng song song
                        ├─ mỗi mẫu phút thành một row Supabase
                        └─ finish lease

Cron mỗi phút ── có viewer còn hạn? ── không ─> 0 request FMS
                       │
                       có
                       └─ cùng freshness guard + lease ở trên

Supabase table ── Realtime 1,2 giây ──> Tab Chênh áp

Ẩn/đóng tab ── dừng heartbeat ──> hết hạn tối đa 90 giây ──> dừng FMS
```

## 6. Thành phần và tệp dự kiến thay đổi

- `web/src/features/pressure/ChenhApTheoAhu.jsx`
  - kết hợp prop `active` với Page Visibility API;
  - quản lý vòng đời heartbeat 30 giây;
  - yêu cầu tải ngay khi phiên chuyển từ inactive sang active;
  - bỏ timer FMS 180 giây;
  - giữ Realtime và đổi fallback RPC thành 60 giây;
  - thêm trạng thái tải 10 phút, hidden và độ tươi.
- `web/src/lib/supabaseData.js`
  - thêm wrapper RPC bắt đầu/touch/kết thúc phiên xem;
  - giữ lời gọi Edge chỉ cho yêu cầu tải ngay có kiểm soát;
  - không cung cấp đường bypass freshness guard/lease.
- `supabase/functions/capnhat-phut-8h/index.ts`
  - kiểm tra viewer, freshness, lease và cooldown trước FMS;
  - chặn `fromDate` ở 10 phút gần nhất;
  - giảm batch đồng thời từ sáu xuống ba;
  - giữ một record FMS thành một row;
  - trả trạng thái skip/degraded/error quan sát được.
- migration Supabase mới
  - tạo bảng/RPC heartbeat người xem;
  - tạo lease/backoff/freshness state và RPC nguyên tử;
  - giữ trigger mỗi phút nhưng cho phép hoạt động cả ngày;
  - bảo đảm đường server bỏ qua FMS khi không có viewer.
- test mới cho visibility, heartbeat TTL, đa người xem, cửa sổ 10 phút, timer phút, concurrency và lease.

Nguồn Edge Function đầy đủ hiện có trong backup local nhưng không có trong cây `origin/main`. Khi triển khai phải đưa đúng nguồn đã kiểm chứng vào nhánh bằng commit rõ ràng; không lấy nguồn từ production một cách ngầm định.

## 7. Phụ thuộc và trạng thái dùng chung

- Trạng thái viewer, freshness, lease và backoff phải nằm trong PostgreSQL, không nằm trong RAM Edge vì nhiều instance có thể chạy song song.
- Các RPC cập nhật trạng thái phải nguyên tử và không mở quyền ghi bảng trực tiếp cho client.
- Supabase Realtime và RPC đọc chênh áp giữ nguyên shape dữ liệu hiện tại.
- Không đổi khóa chính/schema bảng dữ liệu phút trong phạm vi này.
- n8n WF1 theo giờ và WF1b lấp lỗ giữ nguyên.

## 8. Chiến lược TDD và bằng chứng RED/GREEN

### RED trước khi sửa

1. Test mở tab visible yêu cầu heartbeat ngay và một yêu cầu tải ngay.
2. Test hidden/minimized yêu cầu dừng heartbeat và không yêu cầu FMS; hiện tại sẽ thất bại.
3. Test viewer bị mất kết nối yêu cầu server coi là inactive sau 90 giây.
4. Test một, năm và 20 viewer yêu cầu tối đa một lượt FMS/phút.
5. Test không có viewer yêu cầu số request FMS bằng 0.
6. Test cửa sổ yêu cầu `fromDate >= now - 10 phút`.
7. Test 10 mẫu phút yêu cầu 10 row riêng.
8. Test Edge yêu cầu tối đa ba request phòng đồng thời.
9. Test hai claim đồng thời yêu cầu chỉ một claim thành công.

### GREEN tối thiểu

- Sửa đúng phần cần thiết để các test trên qua.
- Chạy regression, UI quality checks và build bằng Node `>=20.19`.
- Không sửa n8n hoặc production trong bước GREEN.

## 9. Tiêu chí chấp nhận

- Không có viewer còn hạn: 0 request tới FMS từ đường chênh áp thời gian gần thực; n8n theo giờ không thuộc chỉ số này.
- Mở tab visible: bắt đầu tải ngay sau heartbeat đầu tiên và lấy không quá 10 phút.
- Khi còn viewer: có tối đa một lượt FMS mỗi phút.
- Mở 1, 5 hoặc 20 tab không làm tăng số lượt FMS.
- Ẩn/thu nhỏ/khóa màn hình: ngừng heartbeat ngay và dừng FMS trong tối đa 90 giây.
- Quay lại visible: tải lại tối đa 10 phút rồi tiếp tục mỗi phút.
- Hoạt động theo nhu cầu cả ngoài 05:00–21:00.
- Không có quá ba request phòng FMS đồng thời.
- 10 mẫu FMS cách nhau một phút tạo đủ 10 row Supabase.
- Khi khỏe, tab thường có tuổi dữ liệu không quá 2 phút; trên 3 phút cảnh báo vàng, trên 7 phút cảnh báo đỏ.
- Backoff bảo vệ FMS đúng theo ngưỡng lỗi đã thiết kế.

## 10. Tác động tải dự kiến

- Không ai xem: đường chênh áp thời gian gần thực giảm từ khoảng 3.420 request phòng/giờ xuống 0; tải n8n theo giờ vẫn giữ nguyên.
- Ít nhất một người xem liên tục: trần khoảng 3.420 request phòng/giờ, không phụ thuộc số người.
- So với hiện trạng một tab: giảm khoảng 25%, từ 4.560 xuống 3.420 request phòng/giờ.
- So với hiện trạng năm tab: giảm khoảng 62,5%, từ 9.120 xuống 3.420 request phòng/giờ.
- Mức đồng thời giảm 50%, từ sáu xuống ba phòng.
- Lần lấy 10 phút tạo khoảng một request/phòng, không phải 10 request/phòng.

Nếu một viewer giữ tab visible 24/7 và 3.420 request phòng/giờ vẫn vượt khả năng FMS, không thể giảm thêm số request mà vẫn bảo đảm mọi phòng cập nhật mỗi phút với API per-room hiện tại. Khi đó cần API batch/push từ FMS hoặc thay đổi yêu cầu tần suất.

## 11. Trình tự triển khai đề xuất

Chỉ thực hiện khi có ủy quyền thay đổi production:

1. Áp dụng migration viewer/lease/backoff nhưng chưa bật gate.
2. Deploy web có heartbeat/visibility tương thích ngược.
3. Deploy Edge có viewer gate, freshness, lease, cửa sổ 10 phút và concurrency ba.
4. Cập nhật cron để chạy cả ngày nhưng chỉ gọi FMS khi có viewer.
5. Theo dõi 24–48 giờ: RAM/CPU FMS, request/phút, viewer active, lượt skip, lỗi API, tuổi và số điểm dữ liệu.

Review checkpoint sau từng bước: xác nhận không tăng request FMS, nhiều viewer không nhân tải và hidden viewer hết hạn đúng thời gian.

## 12. Rollback

- Nếu web heartbeat lỗi, rollback riêng web và tạm dừng đường tải theo viewer; không bật lại polling FMS không khóa từ client.
- Nếu Edge viewer gate lỗi, tạm dừng cron trước khi rollback Edge để tránh gọi FMS nền ngoài ý muốn.
- Nếu lease lỗi, tạm dừng cron trước khi rollback migration.
- Rollback UI không ảnh hưởng dữ liệu FMS gốc.
- Mọi thay đổi làm chậm hơn một phút hoặc bật thu thập nền phải là quyết định vận hành riêng.

## 13. Xác minh cuối cùng

1. Chạy unit/integration tests với fake timers, fake visibility và fake FMS.
2. Chạy test TTL 90 giây khi đóng, hidden, mất mạng và kill ứng dụng.
3. Chạy mô phỏng 20 viewer, xác nhận tối đa một lượt FMS/phút.
4. Chạy test 0 viewer, xác nhận 0 request FMS.
5. Chạy test khoảng 10 phút và đối chiếu đủ từng row phút.
6. Chạy test claim/cooldown trên database local/test.
7. Chạy build/quality checks web bằng Node phù hợp.
8. Nhờ reviewer độc lập kiểm tra migration, quyền RPC, concurrency, visibility và rollback.
9. Primary agent đọc mọi diff và chạy lại toàn bộ kiểm tra sau review.
