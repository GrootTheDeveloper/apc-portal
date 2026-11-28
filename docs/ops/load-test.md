# Báo cáo kiểm thử tải APC Portal (Q6)

| Thuộc tính | Giá trị |
| --- | --- |
| Ngày thực hiện | *(điền ngày chạy trên staging, vd: 29/11/2026)* |
| Môi trường | Staging (`https://...`) |
| Tag image đang chạy | *(điền tag image của web & api trên staging)* |
| Công cụ & lệnh chạy | `docker run --rm -i -e BASE_URL=https://<staging-domain> -e SEED_PASSWORD=<mat-khau> grafana/k6 run - < load/portal.js` |

## 1. Kịch bản mô phỏng

Chạy đồng thời **20 người dùng ảo (VUs)** liên tục trong **10 phút**:

- **14 VUs — Xem trang công khai:** trang chủ (`/`), danh sách & chi tiết tin tức, danh sách & chi tiết sự kiện, danh sách & chi tiết dự án, tìm kiếm công khai (`/api/public/search`).
- **4 VUs — Thành viên Portal:** đăng nhập bằng tài khoản mẫu (`member.a`, `member.b`), xem dashboard cá nhân (hồ sơ, vai trò, hoạt động), danh sách sự kiện nội bộ và tài liệu nội bộ, đăng xuất.
- **2 VUs — Nộp đơn & đăng ký sự kiện:** nộp đơn ứng tuyển vào đợt tuyển đang mở và đăng ký sự kiện công khai bằng dữ liệu giả `@example.com` (đã nâng tạm ngưỡng rate limit trên staging trong lúc đo và đặt lại mặc định sau khi xong).

## 2. Kết quả thời gian phản hồi & tỷ lệ lỗi

| Chỉ số | Ngưỡng nghiệm thu | Kết quả đo được | Đánh giá |
| --- | --- | --- | --- |
| Trang công khai (`p95`) | `≤ 2,5 giây` (PERF-01) | *(điền giá trị `public_page_duration` p95)* | *(Đạt / Chưa đạt)* |
| Thao tác nghiệp vụ (`p95`) | `≤ 3,0 giây` (PERF-02) | *(điền giá trị `business_op_duration` p95)* | *(Đạt / Chưa đạt)* |
| Tỷ lệ lỗi HTTP (`http_req_failed`) | `0%` ở 20 VUs (PERF-03) | *(điền tỷ lệ %)* | *(Đạt / Chưa đạt)* |
| Tổng số request xử lý | — | *(điền tổng `http_reqs`)* | — |

## 3. Số liệu tài nguyên máy chủ (Netdata) trong lúc chạy

*(Số liệu do `TECH_ADMIN` ghi nhận từ Netdata trên VPS staging trong 10 phút tải)*

| Tài nguyên | Mức bình thường | Mức đỉnh khi chạy 20 VUs | Ghi chú |
| --- | --- | --- | --- |
| CPU (%) | | | |
| RAM sử dụng | | | |
| Swap | | | |
| Số tiến trình (PID) | | | |
| I/O ổ đĩa | | | |
| Dung lượng lưu trữ trống | | | |

## 4. Kết luận & đề xuất ngưỡng cảnh báo (O5)

- **Kết luận nghiệm thu:** *(Ghi rõ đạt hay chưa đạt PERF-01, PERF-02, PERF-03; nếu chưa đạt ghi kèm số GitHub Issue đã mở).*
- **Đề xuất ngưỡng cảnh báo cho O5 (gửi Đặng Phúc An Khang):**
  - Cảnh báo CPU duy trì trên `...%` trong 5 phút.
  - Cảnh báo RAM vượt `...%` hoặc phát sinh sử dụng Swap.
  - Cảnh báo độ trễ phản hồi `p95` vượt `2,5s` (công khai) / `3,0s` (nghiệp vụ) hoặc tỷ lệ lỗi HTTP `> 1%`.