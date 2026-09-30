# Đăng nhập & phân quyền — Huỳnh Hoàn Phúc

## Bối cảnh

Portal không cho tự đăng ký: Ban Chủ nhiệm tạo tài khoản và cấp mật khẩu tạm. Mỗi tài khoản luôn có vai trò nền `MEMBER` (không lưu trong database); vai trò quản lý lưu trong bảng `user_roles` kèm phạm vi, ngày bắt đầu, ngày hết hạn, trạng thái:

| Vai trò | Phạm vi |
| --- | --- |
| `MEMBER` | Dữ liệu của bản thân và nội dung nội bộ được cấp |
| `DEPARTMENT_MANAGER` | Dữ liệu của ban ghi trong `user_roles.departmentId` |
| `BOARD` (Ban Chủ nhiệm) | Toàn bộ dữ liệu nghiệp vụ |
| `TECH_ADMIN` | Vận hành kỹ thuật; không xem dữ liệu nghiệp vụ |

`BOARD` và `TECH_ADMIN` là **vai trò đặc quyền**: chỉ có hiệu lực khi tài khoản đã thiết lập xác thực 2 lớp và phiên hiện tại đã nhập mã 2 lớp (BR-19, RP-13). Một tài khoản không giữ cùng lúc hai vai trò này (BR-21).

Mảng này làm phần nền cho mọi API cần đăng nhập: hàm kiểm quyền, phiên đăng nhập, khung trang, kích hoạt tài khoản, quản lý tài khoản và vai trò.

## Phụ thuộc

| Cần có | Từ việc | Dùng cho |
| --- | --- | --- |
| `audit(...)` | B1 (T5 08/10) | A1 (ghi log bị từ chối), A5 |
| Xác thực 2 lớp, cờ `twoFactorVerified` | B3 (CN 01/11) | A1, A2, A5 |

| Người khác cần | Việc | Hạn |
| --- | --- | --- |
| Mọi API `/portal/*`, `/admin/*` | A1 | T5 08/10 |
| Mọi trang `/portal`, `/admin`; R3 (chặn thành viên đã đăng nhập nộp đơn); B3 | A2 | CN 11/10 |
| Mọi trang `/portal/*`, `/admin/*` | A3 | T5 22/10 |
| R6 (tài khoản mới kích hoạt được) | A4 | CN 01/11 |
| R6 (dùng chung hàm tạo tài khoản) | A5 | CN 22/11 |

## Giai đoạn 1 (05/10 – 11/10)

### A1. Hàm phân quyền — hạn T5 08/10

**Mục tiêu:** mọi API dùng chung một cách kiểm tra đăng nhập, vai trò và phạm vi ban; không ai tự viết kiểm quyền riêng.

**Làm:**

- File `apps/api/src/modules/auth/rbac.ts` và `rbac.test.ts`.
- Khai báo kiểu `request.user = { id, departmentId, roles: { role, departmentId }[] }` cho Fastify.
- Cách tính `roles` (dùng chung cho hook đọc phiên ở A2):
  - Luôn có `{ role: 'MEMBER', departmentId: <ban của người dùng> }`.
  - Thêm các dòng `user_roles` có `status = ACTIVE`, `startsAt <= hiện tại` và (`expiresAt` trống hoặc `> hiện tại`). Dòng quá hạn không được tính dù chưa chuyển sang `EXPIRED`.
  - Phiên chưa `twoFactorVerified` thì bỏ `BOARD`, `TECH_ADMIN` khỏi `roles` (RP-13, Vai trò & quyền §12 mục 1).
