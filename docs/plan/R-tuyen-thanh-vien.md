# Tuyển thành viên — Phan Anh Khương

## Bối cảnh

Mỗi đợt tuyển, sinh viên nộp đơn trên website mà không cần tài khoản. Nộp xong nhận **mã hồ sơ**; dùng email + mã hồ sơ để tra cứu trạng thái hoặc rút đơn. Quản lý ban sàng lọc hồ sơ nộp vào ban mình; Ban Chủ nhiệm chốt kết quả và chuyển hồ sơ được chấp nhận thành tài khoản thành viên.

Bảng `recruitment_rounds` và `membership_applications` đã có sẵn, kèm ràng buộc mỗi email và mỗi MSSV chỉ có một đơn trong một đợt.

Trạng thái đợt tuyển: `DRAFT` → `OPEN` → `CLOSED` → `ARCHIVED`. Đợt `OPEN` tự chuyển `CLOSED` khi hết thời gian nhận đơn (REC-16).

Trạng thái hồ sơ ([PRD](../01-prd.md) mục 9.2):

| Từ | Được chuyển sang |
| --- | --- |
| `NEW` (Mới) | `REVIEWING`, `WITHDRAWN` |
| `REVIEWING` (Đang xét) | `INTERVIEW`, `ACCEPTED`, `REJECTED`, `WITHDRAWN` |
| `INTERVIEW` (Mời phỏng vấn) | `ACCEPTED`, `REJECTED`, `WITHDRAWN` |
| `ACCEPTED`, `REJECTED`, `WITHDRAWN` | Không chuyển tiếp |

Quyền theo [Vai trò & quyền](../02-roles-permissions.md) §8.1:

| Hành động | `DEPARTMENT_MANAGER` | `BOARD` |
| --- | --- | --- |
| Tạo, cấu hình, mở, đóng, lưu trữ đợt tuyển | Không (chỉ xem đợt có hồ sơ trong ban) | Được |
| Xem hồ sơ; đánh giá, ghi chú | Hồ sơ nộp vào ban mình | Tất cả |
| Chuyển trạng thái trung gian (`NEW → REVIEWING → INTERVIEW`) | Hồ sơ nộp vào ban mình | Tất cả |
| Chốt Đã chấp nhận / Không chấp nhận | Không | Được |
| Rút đơn thay ứng viên | Không | Được |
| Xuất danh sách ứng viên | Hồ sơ nộp vào ban mình | Tất cả |
| Chuyển ứng viên thành thành viên | Không | Được |

## Phụ thuộc

| Cần có | Từ việc | Dùng cho |
| --- | --- | --- |
| Dữ liệu mẫu (đợt tuyển, hồ sơ mẫu) | D1 (T5 08/10) | R2, R5 |
| `requireAuth`, `requireRole`, `requireScope` | A1 (T5 08/10) | R2, R5, R6 |
| `request.user` khi đã đăng nhập | A2 (CN 11/10) | R3 (chặn thành viên nộp đơn) |
| `recordConsent(...)` | B2 (CN 11/10) | R3 |
| `enqueueEmail(...)` | O1 (CN 11/10) | R3 |
| Mẫu email xác nhận nộp đơn | O2 (CN 01/11) | R3 (dùng email tạm trước khi O2 merge) |
| `audit(...)` | B1 (T5 08/10) | R2, R4, R5, R6 |
| Khung trang admin | A3 (T5 22/10) | R2, R5 |
| Kích hoạt tài khoản | A4 (CN 01/11) | R6 |
| File xuất bảo vệ `createExport(...)` | D6 (CN 08/11) | R5 |
| Hàm tạo tài khoản dùng chung | A5 (CN 22/11) | R6 |

| Người khác cần | Việc | Hạn |
| --- | --- | --- |
| Q2 (test nộp đơn, tra cứu) | R3, R4 | CN 25/10, CN 01/11 |
| Q3 (test xét hồ sơ) | R5 | T5 12/11 |

## Giai đoạn 1 (05/10 – 11/10)

