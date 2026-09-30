# Bảo mật & nhật ký — Trương Phúc Minh

## Bối cảnh

Mảng này làm các phần bảo vệ dữ liệu dùng chung cho cả hệ thống:

- **Nhật ký thao tác (audit log):** ghi lại ai làm gì, với đối tượng nào, lúc nào, kết quả ra sao. Chỉ đọc, không sửa hay xóa được; giữ tối thiểu 12 tháng (DATA-04).
- **Đồng ý xử lý dữ liệu (consent):** khi ứng viên nộp đơn, khách đăng ký sự kiện hoặc thành viên cho phép công khai tên/ảnh/thông tin, hệ thống lưu bằng chứng đồng ý kèm mục đích, đối tượng và phiên bản chính sách (DATA-07).
- **Xác thực 2 lớp (TOTP):** tài khoản `BOARD`, `TECH_ADMIN` nhập thêm mã 6 số từ ứng dụng xác thực (Google Authenticator, Microsoft Authenticator…).
- **Quyền riêng tư của thành viên:** tự bật/tắt đồng ý công khai, gửi yêu cầu về dữ liệu cá nhân.

## Phụ thuộc

| Cần có | Từ việc | Dùng cho |
| --- | --- | --- |
| `requireAuth`, `requireRole`, `requireScope` | A1 (T5 08/10) | B3, B4, B5 |
| Đăng nhập, phiên | A2 (CN 11/10) | B3 |
| Khung trang portal & admin | A3 (T5 22/10) | B4, B5 |
| File xuất bảo vệ `createExport(...)` | D6 (CN 08/11) | B5 |

| Người khác cần | Việc | Hạn |
| --- | --- | --- |
| A1, A5, C3, C4, D4, D5, D6, E4, E6, O3, R2, R4, R5, R6, T4, T5 | B1 `audit(...)` | T5 08/10 |
| R3, E3 (lưu ô đồng ý); C3, C4 (kiểm tra đồng ý công khai) | B2 `recordConsent(...)`, `hasActiveConsent(...)` | CN 11/10 |
| A1, A5 (cờ `twoFactorVerified`); D1 (tài khoản mẫu có TOTP) | B3 | CN 01/11 |

## Giai đoạn 1 (05/10 – 11/10)

### B1. Nhật ký thao tác — hạn T5 08/10

**Mục tiêu:** một hàm `audit(...)` dùng chung để mọi mảng ghi nhật ký thao tác nhạy cảm theo cùng một định dạng.

**Làm:**

- Bảng `AuditLog` (một migration): người thực hiện (`actorId`, có thể rỗng khi là hệ thống), vai trò lúc thực hiện, `action` (chuỗi dạng `post.publish`, `account.lock`), loại và mã đối tượng (`targetType`, `targetId`), `category` (`BUSINESS` / `SECURITY` / `OPERATIONS`), `result` (`SUCCESS` / `FAILURE`), `reason`, `metadata` (JSON, tùy chọn), địa chỉ IP, thời điểm.
- Hàm `audit(request, { action, targetType, targetId, category, result, reason?, metadata? }, tx?)` trong `apps/api/src/modules/audit/service.ts`:
  - Thao tác **thành công**: truyền `tx` để nhật ký ghi cùng transaction với thao tác nghiệp vụ.
  - Thao tác **thất bại** hoặc bị từ chối: ghi **ngoài** transaction nghiệp vụ, để dòng `FAILURE` vẫn còn khi transaction rollback (Vai trò & quyền §11: ghi kết quả và lý do khi thất bại).
- `metadata` chỉ chứa tên trường đã thay đổi và giá trị đã tối thiểu hóa (Vai trò & quyền §11). Làm sạch **đệ quy** trước khi lưu: bỏ mọi khóa có tên chứa `password`, `token`, `secret`, `totp`, `recovery`, `code`, và các khóa chứa nội dung biểu mẫu (`answers`, `content`, `body`) (SEC-09).
- Khai báo danh sách tên `action` trong một hằng số trong cùng file, theo nhóm ở [Vai trò & quyền](../02-roles-permissions.md) mục 11.
- Không có hàm hay API sửa, xóa nhật ký.

**Xong khi:**

- [ ] Test: gọi `audit(...)` tạo đúng một dòng với đủ trường.
- [ ] Test: `metadata` chứa `password`, `profileCode` hoặc `answers` (kể cả lồng trong object con) thì các khóa đó không có trong dòng đã lưu.
- [ ] Test: `audit(...)` thành công trong transaction bị rollback thì không còn dòng nhật ký; dòng `FAILURE` ghi ngoài transaction vẫn còn.
- [ ] Đã nhắn cả nhóm cách dùng kèm ví dụ cho trường hợp thành công và thất bại, và danh sách `action` có sẵn.

### B2. Quyền riêng tư & đồng ý dữ liệu — hạn CN 11/10

**Mục tiêu:** có trang chính sách quyền riêng tư và hàm dùng chung để lưu, kiểm tra sự đồng ý.

**Làm:**

- Trang `/privacy` (route và link ở footer đã có sẵn; thay `Placeholder`). Nội dung dựng từ [PRD](../01-prd.md) mục 10.5: dữ liệu thu thập, mục đích, bảng thời gian lưu giữ, quyền của người dùng, cách liên hệ. Ghi rõ **phiên bản** (ví dụ `2026-10`) và ngày hiệu lực ở đầu trang. Nội dung cần Ban Chủ nhiệm duyệt trước khi phát hành.
- Phiên bản chính sách hiện hành khai báo một chỗ trong code API, dùng chung cho mọi lần lưu đồng ý.
- Bảng `ConsentRecord` (một migration):
  - Chủ thể: `subjectType` (`APPLICATION` / `EVENT_REGISTRATION` / `USER`), `subjectId`.
  - Mục đích `purpose`: `RECRUITMENT_PROCESSING`, `EVENT_REGISTRATION`, `PUBLIC_NAME`, `PUBLIC_PHOTO`, `PUBLIC_PROFILE` (thông tin cá nhân khác như kỹ năng, lĩnh vực) (MEM-12).
  - Đối tượng áp dụng (tùy chọn): `targetType`, `targetId` — ví dụ đồng ý hiện tên trên một dự án cụ thể (MEM-12 "theo từng mục đích/đối tượng"). Để trống là áp dụng chung.
  - `policyVersion`, `grantedAt`, `revokedAt`.
- Hàm trong `apps/api/src/modules/consent/service.ts`:
  - `recordConsent(tx, { subjectType, subjectId, purpose, targetType?, targetId? })` — lưu đồng ý với phiên bản hiện hành, chạy trong transaction của thao tác gọi nó.
  - `revokeConsent(...)` — ghi `revokedAt`, không xóa dòng.
  - `hasActiveConsent({ subjectType, subjectId, purpose, targetType?, targetId? })` — `true` khi có dòng chưa thu hồi khớp đối tượng cụ thể hoặc áp dụng chung.

**Xong khi:**

- [ ] `/privacy` hiện đủ các mục, có phiên bản và ngày hiệu lực; link ở footer mở đúng trang.
- [ ] Test cho `recordConsent`, `revokeConsent`, `hasActiveConsent`; thu hồi xong `hasActiveConsent` trả `false`.
- [ ] Test: đồng ý cho dự án X không làm `hasActiveConsent` với dự án Y trả `true`.
- [ ] Dòng đồng ý lưu đúng `policyVersion` hiện hành.
- [ ] Đã nhắn Phan Anh Khương (R3), Lê Đăng Nghĩa (E3), Nguyễn Gia Bảo (C3, C4) cách dùng.

## Giai đoạn 2 (12/10 – 01/11)

### B3. Xác thực 2 lớp — hạn CN 01/11

**Mục tiêu:** tài khoản `BOARD`, `TECH_ADMIN` chỉ dùng được quyền đặc quyền sau khi thiết lập và nhập đúng mã TOTP.

**Cần có trước:** A2.

**Làm:**

- Cài `otpauth` và `qrcode`.
- Migration: thêm vào `User` trường secret TOTP **đã mã hóa**, thời điểm bật, bước thời gian (time step) của mã hợp lệ gần nhất; bảng mã khôi phục (bản băm, thời điểm đã dùng). Khóa mã hóa đọc từ biến `TOTP_ENCRYPTION_KEY` trong `.env` (thêm vào `.env.example` với giá trị mẫu chỉ dùng local) (SEC-16).
- Luồng thiết lập (FLOW-27):
  1. `/account/setup-two-factor`: nhập lại mật khẩu → hiện mã QR và mã nhập tay → nhập mã 6 số để xác nhận.
  2. `/account/recovery-codes`: hiện 10 mã khôi phục **một lần**; tải lại trang không xem lại được. Người dùng tick "Đã lưu mã khôi phục" mới đi tiếp.
  3. Hệ thống chuyển vai trò đặc quyền `PENDING` sang `ACTIVE`, thu hồi mọi phiên, ghi `audit(...)`, yêu cầu đăng nhập lại.