- `requireAuth` — chưa có `request.user` thì `throw unauthenticated()` (401).
- `requireRole(...roles)` — không có vai trò nào trong danh sách thì `throw forbidden()` (403).
- `requireScope` — kiểm tra phạm vi ban, phục vụ được hai cách dùng:
  1. **Một bản ghi cụ thể** (ví dụ sửa bài có `departmentId = X`): `BOARD` qua; `DEPARTMENT_MANAGER` chỉ qua khi X nằm trong ban người đó quản lý; còn lại (kể cả `MEMBER`, `TECH_ADMIN` với dữ liệu nghiệp vụ) `throw notFound()` (404).
  2. **Lọc danh sách ngay trong truy vấn**: trả điều kiện `where` cho Prisma theo phạm vi của người dùng.
- Request bị từ chối (401, 403) ghi `audit(...)` loại `SECURITY` (FLOW-20). Trước khi B1 merge, để sẵn chỗ gọi.
- Hình dạng hàm (tham số, tên phụ) do người làm quyết định; ghi ví dụ sử dụng trong comment đầu file.
- Test gán sẵn `request.user` giả qua một route thử trong test, chưa cần đăng nhập thật.

**Xong khi:**

- [ ] Có test cho cả 4 vai trò: được phép và bị từ chối.
- [ ] Chưa đăng nhập gọi route có `requireAuth` nhận 401 `unauthenticated`.
- [ ] `MEMBER` gọi route `requireRole('BOARD')` nhận 403 `forbidden`.
- [ ] Quản lý Ban A truy cập bản ghi của Ban B nhận 404 `not_found`.
- [ ] `TECH_ADMIN` không qua `requireRole('BOARD')` và không đọc được bản ghi nghiệp vụ qua `requireScope`.
- [ ] Dòng `user_roles` ở `PENDING`, `EXPIRED`, `REVOKED`, chưa đến `startsAt` hoặc đã qua `expiresAt` không được tính.
- [ ] Phiên chưa `twoFactorVerified` của tài khoản `BOARD` không qua `requireRole('BOARD')`.
- [ ] Đã nhắn cả nhóm cách dùng kèm ví dụ cho route một bản ghi và route danh sách.

### A2. Đăng nhập — hạn CN 11/10

**Mục tiêu:** thành viên đăng nhập bằng tên đăng nhập và mật khẩu; trang `/portal`, `/admin` chỉ mở được khi đã đăng nhập.

**Cần có trước:** A1.

**Làm:**

- Cài `@fastify/cookie` và `@fastify/rate-limit` (đăng ký rate-limit **một lần** trong `app.ts` với `global: false`).
- API trong `apps/api/src/modules/auth/`:
  - `POST /auth/login` `{ username, password }` — thành công thì tạo dòng `sessions` và đặt cookie `apc_session`.
  - `POST /auth/logout` — ghi `revokedAt` cho phiên hiện tại, xóa cookie.
  - `GET /auth/me` — trả `{ id, username, fullName, status, mustChangePassword, roles }`; chưa đăng nhập trả 401.
- Hook đọc phiên cho mọi request: lấy token trong cookie → tìm `sessions` theo SHA-256 của token → phiên chưa `revokedAt`, `lastActiveAt` trong vòng 8 giờ, tài khoản không `LOCKED`/`INACTIVE` → gán `request.user` (cách tính `roles` theo A1), cập nhật `lastActiveAt`.
- Phiên và cookie theo [Kiến trúc](../06-architecture.md) mục 5 dòng 1: token ngẫu nhiên 32 byte, database chỉ lưu SHA-256, cookie `HttpOnly`, `SameSite=Lax`, `Path=/`, thêm `Secure` khi `NODE_ENV=production`.
- Chống CSRF theo Kiến trúc mục 5 dòng 2: request `POST`/`PATCH`/`PUT`/`DELETE` không có header `Origin` trùng `WEB_URL` thì từ chối 403.
- Giới hạn đăng nhập theo **cả tài khoản lẫn địa chỉ nguồn** (SEC-05):
  - Tài khoản: sai mật khẩu tăng `failedLoginAttempts`; lần thứ 5 liên tiếp đặt `lockoutUntil` = 15 phút sau; đăng nhập đúng đặt lại về 0.
  - Địa chỉ nguồn: `config.rateLimit` trên `POST /auth/login`.
