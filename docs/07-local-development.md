# APC Portal - Cài đặt và chạy trên máy cá nhân

| Thuộc tính | Giá trị |
| --- | --- |
| Phiên bản | 1.2 |
| Trạng thái | Đã duyệt |
| Ngày cập nhật | 01/10/2026 |

Tài liệu này hướng dẫn cài đặt từ một máy Windows chưa có công cụ lập trình nào đến khi mở được trang chủ APC trên trình duyệt. Thời gian dự kiến: 45–60 phút, phần lớn là chờ tải. Máy macOS xem mục 9.

Làm đúng thứ tự. Mỗi bước có lệnh **kiểm tra**; chỉ sang bước sau khi lệnh kiểm tra cho kết quả đúng.

## 1. Chuẩn bị

| Yêu cầu | Chi tiết |
| --- | --- |
| Hệ điều hành | Windows 10 (22H2) hoặc Windows 11, bản Home cũng được |
| RAM | Tối thiểu 8 GB. Docker Desktop dùng khoảng 2 GB khi chạy |
| Ổ đĩa trống | Tối thiểu 15 GB |
| Mạng | Ổn định; lần đầu tải khoảng 2–3 GB |
| Quyền máy | Mở được PowerShell bằng quyền Administrator |
| Tài khoản | Một tài khoản GitHub (tạo miễn phí tại https://github.com/signup) |

### 1.1. Mở PowerShell

- **PowerShell thường:** bấm phím Windows, gõ `PowerShell`, bấm Enter.
- **PowerShell quyền Administrator:** bấm phím Windows, gõ `PowerShell`, bấm chuột phải vào kết quả → **Run as administrator** → **Yes**.

Chỉ dùng quyền Administrator ở những bước ghi rõ. Các bước còn lại dùng PowerShell thường.

Sau khi cài xong một công cụ, **đóng hết cửa sổ PowerShell và mở lại** thì lệnh mới được nhận.

### 1.2. Xin quyền vào repository

1. Gửi tên đăng nhập GitHub cho trưởng dự án trong nhóm chat.
2. Mở email từ GitHub có tiêu đề *invited you to collaborate on GrootTheDeveloper/apc-portal*, bấm **View invitation** → **Accept invitation**. Hoặc mở trực tiếp https://github.com/GrootTheDeveloper/apc-portal/invitations.

Chưa chấp nhận lời mời thì vẫn tải code được nhưng không đẩy code lên được.

## 2. Cài Git

Git lưu lịch sử thay đổi của code và đồng bộ code với GitHub.

1. Mở PowerShell thường, chạy:

   ```powershell
   winget install --id Git.Git -e --source winget
   ```

   Máy không có `winget`: tải bộ cài tại https://git-scm.com/download/win, chạy file vừa tải, bấm **Next** ở mọi bước (giữ mặc định).

2. Đóng và mở lại PowerShell.
3. Khai báo tên và email. Email phải trùng email tài khoản GitHub để commit hiện đúng người:

   ```powershell
   git config --global user.name "Nguyen Van A"
   git config --global user.email "email-dang-ky-github@example.com"
   git config --global init.defaultBranch main
   ```

**Kiểm tra:**

```powershell
git --version
git config --global user.email
```

Kết quả đúng: dòng `git version 2.x.x` và đúng email vừa khai báo.

## 3. Cài Node.js 22

Node.js chạy code JavaScript/TypeScript của cả web lẫn API. Dự án dùng Node.js **22**, giống môi trường CI.

1. Mở https://nodejs.org/en/download.
2. Chọn phiên bản **v22.x (LTS)**, hệ điều hành **Windows**, tải bộ cài **Windows Installer (.msi)**.
3. Chạy file `.msi`, bấm **Next** ở mọi bước. Ở màn hình *Tools for Native Modules*, **không** tick ô cài thêm công cụ.
4. Đóng và mở lại PowerShell.

**Kiểm tra:**

```powershell
node -v
```

Kết quả đúng: `v22.` ở đầu, ví dụ `v22.20.0`.

## 4. Bật pnpm

pnpm là công cụ cài thư viện cho dự án. Dự án khóa phiên bản pnpm 10.22.0; Corepack (có sẵn trong Node.js) tự tải đúng phiên bản.

1. Mở PowerShell **quyền Administrator**, chạy:

   ```powershell
   corepack enable
   ```

2. Đóng cửa sổ Administrator. Mở PowerShell thường, cho phép chạy script của pnpm (chỉ áp dụng cho tài khoản Windows hiện tại):

   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   ```

   Khi được hỏi, gõ `Y` rồi Enter.

**Kiểm tra** (PowerShell thường):

```powershell
pnpm -v
```

Lần đầu có thể hỏi *Corepack is about to download ... Do you want to continue?* — gõ `Y` rồi Enter. Kết quả đúng: một số phiên bản `10.x.x`.

`corepack enable` báo lỗi `EPERM` nghĩa là cửa sổ đang dùng không có quyền Administrator. Cách thay thế nếu vẫn lỗi: `npm install -g pnpm@10.22.0`.

## 5. Cài Docker Desktop

Docker chạy sẵn database PostgreSQL, hộp thư thử Mailpit và kho tệp SeaweedFS trên máy, không cần cài riêng từng thứ.

### 5.1. Bật WSL 2

Docker Desktop trên Windows chạy trên WSL 2 (Linux tích hợp trong Windows).

1. Mở PowerShell **quyền Administrator**, chạy:

   ```powershell
   wsl --install --no-distribution
   ```

2. **Khởi động lại máy.**
3. Mở PowerShell thường, chạy `wsl --status`. Kết quả có dòng `Default Version: 2` là đúng.

Lệnh báo WSL đã có sẵn: chạy `wsl --update`, rồi sang bước 5.2.

### 5.2. Cài và mở Docker Desktop

1. Mở https://www.docker.com/products/docker-desktop/, bấm **Download for Windows – AMD64**. Máy dùng chip Snapdragon/ARM chọn bản **ARM64**.
2. Chạy bộ cài. Ở màn hình *Configuration*, giữ tick **Use WSL 2 instead of Hyper-V**. Bấm **OK**, chờ cài xong, bấm **Close and restart** nếu được yêu cầu.
3. Mở **Docker Desktop** từ menu Start. Bấm **Accept** điều khoản. Màn hình đăng nhập có thể bấm **Skip** (không bắt buộc tài khoản Docker).
4. Chờ đến khi góc dưới bên trái hiện **Engine running** (biểu tượng màu xanh).

Docker Desktop phải **đang chạy** mỗi khi làm việc với dự án. Có thể bật *Settings → General → Start Docker Desktop when you sign in to your computer* để tự mở khi bật máy.

**Kiểm tra** (PowerShell thường):

```powershell
docker version
docker compose version
docker run --rm hello-world
```

Kết quả đúng: hai lệnh đầu in ra phiên bản, không có dòng `error`; lệnh cuối in ra `Hello from Docker!`.

Lỗi *Virtualization support not detected* hoặc *WSL 2 is not installed*: xem mục 8.

## 6. Cài VS Code và công cụ AI

1. Cài VS Code:

   ```powershell
   winget install --id Microsoft.VisualStudioCode -e --source winget
   ```

   Hoặc tải tại https://code.visualstudio.com.

2. Trong VS Code, mở tab **Extensions** (`Ctrl+Shift+X`), cài:
   - **Prisma** — tô màu và gợi ý cho file `schema.prisma`.
   - **Tailwind CSS IntelliSense** — gợi ý class Tailwind.
3. Cài một công cụ AI để code: Claude Code, Cursor hoặc GitHub Copilot. Cách giao việc cho AI nằm trong [Bắt đầu](./plan/bat-dau.md) mục 4.

Terminal trong VS Code: menu **Terminal → New Terminal** (`` Ctrl+` ``). Terminal này là PowerShell, dùng được cho mọi lệnh trong tài liệu.

