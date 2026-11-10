# Toyjoy — Website bán đồ chơi

Website tiếng Việt cho đồ án CSDL: giao diện React/Vinext, API Node.js/Express, PostgreSQL 18 và tích hợp Gemini Embedding API qua key cấu hình trong `.env`.

## Chạy bằng Docker trên máy mới (khuyên dùng)

Chỉ cần cài và mở **Docker Desktop** ở chế độ Linux containers; không cần cài Node.js hoặc PostgreSQL trên máy. Tải/clone toàn bộ dự án, mở terminal trong thư mục `toyjoy` có `compose.yaml`, rồi chạy:

```powershell
docker compose up -d --build
```

Mở **http://localhost:5173/** sau khi container `app` báo `healthy` trong `docker compose ps`. Lần đầu cần Internet để tải image và thư viện, build giao diện nên sẽ lâu hơn. Không cần tạo `.env` cho phần cửa hàng, đăng nhập, đặt hàng và quản trị.

Docker tự chạy PostgreSQL, áp dụng SQL, tạo tài khoản demo và 120 đơn lịch sử giả lập, nhập 64 sản phẩm cùng ảnh có sẵn rồi chạy giao diện/API bản production. Database được giữ trong volume `toyjoy_data`; khởi động lại không seed đè dữ liệu hay nhập lại danh mục đã có. Database Docker là bộ dữ liệu riêng, không tự sao chép đơn hàng, tin nhắn hay embedding từ PostgreSQL đang chạy trên máy tác giả. API và PostgreSQL chỉ kết nối nội bộ; cổng web được mở trên loopback của máy.

```powershell
docker compose ps           # Kiểm tra trạng thái
docker compose logs -f app  # Xem tiến trình khởi tạo hoặc lỗi
docker compose down         # Tắt, giữ dữ liệu
docker compose up -d         # Bật lại sau khi đã build
```

Chỉ khi muốn **xóa toàn bộ dữ liệu Docker và tạo lại demo**, chạy `docker compose down -v`, sau đó `docker compose up -d`. Mật khẩu database mặc định là `toyjoy-local-demo`, dành cho demo cục bộ. Có thể đặt `POSTGRES_PASSWORD` trong `.env` trước lần chạy đầu; nếu volume đã tồn tại, thay biến này không tự đổi mật khẩu trong PostgreSQL.

Để dùng chatbot/tìm kiếm AI, tạo `.env` chỉ với `GEMINI_API_KEY=khóa_của_bạn` (hoặc thêm dòng này vào `.env` đang có), chạy lại `docker compose up -d`, đăng nhập admin → **AI & phân tích → Đồng bộ embedding**. Key được truyền lúc chạy, không đóng gói vào image. Các biến `DATABASE_URL`, `PORT` và origin của chế độ Node cục bộ không được dùng để nối database Docker.

Nếu cổng 5173 đã được dùng, đặt `DOCKER_PORT=5174` trong `.env`, chạy lại `docker compose up -d` và mở **http://localhost:5174/**. Khi chia sẻ source, gửi các file đã lưu trong Git; không gửi `.env`, `.local` hay `node_modules` của máy bạn.

## Chạy trên máy hiện tại

Thư mục: `D:\CT221H_PROJECT\toyjoy`.

```powershell
cd D:\CT221H_PROJECT\toyjoy
npm run db:setup
npm run start:local
```

Mở **http://127.0.0.1:5173/**. API: `127.0.0.1:3001`; PostgreSQL riêng của dự án: `127.0.0.1:5433`.

`npm run dev` cũng khởi động cả hệ thống như `npm run start:local`. Lệnh chạy kiểm tra PostgreSQL và chờ API sẵn sàng trước khi mở giao diện; nếu cụm PostgreSQL riêng của dự án đang tắt, lệnh sẽ tự khởi động lại. `npm run dev:ui` chỉ dành cho phát triển giao diện khi API đã chạy riêng.

