# Thành viên & Về APC — Lương Huỳnh

## Bối cảnh

Mảng này gồm ba phần:

- **Trang Về APC** trên website công khai: sứ mệnh, các ban chuyên môn, thông tin liên hệ, link chính thức. Ban Chủ nhiệm tự sửa qua trang quản trị (ORG-01 đến ORG-06).
- **Trang của thành viên** trong portal: tổng quan, hồ sơ cá nhân, lịch sử hoạt động, danh bạ.
- **Quản lý thành viên** cho Ban Chủ nhiệm và quản lý ban.

Thông tin cá nhân của thành viên nằm trực tiếp trong bảng `users` (họ tên, MSSV, khoa, ngành, niên khóa, ảnh, kỹ năng, lĩnh vực quan tâm, ban). Bảng `departments` đã có sẵn (tên, mã, mô tả, trạng thái, thứ tự).

Hai trạng thái độc lập (MEM-11):

| Trạng thái | Giá trị | Ý nghĩa |
| --- | --- | --- |
| Thành viên (`memberStatus`) | Đang hoạt động / Tạm ngưng / Ngừng tham gia | Tình trạng tham gia CLB |
| Tài khoản (`status`) | Chờ kích hoạt / Đang hoạt động / Bị khóa / Ngừng hoạt động | Khả năng đăng nhập |

Quyền theo [Vai trò & quyền](../02-roles-permissions.md) §8.2, §8.7:

| Hành động | Thành viên | `DEPARTMENT_MANAGER` | `BOARD` |
| --- | --- | --- | --- |
| Xem, sửa trường được phép của hồ sơ bản thân | Được | Được | Được |
| Xem danh bạ cơ bản | Được | Được | Được |
| Xem hồ sơ quản lý của thành viên | Không | Trong ban | Tất cả |
| Sửa MSSV, ban, trạng thái thành viên | Không | Không | Được |
| Sửa thông tin APC, ban chuyên môn, nội dung nổi bật | Không | Không | Được |
| Xuất danh sách thành viên | Không | Không | Được |

## Phụ thuộc

| Cần có | Từ việc | Dùng cho |
| --- | --- | --- |
| Dữ liệu mẫu | D1 (T5 08/10) | T2 |
| `requireAuth`, `requireRole`, `requireScope` | A1 (T5 08/10) | T3–T6 |
| `audit(...)` | B1 (T5 08/10) | T4, T5 |
| Upload ảnh | D2 (CN 11/10) | T3 (ảnh đại diện) |
| Bảng `EventRegistration` | E2 (T5 22/10) | T3 (lịch sử hoạt động) |
| Khung trang portal & admin | A3 (T5 22/10) | T3–T6 |
| Điểm danh | E6 (CN 22/11) | T3 hiện đủ buổi đã điểm danh |

| Người khác cần | Việc | Hạn |
| --- | --- | --- |
| D5 (gắn nút Xuất CSV) | T5 trang `/admin/members` | CN 15/11 |
| E6 (hiện buổi đã điểm danh) | T3 trang `/portal/activity-history` | CN 01/11 |

## Giai đoạn 1 (05/10 – 11/10)

### T1. Trang Về APC — hạn CN 11/10

**Mục tiêu:** trang `/about` hoàn chỉnh giao diện, chạy với dữ liệu giả.

**Làm:**

- Thư mục trang `apps/web/src/pages/about/`. Thay `Placeholder` của `/about` trong `App.tsx`.
- Dữ liệu giả trong `mock.ts`, cùng hình dạng phản hồi API ở T2.
- Các khối: giới thiệu và sứ mệnh; danh sách ban chuyên môn (tên, mô tả, đầu mối liên hệ); thông tin liên hệ (email, fanpage); link chính thức (UMTOJ và các link khác, theo luật chung về link ngoài).
- Đầu mối liên hệ của ban hiển thị kênh liên hệ chung của ban (email ban, fanpage) hoặc chức danh; không hiện tên, email, số điện thoại cá nhân của thành viên (BR-20, DATA-03).
- Trang không có khối cơ cấu nhân sự có tên, ảnh thành viên.
- Title, description, canonical, Open Graph (SEO-01).

**Xong khi:**

- [ ] Có đủ trạng thái trang; PR có ảnh chụp.
- [ ] Link ngoài có dấu hiệu rời trang và mở tab mới với `rel="noopener noreferrer"`.
- [ ] Không có thông tin cá nhân của thành viên trên trang.

## Giai đoạn 2 (12/10 – 01/11)

### T2. Nối dữ liệu thật — hạn T5 22/10

**Mục tiêu:** trang Về APC lấy dữ liệu từ database.

**Cần có trước:** T1, D1.

**Làm:**

- Một migration:
  - Bảng `SiteSetting`: một dòng, cột JSON chứa tên hiển thị, mô tả, sứ mệnh, email liên hệ, fanpage, các link chính thức.
  - Thêm trường đầu mối liên hệ vào `Department` (ORG-02).
- Cập nhật dữ liệu mẫu D1 cho `SiteSetting` và đầu mối liên hệ (báo Phạm Đăng Hoàng Thiên, hoặc sửa `seed.ts` trong cùng PR và ghi lý do).
- API `GET /public/about` — trả thông tin APC và các ban `ACTIVE` theo thứ tự `order`.
- Trang dùng `useApi(...)`, xóa `mock.ts`.

**Xong khi:**

- [ ] Ban `ARCHIVED` không hiện trên `/about`.
- [ ] Sửa dữ liệu trong `db:studio` thì trang đổi theo sau khi tải lại.
- [ ] Endpoint có test thành công và test ban `ARCHIVED` bị loại.

### T3. Trang của thành viên — hạn CN 01/11

**Mục tiêu:** thành viên xem tổng quan, sửa hồ sơ cá nhân, xem lịch sử tham gia sự kiện.

**Cần có trước:** A2, D2. Dùng khung trang portal của A3 (hạn T5 22/10); trước đó dựng trang trong layout tạm. Lịch sử hoạt động cần E2.

**Làm:**

- API:
  - `GET /portal/me/profile` — đủ trường MEM-02 (họ tên, ảnh, email, MSSV, khoa/ngành, niên khóa, kỹ năng, lĩnh vực quan tâm, ban, vai trò), đánh dấu trường nào sửa được.
  - `PATCH /portal/me/profile` — schema Zod dạng `.strict()` chỉ nhận ảnh đại diện, email liên hệ, kỹ năng, lĩnh vực quan tâm. Gửi trường khác (MSSV, ban, vai trò, trạng thái) trả **422** (FLOW-12). "Email liên hệ" lưu vào trường nào chờ [QĐ-8](./README.md#8-điểm-cần-trưởng-dự-án-quyết-định); làm các trường còn lại trước.
  - `GET /portal/me/activity` — các sự kiện đã đăng ký và kết quả điểm danh từ `EventRegistration`.
- Ảnh đại diện upload qua D2 với `purpose = AVATAR`; chỉ thay ảnh hiện tại khi tệp ở trạng thái `CLEAN`, còn lại giữ ảnh cũ và hiện trạng thái đang xử lý (FLOW-12 bước 5, STATE-05).
- Trang:
  - `/portal` — tổng quan (MEM-01): sự kiện sắp tới, đăng ký gần đây; chừa chỗ cho thông báo mới (C5) và tài liệu mới (D4), gắn khi các việc đó merge. Mỗi khối gọi API riêng, lỗi khối nào hiện nút Thử lại ở khối đó (STATE-12).
  - `/portal/profile` — xem hồ sơ, phân biệt rõ trường sửa được và chỉ đọc.
  - `/portal/activity-history` — danh sách sự kiện, ngày, trạng thái điểm danh.

**Xong khi:**

- [ ] Thành viên tự sửa được ảnh, kỹ năng, lĩnh vực quan tâm.
- [ ] Gửi `studentId`, `departmentId`, vai trò hay `memberStatus` qua `PATCH` nhận 422 và không có trường nào bị đổi (test).
- [ ] Chưa đăng nhập gọi API nhận 401.
- [ ] Tắt tạm API sự kiện thì khối sự kiện trên `/portal` báo lỗi, các khối khác vẫn hiện.
- [ ] Hai tab cùng sửa hồ sơ: tab lưu sau nhận thông báo xung đột.

## Giai đoạn 3 (02/11 – 22/11)

### T4. Quản trị thông tin APC — hạn CN 08/11

**Mục tiêu:** Ban Chủ nhiệm tự sửa thông tin APC, các ban và nội dung nổi bật trên trang chủ (FLOW-24).

**Cần có trước:** T2, A3, B1.

**Làm:**

- Trang (chỉ `BOARD`):
  - `/admin/organization/profile` — sửa thông tin APC.
  - `/admin/organization/departments`, `/new`, `/[id]` — thêm, sửa, sắp xếp, lưu trữ ban. Tạo xong chuyển đến trang sửa của ban vừa tạo.
  - `/admin/organization/featured-content` — chọn tin tức, sự kiện, dự án nổi bật cho trang chủ.
- Kiểm tra:
  - Link chính thức chỉ nhận `http`/`https`; email đúng định dạng.
  - Tên ban không trùng với ban `ACTIVE` khác.
  - Nội dung nổi bật chỉ chọn được mục đang công khai.
- Xem trước trước khi lưu: mở `/about` hoặc trang chủ ở chế độ preview với dữ liệu chưa lưu (Sitemap §8.8), không tạo bản sao trang riêng.
- Lưu thông tin APC trong **một transaction**; lỗi không làm đổi một phần.
- Lưu trữ ban còn thành viên `memberStatus = ACTIVE` trả 409 kèm **danh sách thành viên cần chuyển** (FLOW-24).
- Trang chủ đọc nội dung nổi bật mỗi lần tải và **bỏ qua mục đã bị gỡ hoặc lưu trữ** (BR-11). Khi chưa chọn mục nào, cách hiển thị theo [QĐ-4](./README.md#8-điểm-cần-trưởng-dự-án-quyết-định). Sửa section trang chủ thì báo Nguyễn Gia Bảo và Lê Đăng Nghĩa trước.
- Mọi thay đổi gọi `audit(...)` (ORG-05).

**Xong khi:**

- [ ] Không lưu trữ được ban còn thành viên đang hoạt động; thông báo liệt kê các thành viên đó.
- [ ] Tạo ban trùng tên một ban đang hoạt động bị từ chối.
- [ ] Link `javascript:...` bị từ chối lưu.
- [ ] Đổi thứ tự ban thì `/about` hiện đúng thứ tự mới.
- [ ] Chọn một bài nổi bật thì bài đó hiện trên trang chủ; gỡ bài đó thì trang chủ không còn hiện.
- [ ] `manager.a` mở các trang này bị chặn; gọi API nhận 403.

### T5. Quản lý thành viên — hạn CN 15/11

**Mục tiêu:** xem, tìm, lọc thành viên; Ban Chủ nhiệm sửa MSSV, ban và trạng thái thành viên (FLOW-13).

**Cần có trước:** A3, B1.

**Làm:**

- API `GET /admin/members` (tìm theo tên/MSSV; lọc ban, vai trò, trạng thái; phân trang), `GET /admin/members/:id`, `PATCH /admin/members/:id` (MSSV, ban, `memberStatus`; chỉ `BOARD`).
- Trang `/admin/members` và `/admin/members/[id]` (tab Hồ sơ quản lý, Ban và trạng thái, Lịch sử hoạt động).
- Đổi trạng thái thành viên đúng sơ đồ ([PRD](../01-prd.md) mục 9.2): Đang hoạt động ↔ Tạm ngưng; Đang hoạt động / Tạm ngưng → Ngừng tham gia. Việc có tự thu hồi phiên và quyền quản trị khi chuyển Ngừng tham gia hay không chờ [QĐ-3](./README.md#8-điểm-cần-trưởng-dự-án-quyết-định).
- Đổi ban: không chuyển vào ban `ARCHIVED`; trong **cùng transaction**, thu hồi các vai trò `DEPARTMENT_MANAGER` gắn với ban cũ của người đó trước khi đổi (RP-08).
- Đổi MSSV, ban, trạng thái gọi `audit(...)` kèm lý do.
- Chừa chỗ nút **Xuất CSV** cho D5, chỉ hiện với `BOARD`.

**Xong khi:**

- [ ] Chỉ `BOARD` sửa được MSSV, ban và trạng thái; `manager.a` gọi `PATCH` nhận 403.
- [ ] `manager.a` chỉ thấy thành viên Ban A; mở thành viên Ban B nhận 404.
- [ ] Bước chuyển sai (ví dụ Ngừng tham gia → Đang hoạt động) trả 409.
- [ ] Chuyển `manager.a` sang Ban B thì vai trò quản lý Ban A của người đó chuyển `REVOKED`.
- [ ] `manager.a` không thấy nút Xuất CSV.
- [ ] Đã nhắn Phạm Đăng Hoàng Thiên chỗ gắn nút Xuất CSV.

### T6. Danh bạ thành viên — hạn CN 22/11

**Mục tiêu:** thành viên xem danh bạ nội bộ với thông tin tối thiểu.

**Cần có trước:** A3.

**Làm:**

- API `GET /portal/members` (tìm theo tên, lọc ban; phân trang), `GET /portal/members/:id`.
- Trang `/portal/members` và `/portal/members/[id]`.
- Chỉ trả họ tên, ảnh đại diện, ban, vai trò, kỹ năng, lĩnh vực quan tâm (MEM-10). Chọn trường ngay trong truy vấn (`select`), không lấy hết rồi ẩn ở giao diện.

**Xong khi:**

- [ ] Phản hồi API không có MSSV, email, số điện thoại (có test kiểm tra).
- [ ] Chưa đăng nhập gọi API nhận 401.

## Lưu ý

- Trạng thái thành viên và trạng thái tài khoản là hai thứ riêng; đổi cái này không tự đổi cái kia, trừ quy tắc sẽ chốt ở QĐ-3.
- Thành viên không tự đổi ban, vai trò, trạng thái hay lịch sử điểm danh (BR-10).
- Nhập/xuất CSV thành viên do Phạm Đăng Hoàng Thiên làm (D5); nút Xuất CSV đặt trên trang T5.
- Nằm ngoài phiếu này, xem [README kế hoạch](./README.md) mục 9: xóa email liên hệ, số điện thoại của thành viên ngừng hoạt động sau 12 tháng (PRD §10.5).

## Tài liệu

- [PRD](../01-prd.md): mục 7.4, 7.10, 9.2 (sơ đồ trạng thái Thành viên), 10.5
- [User flow](../03-user-flows.md): FLOW-01, FLOW-12, FLOW-13, FLOW-24
- [Sitemap](../04-sitemap.md): mục 5.2 (`PAGE-PUB-02`), 7.2, 8.3, 8.8, 13 (STATE-05, STATE-12)
- [Vai trò & quyền](../02-roles-permissions.md): mục 8.2, 8.7, 9 (RP-08)
