# Runbook: bootstrap tài khoản đặc quyền đầu tiên

Tạo `BOARD` đầu tiên và `TECH_ADMIN` đầu tiên trên production còn trống (RP-15, PRD §11 mục 13, AC-RBAC-09). Lệnh do A7 viết: `apps/api/src/scripts/bootstrap.ts` (đọc tham số, in kết quả ở `bootstrap-cli.ts`), logic ở `apps/api/src/modules/accounts/bootstrap.ts`.

> Repository công khai: runbook này chỉ dùng giá trị mẫu. Không ghi tên, email, mật khẩu thật hay địa chỉ máy chủ vào đây.

## Khi nào chạy

- **Một lần**, ngay sau lần triển khai production đầu tiên (O7, bước "triển khai production"), khi `db:deploy` đã chạy xong.
- Chạy lại chỉ trong trường hợp ở mục "Chạy lại" bên dưới.
- Không có endpoint HTTP; chỉ chạy từ console máy chủ, trong container API.

## Chuẩn bị

1. Trưởng dự án và Ban Chủ nhiệm chọn **hai người khác nhau**: một người nhận `BOARD`, một người nhận `TECH_ADMIN` (BR-21). Báo trong nhóm riêng, không ghi vào repository.
2. Có của mỗi người: tên đăng nhập (chữ không dấu, số, `.`, `_`, `-`), email tài khoản, họ tên.
3. Ngày kết thúc nhiệm kỳ hiện tại (`YYYY-MM-DD`). Vai trò đặc quyền hết hạn lúc 23:59:59 giờ Việt Nam ngày đó (RP-03). Thông tin APC (`site_settings`) đã có `termEndsAt` thì ngày nhập **không được muộn hơn** ngày đó (lệnh từ chối; QĐ-6 một nguồn duy nhất). Có dòng mà `termEndsAt` đang trống thì lệnh ghi luôn giá trị này (có audit `org.update_info`). Chưa có dòng đó (database hoàn toàn trống) thì lệnh **không** tạo, vì thông tin giới thiệu bắt buộc đủ nội dung (tạo rỗng làm `/public/about` lỗi 500); lệnh in nhắc để Ban Chủ nhiệm nhập ở trang Thông tin APC sau khi kích hoạt.
4. Hai người có mặt (trực tiếp hoặc gọi riêng) để nhận mật khẩu tạm ngay. **Không gửi mật khẩu tạm qua email hay nhóm chat chung.**

## Chạy

Trong container API (thư mục `apps/api`), chạy bản đã build. Image production không build từ source nên không có `tsx`:

```sh
node dist/scripts/bootstrap.js \
  --board-username chu.nhiem --board-email chu.nhiem@example.edu.vn --board-name "Họ Tên Chủ Nhiệm" \
  --tech-username van.hanh --tech-email van.hanh@example.edu.vn --tech-name "Họ Tên Vận Hành" \
  --term-ends 2027-06-30
```

Thử trên máy local (có `tsx`): `pnpm --filter @apc/api bootstrap -- <cùng tham số>`.

Phải chạy trong **terminal tương tác** (`docker exec -it ...`). Output bị pipe, `tee` hoặc chuyển ra file thì lệnh từ chối ngay (mã thoát 2) trước khi ghi gì vào database, để mật khẩu tạm không rơi vào file log.

Mã thoát: `0` thành công · `1` bị từ chối, tham số sai hoặc lỗi database (database không đổi) · `2` gọi sai (tùy chọn lạ, không phải terminal).

Lệnh chạy trong **một transaction** và lấy khóa chống chạy đồng thời (hai người chạy cùng lúc không tạo ra bốn tài khoản): tham số sai (trùng tên đăng nhập/email giữa hai người, ngày sai dạng, email sai) hoặc lỗi giữa chừng thì database không đổi gì.

Kết quả thành công (mật khẩu tạm in **một lần duy nhất**, không ghi vào log, file hay audit):

```
Đã tạo hai tài khoản bootstrap.
  BOARD       chu.nhiem     xxxxx-xxxxx-xxxxx-xxxxx
  TECH_ADMIN  van.hanh      xxxxx-xxxxx-xxxxx-xxxxx
Mật khẩu tạm hết hạn sau 72 giờ (...).
```