- Đăng nhập đặc quyền: sau mật khẩu đúng, `/account/two-factor` nhận mã 6 số hoặc một mã khôi phục. Mã đã dùng (cùng time step) hoặc ngoài cửa sổ cho phép bị từ chối. Đúng thì đặt `twoFactorVerified = true` trên phiên.
- Gỡ đoạn tạm của A2 (mọi phiên `twoFactorVerified = true`); thay bằng kiểm tra thật. Tài khoản không có vai trò đặc quyền vẫn dùng portal bình thường mà không cần mã.
- Dùng mã khôi phục xong: chuyển đến `/portal/account/security`, bắt buộc tạo bộ mã mới (API tạo lại mã, yêu cầu nhập lại mật khẩu) rồi hiện qua `/account/recovery-codes`.
- Tài khoản có vai trò đặc quyền `PENDING` chỉ mở được trang thiết lập, trang mã khôi phục và Đăng xuất (RP-13, Sitemap §6.2 mục 3); phối hợp với bộ chặn route của A3.
- Giới hạn tần suất nhập mã bằng `config.rateLimit`.
- Cập nhật dữ liệu mẫu cùng Phạm Đăng Hoàng Thiên: `board`, `techadmin` có secret TOTP cố định **chỉ dùng local**; thêm secret vào mục Tài khoản mẫu của [tài liệu cài đặt](../07-local-development.md).

**Xong khi:**

- [ ] Chưa thiết lập 2 lớp thì vai trò vẫn ở `PENDING`; mở trang quản trị bị đưa về `/account/setup-two-factor`.
- [ ] Đăng nhập `board` đúng mật khẩu nhưng chưa nhập mã thì API quản trị trả 403.
- [ ] Dùng lại cùng một mã 6 số lần thứ hai bị từ chối.
- [ ] Mã khôi phục chỉ hiện một lần; mỗi mã chỉ dùng được một lần; dùng xong bị bắt tạo bộ mới.
- [ ] Database không chứa secret TOTP hay mã khôi phục dạng rõ.
- [ ] Secret, mã TOTP, mã khôi phục không xuất hiện trong log, audit, email.
- [ ] Kích hoạt vai trò đặc quyền có dòng nhật ký.

## Giai đoạn 3 (02/11 – 22/11)

### B4. Xem nhật ký — hạn T5 12/11

**Mục tiêu:** người có quyền tra cứu nhật ký thao tác theo người, hành động, đối tượng, kết quả, thời gian.

**Cần có trước:** A3, B1.

**Làm:**

- API `GET /admin/audit-logs` (lọc theo người thực hiện, `action`, loại/mã đối tượng, `result`, khoảng thời gian; phân trang) và `GET /admin/audit-logs/:id`.
- Khoảng thời gian bắt buộc và có giới hạn tối đa (hằng số trong code, ví dụ 31 ngày); vượt giới hạn trả 422 với thông báo yêu cầu thu hẹp (FLOW-21).
- Trang `/admin/audit-logs` và `/admin/audit-logs/[id]`: chi tiết hiện thời gian (`formatDateTime`), IP, vai trò, thay đổi, kết quả.
- `BOARD` xem nhật ký `BUSINESS`; `TECH_ADMIN` xem `SECURITY` và `OPERATIONS`. Lọc ngay trong truy vấn. Mở chi tiết một dòng thuộc loại ngoài quyền trả **403** (FLOW-21).
- Quyền `INCIDENT` (xem loại còn lại khi có sự cố) chưa làm ở phiếu này, xem [README kế hoạch](./README.md) mục 9.

**Xong khi:**

- [ ] Trang chỉ cho xem, không có nút sửa hay xóa; không có API sửa, xóa.
- [ ] `BOARD` không thấy dòng `SECURITY` trong danh sách; mở thẳng chi tiết nhận 403.
- [ ] `member.a`, `manager.a` gọi API nhận 403.
- [ ] Lọc theo khoảng thời gian dùng giờ Việt Nam trên giao diện, đúng với thời gian UTC lưu trong database.
- [ ] Khoảng thời gian vượt giới hạn trả 422.

