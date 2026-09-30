# Email & máy chủ — Đặng Phúc An Khang

## Bối cảnh

Mảng này gồm hai phần:

- **Email giao dịch:** hệ thống gửi email xác nhận khi nộp đơn tuyển, đăng ký hoặc hủy đăng ký sự kiện, khi sự kiện bị hủy. Thao tác nghiệp vụ chỉ ghi một **yêu cầu gửi** (outbox) vào database trong cùng transaction; một tiến trình nền (worker) trong API đọc yêu cầu, dựng nội dung từ mẫu, gửi và tự thử lại khi lỗi. Nhờ vậy, máy chủ email lỗi không làm hỏng việc chính (BR-17). Local gửi vào Mailpit (http://localhost:8025); production gửi qua Brevo.
- **Máy chủ thật:** dựng staging và production trên VPS, HTTPS, triển khai qua release gate, sao lưu, theo dõi — theo [Kiến trúc](../06-architecture.md) mục 5 và [PRD](../01-prd.md) mục 11.

## Phụ thuộc

| Cần có | Từ việc | Dùng cho |
| --- | --- | --- |
| `requireAuth`, `requireRole`, `requireScope` | A1 (T5 08/10) | O3 |
| `audit(...)` | B1 (T5 08/10) | O3, O4 |
| Khung trang admin | A3 (T5 22/10) | O3 |
| Test tự động giao diện | Q2, Q3 | O4 (chạy trên staging) |
| Toàn bộ chức năng đã merge | Cả nhóm (CN 22/11) | O4 |

| Người khác cần | Việc | Hạn |
| --- | --- | --- |
| R3, E3, E4, E5 | O1 `enqueueEmail(...)` | CN 11/10 |
| R3, E3, E4, E5 | O2 mẫu email | CN 01/11 |
| Q4 (nhập nội dung thật trên production) | O4, O5 (release gate) | CN 29/11 |

## Giai đoạn 1 (05/10 – 11/10)

### O1. Hàng đợi email — hạn CN 11/10

**Mục tiêu:** một hàm `enqueueEmail(...)` dùng chung; email được gửi nền, không gửi trùng, tự thử lại khi lỗi tạm thời.

**Làm:**

- Cài `nodemailer`.
- Bảng `NotificationDelivery` (một migration): loại email, người nhận, **tham chiếu tối thiểu** (loại đối tượng + mã đối tượng, ví dụ `APPLICATION` + id đơn), ban liên quan (cho O3 lọc phạm vi), trạng thái `PENDING` / `SENDING` / `RETRY` / `SENT` / `FAILED`, số lần thử, thời điểm thử kế tiếp, thời điểm nhận xử lý, message ID đã làm sạch, lỗi gần nhất đã làm sạch.
- **Không lưu nội dung email đã dựng** trong bảng. Mã hồ sơ, mã đăng ký chỉ được đọc từ bản ghi gốc lúc worker dựng email, không ghi vào `NotificationDelivery` hay log (FLOW-26, OPS-11).
- `enqueueEmail(tx, { type, to, refType, refId, departmentId? })` trong `apps/api/src/modules/email/service.ts` — thêm một dòng `PENDING`, chạy trong transaction của thao tác gọi nó.
- Worker chạy trong process API (khởi động cùng `server.ts`, không chạy khi `NODE_ENV=test`), mỗi 10 giây:
  1. Nhận xử lý các dòng `PENDING`/`RETRY` đến hạn bằng khóa dòng (`FOR UPDATE SKIP LOCKED`), chuyển `SENDING`. Dòng kẹt ở `SENDING` quá 10 phút được nhận lại.
  2. Dựng email từ mẫu (O2) và dữ liệu đọc theo tham chiếu. Thiếu mẫu hoặc thiếu cấu hình: chuyển `FAILED`, ghi log mức lỗi để cảnh báo vận hành; không đụng dữ liệu nghiệp vụ.
  3. Gửi qua SMTP với `Message-ID` sinh từ id của dòng (idempotency key), để gửi lại không tạo thư trùng.
  4. Thành công: `SENT`, lưu message ID. Lỗi tạm thời: `RETRY` với thời gian chờ tăng dần (1, 5, 15, 60 phút). Lỗi vĩnh viễn (SMTP 5xx) hoặc quá 5 lần: `FAILED`.
- Biến `.env`: `SMTP_FROM`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` (thêm vào `.env.example`; local để trống user/password).

**Xong khi:**

- [ ] Gọi `enqueueEmail` trong một route thử: email xuất hiện trong Mailpit trong vòng 15 giây.
- [ ] Tắt Mailpit (`docker stop apc-portal-local-mailpit-1`): email chuyển `RETRY` rồi `FAILED` sau 5 lần; request nghiệp vụ vẫn trả thành công. Bật lại bằng `pnpm infra:up`.
- [ ] Transaction nghiệp vụ bị rollback thì không có email nào được gửi.
- [ ] Chạy hai worker cùng lúc (test) không gửi trùng một email.
- [ ] Bảng `NotificationDelivery` và log không chứa mã hồ sơ, mã đăng ký, mật khẩu SMTP.
- [ ] Đã nhắn Phan Anh Khương (R3) và Lê Đăng Nghĩa (E3, E4, E5) cách dùng.

## Giai đoạn 2 (12/10 – 01/11)

### O2. Mẫu email — hạn CN 01/11

**Mục tiêu:** email giao dịch có giao diện thống nhất, đọc tốt trên điện thoại.

**Cần có trước:** O1.

**Làm:**

- Khung email chung: logo APC, tiêu đề, nội dung, chân trang (tên CLB, email liên hệ, dòng "Email gửi tự động, vui lòng không trả lời"). Màu theo [DESIGN.md](../../DESIGN.md). Mỗi email có cả bản HTML và bản văn bản thuần.
- Mẫu (NTF-01), mỗi mẫu là một hàm nhận dữ liệu và trả `{ subject, html, text }`:
  - **Xác nhận nộp đơn tuyển:** tên ứng viên, tên đợt tuyển, mã hồ sơ, link `/recruitment/application-lookup`.
  - **Xác nhận đăng ký sự kiện:** tên người đăng ký, tên sự kiện, thời gian (giờ Việt Nam), địa điểm hoặc link trực tuyến, mã đăng ký (khách), link tra cứu/hủy.
  - **Xác nhận hủy đăng ký sự kiện.**
  - **Thông báo sự kiện bị hủy:** tên sự kiện, lý do hủy.
  - **Thay đổi trạng thái hồ sơ:** danh sách trạng thái cần báo chờ [QĐ-7](./README.md#8-điểm-cần-trưởng-dự-án-quyết-định).
- Mọi dữ liệu người dùng nhập đều được escape HTML trước khi chèn vào mẫu.

**Xong khi:**

- [ ] Các email hiển thị đúng tiếng Việt trong Mailpit, cả bản HTML lẫn văn bản.
- [ ] Test: họ tên chứa `<script>` hiển thị nguyên dạng chữ.
- [ ] Email hiển thị ổn ở chế độ xem điện thoại của Mailpit.
- [ ] Không mẫu nào chứa mật khẩu, mật khẩu tạm hay mã bảo mật (NTF-05).

## Giai đoạn 3 (02/11 – 22/11)

### O3. Trang theo dõi email — hạn CN 22/11

**Mục tiêu:** người có quyền xem trạng thái gửi email và gửi lại email lỗi.

**Cần có trước:** A3, B1.

**Làm:**

- API `GET /admin/email-deliveries` (lọc trạng thái, loại, khoảng thời gian; phân trang), `GET /admin/email-deliveries/:id`, `POST /admin/email-deliveries/:id/retry`.
- Trang `/admin/email-deliveries` và `/admin/email-deliveries/[id]`, nhãn trạng thái thống nhất Chờ gửi / Đang gửi / Chờ thử lại / Đã gửi / Gửi lỗi (STATE-13).
- Phạm vi (NTF-04, Vai trò & quyền §8.7):
  - `DEPARTMENT_MANAGER`: trạng thái email của ban mình (loại, người nhận, trạng thái, số lần thử, thời điểm); không gửi lại.
  - `BOARD`: tất cả, gửi lại được.
  - `TECH_ADMIN`: không dùng trang này; quyền `INCIDENT` và trang `/admin/system/email` thuộc khu vận hành, xem [README kế hoạch](./README.md) mục 9.
- Gửi lại: hộp xác nhận; chuyển email `FAILED` về `PENDING`, đặt lại số lần thử, gọi `audit(...)`.

**Xong khi:**

- [ ] `manager.a` không thấy email của Ban B; mở thẳng link nhận 404.
- [ ] Chỉ `BOARD` bấm gửi lại được; `manager.a` gọi API gửi lại nhận 403.
- [ ] Gửi lại email đang `SENT` trả 409.
- [ ] Mỗi lần gửi lại có dòng nhật ký.

## Lên máy chủ (23/11 – 29/11)

### O4. Staging, production và quy trình phát hành — hạn T5 26/11

**Mục tiêu:** có staging và production trên VPS; bản phát hành đi qua CI → staging → release gate → production do `TECH_ADMIN` triển khai (FLOW-22).

**Làm:** theo [Kiến trúc](../06-architecture.md) mục 5 dòng 6–8, 11 và [PRD](../01-prd.md) mục 11.

1. **VPS:** Ubuntu 24.04 LTS (tối thiểu 2 vCPU, 2 GB RAM, SSD) trên DigitalOcean bằng credit GitHub Student Developer Pack. Cập nhật bản vá. SSH chỉ bằng key, không đăng nhập bằng mật khẩu. Tường lửa chỉ mở công khai 80, 443; cổng SSH chỉ mở cho danh sách địa chỉ cho phép (PRD §11 mục 16). Bật đồng bộ thời gian (SEC-16).
2. **Image:** `Dockerfile` cho `apps/api` và `apps/web`. `compose.prod.yaml` gồm `web`, `api`, `postgres`: PostgreSQL chỉ nằm trong Docker network nội bộ, không mở cổng ra ngoài (§11 mục 7); mỗi container có giới hạn CPU/RAM (PERF-06, OPS-08); log theo từng container có xoay vòng (OPS-06).
3. **CI:** khi merge vào `main`, chạy `pnpm check`, test giao diện (Q2), quét dependency (`pnpm audit`) và quét image (SEC-10; công cụ quét image cần trưởng dự án duyệt), rồi đẩy image lên `ghcr.io` với tag theo commit. CI **không** tự triển khai production.
4. **Staging:** Compose project riêng trên cùng VPS, secrets và database riêng, chỉ dữ liệu giả. `TECH_ADMIN` chạy workflow triển khai staging (GitHub Actions `workflow_dispatch`) với tag image cụ thể → migration → health check → test giao diện và smoke test trên staging → dừng staging sau khi xác minh.
5. **Production:** chỉ khi release gate đạt (PRD §13, FLOW-22 bước 6: kiểm thử tải, diễn tập restore ở O5, firewall, ngưỡng cảnh báo), `TECH_ADMIN` chạy workflow triển khai production với **cùng tag** đã qua staging. Migration chạy có log, có kế hoạch rollback hoặc forward-fix (§11 mục 10). Health check lỗi thì quay lại tag trước.
6. **Nginx:** `/api/*` chuyển tới API (bỏ tiền tố `/api`), còn lại là web. Chứng chỉ Let's Encrypt bằng certbot, tự gia hạn. Header bảo mật (SEC-13): HSTS, Content-Security-Policy, chống clickjacking (`frame-ancestors`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`. HTTP chuyển sang HTTPS.
7. **Secrets:** mật khẩu database, SMTP Brevo, khóa R2, `TOTP_ENCRYPTION_KEY` lưu trong `.env` trên VPS và GitHub Secrets; staging và production dùng bộ khác nhau; không đưa vào repo.
8. **Ghi nhận:** mỗi lần triển khai ghi phiên bản, người triển khai, kết quả (lịch sử GitHub Actions và nhật ký `OPERATIONS`).
9. **Runbook** trong `docs/ops/` (PRD §11 mục 14): triển khai, rollback, restore, thay secrets, xử lý đầy ổ đĩa, lỗi email, mất quyền quản trị.

**Xong khi:**

- [ ] Mở tên miền bằng `https://` thấy trang chủ; `http://` tự chuyển sang `https://`; các header bảo mật có trong phản hồi.
- [ ] Merge vào `main` chỉ tạo image; production không đổi cho đến khi `TECH_ADMIN` chạy workflow.
- [ ] Một bản phát hành đã đi đủ đường staging → production với cùng tag image.
- [ ] Quay lại bản trước theo runbook thành công.
- [ ] Từ máy ngoài danh sách cho phép không kết nối được cổng SSH và cổng PostgreSQL.
- [ ] Email thật gửi qua Brevo đến hộp thư thật.
- [ ] Đủ 7 runbook trong `docs/ops/`.

### O5. Sao lưu, theo dõi và kiểm thử tải — hạn CN 29/11

**Mục tiêu:** dữ liệu được sao lưu ngoài VPS và khôi phục được; có cảnh báo khi hệ thống bất thường; đủ bằng chứng cho release gate.

**Cần có trước:** O4.

**Làm:** theo [Kiến trúc](../06-architecture.md) mục 5 dòng 9–10 và FLOW-23, FLOW-29.

1. **Sao lưu hằng ngày** (cron): snapshot PostgreSQL (`pg_dump`) và tệp người dùng tải lên theo cùng mốc thời gian; tạo manifest (danh sách tệp, phiên bản schema, thời gian) và checksum; mã hóa bằng `age` rồi đẩy lên bucket R2 riêng cho backup. Khóa `age` lưu tách khỏi bản sao lưu (SEC-14).
2. Kiểm tra checksum sau khi đẩy; sao lưu lỗi gửi cảnh báo cho `TECH_ADMIN`. Giữ bản ngày 30 ngày, bản cuối tháng 12 tháng; xóa bản hết hạn tự động và ghi log (OPS-10).
3. **Diễn tập khôi phục** lên môi trường tách biệt: restore database và tệp, kiểm tra toàn vẹn, chạy smoke test. Ghi biên bản vào `docs/ops/restore.md` (ngày, các bước, thời gian, kết quả). Phải xong **trước lần phát hành production đầu tiên** (OPS-05).
4. **Theo dõi:** UptimeRobot kiểm tra `/api/health` và hạn chứng chỉ TLS từ bên ngoài; Netdata trên VPS có ngưỡng cảnh báo cho CPU, RAM, swap, PID, dung lượng và I/O ổ đĩa, đồng bộ thời gian, tỷ lệ lỗi HTTP, số email tồn trong hàng đợi, trạng thái sao lưu (OPS-09). Cảnh báo gửi email cho `TECH_ADMIN`, không chứa dữ liệu nhạy cảm.
5. **Kiểm thử tải** tối thiểu 20 người dùng đồng thời trên staging; ghi CPU, RAM, swap, PID, I/O ổ đĩa, thời gian phản hồi vào `docs/ops/load-test.md`; đặt ngưỡng cảnh báo theo kết quả (PRD §11 mục 15). Công cụ kiểm thử tải cần trưởng dự án duyệt.

**Xong khi:**

- [ ] Có bản sao lưu mới trên R2 mỗi ngày, đã mã hóa, checksum khớp.
- [ ] Biên bản diễn tập khôi phục thành công trong `docs/ops/restore.md`.
- [ ] Dừng container API thì nhận email cảnh báo trong vòng 5 phút.
- [ ] Có báo cáo kiểm thử tải 20 người dùng đồng thời.

Thời điểm phát hành production phụ thuộc release gate, xem [QĐ-9](./README.md#8-điểm-cần-trưởng-dự-án-quyết-định).

## Lưu ý

- Gửi email lỗi không được làm hỏng việc chính (BR-17).
- Không gửi mật khẩu, mật khẩu tạm hay mã bảo mật qua email (NTF-05).
- Hàng đợi email lưu trong database, không cài thêm Redis hay hàng đợi riêng.
- Khóa bí mật (SMTP, R2, SSH, `age`) không commit vào repo, không dán vào nhóm chat.
- Staging không bao giờ chứa bản sao dữ liệu cá nhân production.
- Nằm ngoài phiếu này, xem [README kế hoạch](./README.md) mục 9: khu vận hành `/admin/system/*`, nhật ký incident, xóa bản ghi email sau 90 ngày, định danh dịch vụ riêng cho worker, email cảnh báo vận hành trong Portal.

## Tài liệu

- [PRD](../01-prd.md): mục 7.11, 10.1 (SEC-10, SEC-13, SEC-14), 10.2, 10.3, 11, 12 (AC-07, AC-09, AC-12), 13
- [User flow](../03-user-flows.md): FLOW-22, FLOW-23, FLOW-26, FLOW-29
- [Sitemap](../04-sitemap.md): mục 8.9, 9, 13 (STATE-13)
- [Vai trò & quyền](../02-roles-permissions.md): mục 8.6, 8.7
- [Kiến trúc](../06-architecture.md): mục 5
