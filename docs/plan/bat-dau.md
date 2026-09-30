# Bắt đầu

Trang này dành cho thành viên mới của nhóm phát triển APC Portal. Đọc hết một lần trước buổi kickoff, sau đó làm theo đúng thứ tự từng mục.

## 1. Cài máy

Làm theo [Cài đặt và chạy trên máy cá nhân](../07-local-development.md) từ mục 1 đến mục 7. Tài liệu đó hướng dẫn cài Git, Node.js, pnpm, Docker Desktop, VS Code từ đầu, kèm lệnh kiểm tra cho từng bước và bảng xử lý lỗi.

Máy được coi là sẵn sàng khi đạt đủ 4 điều:

- [ ] http://localhost:5173 hiện trang chủ APC.
- [ ] http://localhost:3000/health trả `{"status":"ok","service":"apc-api"}`.
- [ ] `pnpm check` chạy xong, không báo lỗi.
- [ ] Đã chấp nhận lời mời cộng tác trên GitHub (mục 1.2 của tài liệu cài đặt).

Chưa đạt đủ 4 điều trước kickoff (T7 03/10): báo trong nhóm chat kèm ảnh chụp lỗi.

## 2. Khái niệm cần biết

| Thuật ngữ | Nghĩa trong dự án |
| --- | --- |
| Terminal | Cửa sổ gõ lệnh. Dự án dùng PowerShell, mở trong VS Code bằng `` Ctrl+` `` |
| Repository (repo) | Thư mục code dùng chung, lưu trên GitHub tại `GrootTheDeveloper/apc-portal` |
| `main` | Nhánh chính, luôn chạy được. Không ai đẩy code thẳng lên `main` |
| Nhánh (branch) | Bản sao riêng của code để làm một việc mà không ảnh hưởng người khác |
| Commit | Một lần lưu thay đổi vào lịch sử, kèm một dòng mô tả |
| Push | Đẩy các commit trên máy lên GitHub |
| Pull request (PR) | Yêu cầu gộp một nhánh vào `main`. Người khác xem và duyệt trước khi gộp |
| Review | Người khác đọc code trong PR, góp ý hoặc duyệt (Approve) |
| CI | Máy chủ GitHub tự chạy `pnpm check` trên mỗi PR. CI đỏ thì không gộp được |
| Merge | Gộp PR vào `main` sau khi được duyệt và CI xanh |
| Migration | File mô tả thay đổi cấu trúc database (thêm bảng, thêm cột). Tạo bằng `db:migrate` |
| Phiếu việc | File `docs/plan/<chữ cái>-<mảng>.md`, liệt kê mọi việc của một người |
| Mã việc | Mã của một việc trong phiếu, ví dụ `A1`, `R3`. Dùng trong tên nhánh, commit, PR và Google Sheet |
| Xong khi | Danh sách điều kiện của một việc. Đạt đủ mới được mở PR |

## 3. Tìm việc

1. Mở [README kế hoạch](./README.md), tìm tên trong bảng **Phân công**, mở phiếu tương ứng.
2. Đọc phần **Bối cảnh** và **Phụ thuộc** ở đầu phiếu để biết mảng này nhận gì từ người khác và phải giao gì cho người khác.
3. Chọn việc **chưa xong đầu tiên** trong phiếu. Hạn ghi cạnh tên việc.
4. Mở Google Sheet kế hoạch (link ghim trong nhóm chat), đổi trạng thái việc đó thành **Đang làm**.

Trạng thái trong Sheet: **Chưa làm** → **Đang làm** → **Review** → **Xong**. Việc bị chặn hoặc sắp trễ hạn chuyển sang **Blocked**.

## 4. Làm một việc

Ví dụ dưới đây dùng việc `A1` trong phiếu `A-dang-nhap.md`. Khi làm việc khác, thay mã việc và tên phiếu.

### Bước 1. Lấy code mới nhất và tạo nhánh

```powershell
git switch main
git pull
pnpm install
pnpm --filter @apc/api db:migrate
git switch -c a1-phan-quyen
```

Tên nhánh: mã việc viết thường, gạch nối, vài chữ không dấu. Ví dụ `r3-nop-don`, `c1-trang-tin-tuc`.

### Bước 2. Giao việc cho AI

Chép đoạn dưới vào công cụ AI, thay mã việc và tên phiếu:

```text
Đọc AGENTS.md và docs/plan/A-dang-nhap.md, làm việc A1.

Giai đoạn 1, chưa viết code: tóm tắt yêu cầu của việc; liệt kê file sẽ tạo và sửa,
endpoint API và trang web sẽ làm; nêu những gì dùng lại từ bảng "Có sẵn cho cả nhóm"
trong docs/plan/README.md. Dừng lại chờ xác nhận.