### R1. Trang tuyển thành viên — hạn CN 11/10

**Mục tiêu:** `/recruitment` và `/recruitment/[slug]` hoàn chỉnh giao diện, chạy với dữ liệu giả.

**Làm:**

- Thư mục trang: `apps/web/src/pages/recruitment/list/`, `recruitment/detail/`. Thay `Placeholder` của `/recruitment` trong `App.tsx`.
- Dữ liệu giả trong `mock.ts` cạnh trang, cùng hình dạng phản hồi API ở R2.
- `/recruitment`: giới thiệu ngắn về việc gia nhập APC, danh sách đợt tuyển (đang mở xếp trước), link **Tra cứu hồ sơ** tới `/recruitment/application-lookup`. Không có đợt nào: hiện thông tin giới thiệu và kênh liên hệ APC (FLOW-03).
- `/recruitment/[slug]`: breadcrumb, tiêu đề, mô tả, đối tượng, điều kiện, thời gian nhận đơn (`formatDateTime`), các ban đang tuyển, dữ liệu sẽ thu thập kèm link `/privacy`, nút **Ứng tuyển** dẫn tới `/recruitment/[slug]/apply`.
- Đợt chưa mở hiện "Mở nhận đơn từ <thời gian>"; đợt đã đóng hiện "Đã đóng nhận đơn".

**Xong khi:**

- [ ] Đợt tuyển chưa mở hoặc đã đóng không có nút **Ứng tuyển**.
- [ ] Không có đợt tuyển nào thì hiện giới thiệu và kênh liên hệ.
- [ ] Có đủ trạng thái trang; PR có ảnh chụp.

## Giai đoạn 2 (12/10 – 01/11)

### R2. Tạo và quản lý đợt tuyển — hạn CN 18/10

**Mục tiêu:** Ban Chủ nhiệm tạo đợt tuyển, cấu hình câu hỏi bổ sung, mở và đóng đợt; trang công khai lấy dữ liệu thật.

**Cần có trước:** R1, A1, B1. Trang quản trị dựng trong layout tạm nếu A3 chưa merge.

**Làm:**

- Một migration thêm vào `RecruitmentRound`:
  - `audience` (đối tượng tuyển), `requirements` (điều kiện).
  - Danh sách ban đang tuyển: quan hệ nhiều-nhiều với `Department`.
  - `questions` (JSON): mỗi câu `{ id, type, label, required, options, hidden }`; `type` là `short_text`, `long_text`, `single_choice`, `multiple_choice`; `id` của câu và của từng lựa chọn sinh một lần và không đổi.
- API quản trị:
  - Tạo, sửa, mở, đóng, lưu trữ: chỉ `BOARD`. Tạo đợt và đổi trạng thái gọi `audit(...)`.
  - Đọc (`/admin/recruitment`, `/[id]`, `/[id]/preview`): `BOARD` mọi đợt; `DEPARTMENT_MANAGER` chỉ đọc đợt có hồ sơ nộp vào ban mình (`PAGE-MGT-REC-01`, `03`, `05`).
- Kiểm tra (FLOW-06): `closesAt` sau `opensAt`, sai trả 422. Đóng sớm cần hộp xác nhận và dừng nhận đơn ngay.
- Tác vụ định kỳ trong process API chuyển đợt `OPEN` đã qua `closesAt` sang `CLOSED` và lưu lại (REC-16).
- Câu hỏi khi đợt đã có hồ sơ (REC-15): không đổi `type`, không xóa câu, không xóa lựa chọn đã có người chọn; chỉ ẩn (`hidden = true`) khỏi lượt nộp mới. Vi phạm trả 409.
- API công khai: `GET /public/recruitment-rounds` (đợt `OPEN` và `CLOSED`), `GET /public/recruitment-rounds/:slug`.
- Trang quản trị: `/admin/recruitment`, `/admin/recruitment/new`, `/admin/recruitment/[id]`, `/admin/recruitment/[id]/edit`, `/admin/recruitment/[id]/preview`.
- Trang R1 dùng `useApi(...)`, xóa `mock.ts`.

