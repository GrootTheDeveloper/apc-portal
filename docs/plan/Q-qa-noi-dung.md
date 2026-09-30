# Kiểm thử & nội dung — Nguyễn Tiến Bảo

## Bối cảnh

Mảng này bảo đảm sản phẩm chạy đúng tài liệu nghiệp vụ trước mỗi buổi demo và trước khi lên máy chủ. Công việc gồm năm phần:

1. **Kịch bản kiểm tra thủ công** — các bước bấm trên trình duyệt kèm kết quả phải thấy, để bất kỳ ai (kể cả người không biết code) làm theo và kết luận Đạt / Không đạt.
2. **Test tự động giao diện** — dùng Playwright điều khiển trình duyệt chạy lại các kịch bản quan trọng bằng một lệnh.
3. **Báo lỗi** — ghi lỗi tìm được thành GitHub Issue, giao đúng người phụ trách.
4. **Kiểm thử tải** — đo Portal với 20 người dùng đồng thời trên staging trước khi phát hành.
5. **Nội dung thật** — gom bài viết, dự án, số liệu của CLB trước khi phát hành; Ban Chủ nhiệm nhập qua trang quản trị ngay sau khi phát hành.

Việc trong phiếu này không tạo bảng database hay API. Các file tạo ra nằm trong `docs/qa/`, `apps/web/e2e/`, `load/` và `docs/ops/load-test.md`.

## Phụ thuộc

| Cần có | Từ việc | Dùng cho |
| --- | --- | --- |
| Bộ tài khoản mẫu và dữ liệu mẫu (`db:seed`) | D1 (T5 08/10) | Mọi kịch bản; Q2, Q3 |
| Các trang công khai chạy được | C1, E1, R1, T1 (CN 11/10) | Chạy kịch bản giai đoạn 1 |
| Nộp đơn, tra cứu đơn | R3 (CN 25/10), R4 (CN 01/11) | Q2 |
| Trang quản trị bài viết, xét hồ sơ | C3 (CN 08/11), R5 (T5 12/11) | Q3 |
| Trang quản trị bài viết, dự án, thông tin APC | C3, C4 (CN 15/11), T4 (CN 08/11) | Q4 |
| Secret TOTP của tài khoản mẫu | B3 (CN 01/11) | Q3 (đăng nhập `board` trong test) |
| Staging chạy được | O4 (T5 26/11) | Q6 |
| Production đã phát hành | O7 (T4 02/12) | Q4 (nhập nội dung thật) |

Người khác cần từ mảng này: kết quả chạy kịch bản trước mỗi demo và danh sách Issue lỗi.

## Giai đoạn 1 (05/10 – 11/10)

### Q1. Kịch bản kiểm tra — hạn CN 11/10

**Mục tiêu:** có bộ kịch bản kiểm tra cho mọi chức năng giai đoạn 1 và 2, viết theo mẫu thống nhất, người không biết code cũng làm theo được.

Kịch bản viết từ phiếu việc và User Flow, **không cần chờ chức năng làm xong**. Khi chức năng merge, chạy kịch bản và ghi kết quả.

**Làm:**

1. Tạo `docs/qa/README.md` gồm:
   - Cách chuẩn bị trước khi chạy: `pnpm infra:up`, `pnpm --filter @apc/api exec prisma migrate reset` (xóa dữ liệu cũ, tạo lại bảng và dữ liệu mẫu), `pnpm dev`.
   - Bảng tài khoản mẫu (chép từ phiếu D, mục D1).
   - Cách báo lỗi (mục "Báo lỗi" bên dưới).
   - Mục lục các file kịch bản.
2. Tạo mỗi mảng một file kịch bản, đặt tên theo mảng:

   | File | Nội dung | Chức năng liên quan |
   | --- | --- | --- |
   | `docs/qa/01-cong-khai.md` | Trang chủ, Về APC, tin tức, dự án, sự kiện, tìm kiếm, `/privacy`, trang 404 | C1, C2, E1, E2, T1, T2, D3, B2 |
   | `docs/qa/02-tuyen-thanh-vien.md` | Xem đợt tuyển, nộp đơn, tra cứu, rút đơn | R1, R3, R4 |
   | `docs/qa/03-dang-ky-su-kien.md` | Đăng ký sự kiện, tra cứu, hủy | E3 |
   | `docs/qa/04-dang-nhap.md` | Đăng nhập, sai mật khẩu, khóa 15 phút, đăng xuất, chuyển về `/login`, tài khoản `pending`/`locked`/`inactive`, kích hoạt, đổi mật khẩu, xác thực 2 lớp | A2, A4, B3 |
   | `docs/qa/05-email-tep.md` | Email xác nhận trong Mailpit, email khi Mailpit tắt, upload tệp hợp lệ và bị từ chối | O1, O2, D2 |

