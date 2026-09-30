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
| Lên máy chủ | 23/11 – 29/11 | VPS, HTTPS, sao lưu; nhập nội dung thật |

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
| B1 | `audit(...)` | T5 08/10 | A1 (log từ chối), A5, B3, B5, C3, C4, D4, D5, D6, E4, E6, O3, R2, R4, R5, R6, T4, T5 |
| D1 | Dữ liệu mẫu `db:seed` và bộ tài khoản mẫu | T5 08/10 | Mọi người khi chạy thử; Q1–Q3 |
| A2 | Đăng nhập, `/auth/me`, chặn trang khi chưa đăng nhập | CN 11/10 | Mọi trang `/portal`, `/admin` |
| B2 | `recordConsent(...)`, `hasActiveConsent(...)`, trang `/privacy` | CN 11/10 | R3, E3, B5, C3, C4 |
| D2 | Upload tệp qua S3 | CN 11/10 | C3, C4 (ảnh bài, ảnh dự án), E4 (ảnh bìa), T3 (ảnh đại diện), D4 |
| O1 | `enqueueEmail(...)` | CN 11/10 | R3, E3, E5, O2 |
| E2 | Bảng `EventRegistration` | T5 22/10 | E3, E5, E6, T3 (lịch sử hoạt động) |
| A3 | Khung trang và menu `/portal`, `/admin` | T5 22/10 | Mọi trang `/portal/*`, `/admin/*` |
| D6 | File xuất bảo vệ `createExport(...)` | CN 08/11 | R5, E6, D5, B5 |
| T5 | Trang `/admin/members` | CN 15/11 | D5 (nút Xuất CSV) |

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
- Tài liệu không rõ hoặc mâu thuẫn: hỏi trưởng dự án, không tự chọn. Các điểm đã biết nằm ở mục 8.

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
| File xuất | File chứa dữ liệu cá nhân tạo bằng `createExport(...)` (D6): chỉ người tạo tải được trong 24 giờ, tự xóa sau đó. Ô CSV bắt đầu bằng `=`, `+`, `-`, `@`, tab, CR thêm dấu `'` phía trước | RP-17, STATE-06, FLOW-25 |
| Ban lưu trữ | Ban `ARCHIVED` không nhận thành viên, sự kiện, tài liệu mới | ORG-06 |
| Trạng thái | Chuyển trạng thái đúng sơ đồ PRD mục 9.2; bước sai trả 409 | BR-16 |

## 8. Điểm cần trưởng dự án quyết định

Các điểm dưới đây tài liệu đặc tả mâu thuẫn hoặc chưa quy định. Việc liên quan làm phần còn lại trước; phần phụ thuộc quyết định chờ đến khi mục này ghi kết quả.

| Mã | Vấn đề | Nguồn | Việc bị ảnh hưởng | Kết quả |
| --- | --- | --- | --- | --- |
| QĐ-1 | Nộp đơn hoặc đăng ký sự kiện **trùng**: FLOW-04 hướng dẫn sang tra cứu, FLOW-14 hiển thị đăng ký hiện có; SEC-05, SEC-08 yêu cầu không làm lộ bản ghi đã tồn tại | FLOW-04, FLOW-14, SEC-05, SEC-08 | R3, E3 | Chờ |
| QĐ-2 | Thành viên có được gửi yêu cầu **xóa** dữ liệu không: Vai trò & quyền §8.7 chỉ ghi xuất/chỉnh sửa; FLOW-28, DATA-06 có xóa | 02 §8.7, FLOW-28, DATA-06 | B5 | Chờ |
| QĐ-3 | Thành viên chuyển **Ngừng tham gia** có tự thu hồi phiên và quyền quản trị không: MEM-11 ghi hai trạng thái độc lập; RP-09, FLOW-13 ghi thu hồi | MEM-11, RP-09, FLOW-13 | T5, A5 | Chờ |
| QĐ-4 | Khối trang chủ khi Ban Chủ nhiệm **chưa chọn nội dung nổi bật**: ẩn khối (FLOW-01) hay hiện mục mới nhất | FLOW-01, ORG-04 | C2, E2, T4 | Chờ |
| QĐ-5 | Công cụ **quét mã độc** cho tệp tải lên: bắt buộc theo đặc tả nhưng chưa có trong danh sách thư viện duyệt | SEC-15, FLOW-19, STATE-05 | D2, D4, T3 | Chờ |
| QĐ-6 | Nơi lưu **ngày kết thúc nhiệm kỳ** để giới hạn ngày hết hạn vai trò đặc quyền | RP-03 | A5 | Chờ |
| QĐ-7 | **Trạng thái hồ sơ nào** gửi email cho ứng viên ("thay đổi trạng thái cần thông báo") | NTF-01 | R5, O2 | Chờ |
| QĐ-8 | "Email liên hệ" thành viên tự sửa là `User.email` (đang duy nhất, dùng cho tài khoản) hay trường riêng | MEM-03, PRD §10.5 | T3 | Chờ |
| QĐ-9 | Phát hành production cần đạt release gate trước (diễn tập restore, kiểm thử tải) nên có thể muộn hơn 29/11; nội dung thật chỉ nhập sau khi phát hành | OPS-05, FLOW-22, PRD §13 | O4, O5, Q4 | Chờ |

## 9. Yêu cầu đặc tả chưa có phiếu

Các yêu cầu dưới đây có trong tài liệu đặc tả nhưng chưa thuộc việc nào. Trưởng dự án giao người hoặc ghi quyết định dời phạm vi.

| Yêu cầu | Nguồn |
| --- | --- |
| Lệnh bootstrap dùng một lần tạo `BOARD` và `TECH_ADMIN` đầu tiên từ console VPS | RP-15, PRD §11 mục 13, AC-RBAC-09 |
| Tác vụ chuyển vai trò hết hạn sang `EXPIRED`; cảnh báo trước 30 ngày và 7 ngày (kèm email) | RP-03, ADM-08, NTF-01 |
| Khôi phục TOTP cần hai người (`BOARD` xác nhận, `TECH_ADMIN` thực hiện) | RP-14, FLOW-27 |
| Trang Vai trò và phạm vi của tôi `/portal/account/roles` | PAGE-MEM-17 |
| Retention: dry-run, thực thi hai người, trang `/admin/data-retention`; xóa bản ghi email sau 90 ngày | DATA-05, DATA-08, PRD §10.5, PAGE-MGT-DATA-03 |
| Thực thi ẩn danh/xóa dữ liệu theo yêu cầu, ghi trước/sau trong audit | FLOW-28 bước 5–6 |
| Khu vận hành `/admin/system/*`, nhật ký incident, quyền `INCIDENT` của `TECH_ADMIN`/`BOARD` trên audit, email, tài liệu | PAGE-OPS-01 đến 09, AC-12 |
| `sitemap.xml`, `robots.txt` | SEO-02, PAGE-SYS-05, PAGE-SYS-06 |
| Trang lỗi 500 có mã tham chiếu, trang bảo trì 503; request/correlation ID trong log | PAGE-SYS-02, PAGE-SYS-04, PUB-08, OPS-11 |
| Xác minh tăng cường (captcha hoặc tương đương) cho biểu mẫu công khai khi bất thường | SEC-05, FLOW-04, FLOW-14 |
| Cảnh báo lệch đồng hồ server, tạm từ chối TOTP khi lệch | SEC-16, FLOW-27 |
| Định danh dịch vụ riêng cho job nền (email worker, retention) | Vai trò & quyền §12 mục 9 |
| Email cảnh báo vận hành | NTF-01 |
