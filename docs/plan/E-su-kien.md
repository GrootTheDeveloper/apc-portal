# Sự kiện — Lê Đăng Nghĩa

## Bối cảnh

APC tổ chức workshop, buổi training, cuộc thi. Mảng này làm toàn bộ vòng đời sự kiện:

- Khách xem danh sách và lịch sự kiện công khai, đăng ký bằng họ tên, email, MSSV (không cần tài khoản), nhận **mã đăng ký** để tra cứu hoặc hủy.
- Thành viên đăng ký sự kiện công khai và nội bộ trong portal.
- Ban Chủ nhiệm và quản lý ban tạo, công bố, hủy, lưu trữ sự kiện; xem, xuất danh sách đăng ký; điểm danh và chốt điểm danh.

Bảng `events` đã có sẵn với trạng thái ([PRD](../01-prd.md) mục 9.2):

| Từ | Được chuyển sang |
| --- | --- |
| `DRAFT` (Bản nháp) | `PUBLISHED` |
| `PUBLISHED` (Đã công bố) | `CANCELLED`, `ENDED` (khi qua thời gian kết thúc) |
| `CANCELLED` (Đã hủy), `ENDED` (Đã kết thúc) | `ARCHIVED` |

Quyền theo [Vai trò & quyền](../02-roles-permissions.md) §8.3:

| Hành động | `DEPARTMENT_MANAGER` | `BOARD` |
| --- | --- | --- |
| Tạo bản nháp, sửa sự kiện | Sự kiện của ban mình | Tất cả |
| Công bố sự kiện nội bộ trong ban | Được | Được |
| Công bố sự kiện toàn CLB hoặc công khai | Không | Được |
| Hủy, lưu trữ sự kiện | Sự kiện của ban mình | Tất cả |
| Xem, xuất danh sách đăng ký; điểm danh | Sự kiện của ban mình | Tất cả |
| Sửa điểm danh đã chốt | Không | Được, kèm lý do |

## Phụ thuộc

| Cần có | Từ việc | Dùng cho |
| --- | --- | --- |
| Dữ liệu mẫu | D1 (T5 08/10) | E2 |
| `recordConsent(...)` | B2 (CN 11/10) | E3 |
| `enqueueEmail(...)` | O1 (CN 11/10) | E3, E4, E5 |
| `startJob(...)` | O1 (CN 11/10) | E2 |
| Mẫu email đăng ký, hủy đăng ký, hủy sự kiện | O2 (CN 01/11) | E3, E4, E5 (dùng email tạm trước khi O2 merge) |
| `requireAuth`, `requireRole`, `requireScope` | A1 (T5 08/10) | E4, E5, E6 |
| `audit(...)` | B1 (T5 08/10) | E4, E6 |
| Upload ảnh | D2 (CN 11/10) | E4 |
| Khung trang admin & portal | A3 (T5 22/10) | E4, E5, E6 |
| File xuất bảo vệ `createExport(...)` | D6 (CN 08/11) | E6 |

| Người khác cần | Việc | Hạn |
| --- | --- | --- |
| T3 (lịch sử hoạt động), D3 (tìm kiếm), D1 (sự kiện nội bộ mẫu) | E2 bảng `EventRegistration`, trường phạm vi, API sự kiện công khai | T5 22/10 |
| T3 (buổi đã điểm danh) | E6 | CN 22/11 |

## Giai đoạn 1 (05/10 – 11/10)

### E1. Trang Sự kiện — hạn CN 11/10

**Mục tiêu:** `/events` và `/events/[slug]` hoàn chỉnh giao diện (danh sách và lịch), chạy với dữ liệu giả.

**Làm:**

- Thư mục trang: `apps/web/src/pages/events/list/`, `events/detail/`. Đăng ký route trong `App.tsx`, thay `Placeholder` của `/events`.
- Chuyển card sự kiện từ `EventsSection` sang `apps/web/src/components/` (ví dụ `EventCard`), trang chủ dùng lại card mới.
- Dữ liệu giả trong `mock.ts` cạnh trang, cùng hình dạng phản hồi API ở E2.
- `/events` có hai chế độ xem, chọn bằng `?view=`:
  - **Danh sách:** sự kiện sắp diễn ra xếp trước, rồi đến sự kiện đã kết thúc; phân trang; lọc theo loại.
  - **Lịch tháng** (PUB-04, `PAGE-PUB-05`): lưới tháng tự dựng bằng CSS grid (không cài thư viện lịch), mỗi ngày liệt kê tên sự kiện, nút tháng trước/sau lưu trên URL (`?month=2026-10`). Ngày giờ theo giờ Việt Nam.
