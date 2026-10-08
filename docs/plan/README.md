# Kế hoạch APC Portal

Thành viên mới đọc [Bắt đầu](./bat-dau.md) trước: cài máy, khái niệm cơ bản, cách giao việc cho AI, mở PR, review, xử lý sự cố.

## 1. Phân công

Mỗi người phụ trách trọn một mảng: bảng database, API và trang web của mảng đó.

| Người | Mảng | Phiếu | Review cùng |
| --- | --- | --- | --- |
| Huỳnh Hoàn Phúc | Đăng nhập & phân quyền | [A-dang-nhap.md](./A-dang-nhap.md) | Trương Phúc Minh |
| Trương Phúc Minh | Bảo mật & nhật ký | [B-bao-mat.md](./B-bao-mat.md) | Huỳnh Hoàn Phúc |
| Nguyễn Gia Bảo | Tin tức & Dự án | [C-noi-dung.md](./C-noi-dung.md) | Lê Đăng Nghĩa |
| Lê Đăng Nghĩa | Sự kiện | [E-su-kien.md](./E-su-kien.md) | Nguyễn Gia Bảo |
| Phan Anh Khương | Tuyển thành viên | [R-tuyen-thanh-vien.md](./R-tuyen-thanh-vien.md) | Lương Huỳnh |
| Lương Huỳnh | Thành viên & Về APC | [T-thanh-vien.md](./T-thanh-vien.md) | Phan Anh Khương |
| Phạm Đăng Hoàng Thiên | Dữ liệu mẫu, tệp, tài liệu, tìm kiếm, nhập CSV | [D-tep-tai-lieu.md](./D-tep-tai-lieu.md) | Đặng Phúc An Khang |
| Đặng Phúc An Khang | Email & máy chủ | [O-email-ha-tang.md](./O-email-ha-tang.md) | Phạm Đăng Hoàng Thiên |
| Nguyễn Tiến Bảo | Kiểm thử & nội dung | [Q-qa-noi-dung.md](./Q-qa-noi-dung.md) | Review thay khi cần |

## 2. Lịch

| Mốc | Thời gian | Kết quả cần có |
| --- | --- | --- |
| Kickoff | T7 03/10 | Mọi máy chạy được dự án; mỗi người đã đọc phiếu được giao |
| Giai đoạn 1 | 05/10 – 11/10 | Hàm dùng chung (phân quyền, nhật ký, đồng ý dữ liệu, email, upload), đăng nhập, dữ liệu mẫu. Các trang công khai dựng với dữ liệu giả |
| Giai đoạn 2 | 12/10 – 01/11 | Website công khai dùng dữ liệu thật: tin tức, dự án, sự kiện, Về APC, tuyển thành viên, nộp đơn, đăng ký sự kiện, tìm kiếm |
| Giai đoạn 3 | 02/11 – 22/11 | Portal thành viên và trang quản trị |
| Lên máy chủ | 23/11 – 29/11 | Staging, hạ tầng production, sao lưu, diễn tập khôi phục, kiểm thử tải, bootstrap; đủ bằng chứng release gate |
| Phát hành | 30/11 – 06/12 | T2 30/11 soát release gate; T4 02/12 phát hành production; Ban Chủ nhiệm nhập nội dung thật đến CN 06/12 |
| Sau phát hành | 07/12/2026 – 28/02/2027 | Các hạng mục dời phạm vi ở [PRD](../01-prd.md) §13.1 |

Demo vào Chủ nhật cuối mỗi giai đoạn: **11/10, 01/11, 22/11**. Mỗi người trình bày các việc đã merge trong giai đoạn, chạy trực tiếp trên máy.

Hạn từng việc ghi trong phiếu. Trạng thái từng việc theo dõi trong **Google Sheet kế hoạch** (link ghim trong nhóm chat).

## 3. Cách đọc một phiếu

Mỗi phiếu có cùng cấu trúc:

| Phần | Nội dung |
| --- | --- |
| Bối cảnh | Mảng này làm gì, ai dùng |
| Phụ thuộc | Mảng này cần gì từ người khác, và người khác đang chờ gì từ mảng này |
| Các việc | Chia theo giai đoạn. Mỗi việc là **một nhánh và một PR** |
| Lưu ý | Quy tắc nghiệp vụ và bảo mật áp dụng cho mọi việc trong phiếu |
| Tài liệu | Mục cần đọc trong PRD, User Flow, Sitemap |