## 7. Tải code và chạy lần đầu

### 7.1. Chọn thư mục đặt code

Đặt code trong một thư mục **không có dấu tiếng Việt, không có khoảng trắng và không nằm trong OneDrive**, ví dụ `C:\code`. Thư mục OneDrive đồng bộ liên tục làm `pnpm install` lỗi hoặc rất chậm.

```powershell
New-Item -ItemType Directory -Force C:\code
Set-Location C:\code
```

### 7.2. Chạy các lệnh cài đặt

Docker Desktop phải đang chạy. Chạy lần lượt từng lệnh, chờ lệnh trước xong mới chạy lệnh sau:

| # | Lệnh | Tác dụng | Kết quả đúng |
| --- | --- | --- | --- |
| 1 | `git clone https://github.com/GrootTheDeveloper/apc-portal.git` | Tải code về thư mục `apc-portal` | Dòng cuối có `done` |
| 2 | `Set-Location apc-portal` | Vào thư mục dự án. Mọi lệnh sau đều chạy ở đây | Dấu nhắc kết thúc bằng `apc-portal>` |
| 3 | `Copy-Item .env.example .env` | Tạo file cấu hình `.env` cho máy local | Không in gì |
| 4 | `pnpm install` | Cài thư viện (2–5 phút) | Dòng cuối có `Done in ...` |
| 5 | `pnpm infra:up` | Bật PostgreSQL, Mailpit, SeaweedFS trong Docker. Lần đầu tải image (vài phút) | Các dòng `Container apc-portal-local-... Started` |
| 6 | `pnpm --filter @apc/api db:migrate` | Tạo bảng trong database | `Your database is now in sync with your schema.` hoặc `Already in sync` |
| 7 | `pnpm dev` | Chạy web và API. Lệnh này chạy liên tục, không tự kết thúc | Có dòng `Local: http://localhost:5173/` |