Giai đoạn 2, sau khi được xác nhận: viết code và test, chạy `pnpm check` đến khi xanh.
Cuối cùng liệt kê cách tự kiểm tra từng ý trong mục "Xong khi" của việc.
```

Đọc kế hoạch AI đưa ra trước khi xác nhận. Yêu cầu AI làm lại nếu kế hoạch có một trong các dấu hiệu sau:

- Sửa file thuộc mảng của người khác.
- Cài thư viện không có trong danh sách [Kiến trúc](../06-architecture.md) mục 5.1.
- Tự viết đoạn kiểm tra quyền thay vì dùng `requireAuth`, `requireRole`, `requireScope`.
- Tạo nhiều hơn một migration.
- Gọi `fetch` trực tiếp trong trang thay vì dùng `api(...)`.
- Lưu mật khẩu hoặc token vào `localStorage`.
- Bỏ qua test, hoặc chỉ có test trường hợp thành công.

### Bước 3. Tự kiểm tra

Làm lần lượt từng ý trong mục **Xong khi** của việc, trên trình duyệt hoặc bằng test. Ý nào chưa đạt thì dán mô tả cho AI sửa. Chưa đạt đủ thì chưa mở PR.

Việc có giao diện: chụp ảnh màn hình ở kích thước máy tính và điện thoại (trong Chrome nhấn `F12` → biểu tượng điện thoại ở góc trên trái của DevTools).

### Bước 4. Commit và push

```powershell
pnpm check
git status
git add -A
git commit -m "feat(api): A1 phân quyền requireAuth, requireRole, requireScope"
git push -u origin a1-phan-quyen
```

- `pnpm check` đỏ thì dán toàn bộ thông báo lỗi cho AI sửa, chạy lại đến khi xanh.
- `git status` liệt kê file sắp commit. Có file lạ (`.env`, file ảnh không liên quan, thư mục `dist`) thì không commit, hỏi trong nhóm.
- Dòng commit theo mẫu `<loại>(<phạm vi>): <mã việc> <mô tả>`. Loại: `feat` (tính năng), `fix` (sửa lỗi), `test`, `docs`, `chore`. Phạm vi: `api`, `web`, `db`, `docs`.
- Lần push đầu tiên, Git mở trình duyệt yêu cầu đăng nhập GitHub. Bấm **Sign in with your browser** → **Authorize**.

### Bước 5. Mở pull request

1. Sau khi push, terminal in ra đường link dạng `https://github.com/GrootTheDeveloper/apc-portal/pull/new/a1-phan-quyen`. Mở link đó (hoặc vào trang repo, bấm **Compare & pull request**).
2. Tiêu đề PR đặt giống dòng commit.
3. Điền mô tả theo mẫu có sẵn: mã việc, đã làm gì, chép từng ý **Xong khi** và đánh dấu, dán ảnh chụp màn hình.
4. Ở cột bên phải, mục **Reviewers**, chọn người review theo bảng ở mục 5.
5. Bấm **Create pull request**.
6. Trong Google Sheet: đổi trạng thái thành **Review**, dán link PR.

### Bước 6. Sửa theo góp ý

Người review để lại nhận xét trên PR. Quay lại đúng nhánh, sửa, rồi đẩy lên; PR tự cập nhật:

```powershell
git switch a1-phan-quyen
# sửa code theo góp ý
pnpm check
git add -A
git commit -m "fix(api): A1 sửa theo review"
git push
```

Trả lời từng nhận xét trên GitHub (ví dụ "Đã sửa"), rồi bấm **Re-request review**.

### Bước 7. Merge

Khi PR có **Approve** và CI xanh (dấu ✓ xanh ở cuối trang PR): bấm **Squash and merge** → **Confirm**. Trong Google Sheet đổi trạng thái thành **Xong**.

Dọn nhánh trên máy:

```powershell
git switch main
git pull
git branch -D a1-phan-quyen
```

### Bước 8. Sang việc tiếp theo

Quay lại Bước 1 với việc tiếp theo trong phiếu. Không cần chờ PR trước được merge, **trừ khi** việc tiếp theo dùng code của việc trước; trường hợp đó phiếu ghi rõ ở dòng **Cần có trước**. Trong lúc chờ, làm review cho người khác hoặc chuẩn bị giao diện với dữ liệu giả.

## 5. Review PR của người khác

Mỗi PR cần một người duyệt. Được nhờ review thì hoàn thành trong vòng 24 giờ.

