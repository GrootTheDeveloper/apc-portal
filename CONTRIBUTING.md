# Đóng góp cho APC Web Portal

## Quy trình

1. Đồng bộ nhánh `main` và tạo nhánh ngắn theo một issue.
2. Cài dependency bằng `pnpm install`; không dùng thêm npm/yarn lockfile.
3. Giữ thay đổi đúng phạm vi issue và cập nhật tài liệu liên quan.
4. Chạy `pnpm check` trước khi push.
5. Mở pull request, mô tả hành vi thay đổi, bằng chứng kiểm tra và phần chưa kiểm tra.

## Quy ước nhánh và commit

Tên nhánh gợi ý: `feat/...`, `fix/...`, `docs/...`, `chore/...`.

Commit nên nhỏ, có mục đích rõ ràng, ví dụ:

```text
feat(web): add public event listing
fix(api): enforce department scope
docs: clarify recruitment flow
```

## Điều bắt buộc

- Không commit secret, `.env`, dữ liệu cá nhân hoặc credential local.
- Không dùng tên/ảnh đối tác, thành viên hoặc đơn vị chưa được phép công bố.
- Thay đổi quyền hoặc dữ liệu phải có test cho trường hợp bị từ chối.
- Migration đã merge không được sửa lịch sử; tạo migration mới.
- Không thêm dependency, service hoặc abstraction nếu chưa có nhu cầu cụ thể.