Mỗi việc gồm:

- **Mục tiêu** — kết quả người dùng thấy được.
- **Cần có trước** — việc của người khác phải merge trước. Không ghi nghĩa là bắt đầu được ngay.
- **Làm** — database, API, trang web cần tạo. Đường dẫn API là gợi ý theo quy ước trong [AGENTS.md](../../AGENTS.md); được đổi tên nếu có lý do, ghi trong PR.
- **Xong khi** — điều kiện nghiệm thu. PR chỉ được mở khi đạt đủ.

## 4. Phụ thuộc giữa các mảng

Các việc dưới đây tạo ra thứ người khác dùng. Người phụ trách, khi merge xong, **nhắn cả nhóm cách dùng** (tên hàm, ví dụ gọi, file nằm ở đâu).

| Việc | Tạo ra | Hạn | Được dùng bởi |
| --- | --- | --- | --- |
| A1 | `requireAuth`, `requireRole`, `requireScope` | T5 08/10 | Mọi API `/portal/*`, `/admin/*` |
| B1 | `audit(...)`, kể cả định danh dịch vụ `audit({ service }, ...)` | T5 08/10 | A1 (log từ chối), A5–A7, B3–B7, C3, C4, D2, D4–D6, E4, E6, O1, O3, O6, R2, R4–R6, T4, T5 |
| D1 | Dữ liệu mẫu `db:seed` và bộ tài khoản mẫu | T5 08/10 | Mọi người khi chạy thử; Q1–Q3 |
| A2 | Đăng nhập, `/auth/me`, chặn trang khi chưa đăng nhập | CN 11/10 | Mọi trang `/portal`, `/admin` |
| B2 | `recordConsent(...)`, `hasActiveConsent(...)`, trang `/privacy` | CN 11/10 | R3, E3, B5, C3, C4 |
| D2 | Upload tệp qua S3 | CN 11/10 | C3, C4 (ảnh bài, ảnh dự án), E4 (ảnh bìa), T3 (ảnh đại diện), D4 |
| O1 | `enqueueEmail(...)`, `startJob(...)` cho tác vụ định kỳ | CN 11/10 | R3–R5, E3–E5, O2, O6 (email); B7, D2, D6, E2, R2, O6 (tác vụ định kỳ) |
| T2 | Cột `SiteSetting.termEndsAt` | T5 22/10 | A6, A7 |
| E2 | Bảng `EventRegistration` | T5 22/10 | E3, E5, E6, T3 (lịch sử hoạt động) |
| A3 | Khung trang và menu `/portal`, `/admin` | T5 22/10 | Mọi trang `/portal/*`, `/admin/*` |
| D6 | File xuất bảo vệ `createExport(...)` | CN 08/11 | R5, E6, D5, B5 |
| A5 | `createAccount(...)`, `deactivateAccount(...)`, trang `/admin/accounts` | T5 12/11 | R6, T5, A7, B6, O6 |
| T5 | Trang `/admin/members` | CN 15/11 | D5 (nút Xuất CSV), B5 (yêu cầu chỉnh sửa) |
| A6 | Gán vai trò, trang `/admin/access-control` | CN 22/11 | B6, A7 |
| C6 | Trang bảo trì, `sitemap.xml`, `robots.txt`, `x-request-id` | T4 25/11 | O4 (Nginx) |
| O4 | Staging | T5 26/11 | Q6 |
| O7 | Production đã phát hành | T4 02/12 | Q4 |

Việc cần một thứ chưa merge: dựng trước phần không phụ thuộc (giao diện với dữ liệu giả, test gán sẵn `request.user` giả), nối vào sau khi phần kia merge.

## 5. Có sẵn cho cả nhóm

Dùng lại, không viết bản khác.

