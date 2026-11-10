# Kịch bản trình bày đồ án Toyjoy

## 1. Chuẩn bị

Chạy PostgreSQL (`npm run db:setup`), API và UI (`npm run start:local`). Mở http://127.0.0.1:5173. Tài khoản admin và khách demo ở README. Không cần Gemini key để trình bày phần CSDL.

## 2. Thủ tục lưu và giao dịch thành công

1. Đăng nhập `hello@toyjoy.vn`.
2. Chọn một đồ chơi, thêm vào giỏ, đặt hàng với ví demo.
3. Xem đơn vừa tạo: mã đơn, trạng thái đã thanh toán, tổng tiền từ CSDL.
4. Xem ví: số dư giảm đúng tổng tiền. Tồn kho giảm đúng số lượng.
5. Đăng nhập admin → Phòng thực hành CSDL: đọc chữ ký `place_order` với IN và OUT.
6. Mở `server/index.mjs` để chỉ ra `CALL place_order(...)`; mở `server/db.mjs` để chỉ ra BEGIN, COMMIT, ROLLBACK.

Luồng: khóa khách và sản phẩm → kiểm tra stock/tiền → tạo orders → order_items → giảm stock → trừ wallet → payments → COMMIT. Giá do CSDL tính, không tin giá từ trình duyệt. Request key UNIQUE theo khách ngăn cùng một yêu cầu ghi đơn hai lần.

## 3. Hủy đơn và hoàn tiền

1. Vào Tài khoản → Đơn hàng của tôi → Hủy đơn vừa đặt.
2. Chỉ ra trạng thái Đã hủy, Đã hoàn tiền vào ví demo.
3. Tồn kho và số dư trở về ban đầu. `cancel_order` khóa bản ghi và kiểm tra trạng thái, gọi lặp không hoàn tiền thêm.
4. Đơn đang giao/hoàn tất bị từ chối hủy.

Ví nội bộ là mô phỏng; không có thanh toán ngân hàng. Với cổng thanh toán thật phải bổ sung webhook, idempotency và cơ chế bù trừ/hoàn tiền bên ngoài CSDL.

## 4. Sự cố và rollback

1. Admin → Phòng thực hành CSDL → Chạy demo rollback.
2. Màn hình cho thấy trước giao dịch, sau CALL nhưng trước lỗi, và sau ROLLBACK.
3. API cố tình chạy `SELECT 1/0` sau khi đã tạo đơn, giảm stock và chạy trigger.
4. So sánh số đơn, stock, wallet, audit và notifications: sau rollback trở về ban đầu. Demo ưu tiên ví khi đủ số dư, nếu không đủ thì dùng COD; với COD ví không bị trừ.
5. Giải thích số thứ tự identity không được rollback, nên đơn có thể nhảy số.

## 5. Trigger: cũ/mới, nhật ký và thông báo

1. Admin → Sản phẩm → sửa một sản phẩm, ghi lại giá cũ.
2. Giảm giá 10.000đ và đổi sort_order rồi lưu.
3. Nhật ký trigger: có UPDATE, người thực hiện, thời gian, OLD.price/NEW.price và OLD.sort_order/NEW.sort_order.
4. Tải lại cửa hàng: vị trí sản phẩm và giá đã đổi.
5. Mở Hộp thư bằng tài khoản khách: có thông báo giảm giá do trigger tạo.
6. Đổi stock từ trên 5 xuống <=5 để tạo thông báo chỉ dành cho admin.
7. Trình bày CHECK stock>=0 và FK; update cùng giá trị không tạo audit giả.

Thông báo chung dùng một bản ghi audience=all, mọi khách đọc được; trạng thái đã đọc lưu riêng từng người. Đây là thông báo trong website, không gửi email/SMS hàng loạt.

## 6. Index và đo hiệu năng

1. Admin → Phòng thực hành CSDL → Đo tốc độ thực tế.
2. Trình bày bảng tạm 200.000 sản phẩm, truy vấn tìm SKU cụ thể.
3. Trước index: Seq Scan; sau B-tree index: Index Scan (planner có thể chọn khác tùy DB).
4. Hiển thị thời gian trung vị 7 lần, giải thích warm cache và giới hạn phép đo.
5. Mở kế hoạch thực thi và xuất CSV; kết quả được lưu trong benchmark_results.

Không khẳng định mọi truy vấn đều nhanh bằng cùng một tỉ lệ. Index chiếm dung lượng và tăng chi phí INSERT/UPDATE.

