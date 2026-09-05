# Phase 0 — 3 task khởi động (không phụ thuộc)

Ba task này làm được ngay, song song, không chờ ai. Xong 3 cái này là mở đường cho toàn bộ Phase 0.

---

## CT1 — APC duyệt trang chủ (redesign) · Phụ trách: CLB/APC · Ưu tiên P0

### 1. Mục tiêu
Có **xác nhận bằng văn bản** của Ban Chủ nhiệm/APC rằng nội dung + hình ảnh trang chủ bản redesign hiện tại được phép công bố. Đây là nút chặn: chưa duyệt thì không công bố ra ngoài và không thay nội dung mẫu bằng dữ liệu thật (CT2).

### 2. Bối cảnh
- Trang chủ đã chạy ở `/` (component React tại `apps/web/src/pages/home/`).
- Bản redesign đã **khác bản tham chiếu gốc**: hero bố cục 50:50 + dải 4 chỉ số CLB, bộ màu brand đỏ/vàng/xanh, dải seam gradient giữa các section (xem `docs/08-handover.md` mục 2).
- Chỉ số CLB ở hero (`apps/web/src/pages/home/sections/HeroSection.tsx`) đang là **số mẫu**, chờ APC xác nhận số thật.

### 3. Các bước
1. Chạy trang chủ local để demo:
   ```bash
   pnpm --filter @apc/web dev
   ```
   Mở `http://localhost:5173`, xem ở kích thước laptop/desktop (1440×900).
2. Chụp màn hình đủ 9 section (hero → footer) để đính kèm khi trình duyệt.
3. Soạn 1 trang tóm tắt "khác gì bản gốc" (hero 50:50, bộ màu brand, seam gradient, dải chỉ số CLB placeholder).
4. Trình BCN/APC bản redesign + danh sách nội dung mẫu cần thay (chỉ số CLB, ô đối tác placeholder).
5. Ghi nhận feedback chỉnh sửa (nếu có) vào một issue.
6. Nhận **phê duyệt bằng văn bản** (email/biên bản/comment issue có tên người duyệt + ngày).

### 4. Định nghĩa Hoàn thành (DoD)
- [ ] Có bản ghi phê duyệt bằng văn bản (ai duyệt, ngày nào).
- [ ] Danh sách nội dung mẫu cần thay đã được APC xác nhận (đầu vào cho CT2).
- [ ] Feedback chỉnh sửa (nếu có) đã tạo issue, gán người xử lý.

### 5. Cách kiểm tra
Mở lại issue/biên bản duyệt — có đủ tên người duyệt, ngày, phạm vi được phép công bố.

### 6. Docs liên quan
`docs/08-handover.md` mục 2 · `docs/00-project-charter.md` mục 9 · `docs/05-feature-catalog.md` (PUB-01..03).

### 7. Nhánh & PR
Không có code. Kết quả là biên bản/issue, không tạo PR.

---

## IN1 — Hoàn thiện CI (gate PR) · Phụ trách: OP-1 · Ưu tiên P1 · Đang làm ~50%

### 1. Mục tiêu
Mọi Pull Request phải chạy `pnpm check` (lint + type-check + test + build); PR đỏ **không được merge**; nhánh `main` được bảo vệ, không push thẳng.

### 2. Bối cảnh
- `.github/workflows/ci.yml` **đã có**: chạy trên `pull_request` + `push main`, cài deps, chạy `pnpm check`, đã bật `cache: pnpm`. → phần workflow coi như xong.
- **Còn thiếu:** (a) bật branch protection cho `main`; (b) tạo 1 PR mẫu để xác nhận CI chạy và chặn merge khi đỏ.
- Job trong CI tên là `quality` (đây chính là "status check" cần yêu cầu ở bước bảo vệ nhánh).

### 3. Các bước
1. Bật branch protection cho `main` (cần quyền admin repo). Dùng UI GitHub:
   *Settings → Branches → Add branch ruleset/protection rule* cho `main`, bật:
   - Require a pull request before merging (≥ 1 review).
   - Require status checks to pass → chọn check **`quality`**.
   - Require branches to be up to date before merging.
   - (Khuyến nghị) Do not allow bypassing.

   Hoặc bằng `gh` CLI:
   ```bash
   gh api -X PUT repos/GrootTheDeveloper/apc-portal/branches/main/protection \
     -H "Accept: application/vnd.github+json" \
     -f "required_status_checks[strict]=true" \
     -f "required_status_checks[contexts][]=quality" \
     -f "enforce_admins=true" \
     -f "required_pull_request_reviews[required_approving_review_count]=1" \
     -F "restrictions=null"
   ```
2. Tạo PR mẫu để kiểm tra: nhánh bất kỳ, sửa nhỏ (vd thêm dòng vào README), mở PR, xác nhận CI `quality` chạy và hiện trạng thái ✓/✗ trên PR.
3. (Tùy chọn) Thử đẩy 1 commit làm `pnpm check` đỏ để xác nhận PR bị chặn merge.

