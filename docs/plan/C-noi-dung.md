# Tin tức & Dự án — Nguyễn Gia Bảo

## Bối cảnh

Khách truy cập xem tin tức và dự án, sản phẩm của APC trên website công khai. Ban Chủ nhiệm và quản lý ban soạn nội dung qua trang quản trị mà không cần developer; chỉ Ban Chủ nhiệm công bố nội dung công khai. Thành viên nhận thông báo nội bộ theo ban, vai trò hoặc toàn CLB.

Bảng `posts` (tin tức và thông báo) và `projects` đã có sẵn. Trạng thái dùng chung `ContentStatus`: `DRAFT` (Bản nháp / Ẩn), `PUBLISHED` (Đã công bố / Công khai), `ARCHIVED` (Lưu trữ). Bài có `scope`: `PUBLIC` (tin công khai) hoặc `INTERNAL` (thông báo nội bộ).

Quyền theo [Vai trò & quyền](../02-roles-permissions.md) §8.4:

| Hành động | `DEPARTMENT_MANAGER` | `BOARD` |
| --- | --- | --- |
| Tạo, sửa, xem trước **bản nháp** | Trong ban | Tất cả |
| Công bố thông báo nội bộ trong ban | Trong ban | Tất cả |
| Công bố nội dung công khai hoặc toàn CLB | Không | Được |
| Gỡ, lưu trữ nội dung công khai | Không | Được |
| Tạo, sửa thông tin dự án/sản phẩm | Trong ban | Tất cả |
| Công bố, ẩn, lưu trữ dự án/sản phẩm | Không | Được |

## Phụ thuộc

| Cần có | Từ việc | Dùng cho |
| --- | --- | --- |
| Dữ liệu mẫu | D1 (T5 08/10) | C2 |
| `requireAuth`, `requireRole`, `requireScope` | A1 (T5 08/10) | C3, C4, C5 |
| `audit(...)` | B1 (T5 08/10) | C3, C4 |
| `hasActiveConsent(...)` | B2 (CN 11/10) | C3, C4 |
| Upload ảnh | D2 (CN 11/10) | C3, C4 |
| Khung trang admin & portal | A3 (T5 22/10) | C3, C4, C5 |
| API xem trạng thái đồng ý | B5 (CN 22/11) | C4 (hiện trạng thái đồng ý từng thành viên; trước đó dùng `hasActiveConsent`) |

| Người khác cần | Việc | Hạn |
| --- | --- | --- |
| D3 (tìm kiếm dùng lại card) | C1 | CN 11/10 |
| Q3, Q4 (nhập nội dung thật) | C3, C4 | CN 08/11, CN 15/11 |
| O4 (Nginx: trang bảo trì, `sitemap.xml`, `robots.txt`) | C6 | T4 25/11 |

## Giai đoạn 1 (05/10 – 11/10)

### C1. Trang Tin tức & Dự án — hạn CN 11/10

**Mục tiêu:** bốn trang công khai `/news`, `/news/[slug]`, `/projects`, `/projects/[slug]` hoàn chỉnh giao diện, chạy với dữ liệu giả.

**Làm:**

- Thư mục trang: `apps/web/src/pages/news/list/`, `news/detail/`, `projects/list/`, `projects/detail/`. Đăng ký route trong `App.tsx`, thay `Placeholder` của `/news` và `/projects`.
- Chuyển card tin tức từ `NewsSection` và card dự án từ `ProjectsSection` sang `apps/web/src/components/` (ví dụ `NewsCard`, `ProjectCard`), cho trang chủ dùng lại card mới.
- Dữ liệu giả đặt trong một file `mock.ts` cạnh trang, **cùng hình dạng** với phản hồi API ở C2 (`{ items, total, page, pageSize }`), để C2 chỉ cần thay nguồn dữ liệu.
- Trang danh sách: lưới card, phân trang (`?page=`), 12 mục mỗi trang; bộ lọc chuyên mục (tin tức) và loại Dự án / Sản phẩm (dự án) lưu trên URL (`?category=`, `?type=`).
- Trang chi tiết tin: breadcrumb, tiêu đề, ngày đăng (`formatDate`), chuyên mục, ảnh, nội dung. Trang chi tiết dự án: breadcrumb, tên, loại, mô tả, ảnh, công nghệ, thành viên tham gia, link sản phẩm, link mã nguồn (link ngoài theo luật chung).
- Slug không tồn tại thì hiện trang 404 dùng chung (`NotFound`).
- Dùng `<AsyncState>` cho các trạng thái; trạng thái rỗng phân biệt "chưa có bài" với "không có kết quả theo bộ lọc" (có nút Xóa bộ lọc).

