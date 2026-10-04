# Dữ liệu mẫu, tệp, tài liệu, tìm kiếm, nhập CSV — Phạm Đăng Hoàng Thiên

## Bối cảnh

Mảng này làm các phần cả nhóm dùng chung và các chức năng quanh tệp:

- **Dữ liệu mẫu:** một lệnh tạo sẵn tài khoản, ban, bài viết, sự kiện, dự án, đợt tuyển, hồ sơ giả để mọi người chạy thử và kiểm thử.
- **Upload tệp:** lưu ảnh, tài liệu vào kho tệp qua S3 API (local là SeaweedFS, production là Cloudflare R2).
- **File xuất bảo vệ:** cơ chế chung cho mọi file xuất có dữ liệu cá nhân — chỉ người được chỉ định (mặc định là người tạo) tải được trong 24 giờ, sau đó tự xóa (RP-17).
- **Tìm kiếm** nội dung công khai.
- **Thư viện tài liệu nội bộ** có phân quyền và lịch sử phiên bản.
- **Nhập/xuất danh sách thành viên** bằng file CSV.

## Phụ thuộc

| Cần có | Từ việc | Dùng cho |
| --- | --- | --- |
| `requireAuth`, `requireRole`, `requireScope` | A1 (T5 08/10) | D2, D4, D5, D6 |
| `audit(...)` | B1 (T5 08/10) | D2, D4, D5, D6 |
| `startJob(...)` | O1 (CN 11/10) | D2, D6 |
| Secret TOTP cho tài khoản mẫu | B3 (CN 01/11) | D1 (bổ sung sau) |
| API tin tức, sự kiện, dự án công khai | C2, E2 | D3 |
| Khung trang admin & portal | A3 (T5 22/10) | D4, D5 |
| Trang `/admin/members` | T5 (CN 15/11) | Nút Xuất CSV của D5 |

| Người khác cần | Việc | Hạn |
| --- | --- | --- |
| Cả nhóm, Q1–Q3 | D1 dữ liệu mẫu và bộ tài khoản mẫu | T5 08/10 |
| C3, C4, E4, T3, D4 | D2 upload | CN 11/10 |
| R5, E6, D5, B5 | D6 file xuất bảo vệ | CN 08/11 |

## Giai đoạn 1 (05/10 – 11/10)

### D1. Dữ liệu mẫu — hạn T5 08/10

**Mục tiêu:** một lệnh tạo đầy đủ dữ liệu giả để cả nhóm chạy thử mọi vai trò, trạng thái và trường hợp bị chặn.

**Làm:**

- File `apps/api/src/db/seed.ts`; thêm script `"db:seed": "tsx src/db/seed.ts"` vào `apps/api/package.json`.
- Khai báo seed trong `apps/api/prisma.config.ts` (mục `migrations.seed`) để `prisma migrate reset` tự chạy seed sau khi tạo lại bảng.
- Dùng `upsert` theo khóa duy nhất (`username`, `code`, `slug`, `profileCode`) để chạy lại nhiều lần không trùng.
- Từ chối chạy khi `NODE_ENV=production`, trừ khi có `ALLOW_SEED=true`. Biến này chỉ đặt ở staging (O4) để có tài khoản mẫu cho kiểm thử; production không bao giờ đặt.
- Mật khẩu mọi tài khoản đọc từ `SEED_PASSWORD` trong `.env`, băm bằng `hashPassword`.
- Vai trò nền `MEMBER` **không** lưu vào `user_roles`. Mỗi dòng `user_roles` có `startsAt`, `reason` ("Dữ liệu mẫu"); `BOARD`, `TECH_ADMIN` có thêm `expiresAt` (ví dụ 1 năm sau) (RP-02, RP-03).
- Tài khoản mẫu:

  | Tên đăng nhập | Vai trò | Ban | Trạng thái |
  | --- | --- | --- | --- |
  | `board` | `BOARD` `ACTIVE` | — | Tài khoản `ACTIVE` |
  | `techadmin` | `TECH_ADMIN` `ACTIVE` | — | Tài khoản `ACTIVE` |
  | `board.pending` | `BOARD` `PENDING` (chưa thiết lập 2 lớp) | — | Tài khoản `ACTIVE` |
  | `manager.a` | `DEPARTMENT_MANAGER` Ban A `ACTIVE` | Ban A | Tài khoản `ACTIVE` |
  | `manager.b` | `DEPARTMENT_MANAGER` Ban B `ACTIVE` | Ban B | Tài khoản `ACTIVE` |
  | `member.a` | — | Ban A | Tài khoản `ACTIVE` |
  | `member.b` | — | Ban B | Tài khoản `ACTIVE` |
  | `pending` | — | Ban A | `PENDING_ACTIVATION`, `mustChangePassword = true`, `isTemporaryPassword = true`, `temporaryPasswordExpiresAt` = 72 giờ sau |
  | `locked` | — | Ban A | `LOCKED` |
  | `inactive` | — | Ban A | `INACTIVE`, `memberStatus = LEFT` |

  Sau khi B3 merge, `board` và `techadmin` được bổ sung secret TOTP cố định chỉ dùng local (B3 phối hợp).