- Chống dò tài khoản (SEC-08): sai tên đăng nhập, sai mật khẩu, tài khoản đang bị chặn tạm thời đều trả **cùng một phản hồi**. Tên đăng nhập không tồn tại vẫn chạy `verifyPassword` với một hash giả để thời gian phản hồi không khác biệt.
- Cho đến khi B3 merge: phiên mới đặt `twoFactorVerified = true` để tài khoản mẫu `board` dùng được trang quản trị khi phát triển. B3 thay bằng kiểm tra thật. Ghi chú rõ trong code.
- Web:
  - Trang `/login` trong `apps/web/src/pages/auth/login/`, thay `Placeholder` trong `App.tsx`.
  - Hook hoặc context `useAuth()` đọc `/auth/me`, dùng chung cho các trang khác.
  - Chưa đăng nhập mở `/portal/*`, `/admin/*`: chuyển về `/login?returnTo=<đường dẫn đang mở>`.
  - Đã đăng nhập mở `/login`: chuyển về `returnTo` hợp lệ hoặc `/portal` (Sitemap §6.2 mục 1).
  - `returnTo` chỉ nhận đường dẫn nội bộ thuộc danh sách route của web; URL tuyệt đối, `//...`, route không tồn tại thì bỏ qua (Sitemap §11.2).
  - Thêm route `/portal` tạm (trang chào "Xin chào, <tên>").
- Test tự tạo tài khoản bằng `db` + `hashPassword`, không chờ dữ liệu mẫu D1.

**Xong khi:**

- [ ] Đăng nhập được bằng tài khoản mẫu; `/auth/me` trả đúng vai trò.
- [ ] Sai mật khẩu 5 lần liên tiếp thì lần thứ 6 bị từ chối dù đúng mật khẩu, cho đến khi hết 15 phút.
- [ ] Sai tên đăng nhập, sai mật khẩu, tài khoản đang bị chặn tạm thời: cùng câu "Sai tên đăng nhập hoặc mật khẩu", cùng mã lỗi.
- [ ] Nhiều request đăng nhập từ cùng địa chỉ vượt ngưỡng nhận 429.
- [ ] Tài khoản `LOCKED` hoặc `INACTIVE` không đăng nhập được; phiên cũ của tài khoản đó bị từ chối ngay.
- [ ] Đăng nhập xong quay lại đúng `returnTo`; `returnTo` là `https://...` hoặc `//...` thì về `/portal`.
- [ ] Đăng xuất xong, dùng lại cookie cũ nhận 401.
- [ ] Request `POST` không có `Origin` đúng nhận 403.
- [ ] Database không có token dạng rõ; không có token trong `localStorage`.
- [ ] Trang `/login` có dòng "Liên hệ Ban Chủ nhiệm để được cấp lại mật khẩu".

## Giai đoạn 2 (12/10 – 01/11)

### A3. Khung trang portal & admin — hạn T5 22/10

**Mục tiêu:** mọi trang thành viên và quản trị dùng chung một layout; menu và bộ chặn route theo đúng thứ tự kiểm tra của đặc tả.

**Cần có trước:** A2.

**Làm:**