**Xong khi:**

- [ ] Bốn trang có đủ trạng thái đang tải, chưa có dữ liệu, không có kết quả theo bộ lọc, lỗi, có dữ liệu. PR có ảnh chụp (tạm sửa `mock.ts` để tạo các trạng thái).
- [ ] Đổi bộ lọc hoặc trang thì URL đổi theo; tải lại trang giữ nguyên.
- [ ] Trang chủ vẫn hiển thị như cũ sau khi chuyển card sang `components/`.
- [ ] Mở `/news/khong-ton-tai` ra trang 404.

## Giai đoạn 2 (12/10 – 01/11)

### C2. Nối dữ liệu thật — hạn CN 01/11

**Mục tiêu:** tin tức, dự án trên website và trang chủ lấy từ database; nội dung chưa công bố không lộ ra ngoài.

**Cần có trước:** C1, D1.

**Làm:**

- API trong `apps/api/src/modules/content/`:
  - `GET /public/news?page=&pageSize=&category=` — bài `status = PUBLISHED` và `scope = PUBLIC`, mới nhất trước.
  - `GET /public/news/:slug`
  - `GET /public/projects?page=&pageSize=&type=` — dự án `status = PUBLISHED`.
  - `GET /public/projects/:slug`
- Chỉ trả trường cần hiển thị; không trả `authorId`, `publishedById` hay dữ liệu nội bộ.
- Trang dùng `useApi(...)`; xóa file `mock.ts`.
- `NewsSection`, `ProjectsSection` ở trang chủ lấy 3 mục mới nhất từ API; không có mục nào đã công bố thì **ẩn khối**, không để khoảng trống (FLOW-01). Về sau T4 chuyển hai khối này sang `GET /public/home` (ưu tiên mục nổi bật, chưa chọn thì vẫn là mục mới nhất, QĐ-4); C2 không cần làm phần đó.
- Trang chi tiết đặt title, description (theo `metaTitle`/`metaDescription`, không có thì dùng tiêu đề/tóm tắt), canonical URL và thẻ Open Graph (tiêu đề, mô tả, ảnh) (SEO-01, CMS-04).

**Xong khi:**

- [ ] Trong code web không còn dữ liệu giả cho tin tức và dự án.
- [ ] Bài `DRAFT`, `ARCHIVED` hoặc `INTERNAL` không có trong danh sách; mở thẳng slug nhận 404.
- [ ] Mỗi endpoint có test thành công và test 404 cho nội dung chưa công bố.
- [ ] Trang chủ hiện đúng 3 tin và 3 dự án mới nhất từ dữ liệu mẫu; xóa hết dự án công khai thì khối dự án biến mất.
- [ ] Trang chi tiết có thẻ `og:title`, `og:description`, `link rel="canonical"` (xem bằng DevTools).

## Giai đoạn 3 (02/11 – 22/11)

### C3. Quản trị bài viết — hạn CN 08/11

**Mục tiêu:** soạn, xem trước, công bố, gỡ, lưu trữ bài viết qua trang quản trị theo đúng bảng quyền ở phần Bối cảnh.

**Cần có trước:** A3, B1, B2, D2.

**Làm:**

