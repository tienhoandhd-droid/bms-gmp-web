# Thiết kế giảm tải FMS cho dữ liệu chênh áp

**Ngày:** 2026-08-27

**Trạng thái:** Chờ người dùng duyệt đặc tả

**Phạm vi:** Tab Chênh áp, Edge Function `capnhat-phut-8h`, lịch thu thập Supabase

## 1. Bối cảnh và bằng chứng

FMS thực tế lưu một mẫu chênh áp mỗi phút. BMS hiện có hai đường cùng kích hoạt việc đọc FMS:

1. Cron phía Supabase chạy mỗi phút.
2. Mỗi trình duyệt đang mở tab Chênh áp gọi lại Edge Function ngay khi mở tab và mỗi 180 giây.

Mỗi lượt Edge Function đăng nhập FMS, lấy danh sách phòng và gọi API dữ liệu cho khoảng 57 phòng, hiện chạy sáu phòng song song. Vì vậy:

- cron một phút tạo khoảng `60 × 57 = 3.420` lượt gọi API phòng mỗi giờ, chưa tính đăng nhập và lấy danh sách phòng;
- mỗi trình duyệt mở tab tạo thêm khoảng `20 × 57 = 1.140` lượt gọi API phòng mỗi giờ;
- số lượt gọi tăng theo số người mở tab, làm FMS quá tải RAM và cuối cùng ngừng trả API;
- workflow n8n chính chỉ chạy mỗi giờ và workflow lấp lỗ chỉ chạy có điều kiện, nên không phải nguồn tải lớn nhất.

Dữ liệu sản xuất đã kiểm tra cho thấy FMS có mẫu cách nhau 60 giây. Edge Function lấy tất cả điểm mới hơn mốc đã lưu và upsert từng điểm. Về lưu trữ có thể quét thưa hơn mà không mất mẫu, nhưng yêu cầu vận hành là mẫu mới phải xuất hiện trên tab mỗi phút, nên cron trung tâm phải giữ nhịp một phút.

Nhịp một phút giữ tải cơ sở khoảng 3.420 request phòng mỗi giờ. Thiết kế này không tuyên bố giảm tải cơ sở đó; nó bảo vệ FMS bằng cách xóa phần tải nhân theo số trình duyệt, giảm số request đồng thời và ngăn chạy chồng/retry dồn.

## 2. Mục tiêu

- Giảm mạnh số kết nối và mức song song vào máy chủ FMS.
- Trong điều kiện FMS khỏe, chạy một lượt thu thập mỗi phút và đưa mẫu mới lên tab ngay khi Supabase ghi xong.
- Trong vận hành bình thường, giữ nguyên từng mẫu một phút do FMS trả về; không lấy trung bình, không bỏ bớt điểm.
- Xóa hệ số nhân tải theo số trình duyệt/người dùng.
- Không cho hai lượt thu thập FMS chạy chồng nhau.
- Tab Chênh áp vẫn cập nhật nhanh từ Supabase Realtime và thể hiện rõ độ tươi của dữ liệu.
- Có cơ chế phục hồi có kiểm soát sau lỗi, không tạo “bão retry”.

## 3. Ngoài phạm vi

- Không thay đổi tần suất ghi một phút bên trong FMS.
- Không giảm yêu cầu cập nhật một phút trong điều kiện FMS hoạt động bình thường. Việc bảo vệ FMS phải dựa vào loại bỏ polling từ client, giới hạn đồng thời, khóa và backoff khi lỗi.
- Không triển khai, push, merge hoặc thay đổi hệ sản xuất trong công việc này nếu chưa có lệnh rõ ràng của người dùng.
- Không thiết kế lại các workflow n8n thu thập theo giờ.

## 4. Phương án được chọn

### 4.1. Chỉ máy chủ trung tâm được kích hoạt FMS

Cron Supabase là chủ sở hữu duy nhất của luồng thu thập chênh áp thời gian gần thực. Lịch giữ nguyên mỗi phút và giữ giới hạn giờ vận hành 05:00–21:00 hiện có.

Tab Chênh áp sẽ:

- chỉ đọc dữ liệu đã lưu trong Supabase;
- bỏ gọi Edge Function khi mở tab;
- bỏ bộ hẹn giờ gọi Edge Function mỗi 180 giây;
- giữ Supabase Realtime, gom sự kiện trong 1,2 giây;
- đổi nhịp đọc RPC dự phòng từ 20 giây thành 60 giây và chỉ chạy khi tab đang mở/đang hoạt động;
- giữ đồng hồ cục bộ 10 giây để nhãn tuổi dữ liệu tự tăng; đồng hồ này không gọi mạng.

Kết quả là dù có một hay nhiều người mở tab, số lượt gọi FMS không thay đổi.

### 4.2. Mỗi phút quét một lần và không mất mẫu khi chèn bù

Mốc `fromDate` tiếp tục lấy từ điểm cuối đã lưu. Một response FMS có các mẫu phút chưa lưu sẽ được ánh xạ thành từng hàng riêng và upsert theo khóa thời gian hiện có.

Trong điều kiện khỏe, mỗi lượt quét nhận và ghi mẫu phút mới nhất. Nếu API lỗi ngắn rồi phục hồi, ví dụ FMS trả các mẫu còn thiếu lúc 10:01, 10:02, 10:03, 10:04 và 10:05, lượt phục hồi phải ghi đủ năm hàng. Không tạo một hàng trung bình nhiều phút và không chỉ giữ hàng cuối.

Khi hệ thống lỗi ngắn và phục hồi trong cửa sổ lấy lại hiện có (30 phút), lần chạy sau phải chèn bù toàn bộ mẫu phút còn thiếu. Sự cố kéo dài quá cửa sổ này sẽ được báo là lỗ dữ liệu và xử lý bằng quy trình backfill riêng; Edge Function không được tự kéo một backlog không giới hạn vì có thể làm FMS quá tải trở lại.

### 4.3. Giới hạn đồng thời và khóa một-lượt

Số phòng gọi song song giảm từ sáu xuống ba. Đây là mức khởi đầu thận trọng; chỉ tăng sau khi có số đo tài nguyên FMS chứng minh an toàn.

Một migration tạo trạng thái điều phối singleton và hai RPC nguyên tử:

- `claim`: chỉ cấp một token chạy khi không có lease còn hiệu lực và không trong thời gian cooldown;
- `finish`: chỉ token đang sở hữu lease được ghi kết quả, giải phóng lease và cập nhật trạng thái lỗi/thành công.

Lease dự kiến 90 giây và được giải phóng ngay khi lượt chạy kết thúc. Edge Function phải claim trước lần gọi FMS đầu tiên. Nếu lượt phút trước chưa xong hoặc bị treo, lượt mới trả thành công mềm với trạng thái `SKIPPED_LOCKED` và tuyệt đối không đăng nhập/gọi API FMS. Token ngăn một lượt cũ ghi đè trạng thái của lượt mới.

### 4.4. Backoff sau lỗi

- Một lỗi: kết thúc lượt hiện tại, chờ lịch phút kế tiếp.
- Hai lỗi liên tiếp: đặt cooldown 5 phút.
- Bốn lỗi liên tiếp: tăng cooldown lên 15 phút.
- Một lượt thành công: xóa bộ đếm lỗi và cooldown.
- Lượt bị khóa/cooldown không được coi là lỗi mới và không được gọi FMS.

Các phòng lỗi riêng lẻ được ghi nhận trong kết quả; không retry tức thì trong cùng lượt. Điều này ưu tiên bảo vệ FMS hơn độ tươi tức thời.

Lỗi đăng nhập, lỗi lấy danh sách phòng hoặc ít nhất 20% request phòng thất bại được tính là một lượt lỗi để kích hoạt backoff. Tỷ lệ lỗi thấp hơn được ghi là `DEGRADED`, không retry ngay và vẫn lưu các phòng thành công.

### 4.5. Hiển thị độ tươi trên tab Chênh áp

Tab hiển thị:

- chu kỳ thu thập trung tâm: 1 phút;
- thời điểm mẫu FMS mới nhất;
- tuổi dữ liệu tự tăng tại trình duyệt;
- cảnh báo vàng khi mẫu mới nhất cũ hơn 3 phút;
- cảnh báo đỏ khi cũ hơn 7 phút.

