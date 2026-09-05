# Phase 0 — 3 task khởi động

Ba task không phụ thuộc, làm song song được ngay. **Kết quả kỳ vọng** là mốc bắt buộc; **Gợi ý cách làm** chỉ tham khảo.

---

## CT1 — APC duyệt trang chủ (redesign) · CLB/APC · P0

### Kết quả kỳ vọng
- APC đồng ý trang chủ redesign được công bố.
- Chốt danh sách nội dung mẫu cần thay (đầu vào cho CT2): chỉ số CLB ở hero, ô đối tác placeholder.
- Phản hồi chỉnh sửa (nếu có) đã thành issue, có người nhận.

### Bối cảnh
- Trang chủ chạy ở `/` — `apps/web/src/pages/home/`.
- Bản redesign khác bản gốc: hero 50:50 + dải 4 chỉ số CLB, bộ màu brand đỏ/vàng/xanh, seam gradient giữa các section (`docs/08-handover.md` mục 2).
- Chỉ số CLB trong `apps/web/src/pages/home/sections/HeroSection.tsx` là số mẫu.

### Gợi ý cách làm
- `pnpm --filter @apc/web dev`, demo trang chủ ở 1440×900.
- Trình BCN/APC bản redesign kèm danh sách nội dung mẫu; ghi lại phản hồi.

### Cách kiểm tra
APC đã đồng ý và danh sách nội dung cần thay đã chốt.

### Docs liên quan
`docs/08-handover.md` mục 2 · `docs/05-feature-catalog.md` (PUB-01..03).

### Nhánh & PR
Không có code.

---

## IN1 — Hoàn thiện CI (gate PR) · OP-1 · P1 · Đang làm ~50%

### Kết quả kỳ vọng
- Mọi PR chạy `pnpm check`; PR đỏ không merge được.
- `main` được bảo vệ: bắt buộc PR + ≥1 review + status check `quality` xanh; không push thẳng.
- Một PR mẫu chứng minh CI chạy và chặn merge khi đỏ.

### Bối cảnh
- `.github/workflows/ci.yml` đã chạy `pnpm check` trên `pull_request` + `push main`, có `cache: pnpm`. Job tên `quality`.
- Còn thiếu: branch protection cho `main` và PR mẫu.

### Gợi ý cách làm
- Bật branch protection qua *Settings → Branches* (require PR, ≥1 review, status check `quality`, up-to-date), hoặc:
  ```bash
  gh api -X PUT repos/GrootTheDeveloper/apc-portal/branches/main/protection \
    -H "Accept: application/vnd.github+json" \
    -f "required_status_checks[strict]=true" \
    -f "required_status_checks[contexts][]=quality" \
    -f "enforce_admins=true" \
    -f "required_pull_request_reviews[required_approving_review_count]=1" \
    -F "restrictions=null"
  ```
- Mở 1 PR nhỏ; thử thêm 1 commit làm `pnpm check` đỏ để xác nhận bị chặn.

### Cách kiểm tra
```bash
gh api repos/GrootTheDeveloper/apc-portal/branches/main/protection | grep -i "quality\|required_pull_request"
```
Push thẳng vào `main` bị từ chối.

### Docs liên quan
`docs/06-architecture.md` mục 4 · `docs/README.md` mục 4 · `.github/workflows/ci.yml`.

### Nhánh & PR
`in1-ci-sample`.

---

## FE1 — Router + layout chung · FE-1 · P0

### Kết quả kỳ vọng
- `react-router-dom` có trong `apps/web/package.json`.
- Layout chung dùng lại Navbar + Footer; `HomePage` không còn tự render chúng.
- Các route mở được (stub cũng được): `/` `/about` `/news` `/events` `/projects` `/recruitment` `/login` `/admin`, và `*` → 404.
- Nav link điều hướng không reload toàn trang; active state đúng; logo → `/`, nút Đăng nhập → `/login`.
- `pnpm check` xanh.

### Bối cảnh
- `apps/web/src/App.tsx` render thẳng `HomePage`; `HomePage.tsx` tự chứa `<Navbar/>` + `<SiteFooter/>`.
- `Navbar.tsx` dùng `NAV_LINKS` với `href="#"` (chưa trỏ route).
- Chưa cài `react-router-dom`.
- Route dùng segment tiếng Anh (`docs/04-sitemap.md` §3.2).

### Gợi ý cách làm
- `pnpm --filter @apc/web add react-router-dom`.
- Tạo `apps/web/src/layouts/RootLayout.tsx`: `<Navbar/>` + `<main><Outlet/></main>` + `<SiteFooter/>`.
- Bỏ `<Navbar/>`/`<SiteFooter/>` khỏi `HomePage.tsx`, giữ sections + `useScrollReveal`.
- Khai báo `createBrowserRouter` trong `App.tsx`: `RootLayout` là cha, route con là HomePage + các trang stub + 404.
- Stub: `apps/web/src/pages/<ten>/index.tsx` trả placeholder; `NotFound.tsx` cho 404.
- `NAV_LINKS` chuyển sang `<NavLink to=...>`. Ánh xạ: Giới thiệu/Về APC → `/about`; Sự kiện → `/events`; Tin tức → `/news`; Dự án → `/projects`; Gia nhập APC → `/recruitment`; Hoạt động → anchor section trang chủ; UMTOJ → link ngoài.

### Cách kiểm tra
```bash
pnpm --filter @apc/web dev   # bấm từng nav link; gõ URL sai để thấy 404
pnpm check
```

### Docs liên quan
`docs/04-sitemap.md` §3.2 và §5 · `docs/06-architecture.md` §3 · `docs/03-user-flows.md` FLOW-01.

### Nhánh & PR
`fe1-router-layout`. PR chỉ tách layout + thêm router; không đổi nội dung section trang chủ.