## 7. Chatbot Gemini — trình bày bằng câu hỏi

1. Bấm **Hỏi Toyjoy** → “Bé 6 tuổi thích vũ trụ, dưới 500.000đ nên mua gì?”. Hỏi tiếp “Có món rẻ hơn không?” để minh họa ngữ cảnh nhiều lượt.
2. Chatbot đọc danh mục thật, ưu tiên ngữ cảnh embedding/cosine, gọi Gemini để trả lời và trả ID sản phẩm. API đối chiếu ID với catalog trước khi hiển thị thẻ mua hàng. Không có món phù hợp thì chatbot cần nói rõ.
3. Đăng nhập admin rồi hỏi “Khách nào thuộc nhóm cần chăm sóc?” hoặc “Cửa hàng đã thu bao nhiêu tiền?”. Máy chủ đọc lại PostgreSQL ở mỗi câu hỏi và trả lời theo quy tắc; chỉ admin được hỏi phân nhóm/doanh thu. Số liệu này và lịch sử trả lời nội bộ không được gửi đến Gemini. Câu trả lời ghi nhãn dữ liệu PostgreSQL.
4. Giải thích: chatbot là giao diện hỏi đáp dễ trình bày; tìm vector và RFM bên dưới vẫn giữ nguyên. RFM là quy tắc, không phải mô hình ML đã huấn luyện. Câu trả lời AI cần đối chiếu dữ liệu trên màn hình.

## 8. Khách hàng giao dịch và trao đổi với admin

API đang chạy → `npm run demo:transactions`. Script chỉ dùng 8 khách demo trong README, tạo dữ liệu qua các API nghiệp vụ và chống tạo trùng khi chạy lại.

| Tài khoản | Mật khẩu | Kịch bản |
| --- | --- | --- |
| hello@toyjoy.vn, demo1@toyjoy.vn | Toyjoy@123 | Đặt COD, admin nhận tin và xác nhận đã tiếp nhận |
| demo2@toyjoy.vn, demo3@toyjoy.vn | Toyjoy@123 | Thanh toán ví, admin chuyển đang giao |
| demo4@toyjoy.vn, demo5@toyjoy.vn | Toyjoy@123 | Thanh toán ví, admin giao rồi hoàn tất |
| demo6@toyjoy.vn, demo7@toyjoy.vn | Toyjoy@123 | Đặt bằng ví rồi hủy, tự hoàn ví và hoàn kho |

Mở hai cửa sổ có phiên đăng nhập riêng (ví dụ cửa sổ thường và riêng tư). Khách → Hỏi Toyjoy → Nhắn admin; admin@toyjoy.vn / Admin@12345 → Quản trị → Hộp thư khách hàng. Chọn khách, xem tin có mã đơn đính kèm và trả lời; quay lại khách chờ tối đa 5 giây để thấy tin. Dữ liệu lưu khi tải lại; khách khác không thấy hội thoại này. Thay đổi giao hàng trong mục Đơn hàng, rồi xem khách nhận thông báo. Đơn mới vẫn có thể tạo bằng giỏ hàng bình thường.

## 9. Tìm kiếm ngữ nghĩa

Chưa có key: AI & phân tích hiển thị Chờ API key. Tìm kiếm AI và chatbot báo chưa cấu hình, tìm từ khóa, hộp thư admin và mua hàng vẫn hoạt động.

Sau khi có key: điền GEMINI_API_KEY trong .env, khởi động lại API → Đồng bộ embedding → bật Tìm bằng AI → nhập “quà cho bé thích khám phá vũ trụ”. Giải thích embedding query và mô tả cùng model, xếp hạng cosine trong PostgreSQL, không dùng LIKE. So sánh vài câu diễn đạt khác nhau và ghi nhận mức phù hợp; chưa có key thì không tuyên bố đã đánh giá chất lượng tìm kiếm.

## 10. Phân tích bổ sung

Mục AI & phân tích có dự báo 7 ngày theo trung bình 28 ngày và phân nhóm RFM. Nói rõ đây là baseline thống kê/quy tắc, dữ liệu lịch sử giả lập; không gắn nhãn mô hình ML huấn luyện hay kết quả Gemini.

## Kiểm chứng tự động

`npm test`: test trong schema tạm, bao gồm hai khách mua cùng món cuối và lỗi sau khi tạo đơn bằng ví. `scripts/check-api.mjs`: kiểm tra 7 API quản trị, demo rollback và benchmark trên DB hiện tại.