- Dữ liệu khác:

  | Loại | Dữ liệu |
  | --- | --- |
  | Ban | `Ban A` (`code: ban-a`), `Ban B` (`code: ban-b`) `ACTIVE`; `Ban C` (`code: ban-c`) `ARCHIVED`, không có thành viên |
  | Bài viết | 4 bài `PUBLISHED` + `PUBLIC`, 1 `DRAFT`, 1 `ARCHIVED`, 1 thông báo `INTERNAL` của Ban A |
  | Sự kiện | 1 `PUBLISHED` sắp diễn ra, 1 `CANCELLED`, 1 `ENDED`, 1 `DRAFT`, 1 `ARCHIVED`. Sự kiện nội bộ bổ sung khi E2 thêm trường phạm vi |
  | Dự án | 2 `PUBLISHED`, 1 `DRAFT`, 1 `ARCHIVED` |
  | Đợt tuyển | 1 `OPEN` (đang nhận đơn), 1 `CLOSED`, 1 `DRAFT`, 1 `ARCHIVED` |
  | Hồ sơ ứng tuyển | Trong đợt `OPEN`: 2 hồ sơ chọn Ban A, 2 hồ sơ chọn Ban B, trạng thái khác nhau (`NEW`, `REVIEWING`, `INTERVIEW`) |

- Email dạng `<tên đăng nhập>@example.com`; MSSV, số điện thoại là số giả.
- Thêm mục "Tài khoản mẫu" vào [tài liệu cài đặt](../07-local-development.md) (bảng tài khoản + cách chạy `db:seed`).

**Xong khi:**

- [ ] `pnpm --filter @apc/api db:seed` chạy 2 lần liền không lỗi, số dòng mỗi bảng không đổi sau lần thứ 2.
- [ ] `prisma migrate reset` tự chạy seed.
- [ ] `user_roles` không có dòng `MEMBER`; mọi dòng có `startsAt` và `reason`.
- [ ] Không có email, tên, MSSV thật.
- [ ] Đã nhắn cả nhóm bảng tài khoản và lệnh chạy.

### D2. Upload tệp — hạn CN 11/10

**Mục tiêu:** một module upload dùng chung cho ảnh bài viết, ảnh dự án, ảnh sự kiện, ảnh đại diện và tài liệu nội bộ; tệp nội bộ không bao giờ lộ đường dẫn kho.

**Cần có trước:** A1.

**Làm:**

- Cài `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@fastify/multipart`, `file-type`.
- Module `apps/api/src/modules/files/`. Cấu hình kho đọc từ `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` trong `.env`.
- Bảng `StoredFile` (một migration): khóa lưu trong kho, tên gốc, loại MIME, dung lượng, người tải lên, `purpose` (`CONTENT_IMAGE`, `AVATAR`, `DOCUMENT`), `visibility` (`PUBLIC` / `INTERNAL`), trạng thái quét (`PENDING` / `CLEAN` / `REJECTED`).
- `POST /portal/files` (cần đăng nhập), nhận `purpose`:
  - **Server quyết định `visibility`**, mặc định `INTERNAL`. Chỉ `CONTENT_IMAGE` do `DEPARTMENT_MANAGER`/`BOARD` tải lên mới được `PUBLIC`. `AVATAR` luôn `INTERNAL` (ảnh đại diện chỉ hiện trong nội bộ, MEM-10); trang dự án công khai hiện ảnh thành viên qua endpoint kiểm tra đồng ý của C4, không đổi `visibility`.
  - Lưu với **khóa ngẫu nhiên** (không dùng tên gốc), trả `{ id }`; không trả URL kho.
- Kiểm tra tệp:
  - Loại xác định bằng **nội dung** tệp (`file-type`), không tin đuôi file hay header `Content-Type`.
  - Chấp nhận: ảnh JPG, PNG, WebP, GIF; PDF; DOCX, XLSX, PPTX (DOC-05). Từ chối mọi loại khác, đặc biệt tệp thực thi.
  - Tối đa 20 MB (DOC-06).
- Quét mã độc trước khi tệp dùng được (SEC-15, STATE-05), bằng ClamAV theo [Kiến trúc](../06-architecture.md) mục 5 dòng 12 (QĐ-5):
  - Tệp mới lưu với trạng thái `PENDING`; trạng thái này là **vùng cách ly**: không đường tải nào trả tệp chưa `CLEAN`.
  - File `apps/api/src/modules/files/scan.ts` gửi nội dung tệp tới `clamd` bằng lệnh `INSTREAM` qua TCP, dùng `node:net` có sẵn (không cài thư viện). Cấu hình `FILE_SCAN_MODE` (`clamav` / `skip`), `CLAMAV_HOST`, `CLAMAV_PORT` trong `.env.example`.
  - Quét ngay trong request upload. Sạch thì `CLEAN`. Phát hiện mã độc thì `REJECTED`, xóa đối tượng khỏi kho, trả 422 và ghi `audit(...)` loại `SECURITY`. ClamAV không phản hồi thì giữ `PENDING`; tác vụ `startJob('file-scan', ...)` (O1) quét lại mỗi phút.
  - `FILE_SCAN_MODE=skip` (mặc định ở local và CI) đặt `CLEAN` kèm log cảnh báo. API **không khởi động** khi `NODE_ENV=production` mà `FILE_SCAN_MODE` khác `clamav`.
  - Thêm dịch vụ `clamav` (image `clamav/clamav`) vào `compose.yaml` với `profiles: [scan]`, để `pnpm infra:up` không bật mặc định (ClamAV dùng khoảng 1,5 GB RAM). Ghi lệnh bật trong [tài liệu cài đặt](../07-local-development.md) mục 10.
- Đường tải:
  - `GET /public/files/:id` — chỉ tệp `PUBLIC` + `CLEAN`.
  - `GET /portal/files/:id` — tệp `INTERNAL` loại `AVATAR` cho người đã đăng nhập. Tài liệu (`DOCUMENT`) chỉ tải qua D4.
  - Header an toàn: `X-Content-Type-Options: nosniff`, `Content-Type` theo loại đã kiểm tra, `Content-Disposition: attachment` cho tệp không phải ảnh.
- Component web `FileUpload` trong `apps/web/src/components/` (chọn tệp, xem trước ảnh, báo lỗi, trạng thái đang xử lý) cho người khác dùng lại.

**Xong khi:**

- [ ] Upload ảnh JPG thành công, ảnh bài viết hiển thị qua `/api/public/files/:id`.
- [ ] Tệp `.exe` đổi đuôi thành `.png` bị từ chối (422).
- [ ] Tệp 21 MB bị từ chối.
- [ ] Chưa đăng nhập upload nhận 401.
- [ ] `member.a` upload với `purpose = CONTENT_IMAGE` nhận tệp `INTERNAL`, không mở được qua `/public/files/:id` (404).
- [ ] Ảnh đại diện không mở được qua `/public/files/:id`.
- [ ] Phản hồi API không chứa URL của kho tệp.
- [ ] Test với một server `clamd` giả (dựng bằng `node:net` trong test) trả `FOUND`: tệp bị từ chối 422, không còn trong kho, có dòng nhật ký `SECURITY`.
- [ ] Bật ClamAV thật (`--profile scan`), tải lên tệp thử EICAR: bị từ chối. Chuỗi EICAR ghép lúc chạy, không lưu nguyên văn trong repo để phần mềm diệt virus trên máy thành viên không cách ly file.
- [ ] Tệp `PENDING` không mở được qua mọi đường tải (404).
- [ ] Đã nhắn cả nhóm cách dùng API và `FileUpload`.

## Giai đoạn 2 (12/10 – 01/11)

### D3. Tìm kiếm — hạn CN 01/11

**Mục tiêu:** khách tìm được tin tức, sự kiện, dự án đang công khai theo tiêu đề.

**Cần có trước:** C2, E2 (có thể bắt đầu với phần tin tức trước).

**Làm:**

- `GET /public/search?q=` — tìm theo tiêu đề, không phân biệt hoa thường, chỉ trong nội dung đang công khai (cùng điều kiện với API danh sách của C2, E2); trả kết quả chia nhóm tin tức / sự kiện / dự án, tối đa 10 mục mỗi nhóm. `q` trống thì trả danh sách mặc định (mục mới nhất mỗi nhóm) (FLOW-02).
- Trang `/search?q=` dùng lại card của C1 và E1; từ khóa giữ trên URL. Gắn `noindex, follow`, canonical không chứa từ khóa (Sitemap §16).
- Không có kết quả: trạng thái rỗng kèm nút Xóa từ khóa.
- Ô tìm kiếm trên trang danh sách tin tức, sự kiện, dự án chuyển sang `/search?q=`. Báo Nguyễn Gia Bảo và Lê Đăng Nghĩa trước khi sửa file trang của họ.

**Xong khi:**

- [ ] Từ khóa có trong tiêu đề bài `DRAFT`, `ARCHIVED`, bài `INTERNAL` hoặc sự kiện nội bộ không ra các mục đó (có test).
- [ ] `q` trống hiện danh sách mặc định.
- [ ] Không có kết quả thì hiện trạng thái rỗng và nút Xóa từ khóa.
- [ ] Lỗi tải kết quả không làm mất từ khóa trên URL.

## Giai đoạn 3 (02/11 – 22/11)

### D6. File xuất bảo vệ — hạn CN 08/11

**Mục tiêu:** một cơ chế dùng chung cho mọi file xuất có dữ liệu cá nhân (danh sách hồ sơ, danh sách đăng ký, danh sách thành viên, dữ liệu cá nhân theo yêu cầu).

**Cần có trước:** D2, B1.

**Làm:**

- Bảng `ExportFile` (một migration): người tạo, người được tải (mặc định là người tạo), loại, khóa trong kho, trạng thái `CREATING` / `READY` / `EXPIRED`, `expiresAt` (24 giờ sau khi tạo).
- Hàm `createExport(request, { kind, filename, rows, downloaderId? })` trong `apps/api/src/modules/exports/service.ts`: tạo file CSV bằng `csv-stringify` (UTF-8 có BOM để Excel đọc đúng tiếng Việt, chống chèn công thức theo luật chung), lưu vào kho, kiểm tra quyền của người gọi **ngay lúc tạo**, gọi `audit(...)`.
- `GET /portal/exports/:id/download` — chỉ người được tải, trước `expiresAt`; khác đi trả 404. Trả tệp qua API, không trả URL kho.
- Tác vụ `startJob('export-cleanup', ...)` (O1) mỗi giờ xóa tệp hết hạn khỏi kho và chuyển `EXPIRED`.
- Component web hiện trạng thái file xuất: đang tạo / sẵn sàng (nút Tải) / hết hạn (STATE-06).
- Cài `csv-stringify`, `csv-parse` (D5 dùng).

**Xong khi:**

- [ ] Người khác người tạo mở link tải nhận 404.
- [ ] Sau 24 giờ (test chỉnh thời gian) link tải trả 404 và tệp không còn trong kho.
- [ ] File mở bằng Excel hiển thị đúng tiếng Việt; ô bắt đầu bằng `=` hiện nguyên chữ.
- [ ] Mỗi lần tạo file xuất có dòng nhật ký.
- [ ] Đã nhắn Phan Anh Khương (R5), Lê Đăng Nghĩa (E6), Trương Phúc Minh (B5) cách dùng.

### D4. Thư viện tài liệu — hạn T5 12/11

**Mục tiêu:** đăng tài liệu nội bộ có phân quyền; thay tệp mới vẫn giữ và khôi phục được bản cũ.

**Cần có trước:** D2, A3, B1.

**Làm:**

- Bảng `Document` (tên, mô tả, chuyên mục, ban sở hữu, phạm vi xem: theo ban hoặc toàn CLB, có thể giới hạn theo vai trò; trạng thái `ACTIVE`/`ARCHIVED`) và `DocumentVersion` (tệp, người tải lên, thời điểm) — một migration.
- Trang quản trị: `/admin/documents`, `/admin/documents/upload`, `/admin/documents/[id]`, `/admin/documents/[id]/versions`.
- Quyền theo [Vai trò & quyền](../02-roles-permissions.md) §8.5:
  - `DEPARTMENT_MANAGER`: tải lên, thay tệp, sửa thông tin, xem và khôi phục phiên bản trước, lưu trữ, khôi phục tài liệu của ban mình; chỉ phân quyền **trong ban**.
  - `BOARD`: mọi tài liệu; phân quyền **toàn CLB**.
  - `TECH_ADMIN`: không truy cập nội dung (404). Riêng metadata lưu trữ (khóa trong kho, dung lượng, trạng thái quét) xem được theo quyền `INCIDENT`: nhập mã sự cố và lý do, mỗi lần xem ghi `audit(...)` loại `SECURITY` ([README kế hoạch](./README.md) mục 7.2).
- Ban `ARCHIVED` không nhận tài liệu mới.
- Trang thành viên: `/portal/documents`, `/portal/documents/[id]` — chỉ liệt kê tài liệu `ACTIVE` người đó được xem.
- Tải xuống: `GET /portal/documents/:id/versions/:versionId/download` kiểm tra quyền **ngay lúc tải** rồi trả nội dung tệp qua API (không dùng URL ký sẵn), để quyền bị thu hồi có hiệu lực ngay (FLOW-19). Chỉ trả phiên bản `CLEAN`.
- Thay tệp tạo `DocumentVersion` mới. Khôi phục phiên bản trước tạo một phiên bản mới sao chép từ bản cũ; không xóa phiên bản nào.
- Lưu trữ và khôi phục tài liệu; không có nút xóa vật lý.
- Tải lên, thay thế, khôi phục phiên bản, đổi quyền, lưu trữ gọi `audit(...)`.

**Xong khi:**

- [ ] `member.b` mở link tải tài liệu chỉ dành cho Ban A nhận 404, kể cả khi có link đúng.
- [ ] Thu hồi quyền của một thành viên xong, link tải cũ của người đó trả 404 ngay.
- [ ] Thay tệp mới xong, tải được cả phiên bản mới và phiên bản trước; khôi phục bản trước thành bản hiện hành được.
- [ ] Tài liệu `ARCHIVED` không hiện ở `/portal/documents` và thành viên không tải được.
- [ ] `manager.a` không sửa được tài liệu của Ban B (404); chọn phạm vi toàn CLB nhận 403.
- [ ] `techadmin` gọi API tài liệu nhận 404; gọi API metadata không kèm mã sự cố nhận 422, kèm mã sự cố thì xem được và có dòng nhật ký.

### D5. Nhập/xuất CSV thành viên — hạn CN 22/11

**Mục tiêu:** Ban Chủ nhiệm nhập danh sách thành viên hiện có bằng file CSV, và xuất danh sách thành viên.

**Cần có trước:** D6, A3, A5 (`createAccount`). Nút Xuất CSV gắn vào trang `/admin/members` sau khi T5 merge.

**Làm:**