### B5. Quyền riêng tư của thành viên — hạn CN 22/11

**Mục tiêu:** thành viên tự quản lý đồng ý công khai và gửi yêu cầu về dữ liệu cá nhân; Ban Chủ nhiệm xử lý yêu cầu; người quản lý nội dung xem được trạng thái đồng ý.

**Cần có trước:** A3, B2, D6.

**Làm:**

- `/portal/privacy`: danh sách mục đích công khai (tên, ảnh, thông tin hồ sơ), theo từng đối tượng nếu có; nút bật/tắt gọi `recordConsent` / `revokeConsent`. Hiện phiên bản chính sách và thời điểm đồng ý.
- API xem trạng thái đồng ý cho người quản lý nội dung: `DEPARTMENT_MANAGER` xem thành viên trong ban, `BOARD` xem tất cả; chỉ đọc, không bật/tắt thay thành viên (MEM-12, Vai trò & quyền §8.7). C4 dùng API này.
- Bảng `DataRequest` (một migration): người yêu cầu, loại, **lý do**, **phạm vi dữ liệu**, trạng thái `NEW` → `PROCESSING` → `COMPLETED` / `REJECTED`, lý do từ chối, người xử lý, kết quả, thời điểm.
  - Loại: xuất dữ liệu, chỉnh sửa dữ liệu. Loại xóa dữ liệu chờ [QĐ-2](./README.md#8-điểm-cần-trưởng-dự-án-quyết-định).
- Trang thành viên: `/portal/data-requests` (danh sách yêu cầu đã gửi), `/portal/data-requests/new`, `/portal/data-requests/[id]` (trạng thái, kết quả, link tải file xuất).
- Trang quản trị (chỉ `BOARD`): `/admin/data-requests`, `/admin/data-requests/[id]` để chuyển trạng thái, ghi kết quả.
- Yêu cầu xuất dữ liệu: `BOARD` bấm tạo file → dùng `createExport(...)` (D6) với **người tải là người yêu cầu**, hết hạn sau 24 giờ (DATA-09, FLOW-28 bước 4).
- Tạo yêu cầu, chuyển trạng thái, tạo file xuất đều gọi `audit(...)`.

**Xong khi:**

- [ ] Tắt đồng ý công khai ảnh thì `hasActiveConsent(... 'PUBLIC_PHOTO')` trả `false` ngay.
- [ ] Thành viên mở yêu cầu của người khác nhận 404.
- [ ] Bước chuyển trạng thái sai (ví dụ `NEW` → `COMPLETED`) trả 409.
- [ ] Tạo yêu cầu thiếu lý do, hoặc từ chối không có lý do, trả 422.
- [ ] File xuất chỉ người yêu cầu tải được; người khác hoặc sau 24 giờ nhận 404.
- [ ] `manager.a` xem được trạng thái đồng ý của thành viên Ban A, không xem được Ban B (404), không bật/tắt được (403).

## Lưu ý

- Nhật ký không chứa mật khẩu, token, secret TOTP, mã khôi phục, mã hồ sơ, mã đăng ký hay toàn bộ nội dung biểu mẫu (SEC-09).
- Không gửi mã 2 lớp hay mã khôi phục qua email (NTF-05).
- Một tài khoản không được vừa là `BOARD` vừa là `TECH_ADMIN`.
- Không xóa dòng nhật ký hay dòng đồng ý; thu hồi đồng ý bằng `revokedAt`.
- Nằm ngoài phiếu này, xem [README kế hoạch](./README.md) mục 9: khôi phục TOTP hai người (RP-14), cảnh báo lệch đồng hồ (SEC-16), retention, thực thi ẩn danh/xóa, quyền `INCIDENT`.

## Tài liệu

- [Vai trò & quyền](../02-roles-permissions.md): mục 8.6, 8.7, 9 (RP-13, RP-17), 10, 10.1, 11, 12
- [User flow](../03-user-flows.md): FLOW-21, FLOW-27, FLOW-28
- [PRD](../01-prd.md): mục 7.4 (MEM-12), 7.9, 10.1 (SEC-09, SEC-12, SEC-16), 10.5
- [Sitemap](../04-sitemap.md): mục 6, 7.2 (`PAGE-MEM-12` đến `PAGE-MEM-16`), 8.10, 8.11, 13