Chế độ phát triển cục bộ dùng runtime Node và Vite proxy cho `/api`, tránh phụ thuộc Worker khi đọc API localhost. Các yêu cầu đọc thông thường có giới hạn chờ 15 giây và hiển thị lỗi để thử lại; đồng bộ embedding có thời hạn riêng dài hơn. Build dành cho Sites vẫn giữ tích hợp Cloudflare.

Đã cài thư viện, tạo CSDL và nạp dữ liệu trên máy này. Danh mục hiện tại có 64 sản phẩm ảnh thật và đã đồng bộ 64/64 embedding. `db:setup` khởi động lại cụm PostgreSQL nếu cần. Dữ liệu nằm ở `.local/pgdata`, không đụng vào cụm PostgreSQL khác trên máy.

## Cài mới

Yêu cầu Node.js >=22.13, PostgreSQL 18. Trong PowerShell:

```powershell
npm ci
npm run db:setup
npm run db:migrate
npm run db:seed
npm run catalog:import
npm run start:local
```

`db:setup` mặc định tìm PostgreSQL ở `C:\Program Files\PostgreSQL\18\bin`, tạo mật khẩu ngẫu nhiên trong `.env`, dùng xác thực SCRAM và chỉ nghe loopback. Nếu vị trí khác, đặt `$env:PG_BIN` tới thư mục `bin`. Tệp `.env`, thư mục `.local` và dữ liệu runtime đã được loại khỏi Git.

Nếu dùng PostgreSQL có sẵn: sao chép `.env.example` thành `.env`, sửa `DATABASE_URL`, rồi chạy `db:migrate` và `db:seed`; bỏ qua `db:setup`. Muốn chạy toàn bộ bằng Docker, làm theo phần Docker ở đầu tài liệu. Seed chỉ chạy trên catalog trống để giữ dữ liệu đang có.

## Tài khoản demo

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Quản trị | admin@toyjoy.vn | Admin@12345 |
| Khách hàng | hello@toyjoy.vn | Toyjoy@123 |
| Khách hàng khác (7 tài khoản) | demo1@toyjoy.vn đến demo7@toyjoy.vn | Toyjoy@123 |

Sau khi đăng nhập admin, bấm biểu tượng **Tài khoản → Quản trị cửa hàng**. Các tài khoản demo có ví nội bộ 5.000.000đ để thử giao dịch; tài khoản tự đăng ký có số dư 0 và vẫn đặt COD được. Không có tiền thật hay cổng thanh toán bên ngoài.

## Chức năng

- Danh mục 64 món đồ chơi với ảnh chụp sản phẩm thật, có nguồn tham khảo, chi tiết sản phẩm, lọc theo danh mục/tuổi, sắp xếp, tìm từ khóa.
- Giỏ hàng và yêu thích lưu trên trình duyệt; đăng ký/đăng nhập; đặt COD hoặc ví demo; xem/hủy đơn; thông báo trong website.
- Quản trị sản phẩm, giá, tồn kho, độ tuổi, ẩn/hiện, thứ tự hiển thị; quản lý trạng thái giao hàng.
- Trang phòng thực hành CSDL: đọc thủ tục/trigger/index thực tế từ PostgreSQL, demo lỗi và rollback, benchmark và xuất CSV.
- Semantic search bằng Gemini embeddings; dự báo nhu cầu bằng trung bình 28 ngày và phân nhóm khách bằng quy tắc RFM có giải thích công thức.
- **Hỏi Toyjoy**: chatbot Gemini tư vấn theo danh mục, tuổi, ngân sách và ngữ cảnh hội thoại; hiển thị sản phẩm để thêm giỏ. Admin có thể hỏi số tiền đã thu, phân nhóm RFM và dự báo từ dữ liệu PostgreSQL.
- **Nhắn admin / Hộp thư khách hàng**: trao đổi hai chiều, đính kèm đơn hàng, tự cập nhật 5 giây, thông báo trong ứng dụng. Mỗi khách chỉ đọc được hội thoại và đơn của chính mình; gửi lại cùng mã yêu cầu không tạo tin trùng.