| Cần | Dùng |
| --- | --- |
| Nút, nhãn tiêu đề | `Button`, `Eyebrow` trong `apps/web/src/components/` |
| Gọi API từ web | `api(...)` trong `apps/web/src/lib/api.ts`; lỗi là `ApiError` có `status`, `code`, `message`, `issues` |
| Tải dữ liệu cho trang kèm 4 trạng thái | `useApi(...)` trong `apps/web/src/hooks/useApi.ts` và `<AsyncState>` trong `apps/web/src/components/AsyncState.tsx` |
| Hiện ngày giờ theo giờ Việt Nam | `formatDate`, `formatDateTime` trong `apps/web/src/lib/format.ts` |
| Mẫu card tin tức, sự kiện, dự án | `NewsSection`, `EventsSection`, `ProjectsSection` trong `apps/web/src/pages/home/sections/`. Người dùng lại đầu tiên chuyển card sang `apps/web/src/components/` |
| Đọc, ghi database | `db` trong `apps/api/src/db/client.ts` |
| Trả lỗi 401, 403, 404, 409, 429 | `throw unauthenticated()`, `forbidden()`, `notFound()`, `conflict()`, `rateLimited()` trong `apps/api/src/lib/errors.ts` |
| Chặn quyền ở API | `requireAuth`, `requireRole(...)`, `requireScope(...)`, `currentUser(request)`, `departmentScope(user)` (lọc danh sách theo ban) trong `apps/api/src/modules/auth/rbac.ts`; ví dụ ở đầu file |
| Người đang đăng nhập ở web | `useAuth()` trong `apps/web/src/hooks/useAuth.ts`; chặn route bằng `<RequireAuth roles={...}>` trong `apps/web/src/components/RequireAuth.tsx` |
| Băm và kiểm tra mật khẩu | `hashPassword`, `verifyPassword` trong `apps/api/src/lib/password.ts` |
| Phân trang danh sách | `pageQuery`, `pageArgs`, `toPage` trong `apps/api/src/lib/pagination.ts` |
| Mã tra cứu ngẫu nhiên, slug | `publicCode()`, `slugify()` trong `apps/api/src/lib/ids.ts` |
| Xem dữ liệu dạng bảng | `pnpm --filter @apc/api db:studio` |
| Sơ đồ database | [apps/api/docs/erd-core-schema.md](../../apps/api/docs/erd-core-schema.md). Sửa schema xong chạy `pnpm --filter @apc/api db:erd` |
| Danh sách thư viện được cài | [Kiến trúc](../06-architecture.md) mục 5.1 |

## 6. Hiện trạng repository

| Phần | Trạng thái |
| --- | --- |
| Trang chủ `/` | Hoàn chỉnh giao diện, dùng nội dung mẫu |
| Router và layout công khai | Có Navbar, Footer; các route `/about`, `/news`, `/events`, `/projects`, `/recruitment`, `/recruitment/application-lookup`, `/events/registration-lookup`, `/privacy`, `/login`, `/admin` đang là trang tạm (`Placeholder`) |
| API | Có `/health`, bộ xử lý lỗi chung, cấu hình đọc từ `.env` |
| Database | Có bảng `users`, `user_roles`, `sessions`, `departments`, `posts`, `events`, `projects`, `recruitment_rounds`, `membership_applications` |
| CI | Chạy `pnpm check` trên mỗi PR; nhánh `main` được bảo vệ, cần 1 Approve |

## 7. Luật chung

### 7.1. Làm việc

- Màu, chữ, khoảng cách theo [DESIGN.md](../../DESIGN.md); dùng component có sẵn ở mục 5 trước khi tạo mới.
- Không commit mật khẩu, file `.env` hay dữ liệu thật.
- Không push thẳng lên `main`.
- Mỗi PR tối đa một migration. `main` có migration mới hơn: xóa migration của nhánh, merge `main`, chạy lại `db:migrate`.
- Tài liệu không rõ hoặc mâu thuẫn: hỏi trưởng dự án, không tự chọn. Các điểm đã chốt nằm ở mục 8.

### 7.2. Áp dụng cho mọi phiếu

Các quy tắc dưới đây lấy từ tài liệu đặc tả và áp dụng cho mọi việc có phần tương ứng; phiếu không nhắc lại. Dòng **Xong khi** của mỗi việc ngầm bao gồm các quy tắc này.