- Trang `/admin/content/posts` (danh sách, lọc trạng thái, chuyên mục, ban, phạm vi), `/admin/content/posts/new`, `/admin/content/posts/[id]` (sửa), `/admin/content/posts/[id]/preview` (xem trước giống trang công khai, cần đăng nhập, gắn `noindex`).
- Trường theo CMS-01: tiêu đề, tóm tắt, nội dung, ảnh đại diện (upload qua D2), chuyên mục, phạm vi (`PUBLIC` / `INTERNAL`), ban, `metaTitle`, `metaDescription`. Tác giả lấy từ người đăng nhập. Quản lý ban tạo bài thì ban tự gán là ban đang quản lý.
- Nội dung lưu dạng văn bản thuần, hiển thị giữ xuống dòng. Không render HTML từ nội dung (chống XSS). Cần trình soạn thảo định dạng hoặc Markdown thì hỏi trưởng dự án, vì thư viện chưa có trong danh sách duyệt.
- Slug sinh bằng `slugify(title)` lúc tạo; trùng thì thêm hậu tố. **Đổi tiêu đề không đổi slug**; giao diện không có ô sửa slug.
- Chuyển trạng thái theo [PRD](../01-prd.md) mục 9.2: `DRAFT → PUBLISHED` (công bố), `PUBLISHED → DRAFT` (gỡ để sửa), `DRAFT/PUBLISHED → ARCHIVED` (lưu trữ).
- Quyền đúng bảng ở phần Bối cảnh:
  - `DEPARTMENT_MANAGER` chỉ sửa bài ở `DRAFT` của ban mình; bài đã công bố muốn sửa phải chờ `BOARD` gỡ về nháp.
  - `DEPARTMENT_MANAGER` chỉ công bố bài `INTERNAL` có đối tượng là ban mình (C5).
  - Công bố `PUBLIC`, gỡ và lưu trữ bài `PUBLIC`: chỉ `BOARD`.
- Trước khi công bố, người soạn đánh dấu nội dung có nêu tên/ảnh thành viên hay không và chọn các thành viên đó; hệ thống kiểm tra `hasActiveConsent` với mục đích tương ứng, thiếu đồng ý thì không cho công bố và liệt kê người thiếu (FLOW-17 bước 3, BR-20).
- Công bố, gỡ, lưu trữ gọi `audit(...)`; công bố ghi `publishedById`, `publishedAt`.

**Xong khi:**

- [ ] `board` tạo và công bố xong một bài có ảnh trong dưới 10 phút (đo cùng Nguyễn Tiến Bảo); bài hiện ở `/news`.
- [ ] Gỡ bài thì bài biến mất khỏi `/news`, link cũ ra 404.
- [ ] `manager.a` mở bài của Ban B nhận 404; `manager.a` công bố bài `PUBLIC` nhận 403; `manager.a` sửa bài `PUBLIC` đã công bố của Ban A nhận 403.
- [ ] Bài nêu tên một thành viên chưa đồng ý công khai tên không công bố được.
- [ ] Bước chuyển sai (ví dụ `ARCHIVED → PUBLISHED`) trả 409.
- [ ] Nội dung có `<script>` hiển thị nguyên dạng chữ, không chạy.
- [ ] Hai người cùng sửa một bài: người lưu sau nhận thông báo xung đột, không ghi đè.
- [ ] Mỗi thao tác công bố, gỡ, lưu trữ có dòng nhật ký.

### C4. Quản trị dự án & sản phẩm — hạn CN 15/11

**Mục tiêu:** quản lý hồ sơ giới thiệu dự án, sản phẩm của APC; tên, ảnh thành viên chỉ hiện khi có đồng ý.

**Cần có trước:** C3.

**Làm:**