Để `pnpm dev` chạy trong cửa sổ đó. Cần gõ lệnh khác thì mở thêm một terminal (trong VS Code: nút **+** ở khung Terminal).

### 7.3. Kiểm tra kết quả

| Mở trên trình duyệt | Kết quả đúng |
| --- | --- |
| http://localhost:5173 | Trang chủ APC |
| http://localhost:3000/health | `{"status":"ok","service":"apc-api"}` |
| http://localhost:8025 | Giao diện hộp thư Mailpit (đang trống) |

Cuối cùng, chạy bộ kiểm tra đầy đủ trong một terminal mới:

```powershell
pnpm check
```

Kết quả đúng: không có dòng `ERR_PNPM` hoặc `failed`, lệnh kết thúc sau phần `build`. Đến đây máy đã sẵn sàng.

### 7.4. Mở dự án trong VS Code

```powershell
code C:\code\apc-portal
```

## 8. Xử lý lỗi thường gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
| --- | --- | --- |
| `git`, `node`, `pnpm` hoặc `docker` *is not recognized* | Terminal mở trước khi cài | Đóng mọi cửa sổ PowerShell và VS Code, mở lại |
| `corepack enable` báo `EPERM: operation not permitted` | Thiếu quyền Administrator | Chạy lại trong PowerShell quyền Administrator (mục 1.1) |
| `pnpm.ps1 cannot be loaded because running scripts is disabled` | Windows chặn script | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`, gõ `Y` |
| `Virtualization support not detected` khi mở Docker | Ảo hóa CPU đang tắt trong BIOS | Mở Task Manager → Performance → CPU, xem dòng *Virtualization*. Nếu *Disabled*: khởi động lại, vào BIOS (thường nhấn F2, F10 hoặc Del khi vừa bật máy), bật **Intel Virtualization Technology (VT-x)** hoặc **SVM Mode** (AMD), lưu và thoát |
| Docker báo `WSL 2 is not installed` hoặc `WSL update failed` | WSL chưa cài hoặc đã cũ | PowerShell Administrator: `wsl --update`, khởi động lại máy |
| `error during connect` hoặc `dockerDesktopLinuxEngine: The system cannot find the file specified` | Docker Desktop chưa chạy | Mở Docker Desktop, chờ **Engine running**, chạy lại lệnh |
| `pnpm infra:up` báo `Docker Compose was not found` | Docker chưa cài hoặc chưa chạy | Như dòng trên; kiểm tra `docker compose version` |
| `pnpm infra:up` báo `port is already allocated` với `5432` | Máy đã có PostgreSQL khác | Trong `.env` đặt `POSTGRES_PORT=5433` và sửa `DATABASE_URL` thành `postgresql://apc:apc_local_only@localhost:5433/apc_portal`, chạy lại `pnpm infra:up` |
| `port is already allocated` với `9000`, `9001`, `1025` hoặc `8025` | Phần mềm khác đang dùng cổng | Tìm chương trình: `Get-NetTCPConnection -LocalPort 9000 \| Select-Object OwningProcess`, rồi `Get-Process -Id <số vừa in>`. Tắt chương trình đó |
| `pnpm dev` báo `EADDRINUSE` cổng `3000` hoặc `5173` | Còn một `pnpm dev` khác đang chạy | Đóng terminal cũ, hoặc nhấn `Ctrl+C` trong terminal đó |
| `Environment variable not found: DATABASE_URL` hoặc cảnh báo *Chưa có file .env* | Chưa tạo `.env` | Ở thư mục gốc repo: `Copy-Item .env.example .env` |
| `P1001: Can't reach database server` | PostgreSQL chưa bật hoặc sai cổng | `pnpm infra:up`; kiểm tra cổng trong `DATABASE_URL` khớp `POSTGRES_PORT` |
| `P1000: Authentication failed` | Database được tạo từ mật khẩu khác trong `.env` cũ | Xóa dữ liệu local theo mục 10.3 rồi làm lại bước 5–6 ở mục 7.2 |
| `pnpm install` báo `EPERM`, `EBUSY` | Thư mục bị khóa bởi OneDrive, antivirus hoặc VS Code | Chuyển repo ra `C:\code`, đóng VS Code, chạy lại |
| Trang web hiện *Không kết nối được máy chủ* | API không chạy hoặc bị lỗi | Xem terminal đang chạy `pnpm dev`, tìm dòng lỗi màu đỏ của `@apc/api` |
| Sau khi `git pull`, code lỗi lạ | Có thư viện hoặc migration mới | `pnpm install` rồi `pnpm --filter @apc/api db:migrate` |
| Icon trang chủ không hiện khi mất mạng | Material Symbols tải từ Google Fonts | Bình thường; có mạng lại sẽ hiện |