## Demo nhanh chatbot và giao dịch khách–admin

1. Chạy `npm run db:migrate` để thêm bảng tin nhắn, sau đó `npm run start:local`.
2. Bấm **Hỏi Toyjoy** ở góc dưới phải. Hỏi “Gợi ý đồ chơi cho bé 6 tuổi dưới 500.000đ”; chatbot gọi Gemini thật và chỉ hiển thị thẻ sản phẩm có trong danh mục. Cấu hình `GEMINI_CHAT_MODEL` mặc định là `gemini-2.5-flash`; cần `GEMINI_API_KEY` ở máy chủ.
3. Đăng nhập khách, chuyển sang **Nhắn admin**, chọn đơn liên quan rồi gửi tin. Mở cửa sổ riêng đăng nhập admin → **Hộp thư khách hàng** để trả lời. Thao tác giao/hoàn tất đơn nằm trong **Đơn hàng**.
4. Muốn tạo sẵn kịch bản cho 8 khách mẫu, khi API đang chạy: `npm run demo:transactions`. Lệnh tạo 8 đơn và 16 tin nhắn ghi rõ `[DEMO ĐỒ ÁN]`, qua API thật. Hai đơn COD chờ xác nhận, hai đơn ví đang giao, hai đơn ví hoàn tất, hai đơn hủy và hoàn ví. Chạy lại giữ nguyên các giao dịch đã tạo nhờ mã yêu cầu cố định; không đặt lại trạng thái của đơn đã được xử lý.

Đơn và ví trong kịch bản là dữ liệu minh họa; không giao hàng hoặc thanh toán thật. Lệnh demo làm thay đổi tồn kho, ví demo, nhật ký và thông báo trong CSDL cục bộ. Trên máy đã seed sẵn có thể chạy trực tiếp; máy mới cần thực hiện đầy đủ phần Cài mới trước.

Câu hỏi về đơn/ví được trả lời trực tiếp trên máy chủ từ phiên đăng nhập; câu hỏi doanh thu/RFM/dự báo chỉ admin được dùng và cũng được xử lý tại máy chủ. Các câu trả lời này có nhãn dữ liệu PostgreSQL, không gửi số liệu hoặc lịch sử trả lời nội bộ sang Gemini. Lịch sử chatbot chỉ nằm trong bộ nhớ giao diện và được xóa khi đổi tài khoản hoặc tải lại trang; tin nhắn khách–admin lưu trong PostgreSQL. Chỉ luồng tư vấn sản phẩm gửi câu hỏi, lịch sử tư vấn và danh mục công khai sang Gemini. Chatbot chỉ tư vấn; đặt/hủy đơn và nhắn admin vẫn cần thao tác qua giao diện.

## Đối chiếu đề bài

| Yêu cầu | Hiện thực | Vị trí demo |
| --- | --- | --- |
| Stored procedure, tham số IN/OUT | `place_order`, `cancel_order`, backend dùng `CALL`; tổng tiền lấy từ CSDL | Đặt hàng; quản trị → Phòng thực hành CSDL |
| Transaction, COMMIT/ROLLBACK | Đơn + chi tiết + stock + wallet + payment trong cùng giao dịch, khóa `FOR UPDATE`, request key chống tạo trùng | Đặt/hủy đơn; nút Chạy demo rollback |
| Trigger OLD/NEW | Audit sản phẩm/đơn, bỏ qua update không đổi giá trị; giá giảm tạo thông báo toàn bộ khách; stock thấp báo admin; sửa nội dung xóa embedding cũ | Sản phẩm → sửa giá hoặc sort_order → Nhật ký trigger; Hộp thư |
| Index và đo thời gian | Index B-tree thật trên SKU/category/price/sort/order FK; benchmark bảng tạm 200.000 dòng, 7 lần trước và sau index | Phòng thực hành CSDL → Đo tốc độ thực tế |
| Gemini semantic search | Embedding mô tả và query, cosine similarity trong SQL, không dùng LIKE trong luồng AI | AI & phân tích → đồng bộ embedding; cửa hàng → Tìm bằng AI |

