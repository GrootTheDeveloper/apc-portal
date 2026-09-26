# Bảo mật & nhật ký — Trương Phúc Minh

Làm cả API lẫn giao diện.

### Giai đoạn 1
**B1. Nhật ký thao tác.** Viết hàm `audit(...)` dùng chung để ghi lại ai làm gì, với đối tượng nào, lúc nào, kết quả ra sao.
Xong khi: có test; làm xong nhắn cả nhóm cách dùng.

**B2. Quyền riêng tư & đồng ý dữ liệu.** Làm trang `/privacy` (nội dung tĩnh; route và link ở footer đã có sẵn). Tạo bảng `ConsentRecord` và hàm dùng chung `recordConsent(...)` để lưu "đồng ý xử lý dữ liệu" (ai, mục đích, phiên bản chính sách, lúc nào).
Xong khi: có test cho `recordConsent`; làm xong nhắn Khương (R3) và Nghĩa (E3) cách dùng.

### Giai đoạn 2
**B3. Xác thực 2 lớp.** Tài khoản `BOARD` và `TECH_ADMIN` phải nhập thêm mã từ app xác thực khi đăng nhập. Làm API và 3 trang: `/account/setup-two-factor`, `/account/two-factor`, `/account/recovery-codes`. Được cài `otpauth` và `qrcode`.
Xong khi: mã khôi phục chỉ hiện 1 lần và mỗi mã chỉ dùng được 1 lần; chưa cài 2 lớp thì vai trò trong `user_roles` vẫn ở `PENDING`; phiên đã qua mã 2 lớp đánh dấu `twoFactorVerified` trong bảng `sessions`.

### Giai đoạn 3
**B4. Xem nhật ký.** Làm trang `/admin/audit-logs` để lọc nhật ký theo người, hành động, thời gian.
Xong khi: trang chỉ cho xem, không sửa hay xóa được; `BOARD` xem nhật ký nghiệp vụ, `TECH_ADMIN` xem nhật ký bảo mật và vận hành.

**B5. Quyền riêng tư của thành viên.** Làm trang `/portal/privacy`: thành viên bật/tắt đồng ý công khai tên, ảnh. Làm trang `/portal/data-requests`: thành viên gửi yêu cầu về dữ liệu của mình; Ban Chủ nhiệm xử lý ở `/admin/data-requests`.

### Lưu ý
- Nhật ký không chứa mật khẩu hay dữ liệu nhạy cảm.
- Không gửi mã 2 lớp hay mã khôi phục qua email.
- Một tài khoản không được vừa là `BOARD` vừa là `TECH_ADMIN`.

### Tài liệu
- [Vai trò & quyền](../02-roles-permissions.md): mục 10, 11
- [User flow](../03-user-flows.md): FLOW-21, 27, 28
- [PRD](../01-prd.md): mục 7.9, 10.5
