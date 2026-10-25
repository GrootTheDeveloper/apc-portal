# Đóng góp cho APC Portal

## Quy trình

1. Đồng bộ nhánh `main` và tạo nhánh cho một việc trong [phiếu việc](./docs/plan/README.md).
2. Cài dependency bằng `pnpm install`; không dùng thêm npm/yarn lockfile.
3. Giữ thay đổi đúng phạm vi việc đó và cập nhật tài liệu liên quan.
4. Chạy `pnpm check` trước khi push.
5. Mở pull request, mô tả hành vi thay đổi, bằng chứng kiểm tra và phần chưa kiểm tra.

## Quy ước nhánh và commit

Tên nhánh: `<mã việc>-<mô tả ngắn>`, viết thường, không dấu, ví dụ `r1-trang-tuyen`. Việc ngoài phiếu dùng `fix/...`, `docs/...`, `chore/...`.

Commit theo mẫu `<loại>(<phạm vi>): <mã việc> <mô tả>`. Loại: `feat`, `fix`, `test`, `docs`, `chore`. Phạm vi: `api`, `web`, `db`, `docs`. Ví dụ:

```text
feat(web): E1 trang danh sách sự kiện
fix(api): A1 chặn truy cập ngoài phạm vi ban
docs(plan): làm rõ phiếu tuyển thành viên
```

Các bước chi tiết (tạo nhánh, giao việc cho AI, mở PR, sửa theo review, merge) nằm trong [Bắt đầu](./docs/plan/bat-dau.md) mục 4.

## Điều bắt buộc

- Không commit secret, `.env`, dữ liệu cá nhân hoặc credential local.
- Không dùng tên/ảnh đối tác, thành viên hoặc đơn vị chưa được phép công bố.
- Thay đổi quyền hoặc dữ liệu phải có test cho trường hợp bị từ chối.
- Migration đã merge không được sửa lịch sử; tạo migration mới.
- Chỉ cài thư viện trong danh sách đã duyệt ([Kiến trúc](./docs/06-architecture.md) mục 5.1); thư viện khác phải hỏi người review.