- `PortalLayout` và `AdminLayout` trong `apps/web/src/layouts/`, có breadcrumb theo Sitemap §15.2 (`Portal > Nhóm > Đối tượng`, `Quản trị > Phân hệ > Danh sách > Đối tượng`).
- Menu khai báo trong **một mảng** duy nhất, mỗi mục gồm nhãn, đường dẫn, danh sách vai trò được thấy. Danh sách mục theo [Sitemap](../04-sitemap.md) mục 7.1 (thành viên) và mục 10 (quản trị); mục nào chưa có trang thì trỏ tới `Placeholder`. Một nhóm menu chỉ hiện khi người dùng có ít nhất một mục con hợp lệ.
- Lối vào **Quản trị** chỉ hiện với `DEPARTMENT_MANAGER`, `BOARD`, `TECH_ADMIN`. Lối vào **Vận hành hệ thống** chỉ hiện với `TECH_ADMIN`.
- Bộ chặn route kiểm tra theo thứ tự Sitemap §11.1: phiên → trạng thái tài khoản → bắt buộc đổi mật khẩu (về `/account/activate`) → xác thực 2 lớp (về `/account/setup-two-factor` hoặc `/account/two-factor`) → vai trò (trang 403) → phạm vi (trang 404).
- Trang 403 dùng chung (`PAGE-SYS-03`), dùng lại trang 404 có sẵn.
- Trên điện thoại, menu thu gọn thành nút mở.

**Xong khi:**

- [ ] `member.a` không thấy menu Quản trị; mở thẳng `/admin` thấy trang 403.
- [ ] `manager.a` thấy các mục quản trị theo Sitemap mục 10, không thấy mục chỉ dành cho `BOARD` (Tổ chức, Tài khoản).
- [ ] `techadmin` thấy lối vào Vận hành hệ thống; `board` không thấy.
- [ ] Tài khoản `pending` mở bất kỳ trang `/portal/*` nào đều bị đưa về `/account/activate`.
- [ ] Thêm một trang mới vào menu chỉ cần thêm một phần tử vào mảng.
- [ ] Đã nhắn cả nhóm cách thêm trang vào layout và menu.

### A4. Kích hoạt tài khoản & đổi mật khẩu — hạn CN 01/11

**Mục tiêu:** tài khoản mới đổi mật khẩu tạm trước khi dùng; thành viên tự đổi mật khẩu.

**Cần có trước:** A2, A3.

**Làm:**

- `/account/activate`: tài khoản `PENDING_ACTIVATION` đăng nhập xong chỉ vào được trang này và Đăng xuất. Nhập mật khẩu mới 2 lần.
- `/portal/account/security`: đổi mật khẩu, phải nhập đúng mật khẩu hiện tại.
- API `POST /auth/activate`, `POST /auth/change-password`.
- Quy tắc mật khẩu mới (SEC-11, FLOW-09 bước 4): 15–128 ký tự, cho phép khoảng trắng và tiếng Việt, không bắt buộc trộn ký tự; từ chối mật khẩu nằm trong danh sách mật khẩu phổ biến lưu trong repo (file văn bản, không gọi dịch vụ ngoài), mật khẩu trùng tên đăng nhập, và **mật khẩu trùng mật khẩu tạm**.
- Kích hoạt xong: `status = ACTIVE`, `mustChangePassword = false`, `isTemporaryPassword = false`, ghi `passwordChangedAt`; **thu hồi phiên hiện tại và cấp phiên mới** (token mới) rồi mở `/portal` (FLOW-09 bước 6).
- Đổi mật khẩu xong: thu hồi mọi phiên khác của tài khoản. Đổi thất bại thì mật khẩu cũ vẫn dùng được.

**Xong khi:**

- [ ] Tài khoản `PENDING_ACTIVATION` mở `/portal` bị chuyển về `/account/activate`.
- [ ] Mật khẩu tạm quá 72 giờ (`temporaryPasswordExpiresAt`) không đăng nhập được; thông báo liên hệ Ban Chủ nhiệm.
- [ ] Mật khẩu 14 ký tự, có trong danh sách phổ biến, hoặc trùng mật khẩu tạm bị từ chối với lỗi 422 ghi rõ điều kiện chưa đạt.
- [ ] Sau kích hoạt, cookie phiên cũ nhận 401; phiên mới dùng được.
- [ ] Đổi mật khẩu trên trình duyệt A thì phiên trên trình duyệt B bị đăng xuất.
- [ ] Đổi mật khẩu sai mật khẩu hiện tại bị từ chối.

