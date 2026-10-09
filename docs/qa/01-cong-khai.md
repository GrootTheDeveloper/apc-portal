# Kịch bản kiểm tra: Trang công khai (01-cong-khai)

## Danh sách kịch bản

### KB-01-01. Xem trang chủ và các chỉ số hoạt động
- Chức năng: C1 · Luồng: FLOW-01 · Nghiệm thu: AC-01
- Tài khoản: không đăng nhập
- Chuẩn bị: đã chạy pnpm infra:up, migrate reset và pnpm dev

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Mở http://localhost:5173 | Hiển thị trang chủ với banner, phần giới thiệu ngắn và 4 chỉ số hoạt động của CLB |
| 2 | Kiểm tra giao diện trên màn hình nhỏ (360 px) | Giao diện tự động co giãn, không bị tràn ngang (UX-01) |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

---

### KB-01-02. Xem danh sách và chi tiết tin tức
- Chức năng: C2 · Luồng: FLOW-02 · Nghiệm thu: AC-01
- Tài khoản: không đăng nhập
- Chuẩn bị: dữ liệu mẫu đã được nạp

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Bấm vào mục **Tin tức** trên thanh điều hướng | Mở trang danh sách các bài viết đã công bố |
| 2 | Bấm vào một bài viết bất kỳ | Mở trang chi tiết bài viết với tiêu đề, ngày đăng và nội dung đầy đủ |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

---

### KB-01-03. Mở bài viết ở trạng thái Bản nháp (Draft) hoặc Lưu trữ (Archived)
- Chức năng: C2 · Luồng: FLOW-02
- Tài khoản: không đăng nhập
- Chuẩn bị: biết slug của một bài viết đang ở trạng thái nháp

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Mở danh sách tin tức (/news) | Bài viết ở trạng thái bản nháp không xuất hiện trong danh sách |
| 2 | Nhập trực tiếp đường dẫn bài viết nháp trên trình duyệt | Hệ thống chuyển hướng hoặc hiển thị trang 404 |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |
