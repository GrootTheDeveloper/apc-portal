# Tin tức & Dự án — Nguyễn Gia Bảo

Làm cả API lẫn giao diện. Làm lần lượt từ trên xuống, hạn ghi ngay cạnh tên việc. Mỗi việc là 1 nhánh và 1 PR; mở PR xong là sang việc sau được, trừ khi việc sau cần code của việc trước thì chờ PR đó merge.

### Giai đoạn 1 (05/10 – 11/10)
#### C1. Trang Tin tức & Dự án — hạn CN 11/10
Làm `/news`, `/news/[slug]`, `/projects`, `/projects/[slug]` với dữ liệu giả. Dùng lại mẫu card của `NewsSection` và `ProjectsSection` ở trang chủ.

**Xong khi:** có trạng thái đang tải, không có bài, bị lỗi; hiển thị ổn trên điện thoại.

### Giai đoạn 2 (12/10 – 01/11)
#### C2. Nối dữ liệu thật — hạn CN 01/11
Viết API trả tin tức và dự án đã công bố. Cho các trang tin tức, dự án và trang chủ lấy dữ liệu từ API này bằng `api(...)` trong `apps/web/src/lib/api.ts`.

**Xong khi:** trong code không còn dữ liệu giả.

### Giai đoạn 3 (02/11 – 22/11)
#### C3. Quản trị bài viết — hạn CN 08/11
Làm `/admin/content/posts`: soạn bài, xem trước, công bố, gỡ, lưu trữ.

**Xong khi:** Ban Chủ nhiệm công bố được một bài trong dưới 10 phút.

#### C4. Quản trị dự án — hạn CN 15/11
Làm `/admin/content/projects`, tương tự C3.

#### C5. Thông báo nội bộ — hạn CN 22/11
Làm chức năng gửi thông báo cho một ban hoặc một vai trò. Thành viên xem ở `/portal/announcements`.

**Xong khi:** người ngoài ban không thấy thông báo.

### Lưu ý
- Bài ở trạng thái Bản nháp hoặc Lưu trữ không hiện ra ngoài, kể cả khi gõ thẳng link.
- Quản lý ban chỉ sửa được bài của ban mình và chỉ công bố thông báo nội bộ trong ban. Chỉ `BOARD` công bố nội dung công khai.
- Dự án không có phân công, deadline hay tiến độ.
- Đổi tiêu đề không làm đổi link bài đã công bố.

### Tài liệu
- [PRD](../01-prd.md): mục 7.1, 7.6, 7.7
- [User flow](../03-user-flows.md): FLOW-17, 18
- [Sitemap](../04-sitemap.md): mục 5.2, 8.5, 8.6