Chuyển mỗi mật khẩu cho đúng người, rồi xóa lịch sử terminal nếu terminal có lưu (`history -c` hoặc đóng phiên).

## Sau khi chạy

Mỗi người, trong vòng 72 giờ:

1. Đăng nhập `/login` bằng mật khẩu tạm → hệ thống chuyển tới `/account/activate` → đặt mật khẩu riêng (A4).
2. Thiết lập xác thực hai bước (B3). Khi xong, vai trò `BOARD`/`TECH_ADMIN` chuyển từ `PENDING` sang `ACTIVE` và bootstrap tự bị vô hiệu (lệnh chạy lại sẽ từ chối).
3. Đăng nhập lại, mở `/admin` kiểm tra menu đúng vai trò.

Kiểm tra bằng `pnpm --filter @apc/api db:studio` hoặc trang `/admin/audit-logs` (B4):

- [ ] Bảng `users`: đúng hai tài khoản mới, trạng thái `PENDING_ACTIVATION` (sau bước 1 là `ACTIVE`).
- [ ] Bảng `user_roles`: một dòng `BOARD`, một dòng `TECH_ADMIN`, lý do `bootstrap`, `expiresAt` = ngày kết thúc nhiệm kỳ.
- [ ] Bảng `audit_logs`: các dòng `account.create`, `role.grant` với `actorType = SERVICE`, `serviceName = bootstrap`; không chứa mật khẩu.

Sau đó cấp `BOARD` thứ hai (A6, trang vai trò của tài khoản) và `TECH_ADMIN` thứ hai (A6, quy trình hai người ở `/admin/access-control`). Đủ hai `BOARD` và hai `TECH_ADMIN` đã thiết lập 2 lớp thì đặt `ENFORCE_PRIVILEGED_MINIMUM=true` (A5, RP-06, RP-07).

## Chạy lại

Dòng bootstrap được nhận diện bằng "không có người cấp" (`grantedById` trống) và lý do `bootstrap`. Vai trò cấp ở trang quản trị (A6) luôn ghi người cấp, nên không bị nhận nhầm.

| Tình huống | Lệnh | Kết quả |
| --- | --- | --- |
| Còn tài khoản bootstrap chưa kích hoạt xong (vd mật khẩu tạm quá 72 giờ), **kể cả khi người kia đã kích hoạt xong** (mới xong một nửa) | `node dist/scripts/bootstrap.js` (không cần tham số) | Không tạo tài khoản mới; chỉ cấp lại mật khẩu tạm 72 giờ cho (các) tài khoản bootstrap còn chờ, thu hồi phiên cũ, ghi audit `account.reset_password`. Có truyền tham số thì lệnh in nhắc là tham số không được dùng. Không cần sửa database bằng tay |
| Còn dòng bootstrap chờ nhưng cặp bootstrap không còn đủ đúng một `BOARD` + một `TECH_ADMIN` (vd một dòng đã bị thu hồi) | bất kỳ | Từ chối, thoát mã 1, không cấp lại một phần. Xử lý theo runbook mất quyền quản trị |
| Cả hai tài khoản bootstrap đã kích hoạt xong | bất kỳ | Từ chối, thoát mã 1, database không đổi |
| Đã từng có dòng `BOARD`/`TECH_ADMIN` khác (kể cả đã hết hạn hoặc bị thu hồi) | bất kỳ | Từ chối, thoát mã 1: bootstrap không mở lại sau khi hoàn tất (AC-RBAC-09) |
| Ngày `--term-ends` muộn hơn `termEndsAt` đã lưu ở Thông tin APC | có tham số | Từ chối, thoát mã 1; nhập ngày không muộn hơn ngày đã lưu |
| Tên đăng nhập hoặc email đã có người dùng | có tham số | Từ chối, database không đổi; chọn tên khác |

Mất hết quyền quản trị sau khi bootstrap đã hoàn tất thì **không** dùng lệnh này; xử lý theo runbook mất quyền quản trị (O-area) và quy trình sự cố.
