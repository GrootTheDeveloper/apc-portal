# Kịch bản kiểm tra: Đăng ký sự kiện (03-dang-ky-su-kien)

## Danh sách kịch bản

### KB-03-01. Xem danh sách và chi tiết sự kiện
- Chức năng: E1, E2 · Luồng: FLOW-10 · Nghiệm thu: AC-01
- Tài khoản: không đăng nhập
- Chuẩn bị: dữ liệu mẫu có sự kiện đang mở đăng ký

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Mở trang sự kiện trên hệ thống | Hiển thị danh sách các sự kiện sắp diễn ra và đã diễn ra |
| 2 | Bấm vào một sự kiện đang mở đăng ký | Mở trang chi tiết sự kiện với thông tin thời gian, địa điểm và nút đăng ký |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

---

### KB-03-02. Đăng ký tham gia sự kiện thành công
- Chức năng: E3 · Luồng: FLOW-11 · Nghiệm thu: AC-02
- Tài khoản: không đăng nhập

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Mở trang chi tiết sự kiện đang mở, bấm **Đăng ký** | Hiển thị form đăng ký tham gia sự kiện |
| 2 | Điền thông tin hợp lệ (ví dụ: email 	hamgia1@example.com), bấm xác nhận | Đăng ký thành công, hiển thị mã vé hoặc thông báo xác nhận kèm mã tra cứu |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

---

### KB-03-03. Đăng ký sự kiện đã hết chỗ hoặc quá hạn
- Chức năng: E3 · Luồng: FLOW-11
- Tài khoản: không đăng nhập
- Chuẩn bị: chọn sự kiện đã hết chỗ hoặc đã quá hạn đăng ký

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Mở trang chi tiết sự kiện đã hết chỗ hoặc quá hạn | Nút đăng ký bị vô hiệu hóa hoặc ẩn đi; hoặc khi bấm có thông báo lý do cụ thể (hết chỗ / quá hạn) |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

---

### KB-03-04. Tra cứu và hủy đăng ký sự kiện
- Chức năng: E3 · Luồng: FLOW-11
- Tài khoản: không đăng nhập

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Mở trang tra cứu vé/sự kiện, nhập mã tra cứu hợp lệ | Hiển thị thông tin đăng ký và trạng thái vé |
| 2 | Bấm nút **Hủy đăng ký** (nếu sự kiện cho phép hủy trước hạn) | Cập nhật trạng thái thành đã hủy, giải phóng chỗ |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |
