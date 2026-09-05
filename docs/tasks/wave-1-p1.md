# Wave 1 — 5 phiếu P1 (sau khi BE1 xong)

**Kết quả kỳ vọng** là mốc bắt buộc; **Gợi ý cách làm** chỉ tham khảo. Mỗi task một nhánh, một PR, đi qua CI `quality` + 1 review.

## Điều phối Wave 1
- **BE4 là nút thắt**: cả BE5/6/7 + tuyển chờ nó. Minh (BE-2) làm **BE4 trước, BE3 sau** — hai task là hàng đợi của cùng một người.
- **Khương (BE-3) chờ BE4** → chưa phát việc backend cho Khương ở Wave 1.
- **Trang public thuộc mảng Gia Bảo (FE-2)**. Nghĩa (FE-3=portal) và Phúc (FE-4=admin) hiện bị chặn → Wave 1 **cho mượn** mỗi người 1 trang public (phiếu 5); Wave 2 về đúng mảng. Phúc còn **FE8 (test FE, chỉ phụ thuộc FE1)** làm song song được.
- **Lương Huỳnh (FE-1)**: FE2 phụ thuộc BE3 → dựng UI theo contract + mock trước, ráp khi BE3 merge. Trong lúc chờ có thể làm **FE9 (component/token chung)** — không phụ thuộc gì.

| Phiếu | Người | Nhánh | Chặn bởi |
| --- | --- | --- | --- |
| BE4 | Trương Phúc Minh (BE-2) | `be4-rbac` | — (làm đầu tiên) |
| BE3 | Trương Phúc Minh (BE-2) | `be3-auth` | sau BE4 (cùng người) |
| BE2 | Phạm Đăng Hoàng Thiên (BE-1) | `be2-seed` | — |
| FE2 | Lương Huỳnh (FE-1) | `fe2-login` | contract BE3 |
| Website mock | Gia Bảo / Nghĩa / Phúc | `fe-news-mock` · `fe-events-mock` · `fe-projects-mock` | — |

---

## BE4 — RBAC: middleware phân quyền · BE-2 (Trương Phúc Minh) · P0 · **làm đầu tiên**

### Kết quả kỳ vọng
- Có middleware dùng chung: `requireAuth`, `requireRole(...roles)`, `requireScope(...)`.
- Route được bảo vệ trả **403** khi thiếu quyền, **401** khi chưa đăng nhập; không lộ dữ liệu ngoài quyền.
- Enforce đúng ma trận `docs/02` §8: `BOARD`=ALL, `DEPARTMENT_MANAGER`=SCOPE (chỉ ban của mình), `TECH_ADMIN` **không** có quyền nghiệp vụ.
- Test cho đủ 4 vai trò + case SCOPE: `DEPARTMENT_MANAGER` ban A không đọc/sửa được dữ liệu ban B.

### Bối cảnh
- Schema đã có `enum Role { MEMBER, DEPARTMENT_MANAGER, BOARD, TECH_ADMIN }` và `User.departmentId` (`apps/api/src/db/schema.prisma`).
- `app.ts` hiện chỉ có `/health`, chưa có auth context.
- BE3 (cùng Minh) sẽ gắn user đã xác thực vào request. RBAC đọc từ đó → **chốt sớm hình dạng `request.user`** (`{ id, role, departmentId }`) để BE4 làm được trước cả khi BE3 xong.

### Gợi ý cách làm
- `apps/api/src/auth/rbac.ts`. Dùng Fastify `preHandler` hook.
- `requireRole('BOARD')`; `requireScope(getDeptId)` so `request.user.departmentId` với ban của tài nguyên; `BOARD` bỏ qua kiểm scope.
- Thân 403 chuẩn: `{ error: 'forbidden' }`. Nguyên tắc "không tự nâng quyền" (`docs/02` §6, RP-06).

### Cách kiểm tra
```bash
pnpm --filter @apc/api test
```
Vitest: mỗi vai trò gọi một route giả → assert 200/401/403; `DEPARTMENT_MANAGER` ban A đụng ban B → 403.

### Docs liên quan
`docs/02` §6 (nguyên tắc) · §7 (ký hiệu `OWN/SCOPE/ALL`) · §8 (ma trận).

### Nhánh & PR
`be4-rbac`. Chốt `request.user` với BE3 trong PR description để cả nhóm bám theo.

---

## BE3 — Đăng nhập + session · BE-2 (Trương Phúc Minh) · P0 · sau BE4

### Kết quả kỳ vọng
- `POST /auth/login` (username + password) → phát phiên (cookie ký hoặc JWT); `POST /auth/logout`; `GET /auth/me` trả user hiện tại.
- Verify mật khẩu bằng **Argon2id** trên `passwordHash`.
- Sai mật khẩu tăng `failedLoginAttempts`; vượt ngưỡng khóa tạm bằng `lockoutUntil` (SEC-05).
- `mustChangePassword=true` → buộc đổi trước khi dùng tiếp.
- Input validate bằng Zod. Test: đúng / sai / bị khóa / `/me` khi chưa đăng nhập.

### Bối cảnh
- `User` đã có sẵn: `passwordHash` (ghi chú Argon2id), `failedLoginAttempts`, `lockoutUntil`, `mustChangePassword`, `isTemporaryPassword`, `temporaryPasswordExpiresAt`.
- `config.ts` dùng Zod, có `WEB_URL`; `app.ts` đã `register(cors, { credentials: true })`.
- **Cơ chế session/token là quyết định còn mở** (`docs/06` §5) — chốt xong phải cập nhật docs/ghi ADR.

### Gợi ý cách làm
- `apps/api/src/auth/` (routes + service). Lib `argon2`.
- Phiên: `@fastify/cookie` + session ký, hoặc JWT ngắn hạn — chốt với nhóm.
- Gắn `request.user` = `{ id, role, departmentId }` cho RBAC (BE4) dùng.

### Cách kiểm tra
```bash
pnpm --filter @apc/api test
```
Login đúng → 200 + phiên; sai → 401 + tăng đếm; quá ngưỡng → khóa; `/me` chưa đăng nhập → 401.

### Docs liên quan
`docs/03` FLOW-10 · `docs/02` §8.2 (đăng nhập) · SEC-02/05.

### Nhánh & PR
`be3-auth`. Chốt cơ chế phiên trong PR + cập nhật `docs/06` §5.

---

## BE2 — Seed dữ liệu mẫu · BE-1 (Phạm Đăng Hoàng Thiên) · P1

### Kết quả kỳ vọng
- Lệnh `db:seed` tạo: 1 tài khoản bootstrap (`BOARD`/`TECH_ADMIN`, mật khẩu đọc từ `.env`); user mẫu mỗi vai trò; vài `Department`; tin/sự kiện/dự án `PUBLISHED` khớp nội dung trang chủ; 1 `RecruitmentRound` `OPEN`.
- Chạy lại **idempotent** (upsert, không nhân đôi).
- **KHÔNG hardcode mật khẩu** trong mã.

### Bối cảnh
- Models đã có: `Department`, `User`, `Post`, `Event`, `Project`, `RecruitmentRound`, `MembershipApplication`.
- Enums: `ContentStatus (DRAFT/PUBLISHED/ARCHIVED)`, `ContentScope`, `RecruitmentRoundStatus`.
- `passwordHash` là Argon2id → seed phải hash (dùng `argon2`, cùng lib BE3; BE3 chưa xong thì seed tự hash).

### Gợi ý cách làm
- `apps/api/src/db/seed.ts`; thêm script `db:seed` vào `apps/api/package.json` (dùng `tsx` hoặc `prisma db seed`).
- Đọc `SEED_ADMIN_PASSWORD` từ `.env`; upsert theo khóa unique (`username`/`email`/`code`).
- Nội dung news/events/projects bám các section trang chủ để FE-HOME nối vào thấy khớp.

### Cách kiểm tra
```bash
pnpm --filter @apc/api db:seed   # chạy 2 lần, không lỗi/nhân đôi
```
Query DB thấy đủ bản ghi; sau BE3 đăng nhập bootstrap được.

### Docs liên quan
`docs/02` §4.2 (vai trò) · `docs/06` §4 (.env, không hardcode secret).

### Nhánh & PR
`be2-seed`.

---

## FE2 — Trang đăng nhập + bảo vệ route · FE-1 (Lương Huỳnh) · P0

### Kết quả kỳ vọng
- `/login`: form (username + password) + validate + trạng thái loading/error/success.
- Gọi `POST /auth/login`, lưu phiên; `ProtectedRoute` bọc `/admin` (và portal sau này) → chưa đăng nhập bị đẩy về `/login`; đã đăng nhập vào `/login` → đẩy về dashboard.
- `mustChangePassword` → buộc đổi mật khẩu trước khi dùng tiếp.

### Bối cảnh
- `App.tsx` đã có route `/login` và `/admin` (đang là `Placeholder`). react-router v7.
- Chưa có auth context/client phía web.
- BE3 định nghĩa `/auth/login|logout|me`. **BE3 chưa xong thì code theo contract đã chốt + mock**, ráp thật sau.

### Gợi ý cách làm
- `apps/web/src/auth/` (`AuthProvider` + `useAuth` + `ProtectedRoute`) và `apps/web/src/pages/login/`.
- `fetch` tới API với `credentials: 'include'`. Load app gọi `/auth/me` để khôi phục phiên.
- Thay `Placeholder` ở `/login` bằng trang thật; bọc `/admin` bằng `ProtectedRoute`.
- Đang chờ BE3 thì làm trước **FE9** (component/token chung) — không phụ thuộc gì.

### Cách kiểm tra
```bash
pnpm --filter @apc/web dev
```
Login sai → hiện lỗi; vào `/admin` khi chưa login → về `/login`; login xong vào được.

### Docs liên quan
`docs/03` FLOW-10 · `docs/04` sitemap (login/admin).

### Nhánh & PR
`fe2-login`. Chốt contract `/auth/*` với Minh (BE3) trước khi ráp thật.

---

## Website công khai (mock) · Gia Bảo / Nghĩa / Phúc · P1 · **cho mượn Wave 1**

> Theo plan các trang public thuộc mảng **Gia Bảo (FE-2)**. Wave 1 cho **Nghĩa (FE-3)** và **Phúc (FE-4)** mượn mỗi người 1 trang để không ngồi không (mảng thật của họ đang bị chặn); Wave 2 về đúng mảng. Phúc có thể nhận thêm **FE8 (test FE)** vì chỉ phụ thuộc FE1.

**Chia trang (nhánh riêng, không đụng file nhau):**
- **Gia Bảo** → `/news` Tin tức (FE3) · nhánh `fe-news-mock`
- **Nghĩa** → `/events` Sự kiện (FE4, phần danh sách; tạm bỏ đăng ký/điểm danh) · nhánh `fe-events-mock`
- **Phúc** → `/projects` Dự án (FE5) · nhánh `fe-projects-mock`
- `/about`, `/privacy` (tĩnh) → ai xong trước nhận thêm.

### Kết quả kỳ vọng (mỗi trang)
- Thay `Placeholder` bằng trang thật, render từ **mảng dữ liệu mock trong file** (sẽ thay bằng API ở FE-HOME/BE5/6/7).
- Có đủ trạng thái **loading / empty / error**; responsive; dùng token màu brand.
- Mỗi trang nằm trong folder riêng `apps/web/src/pages/<tên>/` → 3 PR độc lập, không conflict.

### Bối cảnh
- `App.tsx` đã có stub `/news` `/events` `/projects` (`Placeholder`).
- Home sections (`NewsSection`/`EventsSection`/`ProjectsSection`) có sẵn card mẫu → tái dùng bố cục/kiểu.

### Gợi ý cách làm
- `pages/news/index.tsx`, `pages/events/index.tsx`, `pages/projects/index.tsx`.
- Dữ liệu mock dạng **mảng + `map`** (không copy-paste JSX); class Tailwind **literal đầy đủ** (không nội suy `text-${x}`).
- Chờ **FE9** (component chung: Card/Badge) thì dùng lại; FE9 chưa xong thì inline tạm, refactor sau.

### Cách kiểm tra
```bash
pnpm --filter @apc/web dev
```
Mở từng route thấy trang thật; kiểm tra 3 trạng thái loading/empty/error.

### Docs liên quan
`docs/04` §3.2 (routes) · `docs/06` §3 (quy ước FE: mảng+map, class literal, an toàn tiến trình).

### Nhánh & PR
`fe-news-mock` (Gia Bảo) · `fe-events-mock` (Nghĩa) · `fe-projects-mock` (Phúc). Ba PR độc lập.
