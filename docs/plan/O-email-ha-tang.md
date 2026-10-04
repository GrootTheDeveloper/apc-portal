# Email & máy chủ — Đặng Phúc An Khang

## Bối cảnh

Mảng này gồm hai phần:

- **Email giao dịch:** hệ thống gửi email xác nhận khi nộp đơn tuyển, khi hồ sơ đổi sang trạng thái cần báo, khi đăng ký hoặc hủy đăng ký sự kiện, khi sự kiện bị hủy, khi vai trò đặc quyền sắp hết hạn. Thao tác nghiệp vụ chỉ ghi một **yêu cầu gửi** (outbox) vào database trong cùng transaction; một tiến trình nền (worker) trong API đọc yêu cầu, dựng nội dung từ mẫu, gửi và tự thử lại khi lỗi. Nhờ vậy, máy chủ email lỗi không làm hỏng việc chính (BR-17). Local gửi vào Mailpit (http://localhost:8025); production gửi qua Brevo.
- **Tác vụ nền:** khung `startJob(...)` dùng chung cho mọi tác vụ định kỳ của cả nhóm.
- **Máy chủ thật:** dựng staging và production trên VPS, HTTPS, triển khai qua release gate, sao lưu, theo dõi, phát hành lần đầu — theo [Kiến trúc](../06-architecture.md) mục 5 và [PRD](../01-prd.md) mục 11.

## Phụ thuộc

| Cần có | Từ việc | Dùng cho |
| --- | --- | --- |
| `requireAuth`, `requireRole`, `requireScope` | A1 (T5 08/10) | O3 |
| `audit(...)` | B1 (T5 08/10) | O1 (`startJob`), O3, O4, O6 |
| Khung trang admin | A3 (T5 22/10) | O3 |
| Trang `/admin/accounts` (đặt ô cảnh báo vai trò sắp hết hạn) | A5 (T5 12/11) | O6 |
| Test tự động giao diện | Q2, Q3 | O4 (chạy trên staging) |
| Trang bảo trì, `sitemap.xml`, `robots.txt`, `x-request-id` | C6 (T4 25/11) | O4 |
| Kiểm thử tải | Q6 (CN 29/11) | O5 (ngưỡng cảnh báo), O7 |
| Bootstrap, khôi phục 2 lớp, dry-run retention | A7, B6, B7 | O7 |
| Toàn bộ chức năng đã merge | Cả nhóm (CN 22/11) | O4, O7 |

| Người khác cần | Việc | Hạn |
| --- | --- | --- |
| R3, R4, R5, E3, E4, E5, O6 | O1 `enqueueEmail(...)` | CN 11/10 |
| B7, D2, D6, E2, R2, O6 | O1 `startJob(...)` | CN 11/10 |
| R3, R4, R5, E3, E4, E5, O6 | O2 mẫu email | CN 01/11 |
| Q6 (kiểm thử tải trên staging) | O4 | T5 26/11 |
| Q4 (nhập nội dung thật trên production) | O7 (phát hành) | T4 02/12 |

## Giai đoạn 1 (05/10 – 11/10)

### O1. Hàng đợi email & tác vụ nền — hạn CN 11/10

**Mục tiêu:** một hàm `enqueueEmail(...)` dùng chung; email được gửi nền, không gửi trùng, tự thử lại khi lỗi tạm thời.

**Làm:**

- Cài `nodemailer`.
- Bảng `NotificationDelivery` (một migration): loại email, người nhận, **tham chiếu tối thiểu** (loại đối tượng + mã đối tượng, ví dụ `APPLICATION` + id đơn), ban liên quan (cho O3 lọc phạm vi), trạng thái `PENDING` / `SENDING` / `RETRY` / `SENT` / `FAILED`, số lần thử, thời điểm thử kế tiếp, thời điểm nhận xử lý, message ID đã làm sạch, lỗi gần nhất đã làm sạch.
- **Không lưu nội dung email đã dựng** trong bảng. Mã hồ sơ, mã đăng ký chỉ được đọc từ bản ghi gốc lúc worker dựng email, không ghi vào `NotificationDelivery` hay log (FLOW-26, OPS-11).
- `enqueueEmail(tx, { type, to, refType, refId, departmentId? })` trong `apps/api/src/modules/email/service.ts` — thêm một dòng `PENDING`, chạy trong transaction của thao tác gọi nó.
- Hàm `startJob(name, everyMs, fn)` trong `apps/api/src/lib/jobs.ts` — khung dùng chung cho **mọi tác vụ định kỳ** (D2, D6, E2, R2, B7, O6 dùng lại):
  - Khởi động cùng `server.ts`; không chạy khi `NODE_ENV=test` (test gọi thẳng `fn`).
  - Không chạy chồng: lượt trước chưa xong thì bỏ qua lượt sau.
  - Lỗi được ghi log mức lỗi kèm `name`, không làm dừng process.
  - Tác vụ ghi nhật ký bằng `audit({ service: name }, ...)` (B1), không dùng tài khoản cá nhân (Vai trò & quyền §12 mục 9).
- Worker email là tác vụ `startJob('email', 10_000, ...)`, mỗi lượt:
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
- [ ] Test `startJob`: lượt chạy lâu hơn chu kỳ không bị chạy chồng; `fn` ném lỗi thì lượt sau vẫn chạy.
- [ ] Đã nhắn cả nhóm cách dùng `enqueueEmail` và `startJob`.

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
  - **Thay đổi trạng thái hồ sơ** (`application_status`, QĐ-7): gửi khi hồ sơ chuyển Mời phỏng vấn, Đã chấp nhận, Không chấp nhận, Đã rút. Nội dung: tên đợt, trạng thái mới, link `/recruitment/application-lookup`; không chứa mã hồ sơ, ghi chú hay đánh giá.
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
  - `TECH_ADMIN`: theo quyền `INCIDENT` ([README kế hoạch](./README.md) mục 7.2) — nhập mã sự cố và lý do thì xem metadata giao nhận (loại, trạng thái, số lần thử, lỗi đã làm sạch; **không** hiện người nhận) và gửi lại được; mỗi lần dùng ghi `audit(...)` loại `SECURITY`. Trang `/admin/system/email` thuộc giai đoạn sau phát hành ([PRD](../01-prd.md) §13.1).
- Gửi lại: hộp xác nhận; chuyển email `FAILED` về `PENDING`, đặt lại số lần thử, gọi `audit(...)`.

**Xong khi:**

- [ ] `manager.a` không thấy email của Ban B; mở thẳng link nhận 404.
- [ ] `BOARD` gửi lại được; `TECH_ADMIN` chỉ gửi lại được khi kèm mã sự cố; `manager.a` gọi API gửi lại nhận 403.
- [ ] Gửi lại email đang `SENT` trả 409.
- [ ] Mỗi lần gửi lại có dòng nhật ký.
- [ ] `techadmin` gọi API không kèm mã sự cố nhận 422; kèm mã sự cố thì thấy metadata, không thấy địa chỉ người nhận.

### O6. Vai trò hết hạn & cảnh báo 30/7 ngày — hạn CN 22/11

**Mục tiêu:** vai trò đặc quyền hết hạn được ghi đúng trạng thái; `BOARD` và người giữ vai trò nhận email trước 30 ngày và 7 ngày (RP-03, ADM-08, NTF-01, AC-RBAC-06).

**Cần có trước:** O1, O2, A5 (trang `/admin/accounts`). Bảng `user_roles` đã có `expiresAt`; không cần chờ A6.

**Làm:**

- Tác vụ `startJob('role-expiry', ...)` chạy mỗi giờ:
  - Chuyển dòng `user_roles` `ACTIVE` có `expiresAt <= hiện tại` sang `EXPIRED`. Quyền đã mất hiệu lực từ trước nhờ A1 (A1 không tính dòng quá hạn); tác vụ chỉ lưu lại trạng thái.
  - Với dòng `BOARD`/`TECH_ADMIN` `ACTIVE` còn ≤ 30 ngày và ≤ 7 ngày: gọi `enqueueEmail(...)` loại `role_expiring` cho người giữ vai trò và cho mọi `BOARD` đang hoạt động. Mỗi mốc gửi **một lần** cho mỗi dòng vai trò: một migration thêm `warnedLevel` (30 hoặc 7) và `warnedForExpiresAt` (giá trị `expiresAt` lúc báo) vào `user_roles`.
  - `expiresAt` hiện tại khác `warnedForExpiresAt` (đã gia hạn ở A6) thì coi như chưa báo mốc nào.
  - Gọi `audit({ service: 'role-expiry' }, ...)` cho mỗi dòng chuyển `EXPIRED`.
- Mẫu email `role_expiring`: vai trò, ngày hết hạn (giờ Việt Nam), việc cần làm (bàn giao hoặc gia hạn theo RP-10). Không chứa link đăng nhập kèm mã.
- Ô cảnh báo trên `/admin/accounts` (A5): danh sách vai trò đặc quyền hết hạn trong 30 ngày; chỉ biến mất khi đã gia hạn hoặc đã có người kế nhiệm `ACTIVE` (AC-RBAC-06).

**Xong khi:**

- [ ] Test: dòng quá hạn chuyển `EXPIRED`, có dòng nhật ký `actorType = SERVICE`.
- [ ] Test: dòng còn 29 ngày tạo đúng một email cho người giữ và một email cho mỗi `BOARD`; chạy tác vụ lần hai không tạo thêm.
- [ ] Dòng còn 6 ngày (đã báo mốc 30) tạo thêm email mốc 7 ngày.
- [ ] Gia hạn xong, mốc 30 ngày được báo lại khi đến hạn mới.

## Lên máy chủ (23/11 – 29/11)

### O4. Staging, hạ tầng production và quy trình phát hành — hạn T5 26/11

**Mục tiêu:** có staging và hạ tầng production trên VPS; bản phát hành đi qua CI → staging → release gate → production do `TECH_ADMIN` triển khai (FLOW-22).

**Làm:** theo [Kiến trúc](../06-architecture.md) mục 5 dòng 6–8, 11–13 và [PRD](../01-prd.md) mục 11.

1. **VPS:** Ubuntu 24.04 LTS, **2 vCPU / 4 GB RAM** / SSD trên DigitalOcean bằng credit GitHub Student Developer Pack (4 GB vì ClamAV cần khoảng 1–1,5 GB). Cập nhật bản vá. SSH chỉ bằng key, không đăng nhập bằng mật khẩu. Tường lửa chỉ mở công khai 80, 443; cổng SSH chỉ mở cho danh sách địa chỉ cho phép (PRD §11 mục 16). Bật đồng bộ thời gian bằng `chrony` (SEC-16).
2. **Image:** `Dockerfile` cho `apps/api` và `apps/web`. `compose.prod.yaml` gồm `web`, `api`, `postgres`, `clamav`: PostgreSQL và ClamAV chỉ nằm trong Docker network nội bộ, không mở cổng ra ngoài (§11 mục 7); mỗi container có giới hạn CPU/RAM (PERF-06, OPS-08); log theo từng container có xoay vòng, giữ 30 ngày (OPS-06, PRD §10.5). API chạy với `FILE_SCAN_MODE=clamav`.
3. **CI:** khi merge vào `main`, chạy `pnpm check`, job `e2e` (Q2), `pnpm audit` và quét image bằng Trivy (`aquasecurity/trivy-action`, dừng khi có lỗ hổng mức HIGH/CRITICAL đã có bản vá) (SEC-10), rồi đẩy image lên `ghcr.io` với tag theo commit. CI **không** tự triển khai production.
4. **Staging:** Compose project riêng trên cùng VPS, secrets và database riêng, chỉ dữ liệu giả: chạy `db:seed` (D1) với `ALLOW_SEED=true` và `SEED_PASSWORD` riêng của staging; image API phải chạy được lệnh này. `TECH_ADMIN` chạy workflow triển khai staging (GitHub Actions `workflow_dispatch`) với tag image cụ thể → migration → health check → test giao diện và smoke test trên staging → dừng staging sau khi xác minh.
5. **Production:** workflow triển khai production chỉ chạy tay (`workflow_dispatch`) với **cùng tag** đã qua staging. Migration chạy có log, có kế hoạch rollback hoặc forward-fix (§11 mục 10). Health check lỗi thì quay lại tag trước. Lần triển khai production đầu tiên thuộc O7.
6. **Nginx:**
   - `/api/*` chuyển tới API (bỏ tiền tố `/api`); `/sitemap.xml`, `/robots.txt` chuyển tới `/public/sitemap.xml`, `/public/robots.txt` của API (C6); còn lại là web.
   - Gửi header `x-request-id` (`$request_id`) sang API và ghi vào access log (OPS-11, C6).
   - Chế độ bảo trì: có file `/srv/apc/maintenance.on` thì trả `maintenance.html` (C6) với mã 503 cho mọi đường dẫn (PAGE-SYS-02). Bật/tắt ghi trong runbook.
   - Chứng chỉ Let's Encrypt bằng certbot, tự gia hạn. Header bảo mật (SEC-13): HSTS, Content-Security-Policy, chống clickjacking (`frame-ancestors`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`. HTTP chuyển sang HTTPS.
7. **Secrets:** mật khẩu database, SMTP Brevo, khóa R2, `TOTP_ENCRYPTION_KEY` lưu trong `.env` trên VPS và GitHub Secrets; staging và production dùng bộ khác nhau; không đưa vào repo.
8. **Ghi nhận:** mỗi lần triển khai ghi phiên bản, người triển khai, kết quả (lịch sử GitHub Actions và nhật ký `OPERATIONS`).
9. **Runbook** trong `docs/ops/` (PRD §11 mục 14): triển khai, rollback, restore, thay secrets, xử lý đầy ổ đĩa, lỗi email, mất quyền quản trị, bật/tắt bảo trì, xử lý sự cố, mất đồng bộ thời gian (bật bảo trì, tạm dừng xác thực 2 lớp đến khi đồng bộ lại, FLOW-27). Runbook không chứa secret, địa chỉ IP hay tên người dùng thật vì repository công khai.

**Xong khi:**

- [ ] Staging mở bằng `https://` thấy trang chủ; `http://` tự chuyển sang `https://`; các header bảo mật có trong phản hồi.
- [ ] Merge vào `main` chỉ tạo image; production không đổi cho đến khi `TECH_ADMIN` chạy workflow.
- [ ] CI dừng khi Trivy báo lỗ hổng HIGH/CRITICAL có bản vá.
- [ ] Quay lại bản trước trên staging theo runbook thành công.
- [ ] Tạo file `maintenance.on` thì mọi đường dẫn trả 503 kèm trang bảo trì; xóa file thì trở lại bình thường.
- [ ] Từ máy ngoài danh sách cho phép không kết nối được cổng SSH, PostgreSQL, ClamAV.
- [ ] Email thật gửi qua Brevo đến hộp thư thật (từ staging).
- [ ] Đủ 10 runbook trong `docs/ops/`.

### O5. Sao lưu, theo dõi và diễn tập khôi phục — hạn CN 29/11

**Mục tiêu:** dữ liệu được sao lưu ngoài VPS và khôi phục được; có cảnh báo khi hệ thống bất thường; đủ bằng chứng cho release gate.

**Cần có trước:** O4.

**Làm:** theo [Kiến trúc](../06-architecture.md) mục 5 dòng 9–10 và FLOW-23, FLOW-29.

1. **Sao lưu hằng ngày** (cron): snapshot PostgreSQL (`pg_dump`) và tệp người dùng tải lên theo cùng mốc thời gian; tạo manifest (danh sách tệp, phiên bản schema, thời gian) và checksum; mã hóa bằng `age` rồi đẩy lên bucket R2 riêng cho backup. Khóa `age` lưu tách khỏi bản sao lưu (SEC-14).
2. Kiểm tra checksum sau khi đẩy; sao lưu lỗi gửi cảnh báo cho `TECH_ADMIN`. Giữ bản ngày 30 ngày, bản cuối tháng 12 tháng; xóa bản hết hạn tự động và ghi log (OPS-10).
3. **Diễn tập khôi phục** lên môi trường tách biệt: restore database và tệp, kiểm tra toàn vẹn, chạy smoke test. Ghi biên bản vào `docs/ops/restore.md` (ngày, các bước, thời gian, kết quả). Phải xong **trước lần phát hành production đầu tiên** (OPS-05).
4. **Theo dõi:** UptimeRobot kiểm tra `/api/health` và hạn chứng chỉ TLS từ bên ngoài; Netdata trên VPS có ngưỡng cảnh báo cho CPU, RAM, swap, PID, dung lượng và I/O ổ đĩa, **đồng bộ thời gian** (collector `timex`/`chrony`, SEC-16), tỷ lệ lỗi HTTP, số email tồn trong hàng đợi, trạng thái sao lưu (OPS-09). Cảnh báo gửi email cho `TECH_ADMIN`, không chứa dữ liệu nhạy cảm. Đây là email cảnh báo vận hành theo NTF-01.
5. **Sổ sự cố:** Google Sheet "APC Portal – Sổ sự cố" trong Google Drive của CLB, chỉ chia sẻ cho người giữ `TECH_ADMIN` và `BOARD`. **Không đặt trong repo** vì repository công khai. Mỗi sự cố một dòng: mã sự cố (`INC-YYYYMMDD-NN`), thời điểm phát hiện, mức độ, ảnh hưởng, timeline, nguyên nhân, cách khắc phục, việc ngăn tái diễn, thời điểm đóng; không chứa dữ liệu cá nhân hay secret. Mẫu cột ghi trong runbook `docs/ops/incident.md`. Mã sự cố dùng cho quyền `INCIDENT` ([README kế hoạch](./README.md) mục 7.2) (AC-12, [PRD](../01-prd.md) §13.1).
6. Đặt ngưỡng cảnh báo tài nguyên theo báo cáo kiểm thử tải của Q6 (PRD §11 mục 15).

**Xong khi:**

- [ ] Có bản sao lưu mới trên R2 mỗi ngày, đã mã hóa, checksum khớp.
- [ ] Biên bản diễn tập khôi phục thành công trong `docs/ops/restore.md`.
- [ ] Dừng container API thì nhận email cảnh báo trong vòng 5 phút.
- [ ] Dừng `chrony` thì nhận cảnh báo mất đồng bộ thời gian.
- [ ] Có sổ sự cố với một sự cố diễn tập ghi đủ từ lúc phát hiện đến lúc đóng; runbook `docs/ops/incident.md` có mẫu cột.
- [ ] Ngưỡng cảnh báo khớp số liệu trong `docs/ops/load-test.md`.

## Phát hành (30/11 – 06/12)

### O7. Phát hành production lần đầu — hạn T4 02/12

**Mục tiêu:** production chạy bản đã qua staging, đủ điều kiện release gate ([PRD](../01-prd.md) §13), mở cho thành viên dùng (QĐ-9).

**Cần có trước:** O4, O5, A7, B6, B7, C6, Q6; toàn bộ việc giai đoạn 3 đã merge.

**Làm:**

1. **T2 30/11 — soát release gate:** file `docs/ops/release-gate.md` liệt kê từng điều kiện PRD §13 kèm bằng chứng (link biên bản, báo cáo, lượt chạy CI). Điều kiện nào chưa đạt thì ghi lý do và ngày dự kiến; chưa đủ thì dời ngày phát hành, không bỏ qua.
2. **T3 01/12 — triển khai production:** chạy workflow production với tag đã qua staging; chạy A7 bootstrap theo `docs/ops/bootstrap.md`. Hai người bootstrap đổi mật khẩu và thiết lập 2 lớp; cấp tiếp `BOARD` thứ hai (A6) và `TECH_ADMIN` thứ hai (A6, `DUAL`). Bốn người giữ vai trò do trưởng dự án (`TECH_ADMIN`) và Ban Chủ nhiệm (`BOARD`) chỉ định, báo trong nhóm riêng; không ghi tên vào repository vì repository công khai.
3. **T4 02/12 — phát hành:** đủ hai `BOARD` và hai `TECH_ADMIN` đã thiết lập 2 lớp; đặt `ENFORCE_PRIVILEGED_MINIMUM=true` (A5); tick hết `docs/ops/release-gate.md`; báo nhóm và Ban Chủ nhiệm bắt đầu nhập nội dung (Q4).

**Xong khi:**

- [ ] `docs/ops/release-gate.md` có bằng chứng cho mọi điều kiện PRD §13.
- [ ] Production chạy cùng tag image với lần staging đã đạt.
- [ ] Có đúng hai `BOARD` và hai `TECH_ADMIN` `ACTIVE`, do bốn người khác nhau giữ.
- [ ] `ENFORCE_PRIVILEGED_MINIMUM=true` trên production.

## Lưu ý

- Gửi email lỗi không được làm hỏng việc chính (BR-17).
- Không gửi mật khẩu, mật khẩu tạm hay mã bảo mật qua email (NTF-05).
- Hàng đợi email lưu trong database, không cài thêm Redis hay hàng đợi riêng.
- Khóa bí mật (SMTP, R2, SSH, `age`) không commit vào repo, không dán vào nhóm chat.
- Staging không bao giờ chứa bản sao dữ liệu cá nhân production.
- Khu vận hành trong Portal (`/admin/system/*`) và xóa bản ghi email sau 90 ngày thuộc giai đoạn sau phát hành, hạn CN 28/02/2027 ([PRD](../01-prd.md) §13.1). Bản phát hành đầu dùng UptimeRobot, Netdata, GitHub Actions và sổ sự cố (O5).

## Tài liệu

- [PRD](../01-prd.md): mục 7.9 (ADM-08), 7.11, 10.1 (SEC-10, SEC-13, SEC-14, SEC-16), 10.2, 10.3, 11, 12 (AC-07, AC-09, AC-12), 13, 13.1
- [User flow](../03-user-flows.md): FLOW-22, FLOW-23, FLOW-26, FLOW-29
- [Sitemap](../04-sitemap.md): mục 8.9, 9, 12, 13 (STATE-13)
- [Vai trò & quyền](../02-roles-permissions.md): mục 8.6, 8.7, 9 (RP-03, RP-10, RP-18), 12 mục 9
- [Kiến trúc](../06-architecture.md): mục 5