Lỗi không có trong bảng: chụp màn hình toàn bộ terminal (gồm lệnh đã gõ và thông báo lỗi), gửi vào nhóm chat.

## 9. Máy macOS

Thay mục 2–5 bằng các bước sau, các mục còn lại giữ nguyên.

1. Cài Homebrew theo hướng dẫn tại https://brew.sh.
2. Cài Git và Node.js 22:

   ```bash
   brew install git node@22
   brew link --overwrite node@22
   corepack enable
   ```

3. Cài Docker Desktop cho Mac (chọn **Apple Silicon** hoặc **Intel** đúng loại chip) tại https://www.docker.com/products/docker-desktop/, mở ứng dụng và chờ **Engine running**.
4. Ở mục 7.2, dùng `cp .env.example .env` thay cho `Copy-Item`, và `cd apc-portal` thay cho `Set-Location`.

## 10. Làm việc hằng ngày

### 10.1. Bắt đầu và kết thúc buổi làm

| Khi | Lệnh |
| --- | --- |
| Bắt đầu | Mở Docker Desktop → `pnpm infra:up` → `pnpm dev` |
| Kết thúc | `Ctrl+C` trong terminal chạy `pnpm dev` → `pnpm infra:down` |
| Sau mỗi lần `git pull` | `pnpm install` → `pnpm --filter @apc/api db:migrate` |
| Trước khi mở pull request | `pnpm check` |

`pnpm infra:down` chỉ tắt dịch vụ, **không xóa** dữ liệu.

### 10.2. Địa chỉ local

| Dịch vụ | Địa chỉ |
| --- | --- |
| Web | http://localhost:5173 |
| API | http://localhost:3000 (web gọi qua `/api`, không gọi thẳng cổng này) |
| API health | http://localhost:3000/health |
| PostgreSQL | `localhost:5432` (hoặc `POSTGRES_PORT` trong `.env`) |
| Mailpit – hộp thư thử | http://localhost:8025 |
| Mailpit – SMTP | `localhost:1025` |
| Kho tệp S3 (SeaweedFS) | http://localhost:9000 |
| Kho tệp – giao diện quản trị | http://localhost:9001 |

### 10.3. Lệnh thường dùng

| Mục đích | Lệnh |
| --- | --- |
| Chạy web và API | `pnpm dev` |
| Lint, kiểm tra kiểu, test, build | `pnpm check` |
| Chỉ chạy test API | `pnpm --filter @apc/api test` |
| Bật / tắt / xem log dịch vụ Docker | `pnpm infra:up` / `pnpm infra:down` / `pnpm infra:logs` |
| Tạo bảng theo migration mới nhất | `pnpm --filter @apc/api db:migrate` |
| Xem và sửa dữ liệu dạng bảng | `pnpm --filter @apc/api db:studio` |
| Cập nhật sơ đồ database sau khi sửa schema | `pnpm --filter @apc/api db:erd` |
| Xóa sạch database local và tạo lại bảng | `pnpm --filter @apc/api exec prisma migrate reset` (gõ `y` để xác nhận) |

Lệnh `migrate reset` xóa toàn bộ dữ liệu trong database local. Không dùng `docker compose down -v` trừ khi chủ động muốn xóa cả database lẫn kho tệp local.

### 10.4. Sửa trang chủ

Trang chủ là các component React trong `apps/web/src/pages/home/sections/`; Navbar và Footer nằm ở `apps/web/src/layouts/`. Sửa trực tiếp các file này, rồi chạy `pnpm check` và mở trang `/` để kiểm tra.

Lệnh `pnpm homepage:import` chỉ làm mới ảnh tham chiếu từ `design-reference/homepage`, không thay đổi giao diện đang chạy.