SQL được cài bằng `db/001_schema.sql`. API sử dụng chính các thủ tục này, không chỉ trưng bày mã SQL.

## Thêm Gemini API key sau

Trong `.env`:

```dotenv
GEMINI_API_KEY=YOUR_KEY_HERE
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_CHAT_MODEL=gemini-2.5-flash
```

1. Khởi động lại API sau khi sửa `.env`.
2. Đăng nhập admin → **AI & phân tích** → **Đồng bộ embedding**.
3. Trở lại cửa hàng, bật **Tìm bằng AI**, nhập “quà cho bé thích khám phá vũ trụ” và tìm kiếm.

Key chỉ gửi từ máy chủ đến Google bằng header `x-goog-api-key`; không lưu trong trình duyệt hay trả về API. API có timeout và xử lý lỗi/hạn mức. Chưa có key thì trả trạng thái 503 rõ ràng; không giả lập kết quả AI hoặc âm thầm thay bằng LIKE. Đổi model cần đồng bộ embedding lại.

Embedding lưu bằng `double precision[]` và xếp hạng cosine chính xác, không cần cài pgvector trên Windows. Với danh mục lớn hơn, có thể chuyển sang pgvector/HNSW. Chỉ mục trong phần benchmark là B-tree cho nghiệp vụ tra SKU, độc lập với tìm vector.

Tài liệu Gemini: https://ai.google.dev/gemini-api/docs/embeddings