**Xong khi:**

- [ ] Đợt đã có đơn: đổi kiểu câu, xóa câu, xóa lựa chọn đã được chọn đều trả 409; ẩn câu được.
- [ ] `closesAt` trước `opensAt` bị từ chối.
- [ ] Đợt `OPEN` quá hạn chuyển `CLOSED` trong database sau khi tác vụ chạy.
- [ ] Đợt `DRAFT` và `ARCHIVED` không hiện ở `/recruitment`; mở thẳng slug nhận 404.
- [ ] `manager.a` gọi API tạo đợt nhận 403; xem được đợt có hồ sơ Ban A.
- [ ] Bước chuyển sai (ví dụ `DRAFT → CLOSED`) trả 409.

### R3. Nộp đơn — hạn CN 25/10

**Mục tiêu:** sinh viên nộp đơn qua form nhiều bước, nhận mã hồ sơ trên màn hình và qua email; gửi lặp không tạo hai hồ sơ.

**Cần có trước:** R2, B2, O1, A2.

**Làm:**

- Trang `/recruitment/[slug]/apply` (gắn `noindex, nofollow`), 4 bước:
  1. Thông tin cá nhân và học tập: họ tên, email, MSSV, khoa/ngành, niên khóa.
  2. Ban mong muốn (chỉ các ban của đợt), kỹ năng, kinh nghiệm.
  3. Câu hỏi bổ sung của đợt (câu `hidden` không hiện).
  4. Xem lại, ô đồng ý xử lý dữ liệu (link `/privacy`), nút **Nộp đơn**.