### 4. Định nghĩa Hoàn thành (DoD)
- [ ] `main` bật branch protection: bắt buộc PR + ≥1 review + status check `quality` xanh.
- [ ] Không push thẳng được vào `main` (thử `git push` bị từ chối).
- [ ] Một PR mẫu cho thấy CI chạy và chặn merge khi đỏ.

### 5. Cách kiểm tra
```bash
gh api repos/GrootTheDeveloper/apc-portal/branches/main/protection | grep -i "quality\|required_pull_request"
```
và mở PR mẫu xem tab Checks.

### 6. Docs liên quan
`docs/06-architecture.md` mục 4 · `docs/README.md` mục 4 (quy tắc PR) · file `.github/workflows/ci.yml`.

### 7. Nhánh & PR
Nhánh cho PR mẫu: `in1-ci-sample`. Ghi chú: sau khi bật protection, cả nhóm bắt buộc làm việc qua PR.

---

## FE1 — Router + layout chung · Phụ trách: FE-1 · Ưu tiên P0

### 1. Mục tiêu
Có `react-router`, một layout dùng chung (Navbar + Footer), và **route rỗng (đặt tên tiếng Anh)** cho từng trang để điều hướng được giữa các màn hình. Đây là khung để mọi trang frontend cắm vào sau này.

### 2. Bối cảnh
- Entry: `apps/web/src/main.tsx` → `App.tsx` đang render thẳng `HomePage`.
- `HomePage.tsx` hiện **tự chứa** `<Navbar/>` + `<main>...sections...</main>` + `<SiteFooter/>` (`apps/web/src/pages/home/`).
- `Navbar.tsx` dùng mảng `NAV_LINKS` với `href="#"` (chưa trỏ route thật).
- **Chưa cài** `react-router-dom`.
- Route chuẩn (tiếng Anh, theo `docs/04-sitemap.md` §3.2): `/`, `/about`, `/news`, `/events`, `/projects`, `/recruitment`, `/login`, `/admin`.

### 3. Các bước
1. Cài router (workspace web):
   ```bash
   pnpm --filter @apc/web add react-router-dom
   ```
2. Tạo layout dùng chung `apps/web/src/layouts/RootLayout.tsx`: render `<Navbar/>`, `<main><Outlet/></main>`, `<SiteFooter/>`.
3. Sửa `HomePage.tsx`: **bỏ** `<Navbar/>` và `<SiteFooter/>` (đã chuyển lên layout), giữ lại phần sections + `useScrollReveal(rootRef)`.
4. Khai báo router trong `App.tsx` (dùng `createBrowserRouter` + `RouterProvider`), với `RootLayout` là element cha và các route con:
   - `index` → `HomePage`
   - `/about`, `/news`, `/events`, `/projects`, `/recruitment`, `/login`, `/admin` → trang stub
   - `*` → trang 404
5. Tạo trang stub: `apps/web/src/pages/<ten>/index.tsx` — mỗi trang trả một placeholder đơn giản (tiêu đề + dòng "Đang xây dựng"). Tạo `apps/web/src/pages/NotFound.tsx` cho 404.
6. Sửa `Navbar.tsx`: chuyển `NAV_LINKS` sang có `to` và dùng `<NavLink>` (active state tự động). Ánh xạ nhãn → route:
   - Giới thiệu / Về APC → `/about`
   - Sự kiện → `/events` · Tin tức → `/news` · Dự án → `/projects`
   - Gia nhập APC → `/recruitment`
   - Hoạt động → section trang chủ (anchor `/#hoat-dong`) — chưa có route riêng trong scope
   - UMTOJ → link ngoài (giữ `external`, mở tab mới an toàn)
   - Logo → `/` · nút "Đăng nhập" → `/login`
7. Bọc app trong `RouterProvider`; không dùng `<a href="#">` cho điều hướng nội bộ nữa.

### 4. Định nghĩa Hoàn thành (DoD)
- [ ] `react-router-dom` có trong `apps/web/package.json`.
- [ ] `RootLayout` dùng chung Navbar + Footer; HomePage không còn tự render chúng.
- [ ] Mỗi route ở mục 2 mở được (stub cũng được); URL đổi đúng.
- [ ] Nav link điều hướng **không reload toàn trang**; active state đúng.
- [ ] Route sai hiển thị trang 404 có lối về `/`.
- [ ] `pnpm check` xanh (lint + type-check + build).

### 5. Cách kiểm tra
```bash
pnpm --filter @apc/web dev     # bấm thử từng nav link, gõ URL sai để thấy 404
pnpm check                     # lint + type-check + test + build phải xanh
```

### 6. Docs liên quan
`docs/04-sitemap.md` §3.2 (URL tiếng Anh) & §5 (route công khai) · `docs/06-architecture.md` §3 (quy ước component/hook) · `docs/03-user-flows.md` FLOW-01.

### 7. Nhánh & PR
Nhánh: `fe1-router-layout`. PR nhỏ, mô tả rõ; kèm ảnh chụp điều hướng chạy được. Không đổi nội dung/section trang chủ trong PR này (chỉ tách layout + thêm router).
