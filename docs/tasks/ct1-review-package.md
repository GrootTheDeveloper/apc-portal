# CT1 — Gói trình APC duyệt trang chủ

> ✅ **Đã duyệt 05/09/2026** (trưởng dự án). Trang chủ redesign được phép công bố. Việc cấp số liệu CLB thật + danh sách đối tác chuyển sang **CT2**.

Chuẩn bị sẵn để trình BCN/APC. Người chủ trì: CLB/APC.

## Cách demo
```bash
pnpm --filter @apc/web dev
```
Mở `http://localhost:5173`, xem ở kích thước laptop/desktop (1440×900).

## 9 section trang chủ (thứ tự)
Hero → Giá trị cốt lõi → Hoạt động → Dự án → Sự kiện → Tin tức → Đối tác → Đơn vị chủ quản → CTA gia nhập, kèm footer.

## Khác gì bản tham chiếu gốc (điểm cần APC lưu ý)
- Hero bố cục 50:50 (nội dung trái · ảnh phải) kèm **dải 4 chỉ số CLB** dưới ảnh.
- Bộ màu brand đỏ/vàng/xanh xuyên suốt.
- Dải **seam gradient** ngăn giữa các section.

## Nội dung mẫu cần APC cung cấp số/nội dung thật (đầu vào cho CT2)
- **Chỉ số CLB ở Hero** (`apps/web/src/pages/home/sections/HeroSection.tsx`): đang là số mẫu `20+ Dự án · 100+ Thành viên · 3 Ban chuyên môn · 15+ Sự kiện/năm`.
- **Đối tác** (`PartnersSection.tsx`): logo/tên đang là placeholder — cần danh sách đối tác được phép công bố.
- **Tin tức / Sự kiện / Dự án**: đang là dữ liệu mẫu.

## Cần chốt khi duyệt
- [ ] APC đồng ý công bố trang chủ redesign.
- [ ] Số liệu CLB thật cho Hero.
- [ ] Danh sách đối tác được phép hiển thị (hoặc xác nhận ẩn tạm).
- [ ] Nội dung/hình ảnh chỉnh sửa (nếu có) → tạo issue, gán người.

Xong 4 mục trên là đóng CT1 và mở đường cho CT2 (thay dữ liệu thật).
