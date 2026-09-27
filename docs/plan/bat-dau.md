# Bắt đầu

Đọc hết trang này một lần. Làm theo thứ tự là đủ để tự làm việc của mình.

## 1. Cài máy (làm 1 lần, khoảng 30 phút)

Cần có: **Git**, **Node.js 22**, **Docker Desktop** (đang chạy), **VS Code** và một công cụ AI để code (Claude Code, Cursor, Copilot…).

Mở PowerShell, chạy lần lượt:

```powershell
git clone https://github.com/GrootTheDeveloper/apc-portal.git
Set-Location apc-portal
corepack enable
pnpm install
Copy-Item .env.example .env
pnpm infra:up
pnpm --filter @apc/api db:migrate
pnpm dev
```

Mở http://localhost:5173 thấy trang chủ APC là xong. Lỗi thì xem mục "Lỗi thường gặp" trong [Phát triển local](../07-local-development.md).

## 2. Tìm việc của mình

1. Mở [README kế hoạch](./README.md), tìm tên mình trong bảng Phân công, mở phiếu.
2. Làm việc **chưa làm đầu tiên** trong phiếu. Hạn ghi ngay cạnh tên việc.
3. Mở Google Sheet kế hoạch (link ghim trong nhóm chat), đổi Trạng thái việc đó thành **Đang làm**.

## 3. Làm một việc

Ví dụ việc `A1`.

**Bước 1. Lấy code mới nhất và tạo nhánh:**

```powershell
git switch main
git pull
git switch -c a1-phan-quyen
```

Tên nhánh: mã việc viết thường + vài chữ không dấu.

**Bước 2. Giao việc cho AI.** Chép nguyên câu dưới vào công cụ AI, đổi tên phiếu và mã việc:

```text
Đọc AGENTS.md và docs/plan/A-dang-nhap.md. Làm việc A1.
Trước khi code: tóm tắt việc cần làm, liệt kê file sẽ tạo/sửa, và dùng lại những gì
đã có sẵn (bảng "Có sẵn cho cả nhóm" trong docs/plan/README.md). Chờ tôi đồng ý rồi mới code.
Code xong: viết test, chạy `pnpm check` cho đến khi xanh.
```

Đọc kế hoạch AI đưa ra. Thấy lạ (sửa file của mảng khác, cài thư viện ngoài danh sách, bỏ qua test) thì bảo nó làm lại.

**Bước 3. Tự kiểm tra.** Làm đúng từng ý trong dòng **Xong khi** của phiếu, trên trình duyệt hoặc bằng test. Chưa đạt thì chưa mở PR.

**Bước 4. Lưu và đẩy lên GitHub:**

```powershell
pnpm check
git add -A
git commit -m "feat(api): phân quyền requireAuth, requireRole, requireScope"
git push -u origin a1-phan-quyen
```

`pnpm check` phải xanh. Đỏ thì dán lỗi cho AI sửa.

**Bước 5. Mở Pull Request.** Vào trang repo trên GitHub, bấm nút **Compare & pull request**. Điền theo mẫu có sẵn, dán ảnh chụp màn hình, chọn bạn cặp review ở mục **Reviewers**.

**Bước 6.** Trong Google Sheet: đổi Trạng thái thành **Review**, dán link PR. Sang việc tiếp theo trong phiếu (tạo nhánh mới từ `main` như Bước 1).

**Bước 7.** Được duyệt thì bấm **Squash and merge**, đổi Sheet thành **Xong**.

## 4. Review PR của bạn cặp

Mỗi PR cần 1 người duyệt. Bạn được nhờ review thì làm trong ngày:

1. Mở PR, xem tab **Files changed**.
2. Kiểm tra:
   - CI xanh (dấu ✓ xanh cuối trang).
   - Làm đúng dòng "Xong khi" của phiếu.
   - Có test, có ảnh nếu làm giao diện.
   - Không có `.env`, mật khẩu, dữ liệu thật.
   - Không sửa file của mảng khác mà không ghi lý do.
3. Chỗ chưa ổn: bấm vào dòng code để ghi nhận xét. Ổn: **Review changes → Approve**.

Không chắc code đúng hay sai? Nhờ AI: *"Review PR này theo AGENTS.md và phiếu docs/plan/…, chỉ ra lỗi cụ thể"*.

| Cặp review | |
| --- | --- |
| Huỳnh Hoàn Phúc ↔ Trương Phúc Minh | Đăng nhập, bảo mật |
| Nguyễn Gia Bảo ↔ Lê Đăng Nghĩa | Nội dung, sự kiện |
| Phan Anh Khương ↔ Lương Huỳnh | Tuyển thành viên, thành viên |
| Phạm Đăng Hoàng Thiên ↔ Đặng Phúc An Khang | Tệp, email, hạ tầng |
| Nguyễn Tiến Bảo | Review thêm khi ai quá tải |

## 5. Khi gặp chuyện

| Chuyện | Làm gì |
| --- | --- |
| PR báo **conflict** (xung đột) | `git switch main` → `git pull` → `git switch <nhánh của bạn>` → `git merge main`. Nhờ AI sửa các chỗ xung đột, rồi `pnpm check`, `git add -A`, `git commit`, `git push` |
| `main` có migration mới sau khi bạn đã tạo migration | Xóa thư mục migration của bạn, `git merge main`, chạy lại `pnpm --filter @apc/api db:migrate` |
| Sau khi `git pull`, code chạy lỗi lạ | Chạy lại `pnpm install` và `pnpm --filter @apc/api db:migrate` |
| Phiếu viết không rõ, hoặc 2 tài liệu nói khác nhau | Hỏi trong nhóm chat, đừng tự đoán |
| Biết sẽ trễ hạn | Đổi Sheet thành **Blocked**, nhắn nhóm lý do ngay, đừng chờ tới hạn |

**Kẹt thì theo thứ tự:** đọc kỹ thông báo lỗi → dán lỗi cho AI → hỏi bạn cặp → quá 30 phút thì hỏi trong nhóm chat, kèm ảnh chụp lỗi và lệnh đã chạy.

## 6. Lệnh hay dùng

| Muốn | Lệnh |
| --- | --- |
| Chạy web + API | `pnpm dev` |
| Bật / tắt Postgres, Mailpit, kho tệp | `pnpm infra:up` / `pnpm infra:down` |
| Kiểm tra trước khi mở PR | `pnpm check` |
| Xem dữ liệu trong database | `pnpm --filter @apc/api db:studio` |
| Tạo migration sau khi sửa `schema.prisma` | `pnpm --filter @apc/api db:migrate` rồi `pnpm --filter @apc/api db:erd` |
| Xem email đã gửi (local) | http://localhost:8025 |
| Đang ở nhánh nào, đã sửa gì | `git status` |

## 7. Luật không được phá

- Không push thẳng lên `main`.
- Không commit `.env`, mật khẩu, dữ liệu thật.
- Chỉ cài thư viện trong danh sách đã duyệt ([Kiến trúc](../06-architecture.md) mục 5.1).
- Không sửa file của mảng khác; cần thì ghi rõ trong PR và báo người đó.