- File mẫu tải được từ trang, kèm hướng dẫn định dạng. Cột: `fullName`, `username`, `email`, `studentId`, `faculty`, `major`, `cohort`, `departmentCode`. Encoding UTF-8.
- Trang `/admin/members/import` (chỉ `BOARD`), dạng wizard hai bước (FLOW-25, STATE-04):
  1. **Kiểm tra:** tải file lên. Trước khi đọc nội dung, từ chối file quá giới hạn dung lượng hoặc số dòng (hằng số trong code). Kiểm tra encoding, header, trường bắt buộc, định dạng email, MSSV, tên đăng nhập; trùng trong file; trùng với dữ liệu hiện có; mã ban không tồn tại hoặc ban `ARCHIVED`. API trả mã lô (`batchId`), hash của file, số dòng hợp lệ và lỗi theo dòng, cột; có nút tải file lỗi. **Không lưu file** và chưa ghi gì vào database.
  2. **Nhập:** chỉ bật khi không còn lỗi. Người dùng gửi lại cùng file kèm `batchId`; server kiểm tra hash khớp và lô chưa nhập, rồi ghi toàn bộ lô trong **một transaction**; một dòng lỗi thì không dòng nào được ghi (BR-18). Gửi lại cùng `batchId` lần hai không tạo trùng.
- Tài khoản tạo từ CSV bằng `createAccount(...)` (A5), ở `PENDING_ACTIVATION`, chỉ có vai trò nền `MEMBER`; không gán được vai trò đặc quyền qua CSV (RP-16). Mật khẩu tạm cấp riêng từng người qua trang quản lý tài khoản (A5); không tạo file chứa mật khẩu.
- Xuất danh sách thành viên (chỉ `BOARD`): tạo bằng `createExport(...)` (D6).
- Nhập ghi `audit(...)` gồm mã lô, hash file, người nhập, số bản ghi, kết quả; xuất ghi người xuất, số dòng. Không ghi nội dung file.

**Xong khi:**

- [ ] File có 1 dòng lỗi thì báo đúng số dòng, đúng cột và không nhập dòng nào; tải được file lỗi.
- [ ] Gửi lại cùng một lô 2 lần không tạo trùng thành viên.
- [ ] Mã ban trỏ tới Ban C (`ARCHIVED`) bị báo lỗi.
- [ ] File sai header hoặc quá giới hạn bị từ chối trước khi kiểm tra từng dòng.
- [ ] Chỉ `BOARD` nhập/xuất được; `manager.a` gọi API nhận 403.
- [ ] Mỗi lần nhập, xuất có dòng nhật ký với mã lô và hash.

## Lưu ý

- Dữ liệu mẫu chỉ dùng thông tin giả, ví dụ `member.a@example.com`.
- Tài liệu nội bộ luôn kiểm tra quyền lúc tải (BR-12); không trả URL kho tệp cho tệp nội bộ (Kiến trúc mục 5 dòng 5).
- Tệp lưu bằng khóa ngẫu nhiên, không dùng tên gốc làm đường dẫn.
- Xóa vật lý tệp tài liệu cần hai người (Vai trò & quyền §8.5) và đi cùng thực thi retention, thuộc giai đoạn sau phát hành, hạn CN 28/02/2027 ([PRD](../01-prd.md) §13.1). Bản phát hành đầu không có chức năng xóa vật lý tài liệu.

## Tài liệu

- [PRD](../01-prd.md): mục 7.4 (MEM-08, MEM-09), 7.8, 8 (BR-12, BR-18), 10.1 (SEC-15)
- [Vai trò & quyền](../02-roles-permissions.md): mục 8.2, 8.5, 9 (RP-16, RP-17), 12
- [User flow](../03-user-flows.md): FLOW-02, FLOW-19, FLOW-25
- [Sitemap](../04-sitemap.md): mục 5.2 (`PAGE-PUB-17`), 7.2 (`PAGE-MEM-07`, `PAGE-MEM-08`), 8.3 (`PAGE-MGT-MEM-03`), 8.7, 13 (STATE-04 đến STATE-06), 16
- [Kiến trúc](../06-architecture.md): mục 5 dòng 5, 12