- Chuyển bước, lỗi 422, lỗi 429 đều không làm mất dữ liệu đã nhập. Lỗi 422 đánh dấu đúng trường (`ApiError.issues`).
- Chống tạo trùng khi gửi lặp (FLOW-04, STATE-01): mỗi lần mở form, web sinh một `Idempotency-Key` (UUID) gửi kèm header. Một migration thêm cột khóa này (duy nhất) vào `MembershipApplication`. Cùng khóa gửi lại trả đúng kết quả lần đầu, không tạo hồ sơ mới.
- API `POST /public/recruitment-rounds/:slug/applications`:
  - Kiểm tra đợt `OPEN` và trong thời gian nhận đơn; ban mong muốn thuộc các ban của đợt; câu trả lời bắt buộc theo `questions`, bỏ qua câu `hidden`.
  - Người đã đăng nhập (`request.user` có giá trị) nhận 403.
  - Trong **một transaction**: tạo đơn `NEW` với `profileCode` sinh bằng `publicCode()`, gọi `recordConsent(...)`, gọi `enqueueEmail(...)`.
  - Trùng email hoặc MSSV trong đợt: cách thông báo chờ [QĐ-1](./README.md#8-điểm-cần-trưởng-dự-án-quyết-định). Trong lúc chờ, trả 409 với câu chung "Không thể nộp đơn với thông tin này. Nếu đã nộp, vui lòng dùng trang tra cứu."
  - Giới hạn tần suất theo cả email lẫn địa chỉ nguồn (SEC-05).
- Màn hình thành công hiện **mã hồ sơ một lần** và hướng dẫn lưu lại.

**Xong khi:**

- [ ] Gửi cùng một request 2 lần (cùng `Idempotency-Key`) chỉ tạo một hồ sơ.
- [ ] Cùng email hoặc cùng MSSV không nộp được 2 đơn trong một đợt.
- [ ] Chọn ban không thuộc đợt, hoặc bỏ trống câu bắt buộc, trả 422; câu `hidden` bắt buộc không chặn nộp.
- [ ] Chưa tick ô đồng ý thì không gửi được; API cũng trả 422.
- [ ] Email xác nhận có mã hồ sơ xuất hiện trong Mailpit.
- [ ] Tắt Mailpit rồi nộp: đơn vẫn lưu, màn hình vẫn hiện mã.
- [ ] Đăng nhập bằng `member.a` rồi gọi API nộp đơn nhận 403.
- [ ] Mã hồ sơ không có trong log API.

### R4. Tra cứu và rút đơn — hạn CN 01/11

**Mục tiêu:** ứng viên dùng email + mã hồ sơ để xem trạng thái và rút đơn khi chưa có kết quả.

**Cần có trước:** R3.

**Làm:**

- Trang `/recruitment/application-lookup` (thay `Placeholder`, gắn `noindex, nofollow`).
- API (mã gửi qua body):
  - `POST /public/applications/lookup` `{ email, code }` — trả mã hồ sơ, tên đợt, ban đăng ký, trạng thái, thời điểm cập nhật. **Không trả** ghi chú, đánh giá, người xét.
  - `POST /public/applications/withdraw` `{ email, code }` — hộp xác nhận trước khi gửi; chỉ khi trạng thái `NEW`, `REVIEWING` hoặc `INTERVIEW`; trạng thái khác trả 409. Rút đơn gọi `audit(...)` (không ghi mã hồ sơ).
- Sai email hoặc mã: một thông báo chung, không cho biết phần nào sai.
- Giới hạn theo cả email lẫn địa chỉ nguồn: sai quá ngưỡng (hằng số trong code, mặc định 5 lần) trong 15 phút thì chặn 15 phút (429) (FLOW-05, SEC-05).

**Xong khi:**

- [ ] Tra cứu đúng thấy trạng thái Mới; rút đơn xong thấy Đã rút; có dòng nhật ký.
- [ ] Hồ sơ Đã chấp nhận không có nút rút đơn; gọi API rút nhận 409.
- [ ] Sai email và sai mã cho cùng một thông báo.
- [ ] Sai lần thứ 6 trong 15 phút nhận 429.
- [ ] Phản hồi API tra cứu không có trường ghi chú nội bộ (có test kiểm tra).

## Giai đoạn 3 (02/11 – 22/11)

### R5. Xét hồ sơ — hạn T5 12/11

**Mục tiêu:** người có quyền lọc, đánh giá, ghi chú, chuyển trạng thái và xuất danh sách hồ sơ; mọi thay đổi có lịch sử.

**Cần có trước:** A3, B1, D6.

**Làm:**

- Một migration: bảng lịch sử trạng thái hồ sơ (trạng thái cũ, trạng thái mới, lý do, người thay đổi, thời điểm) (FLOW-07 bước 6).
- Trang `/admin/recruitment/[id]/applications` (lọc trạng thái, ban đăng ký, từ khóa; phân trang; nút Xuất CSV) và `/admin/recruitment/[id]/applications/[applicationId]` (thông tin đơn, câu trả lời, đánh giá và ghi chú nội bộ, kết quả phỏng vấn, lịch sử trạng thái, nút đổi trạng thái).
- Quyền đúng bảng ở phần Bối cảnh. `DEPARTMENT_MANAGER` chỉ thấy hồ sơ có ban đăng ký là ban mình.
- Đổi trạng thái đúng bảng chuyển; bước sai trả 409. Mỗi lần đổi ghi một dòng lịch sử kèm lý do, cập nhật `reviewedById`, `reviewedAt`. `BOARD` rút đơn thay ứng viên bắt buộc lý do.
- Hai người cùng sửa một hồ sơ: người lưu sau nhận 409 (luật chung, STATE-09).
- Xuất CSV trong phạm vi người xuất bằng `createExport(...)` (D6).
- Email báo ứng viên khi đổi trạng thái: danh sách trạng thái cần báo chờ [QĐ-7](./README.md#8-điểm-cần-trưởng-dự-án-quyết-định).
- Đổi trạng thái, chốt kết quả, xuất CSV gọi `audit(...)`.

**Xong khi:**

- [ ] `manager.a` chỉ thấy hồ sơ nộp vào Ban A; mở hồ sơ Ban B nhận 404.
- [ ] `manager.a` ghi được đánh giá, ghi chú và chuyển `NEW → REVIEWING → INTERVIEW` cho hồ sơ Ban A.
- [ ] Chỉ `BOARD` chốt được Đã chấp nhận / Không chấp nhận; `manager.a` gọi API nhận 403.
- [ ] Bước chuyển sai (ví dụ `NEW → ACCEPTED`) trả 409; mỗi bước đúng có một dòng lịch sử.
- [ ] Ghi chú nội bộ không hiện khi ứng viên tra cứu.
- [ ] File xuất chỉ chứa hồ sơ trong phạm vi người xuất, chỉ người đó tải được.

### R6. Chuyển hồ sơ thành thành viên — hạn CN 22/11

**Mục tiêu:** hồ sơ Đã chấp nhận tạo được hồ sơ và tài khoản thành viên mà không nhập lại dữ liệu (FLOW-08).

**Cần có trước:** R5, A4. Dùng chung hàm tạo tài khoản với A5 (`apps/api/src/modules/accounts/service.ts`); việc nào làm trước thì tạo hàm, việc sau dùng lại.

**Làm:**

- Nút **Tạo tài khoản thành viên** trên trang chi tiết hồ sơ `ACCEPTED` (chỉ `BOARD`).
- Hộp xác nhận: `BOARD` kiểm tra dữ liệu, chọn ban; hệ thống **đề xuất tên đăng nhập duy nhất** (sửa được); tên trùng thì yêu cầu chọn tên khác.
- Email hoặc MSSV đã thuộc một thành viên khác: dừng, không tạo, hiện link tới hồ sơ thành viên đó.
- Trong **một transaction**: tạo `User` ở `PENDING_ACTIVATION` chỉ với vai trò nền `MEMBER`, mật khẩu tạm ngẫu nhiên băm bằng `hashPassword`, hết hạn sau 72 giờ; ghi `convertedUserId`, `convertedAt` trên đơn; gọi `audit(...)`. Lỗi ở bước nào thì không tạo dở bản ghi nào.
- Mật khẩu tạm **hiển thị một lần** cho `BOARD` (STATE-03), không gửi email.
- Thực hiện lại trên hồ sơ đã chuyển: trả về thành viên đã tạo, không tạo tài khoản thứ hai.

**Xong khi:**

- [ ] Chỉ hồ sơ `ACCEPTED` chuyển được (BR-06); hồ sơ khác nhận 409.
- [ ] Bấm chuyển lần thứ hai trên cùng hồ sơ trả về thành viên đã có, không tạo tài khoản mới.
- [ ] Hồ sơ có email trùng thành viên hiện có: không tạo, hiện link tới thành viên đó.
- [ ] Tài khoản mới đăng nhập bằng mật khẩu tạm và bị đưa tới `/account/activate`.
- [ ] Mật khẩu tạm không có trong log, audit hay email.

## Lưu ý

- Một email hoặc một MSSV chỉ có một đơn trong mỗi đợt (BR-05); ràng buộc unique đã có trong database.
- Mã hồ sơ sinh ngẫu nhiên bằng `publicCode()`, không đánh số tăng dần.
- Ghi chú và đánh giá của người xét không hiện cho ứng viên, kể cả trong API tra cứu (BR-07).
- Thành viên đã đăng nhập không nộp đơn được.
- Mã hồ sơ không ghi vào log hay audit.
- Nằm ngoài phiếu này, xem [README kế hoạch](./README.md) mục 9: xác minh tăng cường cho form công khai (SEC-05), ẩn danh hồ sơ sau 12 tháng (DATA-05, PRD §10.5).

## Tài liệu

- [PRD](../01-prd.md): mục 6.2, 7.2, 9.2 (sơ đồ trạng thái Đợt tuyển, Hồ sơ), 10.5
- [User flow](../03-user-flows.md): FLOW-03 đến FLOW-08
- [Sitemap](../04-sitemap.md): mục 5.2, 5.4, 8.2, 13 (STATE-01, STATE-03, STATE-07, STATE-09)
- [Vai trò & quyền](../02-roles-permissions.md): mục 8.1
