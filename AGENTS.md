# AGENTS.md — Luật cho AI khi code trong repo này

Đọc file này trước mỗi task. Kế hoạch + phiếu việc: `docs/plan/`.

## Dự án
APC Portal: website + portal thành viên + trang quản trị cho CLB APC (UMT).
Monorepo pnpm: `apps/web` (React 19 + Vite + Tailwind 3 + react-router 7), `apps/api` (Fastify 5 + Prisma 6 + Zod 4 + Postgres).
Nguồn sự thật nghiệp vụ: `docs/01-prd.md` (yêu cầu), `docs/02-roles-permissions.md` (quyền), `docs/03-user-flows.md` (luồng), `docs/04-sitemap.md` (route/trang). Thiết kế: `DESIGN.md`.

## Lệnh
- `pnpm install` · `pnpm infra:up` (Postgres/Mailpit/SeaweedFS) · `pnpm --filter @apc/api db:migrate` · `pnpm dev`
- `pnpm --filter @apc/api db:migrate` (tạo migration) · `pnpm --filter @apc/api db:studio` (xem/sửa dữ liệu) · `pnpm --filter @apc/api test`
- File `.env` duy nhất ở gốc repo; API, Prisma và test đều đọc từ đó.
- **Trước khi mở PR: `pnpm check` phải xanh.**

## Quy ước API (`apps/api`)
- Mỗi mảng một thư mục: `src/modules/<mảng>/` gồm `routes.ts`, `service.ts`, `*.test.ts`. Đăng ký route trong `app.ts`.
- Có sẵn, dùng lại, không viết bản khác: `db` trong `src/db/client.ts`; `notFound()`, `forbidden()`, `conflict()`… trong `src/lib/errors.ts`; `hashPassword`/`verifyPassword` trong `src/lib/password.ts`; `pageQuery`/`pageArgs`/`toPage` trong `src/lib/pagination.ts`; `publicCode()`/`slugify()` trong `src/lib/ids.ts`.
- Tra cứu bằng mã (mã hồ sơ, mã đăng ký) gửi qua body `POST`, không đặt mã hay email trong URL vì URL bị ghi log (OPS-11).
- `@fastify/rate-limit` chỉ đăng ký 1 lần trong `app.ts` với `global: false`; route cần giới hạn tự khai báo `config.rateLimit`.
- Nhóm route theo người gọi:
  - `/public/*` — không cần đăng nhập
  - `/auth/*` — đăng nhập/tài khoản
  - `/portal/*` — thành viên đã đăng nhập
  - `/admin/*` — quản trị (luôn kèm `requireRole`/`requireScope`)
- Phiên đăng nhập: cookie `apc_session`, lưu ở bảng `sessions` (docs/06 §5). Không dùng JWT, không lưu token ở `localStorage`.
- User đã đăng nhập: `request.user = { id, departmentId, roles }`; `roles` là các dòng `ACTIVE` trong bảng `user_roles` (`{ role, departmentId }`). Mọi tài khoản mặc định có vai trò nền `MEMBER`. Chặn quyền bằng `requireAuth`, `requireRole(...)`, `requireScope(...)` trong `src/modules/auth/rbac.ts`. **Không tự viết kiểm quyền riêng.**
- Validate mọi input bằng Zod (`schema.parse(...)`). Lỗi trả `{ error: '<code>', message: '<tiếng Việt>' }` theo docs/03 §14: 401 `unauthenticated`, 403 `forbidden`, 404 `not_found`, 409 `conflict`, 422 `validation` (kèm `issues`), 429 `rate_limited`. Chỉ cần `throw`; `src/lib/errors.ts` tự đổi ZodError → 422, trùng unique (P2002) → 409, lỗi khác → 500 kèm mã tham chiếu.
- Truy cập dữ liệu ngoài phạm vi ban (người dùng không được biết dữ liệu tồn tại) trả 404, không trả 403 (docs/02 §12).
- Danh sách có phân trang: `?page=1&pageSize=20` → `{ items, total, page, pageSize }`.
- Thao tác nhạy cảm (tạo/sửa quyền, công bố, xử lý đơn, import/export, tài liệu) gọi `audit(...)` (docs/02 §11).
- Email: gọi `enqueueEmail(...)`. Không gửi SMTP trực tiếp, không gửi mật khẩu/mã khôi phục qua email.
- Tệp: dùng module `files` (S3 API). Không trả URL kho tệp trực tiếp cho tài liệu nội bộ.

## Quy ước DB
- Sửa `src/db/schema.prisma` rồi `db:migrate` để **tạo migration mới**. Không bao giờ sửa migration đã merge.
- Mỗi PR tối đa 1 migration. Pull `main` ngay trước khi tạo migration.
- `main` có migration mới sau khi bạn đã tạo migration: xóa thư mục migration của bạn, merge `main`, chạy lại `db:migrate`.
- CI có Postgres và chạy `db:deploy` trước test, nên test được dùng database thật.
- Không xóa vật lý dữ liệu nghiệp vụ: dùng trạng thái `ARCHIVED`/`INACTIVE` (BR-13).
- Chuyển trạng thái đúng sơ đồ trong docs/01 §9.2; bước chuyển sai phải trả 409 (BR-16).
- Thời gian lưu UTC, hiển thị giờ `Asia/Ho_Chi_Minh` (BR-14).
- Mã công khai (mã hồ sơ, mã đăng ký) sinh bằng `crypto.randomBytes`/`randomUUID`, không tuần tự.

## Quy ước Web (`apps/web`)
- Trang: `src/pages/<khu>/<trang>/`. Gọi API qua `api(...)` trong `src/lib/api.ts` (không `fetch` rải rác); lỗi là `ApiError` có `status`, `code`, `message`, `issues`.
- Component dùng chung ở `src/components/` (`Button`, `Eyebrow`); Navbar/Footer ở `src/layouts/`. Card mẫu vẫn nằm trong `src/pages/home/sections/`; người dùng card đó trước thì chuyển nó sang `src/components/`.
- Mọi trang có đủ 4 trạng thái: loading / empty / error / success. Dùng `useApi(...)` (`src/hooks/useApi.ts`) và `<AsyncState>` (`src/components/AsyncState.tsx`).
- Ngày giờ hiển thị bằng `formatDate`/`formatDateTime` trong `src/lib/format.ts` (giờ Việt Nam), không tự `toLocaleString`.
- Dữ liệu lặp khai báo mảng rồi `map`. Class Tailwind viết literal đầy đủ (không `text-${x}`).
- Màu/chữ theo `DESIGN.md`; dùng lại component có sẵn trước khi tạo mới.
- Route theo `docs/04-sitemap.md`, URL tiếng Anh.

## Test tối thiểu
- API: mỗi endpoint có 1 test thành công và 1 test **bị từ chối** (401/403, hoặc 404 khi sai phạm vi ban).
- Nghiệp vụ có trạng thái: test 1 bước chuyển hợp lệ và 1 bước không hợp lệ.

## Không được làm
- Chỉ cài thư viện trong danh sách đã duyệt (docs/06 §5.1). Thư viện khác phải hỏi người review.
- Không commit `.env`, secret, dữ liệu cá nhân thật.
- Không làm khác các quyết định đã chốt ở docs/06 §5 (phiên, vai trò, email, lưu tệp, hạ tầng). Muốn đổi thì hỏi trưởng dự án.
- Docs mâu thuẫn nhau: dừng lại, hỏi. Không tự chọn phần liên quan đến quyền/dữ liệu cá nhân.
- Không sửa file thuộc mảng người khác ngoài phạm vi phiếu. Cần thì ghi vào PR.