| Phần | Quy tắc | Nguồn |
| --- | --- | --- |
| Giao diện | Dùng được đầy đủ từ màn hình rộng **360 px** trở lên, không tràn ngang | PRD UX-01 |
| Trang danh sách | Phân trang; từ khóa, bộ lọc, sắp xếp, trang lưu trên URL; từ chi tiết quay về giữ nguyên bộ lọc | Sitemap §15.1, §15.3 |
| Trang danh sách | Phân biệt **chưa có dữ liệu** với **không có kết quả theo bộ lọc**; trường hợp sau có nút Xóa bộ lọc | Sitemap STATE-11, FLOW-02 |
| Trang tổng hợp | Một khối dữ liệu lỗi không làm hỏng các khối khác; khối lỗi có nút Thử lại | Sitemap STATE-12 |
| Chi tiết công khai | Breadcrumb `Trang chủ > Nhóm > Tiêu đề`; không chứa email, MSSV, mã hồ sơ/đăng ký | Sitemap §15.2 |
| Trang công khai | Có title, description, canonical, Open Graph. Tìm kiếm: `noindex, follow`. Form, tra cứu, đăng nhập, portal, admin, preview: `noindex, nofollow` | PRD SEO-01, Sitemap §16 |
| Link ngoài | Đánh dấu là link ngoài, mở tab mới với `rel="noopener noreferrer"`. URL do người dùng nhập chỉ nhận `http`/`https` | FLOW-01, FLOW-18, FLOW-24 |
| Form quản trị | Gửi kèm `updatedAt` đã đọc; server thấy khác thì trả 409, giao diện hiện dữ liệu mới và nút Tải lại, không ghi đè | Sitemap STATE-09, ERR-409 |
| Form, editor | Cảnh báo khi rời trang còn thay đổi chưa lưu | Sitemap STATE-08 |
| Hành động nhạy cảm | Khóa, hủy, lưu trữ, chốt, gửi lại, đóng sớm: hộp xác nhận nêu đối tượng, ảnh hưởng, lý do | Sitemap STATE-07 |
| Lỗi 422 | Đánh dấu đúng trường, giữ nguyên dữ liệu đã nhập | ERR-422 |
| Phạm vi | Lọc phạm vi ngay trong truy vấn. Ngoài phạm vi (không được biết bản ghi tồn tại): 404. Biết bản ghi nhưng thiếu quyền hành động: 403 | Vai trò & quyền §12 |
| Mã tra cứu | Mã hồ sơ, mã đăng ký, email không đặt trên URL, không ghi vào log hay audit | OPS-11, SEC-09 |
| File xuất | File chứa dữ liệu cá nhân tạo bằng `createExport(...)` (D6): chỉ người được chỉ định tải (mặc định là người tạo; yêu cầu xuất dữ liệu cá nhân thì là người yêu cầu) trong 24 giờ, tác vụ nền tự xóa sau đó. Ô CSV bắt đầu bằng `=`, `+`, `-`, `@`, tab, CR thêm dấu `'` phía trước | RP-17, STATE-06, FLOW-25 |
| Ban lưu trữ | Ban `ARCHIVED` không nhận thành viên, sự kiện, tài liệu mới | ORG-06 |
| Trạng thái | Chuyển trạng thái đúng sơ đồ PRD mục 9.2; bước sai trả 409 | BR-16 |
| Quyền `INCIDENT` | Chỉ dùng khi có sự cố đã ghi trong sổ sự cố (O5): request kèm mã sự cố dạng `INC-YYYYMMDD-NN` và lý do; thiếu hoặc sai dạng thì 422. Mỗi lần dùng ghi `audit(...)` loại `SECURITY` với `incidentId` (B1). Sổ sự cố nằm ngoài hệ thống nên API chỉ kiểm tra dạng mã | Vai trò & quyền §7, §8.5–8.7 |
| Tác vụ định kỳ | Dùng `startJob(...)` (O1), không tự viết `setInterval`; ghi nhật ký bằng `audit({ service: '<tên>' }, ...)` | Vai trò & quyền §12 mục 9 |
| Email tới thành viên | Gửi tới `User.email` (email tài khoản), không gửi tới `contactEmail` | QĐ-8 |

## 8. Quyết định đã chốt (01/10/2026)

Các điểm tài liệu đặc tả mâu thuẫn hoặc chưa quy định, trưởng dự án đã chốt. Charter, PRD, Vai trò & quyền, User Flow, Sitemap bản 1.4, Danh mục chức năng và Kiến trúc bản 1.3 đã sửa theo các quyết định này; phiếu ghi mã QĐ ở chỗ áp dụng.

| Mã | Vấn đề | Quyết định | Lý do | Áp dụng |
| --- | --- | --- | --- | --- |
| QĐ-1 | Nộp đơn / đăng ký sự kiện **trùng**: FLOW-04, FLOW-14 hướng dẫn tra cứu hoặc hiện bản ghi; SEC-05, SEC-08 cấm làm lộ bản ghi | Trả 409 với **một câu chung** cho mọi trường hợp trùng, kèm hướng dẫn dùng trang tra cứu; không nêu trường nào trùng, không trả dữ liệu của bản ghi đã có. Thành viên đã đăng nhập vẫn thấy đăng ký của chính mình | Bảo mật ưu tiên hơn tiện lợi; người nộp thật đã có mã trong email xác nhận | R3, E3; PRD SEC-05; FLOW-04, FLOW-14 |
| QĐ-2 | Thành viên có được yêu cầu **xóa** dữ liệu | Được. Ba loại yêu cầu: xuất, chỉnh sửa, xóa. `BOARD` quyết định; xóa được thực thi bằng ẩn danh trường tùy chọn của hồ sơ và thu hồi đồng ý công khai, giữ định danh tối thiểu | Khớp FLOW-28, DATA-06; không phá lịch sử (BR-13, RP-12) | B5; Vai trò & quyền §8.7 |
| QĐ-3 | Chuyển **Ngừng tham gia** có thu hồi phiên, quyền không | Có. Ngừng tham gia ⇒ tài khoản Ngừng hoạt động, thu hồi mọi phiên và vai trò quản lý/đặc quyền trong cùng transaction. Tạm ngưng không đổi tài khoản | Người đã rời CLB không được giữ quyền truy cập tài liệu nội bộ (RP-09); hai trạng thái vẫn độc lập ở mọi trường hợp khác | A5, T5; PRD MEM-11; Vai trò & quyền RP-09; FLOW-13 |
| QĐ-4 | Khối trang chủ khi **chưa chọn nội dung nổi bật** | Hiện mục mới nhất đang công khai; chỉ ẩn khối khi không có mục nào | Trang chủ không trống khi mới phát hành; Ban Chủ nhiệm không bắt buộc chọn tay | T4, C2, E2; FLOW-01 |
| QĐ-5 | Công cụ **quét mã độc** (SEC-15) | ClamAV (`clamd`) chạy trong Compose, API gọi qua TCP bằng `node:net`. VPS nâng lên 4 GB RAM. Local, CI mặc định bỏ qua quét; production bắt buộc | Mã nguồn mở, không gửi tệp của thành viên ra dịch vụ ngoài, không thêm thư viện | D2, O4; Kiến trúc §5 dòng 6, 12 |
| QĐ-6 | Nơi lưu **ngày kết thúc nhiệm kỳ** (RP-03) | Cột `SiteSetting.termEndsAt`, `BOARD` sửa ở trang Thông tin APC | Một nguồn duy nhất cho mọi vai trò đặc quyền | T2, T4, A6, A7; PRD §9; FLOW-24 |
| QĐ-7 | **Trạng thái hồ sơ** nào gửi email (NTF-01) | Mời phỏng vấn, Đã chấp nhận, Không chấp nhận, Đã rút. Không gửi khi Mới → Đang xét | Chỉ báo khi ứng viên cần biết hoặc cần làm gì; báo Đã rút để phát hiện bị rút đơn hộ | R4, R5, O2; PRD NTF-01; FLOW-05, FLOW-07 |
| QĐ-8 | "Email liên hệ" thành viên tự sửa | Trường riêng `contactEmail`. `email` là email tài khoản, chỉ `BOARD` sửa, dùng cho mọi email hệ thống | `email` duy nhất, dùng đối chiếu trùng và nhận email bảo mật; không để thành viên tự đổi | T3, T5; PRD MEM-02 đến MEM-04 |
| QĐ-9 | Ngày phát hành production và nội dung thật | 23/11–29/11 dựng staging và làm đủ bằng chứng release gate; T4 **02/12** phát hành production (O7); Ban Chủ nhiệm nhập nội dung thật 02/12–06/12. Gate chưa đạt thì dời ngày, không bỏ điều kiện | PRD §13 yêu cầu diễn tập restore và kiểm thử tải trước phát hành | O4, O5, O7, Q4, Q6 |

## 9. Yêu cầu đặc tả được giao thêm hoặc dời phạm vi

Các yêu cầu trước đây chưa thuộc việc nào. Phần dời phạm vi được ghi nhận chính thức ở [PRD](../01-prd.md) §13.1 theo điều kiện phát hành PRD §13.