## Giai đoạn 3 (02/11 – 22/11)

### A5. Quản lý tài khoản & vai trò — hạn CN 22/11

**Mục tiêu:** Ban Chủ nhiệm tạo, khóa, mở khóa, ngừng hoạt động tài khoản, cấp lại mật khẩu tạm, gán và thu hồi vai trò mà không cần developer; `TECH_ADMIN` xử lý phần kỹ thuật theo đúng ma trận quyền.

**Cần có trước:** A4, B1, B3.

**Làm:**

- Trang `/admin/accounts` (danh sách, tìm theo tên, lọc trạng thái), `/admin/accounts/[id]` (tab Trạng thái tài khoản, Phiên đăng nhập, Hành động bảo mật), `/admin/accounts/[id]/roles` (vai trò, phạm vi, ngày hiệu lực, ngày hết hạn, lý do, lịch sử thay đổi), `/admin/access-control` (hàng đợi quyết định gán/thu hồi `TECH_ADMIN`).
- Quyền theo [Vai trò & quyền](../02-roles-permissions.md) §8.2, §8.6:

  | Hành động | `BOARD` | `TECH_ADMIN` |
  | --- | --- | --- |
  | Tạo tài khoản, cấp lại mật khẩu tạm, mở khóa, ngừng hoạt động | Được | Không |
  | Khóa tài khoản | Được | Chỉ khi xử lý sự cố, bắt buộc ghi mã/mô tả sự cố trong lý do |
  | Thu hồi toàn bộ phiên của một tài khoản | Được | Được |
  | Xem trạng thái kỹ thuật (phiên, lần đăng nhập sai) | Không | Được |
  | Gán/thu hồi `DEPARTMENT_MANAGER`, `BOARD`, đổi phạm vi ban | Được | Không |
  | Gán/thu hồi `TECH_ADMIN` | Ghi quyết định | Thực hiện quyết định |

- **Tạo tài khoản:** tên đăng nhập, email, họ tên, ban. Hệ thống sinh mật khẩu tạm ngẫu nhiên, **hiển thị một lần** cho `BOARD` (STATE-03), hết hạn sau 72 giờ; tài khoản ở `PENDING_ACTIVATION`, chỉ có vai trò nền `MEMBER` (RP-01). Đặt hàm tạo tài khoản ở `apps/api/src/modules/accounts/service.ts` để R6 dùng lại.
- **Khóa / mở khóa / cấp lại mật khẩu tạm / ngừng hoạt động** (FLOW-11): hộp xác nhận kèm **lý do bắt buộc**; chuyển trạng thái đúng sơ đồ tài khoản ([PRD](../01-prd.md) mục 9.2), bước sai trả 409.
  - Khóa, cấp lại mật khẩu tạm, ngừng hoạt động: thu hồi mọi phiên ngay.
  - Mở khóa: không khôi phục phiên cũ.
  - Ngừng hoạt động: thu hồi thêm mọi vai trò quản lý và đặc quyền (RP-09).