API chatbot: [Gemini GenerateContent](https://ai.google.dev/api/generate-content). Khi không có khóa hoặc Gemini lỗi/hết hạn mức, chatbot hiển thị lỗi rõ ràng; hộp thư admin và luồng mua hàng vẫn hoạt động.

## Dự báo và phân nhóm

- Dự báo 7 ngày: lượng bán trong 28 ngày lịch đầy đủ trước hôm nay / 28 × 7, làm tròn lên. Chỉ tính đơn paid/shipping/completed; không tính pending/cancelled.
- RFM: số ngày từ lần mua gần nhất, số đơn và tổng giá trị mua. Không có đơn → mới; hơn 30 ngày → cần chăm sóc; ít nhất 3 đơn và 2 triệu đồng → thân thiết; còn lại → tiềm năng.
- Đây là baseline thống kê và quy tắc nghiệp vụ, **chưa phải mô hình ML huấn luyện** và không gọi Gemini để tự bịa số liệu. AI chính theo đề là tìm kiếm ngữ nghĩa; việc đánh giá chất lượng Gemini phải chờ key.
- 120 đơn lịch sử và 8 khách hàng ban đầu đều là dữ liệu giả lập, không phải dữ liệu kinh doanh thật.

## Kiểm tra

Khởi động API và PostgreSQL trước khi chạy:

```powershell
npm run typecheck
npm test
node --env-file=.env scripts/check-api.mjs
npm run build
```

Các test CSDL chạy trong schema tạm riêng rồi tự dọn schema đó: mua bằng ví, idempotency, hoàn ví một lần, rollback cả trigger, mua đồng thời không vượt stock, ràng buộc, OLD/NEW và cosine. HTTP tests kiểm tra quyền admin, origin và trạng thái chưa cấu hình Gemini. `check-api` kiểm tra các API quản trị, chạy rollback và lưu một kết quả benchmark vào CSDL; báo cáo ở `outputs/verification.json`.

Benchmark lấy trung vị 7 lần sau warm-up, cùng dữ liệu và cùng truy vấn. Kết quả thực tế phụ thuộc phần cứng, cache và planner; không dùng số cố định trong UI. Bảng benchmark là TEMP riêng mỗi kết nối, không xóa index nghiệp vụ. Sequence/identity có thể bị nhảy số sau rollback — đó là hành vi bình thường của PostgreSQL.

## Cấu trúc

```text
app/                       Layout, trang cửa hàng, route proxy /api
components/shop.tsx        Giao diện khách hàng
components/admin.tsx       Quản trị và demo đề bài
components/toy-art.tsx     Minh họa đồ chơi bằng SVG
components/toyjoy.css      Giao diện responsive
server/index.mjs           API, phân quyền, benchmark và phân tích
server/db.mjs              Pool PostgreSQL và transaction wrapper
server/auth.mjs            Scrypt, session cookie HttpOnly
server/gemini.mjs          Embedding API và đồng bộ dữ liệu
server/chat.mjs            Gemini tư vấn sản phẩm; hỏi đơn/số liệu nội bộ xử lý tại máy chủ
server/support.mjs         API tin nhắn khách–admin và kiểm tra quyền sở hữu đơn
components/chat.tsx        Chatbot, nhắn admin và hộp thư quản trị
db/001_schema.sql          Schema, CHECK/FK, procedure, trigger, index
db/003_support.sql         Tin nhắn, khóa ngoại và mã chống gửi trùng
scripts/                   Cài DB, migrate, seed, chạy app và kiểm tra
tests/                     Kiểm thử PostgreSQL và HTTP
docs/DEMO.md               Kịch bản trình bày đồ án
```

## Triển khai

Chạy bản build trên máy chủ Node: `npm run build`, sau đó `npm start` (UI và API cùng chạy). Dùng reverse proxy HTTPS ở phía trước khi đưa ra Internet. `FRONTEND_PORT` có thể đổi cổng UI bản production; `PORT` trong `.env` là cổng API. Các giá trị origin phải khớp địa chỉ thực tế.

Bản hiện tại chạy **cục bộ** với PostgreSQL và Node API thật. Chưa xuất bản Sites: môi trường Sites chạy Cloudflare Workers không phù hợp để truy cập cụm PostgreSQL loopback trên máy bạn. Để triển khai đầy đủ, cần máy chủ chạy Node/PostgreSQL, hoặc API có HTTPS và CSDL được cấp kết nối; đặt `API_ORIGIN`, `APP_ORIGIN` đúng domain và `COOKIE_SECURE=true` khi dùng HTTPS. Đổi mật khẩu tài khoản mẫu trước khi mở ra Internet.

Thông báo hiện ở trong ứng dụng; chưa kết nối email/SMS, cổng thanh toán hay đơn vị vận chuyển. Đăng nhập dùng mật khẩu scrypt có salt và session token băm trong DB, cookie HttpOnly/SameSite; các API quản trị kiểm tra quyền ở máy chủ.

## Danh mục ảnh thật (64 sản phẩm)

8 thú bông, 8 búp bê, 12 LEGO, 8 Rubik, 8 cờ/board game, 8 xe/mô hình, 6 sáng tạo và 6 giáo dục. 16 sản phẩm SVG cũ được ẩn, giữ nguyên bản ghi để bảo toàn đơn hàng cũ. Dữ liệu mới có ảnh thật và liên kết nguồn trong cửa sổ chi tiết; tuổi lọc, giá và tồn kho là dữ liệu demo.

- `npm run catalog:import`: nhập lại từ `data/photo-catalog.json` và ảnh đã lưu, không tải mạng; không ghi đè tồn kho của các món đã có.
- `npm run catalog:refresh`: lấy lại danh mục công khai và ảnh từ MyKingdom/SpeedCubeShop.
- `npm run ai:sync`: chỉ tạo embedding mới hoặc đã thay đổi. Có 3 tác vụ đồng thời và trạng thái tiến độ trong giao diện quản trị.
- Nguồn chi tiết: [docs/IMAGE_SOURCES.md](docs/IMAGE_SOURCES.md).
- Sản phẩm mới chưa có lịch sử bán sẽ có dự báo baseline bằng 0 cho đến khi có dữ liệu đơn hàng.