- Chi tiết: breadcrumb, tiêu đề, ảnh, loại, thời gian bắt đầu – kết thúc (`formatDateTime`), địa điểm hoặc link trực tuyến, ban tổ chức, đầu mối liên hệ, mô tả, thời gian nhận đăng ký, nút **Đăng ký** dẫn tới `/events/[slug]/register`.
- Nhãn trạng thái: **Sắp diễn ra**, **Đã hủy**, **Đã kết thúc**. Sự kiện đã hủy, đã kết thúc, chưa mở hoặc đã hết hạn đăng ký không có nút Đăng ký; thay bằng trạng thái và thời điểm phù hợp.

**Xong khi:**

- [ ] Nhìn vào card phân biệt được ngay sự kiện sắp diễn ra, đã hủy, đã kết thúc.
- [ ] Chế độ lịch hiện đúng ngày của các sự kiện mẫu; chuyển tháng giữ trên URL.
- [ ] Có đủ trạng thái trang (đang tải, chưa có dữ liệu, không có kết quả theo bộ lọc, lỗi, có dữ liệu); PR có ảnh chụp.
- [ ] Trang chủ vẫn hiển thị như cũ sau khi chuyển card.

## Giai đoạn 2 (12/10 – 01/11)

### E2. Nối dữ liệu thật — hạn T5 22/10

**Mục tiêu:** trang sự kiện lấy dữ liệu từ database; có bảng đăng ký cho E3, E5, E6.

**Cần có trước:** E1, D1.

**Làm:**

- Một migration gồm:
  - Thêm vào `Event` (EVT-02, EVT-03):
    - `audience` — đối tượng tham gia: `PUBLIC` (công khai), `CLUB` (nội bộ toàn CLB), `DEPARTMENT` (nội bộ trong ban quản lý). Tách khỏi `departmentId`, vốn luôn là **ban quản lý** sự kiện.
    - `registrationOpensAt`, `registrationClosesAt`, `capacity` (để trống là không giới hạn), `allowGuestRegistration` (cho phép người ngoài APC đăng ký; chỉ áp dụng khi `audience = PUBLIC`), `onlineUrl`, `cancelReason`.
  - Bảng `EventRegistration`: sự kiện; **hoặc** thành viên (`userId`) **hoặc** thông tin khách (họ tên, email, MSSV); `registrationCode` (sinh bằng `publicCode()`, duy nhất); trạng thái `REGISTERED` / `CANCELLED`; điểm danh `NOT_MARKED` / `PRESENT` / `EXCUSED` / `ABSENT`; thời điểm đăng ký, hủy.
  - Ràng buộc duy nhất: (sự kiện, email khách) và (sự kiện, `userId`). Người đã hủy đăng ký lại thì **kích hoạt lại** dòng cũ (chuyển về `REGISTERED`), không tạo dòng mới.
  - Trường chốt điểm danh trên `Event` (thời điểm chốt, người chốt) cho E6.
- Tác vụ `startJob('event-end', ...)` (O1) chuyển sự kiện `PUBLISHED` đã qua `endAt` sang `ENDED` và lưu lại, để về sau lưu trữ được.
- Cập nhật dữ liệu mẫu D1 cho các trường mới và thêm sự kiện nội bộ Ban A, sự kiện toàn CLB (báo Phạm Đăng Hoàng Thiên, hoặc sửa `seed.ts` trong cùng PR và ghi lý do).
- API trong `apps/api/src/modules/events/`:
  - `GET /public/events?page=&pageSize=&type=&month=` — sự kiện `audience = PUBLIC` ở `PUBLISHED`, `CANCELLED`, `ENDED`.
  - `GET /public/events/:slug`