| Yêu cầu | Nguồn | Xử lý | Người | Hạn |
| --- | --- | --- | --- | --- |
| Lệnh bootstrap `BOARD`, `TECH_ADMIN` đầu tiên | RP-15, PRD §11 mục 13, AC-RBAC-09 | A7 | Huỳnh Hoàn Phúc | T4 25/11 |
| Vai trò hết hạn chuyển `EXPIRED`, email cảnh báo 30/7 ngày | RP-03, ADM-08, NTF-01 | O6 | Đặng Phúc An Khang | CN 22/11 |
| Khôi phục 2 lớp bằng hai người | RP-14, FLOW-27 | B6 | Trương Phúc Minh | T4 25/11 |
| Trang `/portal/account/roles` | PAGE-MEM-17 | T3 | Lương Huỳnh | CN 01/11 |
| Yêu cầu xóa dữ liệu: ẩn danh hồ sơ thành viên | FLOW-28 bước 6 | B5 | Trương Phúc Minh | CN 22/11 |
| Yêu cầu xóa dữ liệu: ẩn danh hồ sơ ứng tuyển, đăng ký sự kiện, tệp của người yêu cầu | DATA-06, FLOW-28 bước 6 | **Dời** sang sau phát hành (PRD §13.1), làm cùng thực thi retention | Trương Phúc Minh | CN 28/02/2027 |
| Quyền `INCIDENT` trên nhật ký, email, metadata tài liệu | Vai trò & quyền §8.5–8.7 | B4, O3, D4 theo luật chung mục 7.2 | Trương Phúc Minh, Đặng Phúc An Khang, Phạm Đăng Hoàng Thiên | Theo hạn từng việc |
| Định danh dịch vụ cho tác vụ nền | Vai trò & quyền §12 mục 9 | B1 (`audit({ service })`), O1 (`startJob`) | Trương Phúc Minh, Đặng Phúc An Khang | T5 08/10, CN 11/10 |
| `sitemap.xml`, `robots.txt`, trang 500 có mã tham chiếu, trang bảo trì, correlation ID | SEO-02, PAGE-SYS-02, 04–06, OPS-11 | C6 (phần ứng dụng), O4 (Nginx) | Nguyễn Gia Bảo, Đặng Phúc An Khang | T4 25/11, T5 26/11 |
| Cảnh báo lệch đồng hồ | SEC-16, FLOW-27 | O4 (`chrony`), O5 (cảnh báo Netdata) | Đặng Phúc An Khang | CN 29/11 |
| Email cảnh báo vận hành | NTF-01 | O5 (Netdata, UptimeRobot) | Đặng Phúc An Khang | CN 29/11 |
| Sổ sự cố | FLOW-29, AC-12 | Dạng mã sự cố ở luật chung mục 7.2; sổ ở O5 (Google Sheet riêng, ngoài repo) | Đặng Phúc An Khang | CN 29/11 |
| Chạy thử retention, báo cáo dry-run | PRD §13, DATA-08 | B7 | Trương Phúc Minh | CN 29/11 |
| Kiểm thử tải 20 người dùng | PERF-03, PRD §11 mục 15 | Q6 (chuyển từ O5) | Nguyễn Tiến Bảo | CN 29/11 |
| Phát hành production lần đầu | FLOW-22, PRD §13 | O7 | Đặng Phúc An Khang | T4 02/12 |
| Thực thi retention (xóa/ẩn danh theo lô, `DUAL`), trang `/admin/data-retention`, xóa bản ghi email sau 90 ngày, xóa vật lý tệp `DUAL` | DATA-05, DATA-08, PRD §10.5, PAGE-MGT-DATA-03, Vai trò & quyền §8.5 | **Dời** sang sau phát hành (PRD §13.1) | Trương Phúc Minh | CN 28/02/2027 |
| Khu vận hành `/admin/system/*` trong Portal | PAGE-OPS-01 đến 09 | **Dời** sang sau phát hành; bản đầu dùng UptimeRobot, Netdata, GitHub Actions, sổ sự cố | Đặng Phúc An Khang | CN 28/02/2027 |
| Xác minh tăng cường (captcha) cho form công khai | SEC-05 | **Dời** sang sau phát hành; bản đầu trả 429 theo ngưỡng (FLOW-04, FLOW-14 cho phép). Có dấu hiệu lạm dụng thì làm ngay | Phan Anh Khương, Lê Đăng Nghĩa | CN 28/02/2027 |

Phân bổ lại khối lượng: A5 cũ tách thành A5 (tài khoản) và A6 (vai trò); tác vụ hết hạn vai trò chuyển sang O6; kiểm thử tải chuyển từ O5 sang Q6; nhập nội dung thật (Q4) dời sau ngày phát hành.