1. Mở PR, xem tab **Files changed**.
2. Kiểm tra theo danh sách:
   - [ ] CI xanh.
   - [ ] Mô tả PR đã đánh dấu đủ các ý **Xong khi** của việc trong phiếu.
   - [ ] Có test cho trường hợp thành công và trường hợp bị từ chối (401/403/404).
   - [ ] Việc có giao diện: có ảnh máy tính và điện thoại; trang có đủ trạng thái đang tải, rỗng, lỗi, có dữ liệu.
   - [ ] Không có `.env`, mật khẩu, dữ liệu cá nhân thật.
   - [ ] Không sửa file của mảng khác; nếu có thì mô tả PR ghi lý do.
   - [ ] Có migration thì chỉ một, và đã cập nhật sơ đồ `apps/api/docs/erd-core-schema.md`.
   - [ ] Đạt các quy tắc chung trong [README kế hoạch](./README.md) mục 7.2 (360 px, trạng thái rỗng khi lọc, xung đột phiên bản, phạm vi 404/403…).
3. Muốn chạy thử trên máy: `git fetch`, `git switch <tên nhánh của PR>`, `pnpm install`, `pnpm --filter @apc/api db:migrate`, `pnpm dev`. Xong thì `git switch main`.
4. Chỗ chưa ổn: bấm dấu **+** cạnh dòng code để ghi nhận xét cụ thể (sai gì, nên sửa thế nào). Xong thì bấm **Review changes** → **Request changes**.
5. Mọi thứ ổn: **Review changes** → **Approve** → **Submit review**.

Chưa chắc code đúng hay sai: nhờ AI với câu lệnh *"Review PR này theo AGENTS.md và phiếu docs/plan/<tên phiếu>, việc <mã việc>. Chỉ ra lỗi cụ thể kèm dòng code."*

| Cặp review | Mảng |
| --- | --- |
| Huỳnh Hoàn Phúc ↔ Trương Phúc Minh | Đăng nhập, bảo mật |
| Nguyễn Gia Bảo ↔ Lê Đăng Nghĩa | Nội dung, sự kiện |
| Phan Anh Khương ↔ Lương Huỳnh | Tuyển thành viên, thành viên |
| Phạm Đăng Hoàng Thiên ↔ Đặng Phúc An Khang | Tệp, email, hạ tầng |
| Nguyễn Tiến Bảo | Review thay khi người trong cặp quá tải hoặc vắng |

## 6. Khi gặp sự cố

| Tình huống | Cách xử lý |
| --- | --- |
| PR báo **This branch has conflicts** | `git switch main` → `git pull` → `git switch <nhánh>` → `git merge main`. Nhờ AI sửa các đoạn có dấu `<<<<<<<`, rồi `pnpm check` → `git add -A` → `git commit` → `git push` |
| `main` có migration mới sau khi nhánh đã tạo migration | Xóa thư mục migration của nhánh trong `apps/api/src/db/migrations/`, `git merge main`, chạy lại `pnpm --filter @apc/api db:migrate` để tạo lại migration. Prisma hỏi reset database local thì gõ `y` |
| Sau `git pull`, code lỗi lạ | `pnpm install` → `pnpm --filter @apc/api db:migrate` |
| Lỗi khi cài đặt hoặc chạy dự án | Bảng lỗi trong [tài liệu cài đặt](../07-local-development.md) mục 8 |
| Phiếu không rõ, hoặc hai tài liệu nói khác nhau | Hỏi trong nhóm chat. Không tự đoán, nhất là phần liên quan đến quyền và dữ liệu cá nhân |
| Cần sửa file của mảng khác | Nhắn người phụ trách mảng đó trước; ghi lý do trong mô tả PR |
| Việc cần code của người khác mà chưa có | Làm phần không phụ thuộc trước (giao diện với dữ liệu giả, test). Đổi Sheet sang **Blocked** nếu không còn phần nào làm được |
| Biết sẽ trễ hạn | Đổi Sheet sang **Blocked** và nhắn nhóm lý do ngay, không chờ đến hạn |

Thứ tự khi bị kẹt: đọc kỹ thông báo lỗi → dán lỗi cho AI → hỏi người cùng cặp review → quá 30 phút thì hỏi trong nhóm chat, kèm ảnh chụp lỗi và lệnh đã chạy.

## 7. Luật bắt buộc

- Không push thẳng lên `main`.
- Không commit `.env`, mật khẩu, dữ liệu cá nhân thật.
- Chỉ cài thư viện trong danh sách [Kiến trúc](../06-architecture.md) mục 5.1.
- Mỗi PR tối đa một migration.
- Không sửa file của mảng khác khi chưa báo người phụ trách.
- Mọi quy ước viết code cho API và web nằm trong [AGENTS.md](../../AGENTS.md). AI đọc file này, người làm cũng cần đọc ít nhất một lần.

Danh sách lệnh thường dùng: [tài liệu cài đặt](../07-local-development.md) mục 10.3.