- Trang dùng `useApi(...)`, xóa `mock.ts`. `EventsSection` ở trang chủ lấy 3 sự kiện sắp diễn ra; không có thì ẩn khối (FLOW-01). Về sau T4 chuyển khối này sang `GET /public/home` (ưu tiên sự kiện nổi bật, chưa chọn thì vẫn là sự kiện sắp diễn ra, QĐ-4); E2 không cần làm phần đó.
- Trang chi tiết có title, description, canonical, Open Graph (SEO-01).

**Xong khi:**

- [ ] Sự kiện `DRAFT`, `ARCHIVED` hoặc nội bộ không có trong danh sách và lịch; mở thẳng slug nhận 404.
- [ ] Sự kiện mẫu đã qua `endAt` chuyển `ENDED` trong database sau khi tác vụ chạy.
- [ ] Mỗi endpoint có test thành công và test 404.
- [ ] Đã cập nhật sơ đồ database (`db:erd`) và nhắn Lương Huỳnh (T3) cấu trúc bảng đăng ký.

### E3. Khách đăng ký sự kiện — hạn CN 01/11

**Mục tiêu:** người ngoài APC đăng ký sự kiện công khai, nhận mã đăng ký qua màn hình và email, tự tra cứu hoặc hủy.

**Cần có trước:** E2, B2, O1.

**Làm:**

- Trang `/events/[slug]/register` (gắn `noindex, nofollow`): họ tên, email, MSSV, ô đồng ý xử lý dữ liệu (link tới `/privacy`). Thành công thì hiện **mã đăng ký một lần** trên màn hình (STATE-02).
- Trang `/events/registration-lookup` (thay `Placeholder`, gắn `noindex, nofollow`): nhập email + mã đăng ký → xem thông tin đăng ký, nút **Hủy đăng ký** kèm hộp xác nhận.
- API (mã gửi qua body, không đặt trên URL):
  - `POST /public/events/:slug/registrations` `{ fullName, email, studentId, consent }`
  - `POST /public/event-registrations/lookup` `{ email, code }`
  - `POST /public/event-registrations/cancel` `{ email, code }`
- Điều kiện nhận đăng ký (BR-08, FLOW-14): sự kiện `PUBLISHED`, trong khoảng `registrationOpensAt`–`registrationClosesAt`, `audience = PUBLIC`, `allowGuestRegistration = true`, còn chỗ. Không đạt thì từ chối và nêu lý do (chưa mở, hết hạn, hết chỗ, sự kiện không nhận khách, đã hủy).
- Trong **một transaction**: khóa dòng sự kiện, đếm số đăng ký `REGISTERED`, tạo đăng ký, gọi `recordConsent(...)`, gọi `enqueueEmail(...)`. Hai người đăng ký cùng lúc không vượt sức chứa.
- Đăng ký trùng email (QĐ-1): API trả 409 với câu chung "Không thể đăng ký với thông tin này. Nếu đã đăng ký, vui lòng dùng trang tra cứu." Câu này giống nhau cho mọi trường hợp trùng, không trả mã, trạng thái hay bất kỳ dữ liệu nào của đăng ký đã có (SEC-05, SEC-08). Thành viên đã đăng nhập thì khác: thấy đăng ký hiện có của chính mình (E5).
- Hủy được đến hết `registrationClosesAt`; hủy xong trạng thái `CANCELLED`, chỗ được trả lại, gửi email xác nhận hủy (NTF-01, AC-09).
- Giới hạn tần suất theo cả email lẫn địa chỉ nguồn (SEC-05) cho ba route. Tra cứu sai 5 lần trong 15 phút thì chặn 15 phút (429), cùng quy tắc với R4.

**Xong khi:**