- Một migration: thêm `type` (`PROJECT` / `PRODUCT`) vào `Project` (FLOW-18 bước 1); bảng nối dự án – thành viên tham gia.
- Trang `/admin/content/projects`, `/new`, `/[id]`, `/[id]/preview`.
- Trường theo PRT-01: loại, tên, mô tả, ảnh, công nghệ (danh sách), link sản phẩm, link mã nguồn (chỉ nhận `http`/`https`, sai thì 422), thành viên tham gia.
- Form hiện **trạng thái đồng ý công khai** của từng thành viên được chọn (chỉ đọc; không đồng ý thay thành viên) (FLOW-18 bước 2, MEM-12).
- Trang công khai chỉ hiện tên thành viên có `hasActiveConsent` mục đích `PUBLIC_NAME` cho dự án đó hoặc áp dụng chung; ảnh thành viên cần `PUBLIC_PHOTO` (PRT-04, BR-20). Ảnh phục vụ qua `GET /public/projects/:slug/members/:userId/avatar`: kiểm tra dự án đang công khai, người đó thuộc dự án và `hasActiveConsent(PUBLIC_PHOTO)` **ngay lúc tải**; thiếu điều kiện nào thì 404. Không đổi `visibility` của ảnh đại diện (D2).
- Trạng thái: `DRAFT` (Ẩn), `PUBLISHED` (Công khai), `ARCHIVED`. Lưu mới luôn ở Ẩn. `DEPARTMENT_MANAGER` tạo, sửa dự án của ban mình; công bố, ẩn, lưu trữ chỉ `BOARD`.
- Công bố, ẩn, lưu trữ gọi `audit(...)`.

**Xong khi:**

- [ ] Dự án không có trường người được giao việc, deadline, tiến độ (BR-15).
- [ ] Thành viên chưa đồng ý công khai tên không hiện trên `/projects/[slug]`; đồng ý xong thì hiện ở lần tải tiếp theo.
- [ ] Link `javascript:...` hoặc `ftp://...` bị từ chối lưu.
- [ ] `manager.a` bấm công bố nhận 403; mở dự án của Ban B nhận 404.
- [ ] Bước chuyển sai trả 409.

### C5. Thông báo nội bộ — hạn CN 22/11

**Mục tiêu:** gửi thông báo đến một ban, một nhóm vai trò hoặc toàn CLB; thành viên xem tại portal.

**Cần có trước:** C3, A3.

**Làm:**

- Thông báo là bài `scope = INTERNAL`, soạn bằng trang C3.
- Một migration thêm **trường đối tượng nhận** vào `Post`, tách khỏi `departmentId` (ban sở hữu bài): `ALL` (toàn CLB), `DEPARTMENT` (kèm ban nhận), `ROLES` (kèm danh sách vai trò).
- Quyền: `DEPARTMENT_MANAGER` chỉ chọn đối tượng `DEPARTMENT` là ban mình; `ALL` và `ROLES` chỉ `BOARD` (Vai trò & quyền §8.4, FLOW-17 bước 5–6).
- API `GET /portal/announcements`, `GET /portal/announcements/:id` — chỉ bài `PUBLISHED`, lọc ngay trong truy vấn theo ban và vai trò của người đăng nhập.
- Trang `/portal/announcements` và `/portal/announcements/[id]`.

**Xong khi:**

- [ ] `member.b` không thấy thông báo gửi Ban A trong danh sách; mở thẳng link nhận 404.
- [ ] Thông báo gửi vai trò `DEPARTMENT_MANAGER` chỉ quản lý ban thấy; thông báo `ALL` mọi thành viên thấy.
- [ ] Thông báo `DRAFT` hoặc `ARCHIVED` mở thẳng link nhận 404.
- [ ] `manager.a` chọn đối tượng `ALL` hoặc `ROLES` nhận 403.
- [ ] Thông báo nội bộ không bao giờ xuất hiện ở `/news`.

## Lên máy chủ (23/11 – 29/11)

### C6. Trang hệ thống & SEO — hạn T4 25/11

**Mục tiêu:** công cụ tìm kiếm đọc được `sitemap.xml`, `robots.txt`; người dùng gặp lỗi hệ thống thấy trang lỗi có mã tham chiếu; khi bảo trì thấy trang bảo trì (SEO-02, PUB-08, OPS-11, Sitemap §12).

**Cần có trước:** C2, E2, R1.

**Làm:**

