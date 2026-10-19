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
| Trang `/admin/accounts/[id]` | A5 (T5 12/11) | B6 |
| Trang `/admin/access-control` | A6 (CN 22/11) | B6 |
| `startJob(...)` | O1 (CN 11/10) | B7 |

| Người khác cần | Việc | Hạn |
| --- | --- | --- |
| A1, A5–A7, B3–B7, C3, C4, D2, D4–D6, E4, E6, O1, O3, O6, R2, R4–R6, T4, T5 | B1 `audit(...)` | T5 08/10 |
| R3, E3 (lưu ô đồng ý); C3, C4 (kiểm tra đồng ý công khai) | B2 `recordConsent(...)`, `hasActiveConsent(...)` | CN 11/10 |
| A1, A5, A6 (cờ `twoFactorVerified`); D1 (tài khoản mẫu có TOTP) | B3 | CN 01/11 |
| O7 (release gate: báo cáo dry-run retention) | B7 | CN 29/11 |

## Giai đoạn 1 (05/10 – 11/10)

### B1. Nhật ký thao tác — hạn T5 08/10

**Mục tiêu:** một hàm `audit(...)` dùng chung để mọi mảng ghi nhật ký thao tác nhạy cảm theo cùng một định dạng.

**Làm:**

- Bảng `AuditLog` (một migration): người thực hiện (`actorType` `USER` / `SERVICE`; `actorId` khi là người, `serviceName` khi là tác vụ nền hoặc lệnh CLI), vai trò lúc thực hiện, `action` (chuỗi dạng `post.publish`, `account.lock`), loại và mã đối tượng (`targetType`, `targetId`), `category` (`BUSINESS` / `SECURITY` / `OPERATIONS`), `result` (`SUCCESS` / `FAILURE`), `reason`, `incidentId` (mã sự cố khi dùng quyền `INCIDENT`, cột riêng để bộ làm sạch `metadata` không xóa mất), `metadata` (JSON, tùy chọn), địa chỉ IP, thời điểm.
- Hàm `audit(request, { action, targetType, targetId, category, result, reason?, incidentId?, metadata? }, tx?)` trong `apps/api/src/modules/audit/service.ts`:
  - Thao tác **thành công**: truyền `tx` để nhật ký ghi cùng transaction với thao tác nghiệp vụ.
  - Thao tác **thất bại** hoặc bị từ chối: ghi **ngoài** transaction nghiệp vụ, để dòng `FAILURE` vẫn còn khi transaction rollback (Vai trò & quyền §11: ghi kết quả và lý do khi thất bại).
  - Tác vụ nền và lệnh CLI không có `request`: truyền `{ service: '<tên-tác-vụ>' }` thay cho `request`, ví dụ `audit({ service: 'role-expiry' }, {...}, tx)`. Đây là **định danh dịch vụ** theo Vai trò & quyền §12 mục 9: tác vụ nền không chạy bằng tài khoản cá nhân và luôn để lại dấu vết.
- `metadata` chỉ chứa tên trường đã thay đổi và giá trị đã tối thiểu hóa (Vai trò & quyền §11). Làm sạch **đệ quy** trước khi lưu: bỏ mọi khóa có tên chứa `password`, `token`, `secret`, `totp`, `recovery`, `code`, và các khóa chứa nội dung biểu mẫu (`answers`, `content`, `body`) (SEC-09).
- Khai báo danh sách tên `action` trong một hằng số trong cùng file, theo nhóm ở [Vai trò & quyền](../02-roles-permissions.md) mục 11.
- Không có hàm hay API sửa, xóa nhật ký.
- Nối với A1: hàm `denied(...)` trong `apps/api/src/modules/auth/rbac.ts` đang để sẵn `TODO(B1)`. Thay bằng `audit(...)` loại `SECURITY`, `result = FAILURE` cho request bị từ chối 401/403 (FLOW-20). Sửa đúng chỗ đó, báo Phúc trong PR.

**Xong khi:**

- [ ] Test: gọi `audit(...)` tạo đúng một dòng với đủ trường.
- [ ] Gọi route `requireRole('BOARD')` bằng tài khoản `MEMBER` tạo một dòng `SECURITY` / `FAILURE`.
- [ ] Test: `metadata` chứa `password`, `profileCode` hoặc `answers` (kể cả lồng trong object con) thì các khóa đó không có trong dòng đã lưu.
- [ ] Test: `audit(...)` thành công trong transaction bị rollback thì không còn dòng nhật ký; dòng `FAILURE` ghi ngoài transaction vẫn còn.
- [ ] Test: `audit({ service: 'test-job' }, ...)` lưu `actorType = SERVICE`, `actorId` rỗng.
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
- Tài khoản có vai trò đặc quyền (`PENDING`, hoặc `ACTIVE` nhưng chưa có 2 lớp, ví dụ sau khi khôi phục ở B6) chỉ mở được trang thiết lập, trang mã khôi phục và Đăng xuất (RP-13, Sitemap §6.2 mục 3); phối hợp với bộ chặn route của A3.
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
- Quyền `INCIDENT` (Vai trò & quyền §8.6): `BOARD` xem `SECURITY`/`OPERATIONS`, `TECH_ADMIN` xem `BUSINESS` chỉ khi nhập **mã sự cố** (theo sổ sự cố, O5) và lý do. Mỗi lần xem theo cách này ghi `audit(...)` loại `SECURITY` kèm mã sự cố. Áp dụng theo quy tắc chung ở [README kế hoạch](./README.md) mục 7.2.

**Xong khi:**

- [ ] Trang chỉ cho xem, không có nút sửa hay xóa; không có API sửa, xóa.
- [ ] `BOARD` không thấy dòng `SECURITY` trong danh sách; mở thẳng chi tiết nhận 403.
- [ ] `BOARD` nhập mã sự cố và lý do thì xem được dòng `SECURITY`; lần xem đó có dòng nhật ký riêng. Thiếu mã hoặc lý do trả 422.
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
  - Loại: xuất dữ liệu, chỉnh sửa dữ liệu, xóa dữ liệu (QĐ-2, FLOW-28, DATA-06).
- Trang thành viên: `/portal/data-requests` (danh sách yêu cầu đã gửi), `/portal/data-requests/new`, `/portal/data-requests/[id]` (trạng thái, kết quả, link tải file xuất).
- Trang quản trị (chỉ `BOARD`): `/admin/data-requests`, `/admin/data-requests/[id]` để chuyển trạng thái, ghi kết quả.
- Yêu cầu xuất dữ liệu: `BOARD` bấm tạo file → dùng `createExport(...)` (D6) với **người tải là người yêu cầu**, hết hạn sau 24 giờ (DATA-09, FLOW-28 bước 4).
- Yêu cầu chỉnh sửa: `BOARD` sửa dữ liệu ở trang quản lý thành viên (T5) rồi ghi kết quả vào yêu cầu (FLOW-28 bước 5).
- Yêu cầu xóa: `BOARD` bấm "Ẩn danh hồ sơ" trên `/admin/data-requests/[id]` (FLOW-28 bước 6). Trong một transaction: xóa trường tùy chọn của hồ sơ (ảnh đại diện, email liên hệ, số điện thoại, kỹ năng, lĩnh vực quan tâm), thu hồi mọi đồng ý công khai, gọi `audit(...)` ghi **tên** các trường đã xóa (không ghi giá trị). Họ tên, MSSV, lịch sử điểm danh giữ lại làm định danh tối thiểu (RP-12, PRD §10.5). Thành viên muốn rời CLB thì `BOARD` chuyển thêm Ngừng tham gia ở T5. Dữ liệu ở hồ sơ ứng tuyển, đăng ký sự kiện và bản sao lưu xử lý theo retention ([PRD](../01-prd.md) §13.1).
- Tạo yêu cầu, chuyển trạng thái, tạo file xuất đều gọi `audit(...)`.

**Xong khi:**

- [ ] Tắt đồng ý công khai ảnh thì `hasActiveConsent(... 'PUBLIC_PHOTO')` trả `false` ngay.
- [ ] Thành viên mở yêu cầu của người khác nhận 404.
- [ ] Bước chuyển trạng thái sai (ví dụ `NEW` → `COMPLETED`) trả 409.
- [ ] Tạo yêu cầu thiếu lý do, hoặc từ chối không có lý do, trả 422.
- [ ] File xuất chỉ người yêu cầu tải được; người khác hoặc sau 24 giờ nhận 404.
- [ ] Ẩn danh hồ sơ: các trường tùy chọn trống, `hasActiveConsent` mọi mục đích công khai trả `false`, nhật ký có tên trường nhưng không có giá trị cũ.
- [ ] `manager.a` xem được trạng thái đồng ý của thành viên Ban A, không xem được Ban B (404), không bật/tắt được (403).

## Lên máy chủ (23/11 – 29/11)

### B6. Khôi phục xác thực 2 lớp bằng hai người — hạn T4 25/11

**Mục tiêu:** người giữ vai trò đặc quyền mất điện thoại và mã khôi phục vẫn lấy lại được quyền, nhưng không ai tự khôi phục cho mình (RP-14, FLOW-27, AC-10).

**Cần có trước:** A6, B3.

**Làm:**

- Bảng `TwoFactorReset` (một migration): tài khoản cần khôi phục, người xác nhận danh tính (`BOARD`), cách xác minh danh tính (lý do), người thực hiện (`TECH_ADMIN`), trạng thái `PENDING` → `DONE` / `CANCELLED`, thời điểm.
- Bước 1 — `BOARD` trên `/admin/accounts/[id]` (A5): nút "Yêu cầu khôi phục 2 lớp", bắt buộc ghi cách đã xác minh danh tính.
- Bước 2 — `TECH_ADMIN` trên `/admin/access-control` (A6, thêm một khối "Khôi phục 2 lớp đang chờ"): bấm thực hiện. Hệ thống xóa secret TOTP và mã khôi phục của tài khoản, thu hồi mọi phiên. Trạng thái dòng vai trò **giữ nguyên** (sơ đồ Gán vai trò không có bước `ACTIVE → PENDING`); tài khoản không còn 2 lớp nên theo RP-13 chỉ mở được trang thiết lập cho đến khi thiết lập lại theo B3.
- Ràng buộc:
  - Người xác nhận và người thực hiện là hai tài khoản khác nhau, và **đều khác** tài khoản cần khôi phục.
  - Mỗi tài khoản chỉ có một yêu cầu `PENDING`.
  - `BOARD` hủy được yêu cầu chưa thực hiện, kèm lý do.
- Cả hai bước gọi `audit(...)` loại `SECURITY`, ghi người xác nhận và người thực hiện.

**Xong khi:**

- [ ] `board` yêu cầu, `techadmin` thực hiện: tài khoản mục tiêu mất 2 lớp cũ, phiên cũ nhận 401; đăng nhập lại bị đưa tới `/account/setup-two-factor`, thiết lập xong thì dùng lại được quyền đặc quyền.
- [ ] Tự yêu cầu hoặc tự thực hiện cho chính mình trả 403.
- [ ] `techadmin` thực hiện khi chưa có yêu cầu của `BOARD` trả 409.
- [ ] `manager.a` gọi hai API trên nhận 403.

### B7. Chạy thử retention (dry-run) — hạn CN 29/11

**Mục tiêu:** có báo cáo dry-run retention trên staging theo điều kiện phát hành ([PRD](../01-prd.md) §13); phần thực thi xóa/ẩn danh thuộc giai đoạn sau phát hành ([PRD](../01-prd.md) §13.1).

**Cần có trước:** B1, O1, R2, E2, A5 (`deactivatedAt`), O4 (staging để chạy thử).

**Làm:**

- File `apps/api/src/modules/retention/service.ts`, hàm `findExpired(now)` trả **số lượng** bản ghi hết hạn theo từng nhóm trong bảng lưu giữ ([PRD](../01-prd.md) §10.5):

  | Nhóm | Hết hạn khi |
  | --- | --- |
  | Hồ sơ không trúng tuyển hoặc đã rút | 12 tháng sau `RecruitmentRound.closesAt` |
  | Câu trả lời của hồ sơ được chấp nhận | 12 tháng sau `RecruitmentRound.closesAt` |
  | Đăng ký sự kiện công khai (không có tài khoản) | 12 tháng sau `Event.endAt` |
  | Dữ liệu liên hệ của tài khoản ngừng hoạt động | 12 tháng sau `User.deactivatedAt` (A5) |
  | Bản ghi gửi email | 90 ngày sau khi tạo |

- Lệnh `pnpm --filter @apc/api retention:dry-run`: gọi `findExpired`, in bảng số lượng, **không sửa dữ liệu**, gọi `audit({ service: 'retention' }, ...)` loại `OPERATIONS` với số lượng trong `metadata`. Không in hay ghi dữ liệu cá nhân.
- Tác vụ định kỳ `startJob('retention-dry-run', ...)` (O1) chạy hằng ngày, ghi cùng dòng nhật ký như trên.
- Chạy trên staging trước release gate; ghi kết quả vào `docs/ops/retention-dry-run.md` (ngày chạy, tag image, số lượng từng nhóm; không ghi tên người vì repository công khai).

**Xong khi:**

- [ ] Test: bản ghi mẫu quá hạn 1 ngày được đếm; bản ghi còn 1 ngày mới hết hạn không được đếm; cho từng nhóm trong bảng.
- [ ] Chạy lệnh xong, số dòng trong mọi bảng nghiệp vụ không đổi.
- [ ] Nhật ký có dòng `retention.dry_run` với `actorType = SERVICE`.
- [ ] Có `docs/ops/retention-dry-run.md` với kết quả chạy trên staging.

## Lưu ý

- Nhật ký không chứa mật khẩu, token, secret TOTP, mã khôi phục, mã hồ sơ, mã đăng ký hay toàn bộ nội dung biểu mẫu (SEC-09).
- Không gửi mã 2 lớp hay mã khôi phục qua email (NTF-05).
- Một tài khoản không được vừa là `BOARD` vừa là `TECH_ADMIN`.
- Không xóa dòng nhật ký hay dòng đồng ý; thu hồi đồng ý bằng `revokedAt`.
- Cảnh báo lệch đồng hồ (SEC-16) do Netdata trên VPS đảm nhận (O5); code TOTP không tự nới cửa sổ chấp nhận mã.
- Thực thi retention (xóa/ẩn danh theo lô, trang `/admin/data-retention`) thuộc giai đoạn sau phát hành, hạn CN 28/02/2027, người phụ trách vẫn là mảng này ([PRD](../01-prd.md) §13.1).

## Tài liệu

- [Vai trò & quyền](../02-roles-permissions.md): mục 8.6, 8.7, 9 (RP-13, RP-17), 10, 10.1, 11, 12
- [User flow](../03-user-flows.md): FLOW-21, FLOW-27, FLOW-28
- [PRD](../01-prd.md): mục 7.4 (MEM-12), 7.9, 10.1 (SEC-09, SEC-12, SEC-16), 10.5, 13, 13.1
- [Sitemap](../04-sitemap.md): mục 6, 7.2 (`PAGE-MEM-12` đến `PAGE-MEM-16`), 8.10, 8.11, 13