3. Mỗi kịch bản viết theo mẫu:

   ```markdown
   ### KB-02-03. Nộp đơn trùng email trong cùng đợt

   - Chức năng: R3 · Luồng: FLOW-04 · Nghiệm thu: AC-02
   - Tài khoản: không đăng nhập
   - Chuẩn bị: đã chạy KB-02-02 (đã nộp một đơn bằng `ungvien1@example.com`)

   | # | Thao tác | Kết quả phải thấy |
   | --- | --- | --- |
   | 1 | Mở http://localhost:5173/recruitment, bấm đợt tuyển đang mở | Trang chi tiết có nút **Ứng tuyển** |
   | 2 | Bấm **Ứng tuyển**, điền email `ungvien1@example.com`, các trường khác hợp lệ, tick ô đồng ý, bấm **Nộp đơn** | Không tạo đơn mới; hiện câu chung "Không thể nộp đơn với thông tin này. Nếu đã nộp, vui lòng dùng trang tra cứu.", không nói email hay MSSV bị trùng (QĐ-1); dữ liệu đã nhập vẫn còn trên form |
   | 3 | Mở `db:studio`, bảng `membership_applications` | Vẫn chỉ có một đơn của email này |

   | Ngày chạy | Người chạy | Kết quả | Issue |
   | --- | --- | --- | --- |
   | | | | |
   ```

   Quy ước:
   - Mã kịch bản `KB-<số file>-<số thứ tự>`, không đổi sau khi đã tạo.
   - Mỗi bước chỉ một thao tác. Cột "Kết quả phải thấy" ghi điều nhìn thấy được trên màn hình (chữ, nút, trang), không ghi "chạy đúng" hay "hoạt động bình thường".
   - Dữ liệu nhập ghi cụ thể (email, MSSV), chỉ dùng dữ liệu giả `@example.com`.
   - Mỗi chức năng có ít nhất một kịch bản thành công và một kịch bản **bị chặn**: sai dữ liệu, trùng, quá hạn, không có quyền.

4. Kịch bản bắt buộc có (ngoài kịch bản thành công của từng chức năng):
   - Bài viết, sự kiện, dự án ở trạng thái Bản nháp hoặc Lưu trữ không hiện trong danh sách và mở thẳng link thì ra trang 404.
   - Đợt tuyển chưa mở hoặc đã đóng không có nút **Ứng tuyển**.
   - Nộp đơn khi chưa tick ô đồng ý: không gửi được.
   - Tra cứu đơn bằng mã sai: thông báo chung, không nói email hay mã sai.
   - Đăng ký sự kiện đã hết chỗ hoặc quá hạn: bị chặn, có thông báo lý do.
   - Chưa đăng nhập mở `/portal` hoặc `/admin`: chuyển về `/login`; đăng nhập xong quay lại đúng trang đã định vào.
   - Sai mật khẩu 5 lần liên tiếp: phải chờ 15 phút.
   - Sai tên đăng nhập và sai mật khẩu hiện **cùng một** thông báo (SEC-08).
   - Tài khoản `locked`, `inactive` không đăng nhập được; `pending` đăng nhập xong chỉ vào được trang kích hoạt (AC-03).
   - Mật khẩu mới 14 ký tự bị từ chối; 15 ký tự và 128 ký tự được chấp nhận; 129 ký tự bị từ chối (SEC-11).
   - `board.pending` (vai trò chưa thiết lập 2 lớp) không vào được trang quản trị (AC-10).
   - Tài khoản `MEMBER` mở `/admin`: không vào được.
   - Mọi trang công khai dùng được ở màn hình 360 px, không tràn ngang (UX-01).
   - Tắt Mailpit (`docker stop apc-portal-local-mailpit-1`) rồi nộp đơn: đơn vẫn lưu, màn hình vẫn hiện mã hồ sơ. Bật lại bằng `pnpm infra:up`.
   - Upload tệp `.exe` đổi đuôi thành `.png` và tệp lớn hơn 20 MB: bị từ chối.

**Xong khi:**

- [ ] Có `docs/qa/README.md` và đủ 5 file kịch bản trong bảng trên.
- [ ] Mỗi chức năng trong cột "Chức năng liên quan" có ít nhất một kịch bản thành công và một kịch bản bị chặn.
- [ ] Đủ các kịch bản bắt buộc ở bước 4.
- [ ] Một thành viên không làm code (nhờ người trong CLB) đọc và làm thử 3 kịch bản bất kỳ mà không cần hỏi thêm.
- [ ] Đã chạy các kịch bản của chức năng đã merge trước demo 11/10, ghi kết quả vào bảng dưới mỗi kịch bản.

## Giai đoạn 2 (12/10 – 01/11)

### Q2. Test tự động giao diện — hạn CN 01/11

**Mục tiêu:** một lệnh chạy lại tự động các luồng công khai quan trọng trên trình duyệt thật.

**Cần có trước:** D1, C2, R3, R4 đã merge.

**Làm:**

1. Cài Playwright cho `apps/web` (thư viện đã duyệt):

   ```powershell
   pnpm --filter @apc/web add -D @playwright/test
   pnpm --filter @apc/web exec playwright install chromium
   ```

2. Tạo `apps/web/playwright.config.ts`: thư mục test `e2e`, `baseURL` là `http://localhost:5173`, chỉ chạy Chromium, chụp ảnh màn hình khi test lỗi.
3. Thêm script `"test:e2e": "playwright test"` vào `apps/web/package.json`.
4. Loại thư mục `e2e/` khỏi Vitest của web (trong `apps/web/vite.config.ts`, mục `test.exclude`), để `pnpm check` không chạy nhầm file Playwright.
5. Viết test trong `apps/web/e2e/`, mỗi luồng một file, mỗi test ghi mã kịch bản tương ứng trong tên test (ví dụ `test('KB-02-02 nộp đơn thành công', ...)`):

   | File | Luồng |
   | --- | --- |
   | `xem-tin.spec.ts` | Mở `/news`, bấm một bài, thấy nội dung; mở slug bài nháp ra 404 |
   | `nop-don.spec.ts` | Nộp đơn hợp lệ, nhận mã hồ sơ; nộp trùng email bị chặn; chưa tick đồng ý không gửi được |
   | `tra-cuu-don.spec.ts` | Tra cứu bằng mã vừa nhận thấy trạng thái Mới; mã sai thấy thông báo chung; rút đơn |

6. Thêm vào `docs/qa/README.md` mục "Chạy test tự động": chuẩn bị (`infra:up`, `migrate reset`, `pnpm dev` ở một terminal) rồi `pnpm --filter @apc/web test:e2e` ở terminal khác.

7. Thêm job `e2e` vào `.github/workflows/ci.yml` (PRD §11 mục 3, FLOW-22 bước 1): dịch vụ PostgreSQL như job hiện có → `db:deploy` → `db:seed` → build → chạy web và API → `test:e2e`; lưu ảnh chụp lỗi làm artifact. Báo Đặng Phúc An Khang (O4) vì O4 dùng lại job này.
8. Chạy lặp nhiều lần sẽ chạm giới hạn tần suất của form công khai (SEC-05). Đề nghị người phụ trách R3, R4, E3 đọc ngưỡng giới hạn từ cấu hình để môi trường e2e đặt ngưỡng cao; production giữ ngưỡng mặc định.

`test:e2e` không nằm trong `pnpm check` (cần trình duyệt và dữ liệu mẫu) nhưng chạy trong job `e2e` của CI.

**Xong khi:**

- [ ] `pnpm --filter @apc/web test:e2e` chạy qua cả 3 file, không test nào lỗi.
- [ ] Chạy 2 lần liên tiếp (không reset database) vẫn qua: test tự tạo dữ liệu riêng (ví dụ email có số ngẫu nhiên), không phụ thuộc lần chạy trước.
- [ ] `pnpm check` vẫn xanh; job `e2e` trên CI xanh.
- [ ] Cố ý làm sai một kết quả mong đợi thì test báo đỏ và có ảnh chụp màn hình lỗi.

## Giai đoạn 3 (02/11 – 22/11)

### Q3. Kiểm tra phần quản trị — hạn T5 12/11

**Mục tiêu:** kịch bản thủ công cho toàn bộ phần quản trị và test tự động cho luồng trọng yếu, gồm cả trường hợp vượt quyền của mọi vai trò.

**Cần có trước:** A2, B3, C3 đã merge. Các chức năng chưa merge (R5 hạn 12/11; D5, O3, B5, A6, O6 hạn 22/11; A7, B6, C6 hạn 25/11): viết kịch bản trước theo phiếu, chạy và bổ sung test tự động ngay sau khi merge.

**Làm:**

1. Thêm `docs/qa/06-quan-tri.md` với các kịch bản:
   - Đăng nhập bằng `board`, soạn bài, xem trước, công bố; bài hiện ở `/news`. Gỡ bài; bài biến mất khỏi `/news`.
   - Đăng nhập bằng `manager.a`: sửa được bài của Ban A; mở link sửa bài của Ban B thì ra 404; không có nút công bố bài công khai.
   - Đăng nhập bằng `member.a`: không thấy menu Quản trị; mở thẳng `/admin/content/posts` bị chặn.
   - Đăng nhập bằng `board`, đổi trạng thái hồ sơ Mới → Đang xét → Mời phỏng vấn → Đã chấp nhận; ghi chú nội bộ không hiện khi ứng viên tra cứu.
   - `manager.a` chỉ thấy hồ sơ nộp vào Ban A; không có nút chốt Đã chấp nhận / Không chấp nhận.
   - `techadmin` không đọc được bài viết nháp, hồ sơ ứng tuyển, hồ sơ quản lý thành viên, tài liệu nội bộ qua trang quản trị hay API (AC-RBAC-04).
   - Tài liệu nội bộ: `member.b` không tải được tài liệu của Ban A kể cả khi có link; thay tệp giữ được bản cũ (AC-05).
   - Nhật ký: công bố bài, đổi trạng thái hồ sơ, khóa tài khoản đều tạo dòng nhật ký; trang nhật ký không có nút sửa, xóa (AC-06).
   - CSV: file có một dòng lỗi không nhập dòng nào; file xuất chỉ người tạo tải được (AC-08).
   - Email: `manager.a` chỉ thấy email của Ban A, không gửi lại được; `board` gửi lại được; `techadmin` chỉ xem metadata và gửi lại khi nhập mã sự cố (AC-09).
2. Viết test tự động `apps/web/e2e/quan-tri.spec.ts` cho: đăng nhập, công bố bài viết, `member.a` bị chặn ở `/admin`, xét một hồ sơ đến Đã chấp nhận.
3. Đăng nhập trong test: tạo hàm dùng chung `login(page, username)` trong `apps/web/e2e/helpers.ts`, mật khẩu đọc từ biến `SEED_PASSWORD`. Tài khoản `board`, `techadmin` cần mã 2 lớp: sinh mã từ secret TOTP cố định của dữ liệu mẫu bằng `otpauth` (thư viện đã duyệt).

**Xong khi:**

- [ ] Có `docs/qa/06-quan-tri.md` đủ các kịch bản ở bước 1, đã chạy và ghi kết quả.
- [ ] `quan-tri.spec.ts` qua, chạy lặp lại vẫn qua.
- [ ] Mỗi vai trò `MEMBER`, `DEPARTMENT_MANAGER`, `BOARD`, `TECH_ADMIN` có ít nhất một kịch bản bị chặn.
- [ ] Có kịch bản cho AC-05, AC-06, AC-08, AC-09, AC-10.

## Lên máy chủ (23/11 – 29/11)

### Q6. Kiểm thử tải — hạn CN 29/11

**Mục tiêu:** có bằng chứng Portal phục vụ tối thiểu 20 người dùng đồng thời trên staging (PERF-03, [PRD](../01-prd.md) §11 mục 15, AC-07); số liệu dùng để đặt ngưỡng cảnh báo (O5).

**Cần có trước:** O4 (staging chạy được).

**Làm:**

1. Công cụ: k6 chạy bằng Docker (`docker run --rm -i grafana/k6 run - < load/portal.js`), theo [Kiến trúc](../06-architecture.md) mục 5 dòng 14. Không cài vào `package.json`.
2. Kịch bản `load/portal.js` trong repo, mô phỏng 20 người dùng ảo trong 10 phút:
   - 14 người xem trang công khai: trang chủ, danh sách và chi tiết tin tức, sự kiện, dự án, tìm kiếm.
   - 4 người đăng nhập bằng tài khoản mẫu `member.*` của staging, mở dashboard, danh sách sự kiện, tài liệu.
   - 2 người nộp đơn tuyển và đăng ký sự kiện công khai với dữ liệu giả.
   - Nâng giới hạn tần suất của staging trong lúc chạy (biến cấu hình của Q2), đặt lại sau khi xong.
3. Trong lúc chạy, `TECH_ADMIN` ghi số liệu Netdata: CPU, RAM, swap, số PID, I/O ổ đĩa, dung lượng lưu trữ.
4. Ghi báo cáo `docs/ops/load-test.md`: ngày, tag image, kịch bản, thời gian phản hồi phân vị 95 của trang công khai và thao tác nghiệp vụ, tỷ lệ lỗi, số liệu tài nguyên, kết luận so với PERF-01 (2,5 giây), PERF-02 (3 giây), PERF-03. Báo Đặng Phúc An Khang để đặt ngưỡng cảnh báo.

**Xong khi:**

- [ ] Có `load/portal.js` chạy lại được bằng một lệnh.
- [ ] `docs/ops/load-test.md` có đủ số liệu ở bước 4; tỷ lệ lỗi 0% ở 20 người dùng đồng thời.
- [ ] Phân vị 95: trang công khai ≤ 2,5 giây, thao tác nghiệp vụ ≤ 3 giây. Không đạt thì mở Issue cho mảng liên quan và chạy lại sau khi sửa.

## Phát hành (30/11 – 06/12)

### Q4. Nội dung thật — hạn CN 06/12

**Mục tiêu:** chuẩn bị đủ nội dung thật đã được duyệt; sau khi production phát hành, nội dung được Ban Chủ nhiệm đưa lên qua trang quản trị.

**Cần có trước:** C3, C4, T4 đã merge. Nội dung thật chỉ nhập trên production sau khi phát hành (O7, T4 02/12; QĐ-9); không nhập nội dung thật trên máy local hay staging. Chuẩn bị Sheet xong trước CN 22/11.

**Làm:**

1. Tạo Google Sheet "Nội dung APC Portal" trong Google Drive của CLB (không đưa vào repo vì chứa dữ liệu thật), mỗi loại một tab:

   | Tab | Cột |
   | --- | --- |
   | Thông tin APC | Tên, sứ mệnh, mô tả ngắn, email liên hệ, fanpage, link UMTOJ, link chính thức khác |
   | Ban chuyên môn | Tên ban, mô tả, đầu mối liên hệ, thứ tự hiển thị |
   | Số liệu | 4 chỉ số ở phần đầu trang chủ (tên chỉ số, con số, nguồn) |
   | Bài viết | Tiêu đề, tóm tắt, nội dung, chuyên mục, ngày, link ảnh, người cung cấp |
   | Dự án | Tên, mô tả, công nghệ, link sản phẩm, link mã nguồn, thành viên tham gia, link ảnh |
   | Duyệt | Nội dung, người duyệt thuộc Ban Chủ nhiệm, ngày duyệt, được phép công bố (Có/Không) |

2. Nhắn đầu mối từng ban xin nội dung, hạn nộp CN 08/11.
3. Với mỗi nội dung có tên hoặc ảnh thành viên: nhắn thành viên đó tự bật đồng ý công khai tại `/portal/privacy` (B5). Người khác không bật thay được (MEM-12); trang quản trị C3, C4 tự chặn công bố khi thiếu đồng ý.
4. Logo, tên đối tác: chỉ đưa lên khi có xác nhận của Ban Chủ nhiệm trong tab Duyệt.
5. Nhập và công bố do người giữ vai trò `BOARD` thực hiện bằng tài khoản của chính họ (AC-05, RP-18); người phụ trách Q4 chuẩn bị Sheet, hướng dẫn thao tác và kiểm tra kết quả trên trang công khai.
6. Gửi Ban Chủ nhiệm xác nhận 4 chỉ số trang chủ; người phụ trách C cập nhật số trong `HeroSection.tsx` qua PR.

**Xong khi:**

- [ ] Sheet có đủ nội dung cho mọi trang công khai (trang chủ, Về APC, tin tức, dự án) trước CN 22/11.
- [ ] Đến CN 06/12, mọi trang công khai trên production có nội dung thật, không còn nội dung mẫu.
- [ ] Mọi dòng trong Sheet đã nhập có "Được phép công bố: Có" kèm người duyệt.
- [ ] Không có tên, ảnh thành viên nào thiếu đồng ý công khai.
- [ ] 4 chỉ số trang chủ đã được Ban Chủ nhiệm xác nhận.