- **Mã tham chiếu (correlation ID)** trong `apps/api/src/app.ts` và `src/lib/errors.ts`:
  - Mỗi request có mã ngẫu nhiên (`randomUUID()`); nhận header `x-request-id` do Nginx gửi nếu đúng dạng UUID, không thì tự sinh. Trả lại header `x-request-id` trong mọi phản hồi.
  - Log của Fastify đã kèm mã này; thêm cấu hình `redact` bỏ header `cookie`, `authorization` khỏi log (OPS-11).
  - Phản hồi 500 thêm trường `requestId`; `ApiError` ở web đọc trường này.
- **Trang lỗi 500** (`PAGE-SYS-04`): `<AsyncState>` ở trạng thái lỗi 500 hiện "Mã tham chiếu: …" để người dùng gửi cho Ban Chủ nhiệm. Thêm error boundary cấp route cho lỗi giao diện, không hiện stack trace.
- **Trang bảo trì** (`PAGE-SYS-02`): file tĩnh `apps/web/public/maintenance.html`, tự chứa CSS, không gọi API, theo màu và chữ của [DESIGN.md](../../DESIGN.md). Nginx trả file này với mã 503 khi bật chế độ bảo trì (O4).
- **`sitemap.xml`** (`PAGE-SYS-05`): API `GET /public/sitemap.xml` sinh từ database, URL tuyệt đối theo `WEB_URL`. Gồm trang công khai cố định (`/`, `/about`, `/news`, `/events`, `/projects`, `/recruitment`, `/privacy`) và chi tiết tin tức, sự kiện, dự án đang công khai. Không gồm tìm kiếm, biểu mẫu, tra cứu, đăng nhập, portal, admin (Sitemap §16).
- **`robots.txt`** (`PAGE-SYS-06`): API `GET /public/robots.txt` chặn `/login`, `/account`, `/portal`, `/admin`, trang xem trước, biểu mẫu và tra cứu (Sitemap §16; `/search` không chặn vì dùng `noindex, follow`); dòng `Sitemap:` trỏ tới `sitemap.xml`.
- Nginx (O4) chuyển `/sitemap.xml`, `/robots.txt` tới hai API trên; local thêm vào proxy trong `apps/web/vite.config.ts`. Báo Đặng Phúc An Khang khi merge.

**Xong khi:**

- [ ] Mọi phản hồi API có header `x-request-id`; cùng mã đó có trong dòng log của request.
- [ ] Log không chứa cookie phiên.
- [ ] Gây lỗi 500 thử (route test) thì web hiện mã tham chiếu khớp với log.
- [ ] `sitemap.xml` hợp lệ, có bài `PUBLISHED`, không có bài `DRAFT`/`ARCHIVED`, không có thông báo nội bộ.
- [ ] `robots.txt` có đủ các đường dẫn bị chặn và dòng `Sitemap:`.
- [ ] Mở `maintenance.html` trực tiếp hiển thị đúng ở 360 px, không lỗi khi API tắt.

## Lưu ý

- Bài ở trạng thái Bản nháp hoặc Lưu trữ không hiện ra ngoài, kể cả khi gõ thẳng link (BR-11).
- Chỉ `BOARD` công bố, gỡ, lưu trữ nội dung công khai.
- Dự án chỉ là hồ sơ giới thiệu; không có phân công, deadline hay tiến độ.
- Đổi tiêu đề không làm đổi link bài đã công bố.
- Không xóa vật lý bài hay dự án; dùng `ARCHIVED`.
- Các quy tắc chung (360 px, SEO, xung đột phiên bản, cảnh báo rời trang, link ngoài) theo [README kế hoạch](./README.md) mục 7.2.

## Tài liệu

- [PRD](../01-prd.md): mục 7.1, 7.6, 7.7, 9.2 (sơ đồ trạng thái Nội dung), 10.3 (OPS-11), 10.6 (SEO)
- [User flow](../03-user-flows.md): FLOW-01, FLOW-02, FLOW-17, FLOW-18
- [Sitemap](../04-sitemap.md): mục 5.2, 7.2 (`PAGE-MEM-02`, `PAGE-MEM-03`), 8.5, 8.6, 12, 14, 15, 16
- [Vai trò & quyền](../02-roles-permissions.md): mục 8.4, 8.7