- [ ] Đăng ký thành công hiện mã đăng ký; email xác nhận có trong Mailpit; tải lại trang không tạo đăng ký thứ hai.
- [ ] Bị chặn, có thông báo lý do rõ ràng: hết chỗ, chưa mở đăng ký, quá hạn đăng ký, sự kiện đã hủy, sự kiện không nhận khách.
- [ ] Chưa tick ô đồng ý thì không gửi được form, API cũng trả 422.
- [ ] Tra cứu sai email hoặc sai mã chỉ báo một lỗi chung; sai lần thứ 6 trong 15 phút nhận 429.
- [ ] Đăng ký lần hai cùng email nhận 409 với câu chung; phản hồi không chứa mã hay dữ liệu của đăng ký đầu (có test).
- [ ] Hủy đăng ký tạo email xác nhận hủy; đăng ký lại sau khi hủy dùng lại dòng cũ.
- [ ] Tắt Mailpit rồi đăng ký: lượt đăng ký vẫn lưu, màn hình vẫn hiện mã.
- [ ] Test: hai request đăng ký đồng thời vào sự kiện còn 1 chỗ chỉ có một request thành công.

## Giai đoạn 3 (02/11 – 22/11)

### E4. Quản trị sự kiện — hạn CN 08/11

**Mục tiêu:** tạo, sửa, xem trước, công bố, hủy, lưu trữ sự kiện qua trang quản trị theo đúng bảng quyền ở phần Bối cảnh.

**Cần có trước:** A3, B1, D2.

**Làm:**

- Trang `/admin/events` (danh sách, lọc trạng thái, ban, đối tượng), `/admin/events/new`, `/admin/events/[id]` (chi tiết và sửa), `/admin/events/[id]/preview`.
- Trường theo EVT-02, EVT-03: tiêu đề, mô tả, ảnh bìa (upload qua D2), loại, thời gian, địa điểm hoặc link trực tuyến, ban quản lý, đầu mối liên hệ, đối tượng, thời gian đăng ký, sức chứa, cho phép khách đăng ký.
- Kiểm tra (FLOW-15 bước 3): `endAt` sau `startAt`; `registrationClosesAt` sau `registrationOpensAt` và không sau `endAt`; sức chứa không nhỏ hơn số đã đăng ký. Sai trả 422.
- Quản lý ban tạo sự kiện thì ban quản lý tự gán là ban mình, không chọn ban khác; ban `ARCHIVED` không nhận sự kiện mới (ORG-06).
- Công bố: `DEPARTMENT_MANAGER` chỉ công bố sự kiện `audience = DEPARTMENT` của ban mình; `PUBLIC` và `CLUB` chỉ `BOARD` công bố.
- Sửa thời gian, sức chứa, đối tượng khi đã có người đăng ký: hộp xác nhận hiện số người bị ảnh hưởng (FLOW-15).
- Hủy sự kiện: bắt buộc lý do (lưu `cancelReason`), giữ nguyên dữ liệu đăng ký (EVT-09), gửi email báo hủy cho người đã đăng ký (NTF-01). Lưu trữ chỉ từ `CANCELLED` hoặc `ENDED`.
- Công bố, hủy, lưu trữ gọi `audit(...)`.

**Xong khi:**

- [ ] `manager.a` công bố được sự kiện nội bộ Ban A; công bố sự kiện `PUBLIC` hoặc `CLUB` nhận 403.
- [ ] `manager.a` hủy và lưu trữ được sự kiện của Ban A; mở sự kiện của Ban B nhận 404.
- [ ] Hủy không có lý do trả 422; hủy xong danh sách đăng ký vẫn còn, trang công khai hiện **Đã hủy** kèm lý do, người đăng ký nhận email.
- [ ] `endAt` trước `startAt` bị từ chối.
- [ ] Bước chuyển sai (ví dụ `DRAFT → CANCELLED`, `PUBLISHED → ARCHIVED`) trả 409.

### E5. Thành viên đăng ký sự kiện — hạn CN 15/11

**Mục tiêu:** thành viên xem và đăng ký sự kiện ngay trong portal, không cần nhập lại thông tin.

**Cần có trước:** E2, A3.

**Làm:**

- Trang `/portal/events` (danh sách và lịch tháng như E1, gồm sự kiện công khai và nội bộ người đó được xem) và `/portal/events/[id]` (chi tiết, nút Đăng ký / Hủy đăng ký).
- API `GET /portal/events`, `GET /portal/events/:id`, `POST /portal/events/:id/registrations`, `POST /portal/events/:id/registrations/cancel`. Đăng ký gắn `userId`.
- Sự kiện được xem: `PUBLIC`, `CLUB`, và `DEPARTMENT` khi người dùng thuộc ban quản lý. Lọc ngay trong truy vấn.
- Cùng các kiểm tra như E3 (thời gian, sức chứa, sai đối tượng); hủy được đến hết `registrationClosesAt`.
- Đăng ký và hủy gửi email xác nhận (NTF-01, AC-09).