- **Gán vai trò** (FLOW-20): dòng `user_roles` có `reason`, `startsAt`, `grantedById`.
  - `DEPARTMENT_MANAGER`: bắt buộc chọn ban; tạo ở `ACTIVE`.
  - `BOARD`: bắt buộc `expiresAt` không muộn hơn ngày kết thúc nhiệm kỳ (RP-03; nơi lưu ngày này chờ [QĐ-6](./README.md#8-điểm-cần-trưởng-dự-án-quyết-định)). Tài khoản đã thiết lập 2 lớp thì `ACTIVE` ngay và thu hồi phiên cũ; chưa thiết lập thì `PENDING` cho đến khi xong B3.
  - `TECH_ADMIN` (DUAL): `BOARD` ghi quyết định → quyết định hiện trong `/admin/access-control` → một `TECH_ADMIN` khác đang hoạt động bấm thực hiện. Audit ghi cả người quyết định và người thực hiện.
  - Đổi ban của `DEPARTMENT_MANAGER`: thu hồi phạm vi cũ rồi cấp phạm vi mới trong **cùng một transaction** (RP-08).
- **Thu hồi vai trò:** ghi `status = REVOKED`, `revokedAt`, `revokedById`, lý do; thu hồi các phiên của người đó.
- **Ngưỡng tối thiểu** (RP-06, RP-07): không khóa, thu hồi, ngừng hoạt động nếu thao tác làm số `BOARD` (hoặc `TECH_ADMIN`) đang hoạt động dưới 2. Quy tắc này chỉ bật sau khi production phát hành: đọc từ biến cấu hình `ENFORCE_PRIVILEGED_MINIMUM` (thêm vào `.env.example`, mặc định `false` ở local); test bật biến này để kiểm tra.
- Mọi thao tác trên gọi `audit(...)` kèm lý do.

**Xong khi:**

- [ ] Người bị khóa đang đăng nhập bị đăng xuất ngay ở request tiếp theo; mở khóa xong phải đăng nhập lại.
- [ ] Không ai gán, thu hồi hoặc đổi vai trò của bản thân (API trả 403).
- [ ] Gán `TECH_ADMIN` cho tài khoản đang có `BOARD` (kể cả dòng `PENDING`) và ngược lại trả 409.
- [ ] Gán `TECH_ADMIN` chưa có hiệu lực cho đến khi một `TECH_ADMIN` khác thực hiện quyết định.
- [ ] Đổi ban của quản lý: không có thời điểm nào người đó có quyền ở cả hai ban.
- [ ] Ngừng hoạt động tài khoản thì mọi vai trò quản lý của tài khoản đó chuyển `REVOKED`.
- [ ] Bật `ENFORCE_PRIVILEGED_MINIMUM`: thao tác làm số `BOARD` đang hoạt động dưới 2 trả 409.
- [ ] Thiếu lý do khi khóa, mở khóa, cấp lại mật khẩu, ngừng hoạt động, gán, thu hồi trả 422.
- [ ] Mật khẩu tạm không xuất hiện trong log, audit, email hay API sau lần hiển thị đầu.
- [ ] `manager.a`, `member.a` mở `/admin/accounts` bị chặn; gọi API nhận 403. `techadmin` gọi API tạo tài khoản nhận 403.

## Lưu ý

- Mật khẩu dài 15–128 ký tự, băm bằng Argon2id qua `hashPassword`. Không ghi mật khẩu ra log, không trả về trong API, không gửi qua email.
- Không có chức năng tự đăng ký hay quên mật khẩu (AUTH-01, AUTH-10).
- Đăng nhập sai chỉ báo "Sai tên đăng nhập hoặc mật khẩu", không cho biết tài khoản có tồn tại hay không.
- `TECH_ADMIN` không xem được dữ liệu nghiệp vụ.
- Không lưu mật khẩu hay token trong `localStorage`.
- Nằm ngoài phiếu này, xem [README kế hoạch](./README.md) mục 9: lệnh bootstrap tài khoản đặc quyền đầu tiên, tác vụ hết hạn vai trò và cảnh báo 30/7 ngày, trang `/portal/account/roles`.

## Tài liệu

- [Vai trò & quyền](../02-roles-permissions.md): đọc hết
- [PRD](../01-prd.md): mục 7.3, 7.9, 9.2 (sơ đồ Tài khoản, Gán vai trò), 10.1 (SEC-03, SEC-05, SEC-06, SEC-08, SEC-11)
- [User flow](../03-user-flows.md): FLOW-09, FLOW-10, FLOW-11, FLOW-20
- [Sitemap](../04-sitemap.md): mục 6, 7.1, 8.3, 10, 11, 13 (STATE-03, STATE-07, STATE-14)
- [Kiến trúc](../06-architecture.md): mục 5 dòng 1–3