Không cung cấp nút “quét FMS ngay” trên tab, vì nút này tái tạo đúng đường tải gây sự cố. Nút làm mới, nếu có, chỉ đọc lại Supabase.

## 5. Luồng dữ liệu sau thay đổi

```text
Cron Supabase (mỗi 1 phút)
        │
        ├─ claim lease ── không được cấp ──> kết thúc, không gọi FMS
        │
        └─ được cấp
             ├─ đăng nhập + lấy danh sách FMS
             ├─ đọc tối đa 3 phòng song song
             ├─ giữ từng mẫu 1 phút và upsert Supabase
             └─ finish: thành công hoặc lỗi/backoff

Supabase table ── Realtime 1,2 giây ──> Tab Chênh áp
        └──────── RPC dự phòng 60 giây ─> Tab Chênh áp
```

## 6. Thành phần và tệp dự kiến thay đổi

- `web/src/features/pressure/ChenhApTheoAhu.jsx`
  - bỏ mọi lệnh kích hoạt Edge/FMS từ trình duyệt;
  - đổi fallback RPC thành 60 giây;
  - cập nhật nhãn chu kỳ và ngưỡng độ tươi.
- `web/src/lib/supabaseData.js`
  - gỡ API client không còn được tab sử dụng hoặc giữ private nếu có người dùng hợp lệ khác; quyết định dựa trên kiểm tra tham chiếu trước khi sửa.
- `supabase/functions/capnhat-phut-8h/index.ts`
  - claim/finish lease;
  - giảm batch đồng thời xuống ba;
  - giữ ánh xạ một record FMS thành một row;
  - trả trạng thái quan sát được cho khóa/cooldown/lỗi phòng.
- migration Supabase mới
  - tạo trạng thái lease/backoff và RPC nguyên tử;
  - xác nhận lịch `bms-phut-8h` tiếp tục là `* * * * *`;
  - giữ kiểm tra khung giờ hiện tại.
- test mới cho timer UI, ánh xạ mẫu phút, giới hạn đồng thời và lease.

`supabase/functions/capnhat-phut-8h/index.ts` hiện có trong bản backup local nhưng không có trong cây GitHub `origin/main`. Khi triển khai phải đưa đúng nguồn đã kiểm chứng vào nhánh bằng một commit rõ ràng; không lấy lại nguồn từ hệ sản xuất một cách ngầm định.

## 7. Phụ thuộc và trạng thái dùng chung

- Supabase Realtime và RPC đọc chênh áp phải tiếp tục tương thích với shape dữ liệu hiện tại.
- Lease/backoff là trạng thái dùng chung duy nhất giữa cron và mọi lời gọi Edge Function; cập nhật phải nguyên tử tại PostgreSQL.
- Khóa không được nằm trong bộ nhớ Edge Function vì nhiều instance có thể chạy song song.
- Không đổi schema/khóa chính của bảng dữ liệu phút trong phạm vi này.
- n8n WF1 theo giờ và WF1b lấp lỗ giữ nguyên; theo dõi để bảo đảm chúng không vô tình chạy dày hơn.

## 8. Chiến lược TDD và bằng chứng RED/GREEN

### RED trước khi sửa

1. Test UI chứng minh mở tab hiện gọi Edge ngay và gọi lại sau 180 giây; test mới yêu cầu số lần gọi Edge bằng 0 sẽ thất bại.
2. Test timer yêu cầu RPC dự phòng chạy sau 60 giây sẽ thất bại với cấu hình 20 giây hiện tại.
3. Test Edge yêu cầu tối đa ba request phòng đồng thời sẽ thất bại với batch sáu hiện tại.
4. Test lease với hai claim đồng thời yêu cầu chỉ một claim thành công sẽ thất bại khi chưa có migration/RPC.
5. Test bảo toàn độ phân giải đưa năm mẫu phút vào parser và yêu cầu năm row riêng; đây là regression guard bắt buộc dù hành vi hiện tại có thể đã đúng.

### GREEN tối thiểu