**Xong khi:**

- [ ] `member.b` không thấy sự kiện nội bộ Ban A; mở thẳng link nhận 404.
- [ ] Đăng ký lần hai cùng sự kiện hiện trạng thái đã đăng ký, không tạo bản ghi mới.
- [ ] Sự kiện `CLUB` hiện cho thành viên mọi ban.
- [ ] Đăng ký và hủy có email trong Mailpit.

### E6. Danh sách đăng ký & điểm danh — hạn CN 22/11

**Mục tiêu:** người quản lý sự kiện xem, tìm, xuất danh sách đăng ký; điểm danh, chốt điểm danh; kết quả vào lịch sử thành viên.

**Cần có trước:** E4, D6.

**Làm:**

- Trang `/admin/events/[id]/registrations` (tìm theo tên/email, lọc trạng thái, nút Xuất CSV) và `/admin/events/[id]/attendance` (đánh dấu Chưa điểm danh / Có mặt / Vắng có phép / Vắng mặt cho từng người).
- Điểm danh (FLOW-16): lưu từng thay đổi ngay khi bấm (mất mạng không mất phần đã lưu); người chưa đánh dấu giữ Chưa điểm danh. Nút **Chốt điểm danh** kèm xác nhận.
- Sau khi chốt: chỉ `BOARD` sửa được kết quả, bắt buộc lý do.
- Xuất danh sách bằng `createExport(...)` (D6).
- Người đăng ký dạng khách chỉ lưu kết quả trong sự kiện, không tạo hồ sơ thành viên.
- Xuất danh sách, điểm danh, chốt, sửa điểm danh đã chốt gọi `audit(...)`.

**Xong khi:**

- [ ] Buổi đã điểm danh hiện trong lịch sử hoạt động của thành viên (`/portal/activity-history`, trang T3 của Lương Huỳnh).
- [ ] Sau khi chốt, `manager.a` sửa điểm danh nhận 403; `board` sửa không có lý do nhận 422.
- [ ] `manager.a` mở danh sách đăng ký sự kiện Ban B nhận 404.
- [ ] File xuất chỉ người tạo tải được; mở bằng Excel hiển thị đúng tiếng Việt.
- [ ] Mỗi lần xuất, điểm danh, chốt có dòng nhật ký.

## Lưu ý

- Chỉ nhận đăng ký khi sự kiện ở trạng thái Đã công bố và trong thời gian đăng ký (BR-08).
- Kiểm tra số chỗ ở server, trong cùng transaction với lúc lưu đăng ký.
- Chưa tick ô đồng ý thì không gửi được form.
- Tra cứu sai chỉ báo lỗi chung, không cho biết email có tồn tại hay không.
- Gửi email lỗi thì lượt đăng ký vẫn được lưu (BR-17).
- Chỉ người đăng ký và người quản lý sự kiện xem được thông tin đăng ký cá nhân (BR-09).
- Mã đăng ký không ghi vào log hay audit.
- Bản phát hành đầu chặn lạm dụng form công khai bằng giới hạn tần suất (429). Bước xác minh tăng cường (captcha) và xóa thông tin liên hệ của đăng ký công khai sau 12 tháng thuộc giai đoạn sau phát hành, hạn CN 28/02/2027 ([PRD](../01-prd.md) §13.1).

## Tài liệu

- [PRD](../01-prd.md): mục 6.3, 7.1 (PUB-04), 7.5, 9.2 (sơ đồ trạng thái Sự kiện), 10.5
- [User flow](../03-user-flows.md): FLOW-14, FLOW-15, FLOW-16
- [Sitemap](../04-sitemap.md): mục 5.2, 5.4, 7.2 (`PAGE-MEM-04` đến `PAGE-MEM-06`), 8.4, 13
- [Vai trò & quyền](../02-roles-permissions.md): mục 8.3