## Liên tục (05/10 – 29/11)

### Q5. Chạy kiểm tra trước demo và cập nhật tài liệu — hạn CN 29/11

**Mục tiêu:** trước mỗi demo biết chính xác chức năng nào đạt, chức năng nào lỗi; tài liệu hướng dẫn luôn khớp với code.

**Làm:**

1. Thứ Sáu trước mỗi demo (09/10, 30/10, 20/11): pull `main`, reset database, chạy toàn bộ kịch bản của chức năng đã merge và `test:e2e`. Gửi nhóm chat bảng tóm tắt: số kịch bản Đạt / Không đạt, link Issue của từng lỗi.
2. Mỗi tuần một lần, cài lại dự án trên một thư mục trống theo [tài liệu cài đặt](../07-local-development.md). Bước nào sai hoặc thiếu (lệnh mới như `db:seed`, `test:e2e`, biến `.env` mới) thì mở PR sửa tài liệu.
3. Khi một chức năng merge, cập nhật cột Trạng thái trong [Danh mục chức năng](../05-feature-catalog.md).

**Xong khi:**

- [ ] Có 3 bảng tóm tắt kết quả trước 3 buổi demo trong nhóm chat.
- [ ] Máy đã có đủ công cụ: một người mới chạy được dự án chỉ bằng README trong tối đa 15 phút ([Bàn giao](../08-handover.md) mục 3).
- [ ] Máy trống: một người chưa từng cài dự án làm theo `docs/07-local-development.md` chạy được trang chủ trong dưới 60 phút, không cần hỏi thêm.
- [ ] Danh mục chức năng khớp với những gì đã merge.

## Báo lỗi

Mỗi lỗi tìm được là một GitHub Issue: tab **Issues** → **New issue**.

- **Tiêu đề:** `[KB-02-03] Nộp đơn trùng email vẫn tạo đơn mới`.
- **Nội dung:**

  ```markdown
  **Các bước:** (chép từ kịch bản, ghi đến bước bị lỗi)
  **Kết quả phải thấy:** ...
  **Kết quả thực tế:** ...
  **Ảnh chụp / thông báo lỗi:** (dán ảnh, dán lỗi trong terminal nếu có)
  **Commit đang chạy:** (kết quả lệnh `git log -1 --oneline`)
  ```

- **Assignees:** người phụ trách mảng theo bảng [Phân công](./README.md).
- **Labels:** `bug`. Lỗi làm hỏng luồng chính (không nộp được đơn, không đăng nhập được, lộ dữ liệu) thêm `critical` (tạo nhãn ở tab **Issues → Labels** nếu chưa có) và nhắn ngay người phụ trách.

**Lỗi bảo mật** (lộ dữ liệu cá nhân, vượt quyền, lộ mã tra cứu) **không mở Issue** vì repository công khai; nhắn riêng trưởng dự án và người phụ trách mảng, chỉ mô tả hiện tượng.

Người phụ trách sửa lỗi trong PR có dòng `Fixes #<số issue>` trong mô tả; Issue tự đóng khi PR merge. Sau đó chạy lại kịch bản và ghi kết quả.

## Lưu ý

- Chỉ kiểm thử bằng dữ liệu giả. Không nhập dữ liệu cá nhân thật vào máy local hay vào kịch bản.
- Nội dung, logo đối tác chưa được Ban Chủ nhiệm cho phép thì không đưa lên.
- Kịch bản mô tả điều người dùng thấy, không mô tả code. Khi kết quả thực tế khác tài liệu nghiệp vụ mà không rõ bên nào đúng, hỏi trưởng dự án trước khi ghi là lỗi.

## Tài liệu

- [PRD](../01-prd.md): mục 10.2 (PERF-01 đến PERF-03), 10.4 (UX-01), 11 mục 3 và 15, 12 (tiêu chí nghiệm thu AC-01 đến AC-10)
- [User flow](../03-user-flows.md): FLOW-01 đến FLOW-21, mục 14 (trạng thái lỗi dùng chung)
- [Vai trò & quyền](../02-roles-permissions.md): mục 13 (tiêu chí nghiệm thu phân quyền)
- [Sitemap](../04-sitemap.md): mục 5.2, 6.1 (danh sách trang cần kiểm tra)