- Sửa đúng phần cần thiết để toàn bộ test trên qua.
- Chạy lại test hiện hữu, kiểm tra chất lượng UI và build bằng Node tương thích `>=20.19`.
- Không sửa n8n hoặc dữ liệu sản xuất trong bước GREEN.

## 9. Tiêu chí chấp nhận

- Mở 1, 5 hoặc 20 tab Chênh áp không tạo thêm bất kỳ request FMS nào.
- Cron phát 60 trigger mỗi giờ trong khung vận hành; khi FMS khỏe và không có lượt chạy chồng, có đúng một lượt thu thập thành công mỗi phút.
- Tải FMS từ tab trở thành trần cố định khoảng 3.420 request phòng mỗi giờ, không còn cộng thêm khoảng 1.140 request/giờ cho mỗi trình duyệt đang mở. So với hiện trạng có một tab, tổng request phòng giảm khoảng 25%; với năm tab, giảm khoảng 62,5%.
- Không có quá ba request phòng FMS đang chạy đồng thời.
- Hai lời gọi Edge đồng thời chỉ có một lời gọi được phép chạm FMS.
- Năm mẫu FMS còn thiếu, liên tiếp cách nhau một phút, tạo đủ năm row Supabase sau lượt phục hồi.
- Khi khỏe, tab nhận số mới mỗi phút và thường có tuổi dữ liệu không quá 2 phút; trên 3 phút có cảnh báo vàng, trên 7 phút có cảnh báo đỏ.
- Sau hai lỗi liên tiếp, không có request FMS mới trong 5 phút; sau bốn lỗi liên tiếp, cooldown tăng lên 15 phút.
- Build và regression checks qua trên Node phù hợp.

## 10. Trình tự triển khai đề xuất

Trình tự này chỉ được thực hiện sau khi người dùng duyệt và cho phép thay đổi hệ sản xuất:

1. Chạy migration tạo lease/backoff, chưa đổi cron.
2. Deploy Edge Function có khóa và giới hạn ba phòng song song.
3. Deploy web bỏ đường gọi FMS từ trình duyệt.
4. Xác nhận cron trung tâm vẫn chạy mỗi phút và chỉ có một đường kích hoạt FMS.
5. Theo dõi 24–48 giờ: RAM/CPU FMS, tỷ lệ lỗi API, tuổi dữ liệu, số điểm phút, số lượt bị khóa và lỗ dữ liệu.
6. Nếu FMS vẫn quá tải dù đã bỏ polling client và giảm đồng thời, dừng để đánh giá API/FMS; không tự ý giảm nhịp một phút hoặc tăng song song.

Review checkpoint bắt buộc sau từng bước: xác nhận số lời gọi FMS không tăng, lease hoạt động, và dữ liệu mới nhất vẫn chứa đủ các timestamp một phút.

## 11. Rollback

- Nếu Edge mới lỗi, rollback Edge về bản trước hoặc tạm dừng cron; không bật lại polling FMS từ trình duyệt.
- Nếu UI lỗi, rollback riêng web; việc thu thập trung tâm vẫn độc lập.
- Nếu lease lỗi, tạm dừng lịch thu thập trước khi rollback migration để tránh chạy chồng.
- Mọi thay đổi khẩn cấp làm chậm hơn một phút phải là quyết định vận hành riêng; không khôi phục gọi FMS từ client.
- Mọi rollback schema phải có migration đảo rõ ràng; không xóa bảng trạng thái trước khi lưu log cần điều tra.

## 12. Xác minh cuối cùng

Trước khi tuyên bố hoàn tất:

1. Chạy unit/integration tests với fake timers và fake FMS.
2. Chạy build/quality checks của web bằng Node `>=20.19`.
3. Chạy test claim đồng thời và test cooldown trên database local/test.
4. Chạy mô phỏng nhiều tab, xác nhận số request FMS vẫn bằng 0 từ client.
5. Chạy một lượt FMS giả có năm mẫu phút và đối chiếu đủ năm row đã upsert.
6. Nhờ reviewer độc lập kiểm tra diff, đặc biệt migration, khóa đồng thời và đường rollback.
7. Primary agent tự đọc mọi diff và chạy lại toàn bộ kiểm tra liên quan sau review.
