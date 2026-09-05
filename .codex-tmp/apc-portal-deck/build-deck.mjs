import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const ROOT = "F:\\github-project\\apc-web-portal";
const OUT = `${ROOT}\\outputs\\apc-portal-kickoff`;
const RENDER = `${ROOT}\\.codex-tmp\\apc-portal-deck\\rendered`;
const FINAL = `${OUT}\\APC-Portal-Team-Kickoff.pptx`;

const ASSET = {
  logo: `${ROOT}\\apps\\web\\public\\assets\\home\\00-apc-logo.png`,
  hero: `${ROOT}\\imgs\\hero-isometric-concept.png`,
  team: `${ROOT}\\apps\\web\\public\\assets\\home\\02-apc-students-working.png`,
  homepage: `${ROOT}\\design-reference\\homepage\\preview-full.png`,
  tech: `${OUT}\\assets\\apc-portal-tech-illustration.png`,
  productZones: `${OUT}\\assets\\product-zones-v2.png`,
  requestFlow: `${OUT}\\assets\\request-flow-v2.png`,
  authFlow: `${OUT}\\assets\\auth-flow-v2.png`,
  dockerLocal: `${OUT}\\assets\\docker-local-v2.png`,
  recruitmentFlow: `${OUT}\\assets\\recruitment-flow-v2.png`,
  gitWorkflow: `${OUT}\\assets\\git-workflow-v2.png`,
  newsFlow: `${OUT}\\assets\\news-flow-v2.png`,
};

const IMG = {
  logo: await fs.readFile(ASSET.logo),
  hero: await fs.readFile(ASSET.hero),
  team: await fs.readFile(ASSET.team),
  homepage: await fs.readFile(ASSET.homepage),
  tech: await fs.readFile(ASSET.tech),
  productZones: await fs.readFile(ASSET.productZones),
  requestFlow: await fs.readFile(ASSET.requestFlow),
  authFlow: await fs.readFile(ASSET.authFlow),
  dockerLocal: await fs.readFile(ASSET.dockerLocal),
  recruitmentFlow: await fs.readFile(ASSET.recruitmentFlow),
  gitWorkflow: await fs.readFile(ASSET.gitWorkflow),
  newsFlow: await fs.readFile(ASSET.newsFlow),
};

const C = {
  bg: "#FAF8F5",
  surface: "#F1ECE5",
  card: "#FFFFFF",
  ink: "#201A16",
  muted: "#6B5F55",
  hair: "#E7DFD5",
  hairStrong: "#CBBFAF",
  red: "#C23B22",
  redDark: "#841F11",
  redPale: "#F6DED6",
  blue: "#1568C9",
  blueDark: "#0B3E7A",
  bluePale: "#DCEAFB",
  gold: "#F0A202",
  goldPale: "#FCEACA",
  green: "#0E9F6E",
  navy: "#081A33",
  code: "#0B172A",
  codeText: "#E8EEF7",
};

const W = 1280;
const H = 720;
const M = 72;
const FONT = "Arial";
const MONO = "Consolas";

const deck = Presentation.create({ slideSize: { width: W, height: H } });

const SPOKEN = [
  `APC Portal là dự án chung của chín thành viên trong giai đoạn từ đầu tháng 9 đến ngày 15 tháng 10. Buổi này sẽ đi từ bài toán của APC, phạm vi sản phẩm, công nghệ đang dùng, đến phần việc cụ thể của từng người. Sau buổi kickoff, mọi người cần biết đầu ra mình chịu trách nhiệm và ai đang chờ đầu ra đó.`,
  `Có bốn việc cần chốt trong buổi hôm nay. Thứ nhất, chúng ta đang giải quyết bài toán nào. Thứ hai, bản demo cuối giai đoạn phải chạy được những luồng gì. Thứ ba, mỗi thành viên sở hữu phần nào. Cuối cùng, cả đội thống nhất cách làm task, mở pull request, review và xử lý khi bị kẹt.`,
  `Hiện thông tin và hoạt động của APC đang nằm ở nhiều kênh khác nhau: fanpage, email, Google Forms, UMTOJ và các website sự kiện. Người dùng phải tự biết nên tìm ở đâu, còn Ban Chủ nhiệm phải cập nhật nhiều nơi. APC Portal được xây để có một địa chỉ chính thức, nơi nội dung và dữ liệu được quản lý tập trung.`,
  `APC Portal có ba khu vực. Khu vực công khai dành cho sinh viên và khách truy cập. Khu vực thành viên phục vụ người đã có tài khoản APC. Khu vực quản trị dành cho người phụ trách nội dung, tuyển thành viên và vận hành. Ba khu vực dùng chung một hệ thống dữ liệu, nhưng quyền truy cập và chức năng khác nhau.`,
  `PRD mô tả full MVP khá rộng, bao gồm hồ sơ thành viên, hoạt động, tài liệu nội bộ, audit và nhiều luồng quản trị. Tuy nhiên kế hoạch đến ngày 15 tháng 10 chỉ tập trung vào nền tảng, nội dung công khai, đăng nhập, CMS và quy trình Gia nhập APC. Các phần chưa nằm trong Excel không nên tự động kéo vào sprint hiện tại.`,
  `Dự án đã có trang chủ React, API Fastify với endpoint health, môi trường PostgreSQL, Mailpit và MinIO, cùng lệnh kiểm tra lint, type-check, test và build. Phần còn thiếu là dữ liệu nghiệp vụ, đăng nhập, phân quyền, các API nội dung, form Gia nhập và CMS. Vì vậy nhóm đang phát triển tiếp trên một nền đã chạy được, không bắt đầu từ repository trống.`,
  `Repository dùng monorepo TypeScript. apps/web chứa giao diện React. apps/api chứa Fastify API và nghiệp vụ phía server. docs là nguồn để kiểm tra yêu cầu, quyền và user flow. compose.yaml chỉ mô tả hạ tầng local. Khi nhận task, mỗi người cần xác định đúng thư mục code và tài liệu nghiệp vụ liên quan trước khi sửa.`,
  `Bản demo ngày 15 tháng 10 cần cho thấy hai phía. Sinh viên xem được nội dung và gửi đơn Gia nhập. Người quản trị đăng nhập đúng quyền, quản lý nội dung, xử lý hồ sơ, upload file và gửi email. Ngoài giao diện, bản demo còn phải có dữ liệu lưu thật, CI xanh, staging truy cập được và quy trình backup hoặc bàn giao rõ ràng.`,
  `Phần công nghệ sẽ bám trực tiếp vào dự án. Chúng ta sẽ xem request đi từ trình duyệt đến API và database thế nào, công nghệ nào đã được cài, Docker đang dùng ở đâu, và các quyết định nào còn phải chốt. Các đoạn code trên slide đều được rút ngắn từ repository hoặc được ghi rõ là ví dụ chưa triển khai.`,
  `Một request bắt đầu khi người dùng thao tác trên trình duyệt. React hiển thị giao diện và gửi yêu cầu HTTP. Fastify nhận request, Zod kiểm tra dữ liệu, sau đó Backend đọc hoặc ghi PostgreSQL. Nếu request liên quan đến ảnh hoặc tệp, Backend làm việc với MinIO. Nếu cần gửi email trong local, kết quả được kiểm tra qua Mailpit.`,
  `Stack hiện tại được xác định từ package.json và compose.yaml. Node.js 22 và pnpm 10 là nền chạy chung. Frontend dùng React 19, Vite 8 và Tailwind 3. Backend dùng Fastify 5, Zod 4 và driver pg. Vitest và Oxlint phục vụ kiểm tra. React Router, ORM, cách quản lý phiên và thư viện hash mật khẩu vẫn chưa được chốt hoặc chưa cài.`,
  `Frontend dùng React để tách giao diện thành các component. TypeScript giúp phát hiện lỗi kiểu dữ liệu trước khi chạy. Vite cung cấp dev server và build nhanh. Tailwind giữ màu sắc, spacing và responsive nhất quán. HomePage hiện đã được tách thành Navbar, Hero, News, Events, Projects và các section khác để các phần có thể phát triển độc lập.`,
  `Frontend hiện mới có route trang chủ. FE-1 sẽ tạo React Router, layout chung, route đăng nhập và route guard. Sau đó FE-2 triển khai Tin tức và Sự kiện, FE-3 triển khai Dự án và Gia nhập, còn FE-4 triển khai khu vực admin. Các trang phải có trạng thái loading, empty, error và success thay vì chỉ hiển thị trường hợp dữ liệu đẹp.`,
  `Backend hiện có Fastify app, CORS và endpoint GET health. Mỗi endpoint gồm phương thức HTTP, đường dẫn và hàm xử lý. Dữ liệu trả về ở dạng JSON để Frontend sử dụng. Khi phát triển CRUD, Backend phải validate input, kiểm tra quyền, xử lý lỗi và trả status code nhất quán; việc ẩn nút ở Frontend không thay thế kiểm tra quyền ở API.`,
  `BE-1 sẽ thiết kế các bảng nền gồm user, role, news, event, project và membership_application. Đây mới là danh sách thực thể chính, chưa phải ERD cuối. Trước khi migration đầu tiên được merge, nhóm cần chốt ORM, quan hệ giữa bảng, khóa chính, trạng thái và những trường Frontend cần dùng. Seed data phải dùng dữ liệu mẫu an toàn, không hardcode mật khẩu thật.`,
  `Zod hiện được dùng để parse biến môi trường như API_PORT và DATABASE_URL. Khi thêm endpoint, cùng nguyên tắc đó sẽ được dùng để validate body, params và query. Ví dụ form Gia nhập cần kiểm tra email, mã sinh viên, trường bắt buộc và độ dài nội dung. Frontend có thể validate để hỗ trợ người dùng, nhưng Backend vẫn phải validate lại.`,
  `Đăng nhập và phân quyền là hai bước khác nhau. Đăng nhập xác định tài khoản có hợp lệ không và tạo session hoặc token. Sau đó mỗi request dùng thông tin phiên để xác định user hiện tại. Middleware RBAC kiểm tra vai trò và phạm vi trước khi cho phép hành động. Nếu đã đăng nhập nhưng không có quyền, API trả 403; Frontend hiển thị thông báo phù hợp.`,
  `PostgreSQL lưu dữ liệu có cấu trúc và quan hệ. MinIO lưu ảnh hoặc tệp upload để database chỉ giữ URL hoặc object key. Mailpit nhận email trong môi trường local để nhóm kiểm tra tiêu đề, nội dung và người nhận mà không gửi ra Internet. Ba dịch vụ này đều được chạy bằng Docker Compose để mọi máy dùng cùng phiên bản và port.`,
  `Kế hoạch Backend hiện có sáu nhóm route chính. Auth phục vụ login, logout và me. News, events và projects cung cấp list, detail và CRUD. Upload nhận multipart và lưu vào MinIO. Applications nhận đơn, liệt kê hồ sơ và xử lý approve hoặc reject. Trước khi FE tích hợp, hai bên cần chốt field, response, status code và lỗi.`,
  `Docker không bị loại khỏi Frontend hay Backend. Trong môi trường local hiện tại, code React và Fastify chạy trực tiếp để hot reload, debug và xem log đơn giản hơn. Docker được dùng cho PostgreSQL, Mailpit và MinIO vì các dịch vụ này cần đúng phiên bản, port, volume và health check. Khi làm staging, Web và API có thể được đóng thành image riêng.`,
  `Cách chạy hiện tại gồm hai phần. pnpm dev chạy React ở cổng 5173 và Fastify ở cổng 3000 trên máy thành viên. pnpm infra:up gọi Docker Compose để bật PostgreSQL, Mailpit và MinIO. API kết nối tới các service đó qua port local. Vì Web và API chưa nằm trong compose.yaml, mọi người không nên hiểu rằng toàn bộ hệ thống đã được container hóa.`,
  `Trong compose.yaml, image xác định phiên bản PostgreSQL. Mapping 127.0.0.1:5432 giới hạn database cho máy local thay vì công khai ra mạng. Volume postgres_data giữ dữ liệu khi container bị dừng hoặc tạo lại. Health check dùng pg_isready để báo khi database thực sự sẵn sàng. Cấu hình tương tự được áp dụng cho Mailpit và MinIO.`,
  `Lần đầu cài đặt cần đúng Node.js, pnpm và Docker Desktop, sau đó copy env mẫu, bật hạ tầng và chạy dev server. Hằng ngày thường chỉ cần pnpm infra:up và pnpm dev. Trước khi mở PR phải chạy pnpm check. Khi kết thúc dùng pnpm infra:down; lệnh này giữ volume, còn down -v sẽ xóa dữ liệu local nên không dùng tùy tiện.`,
  `Bốn quyết định đang mở cần được chốt bằng issue hoặc ADR. BE-1 và Tech Lead chọn Prisma hoặc Drizzle. BE-2 và FE-1 chốt session cookie hay JWT. BE-2 chọn Argon2 hoặc bcrypt. OP-1 và Tech Lead chốt hạ tầng staging, domain, TLS và cách build image. Các quyết định này ảnh hưởng nhiều task nên không nên tự chọn trong một PR riêng lẻ.`,
  `GitHub Actions chạy pnpm check khi có pull request hoặc push vào main. Lệnh này chạy lint, type-check, test rồi build. Nếu một bước thất bại, PR chưa đạt điều kiện merge. CI không thay thế review: test tự động kiểm tra hành vi đã viết, còn reviewer kiểm tra logic, phạm vi thay đổi, bảo mật, tài liệu và phần chưa được test.`,
  `Trang Tin tức cho thấy cách nhiều người nối công việc. FE-2 dựng danh sách, chi tiết và các trạng thái giao diện. BE-3 triển khai GET news và GET news theo id hoặc slug. BE-1 cung cấp schema và migration. OP-2 kiểm tra loading, empty, error và dữ liệu công bố. Field và response phải được thống nhất trước khi hai phía tích hợp.`,
  `Luồng Gia nhập bắt đầu ở form do FE-3 triển khai. BE-2 nhận request, validate và lưu membership_application. Hệ thống gửi email xác nhận qua module email; ở local email xuất hiện trong Mailpit. FE-4 cung cấp màn hình để người có quyền xem, duyệt hoặc từ chối hồ sơ. BE-10 phụ thuộc RBAC và email nên không thể hoàn thành độc lập.`,
  `Đội có ba nhóm trách nhiệm. Backend có Thiên, Minh và Khương. Frontend có Huỳnh, Gia Bảo, Đăng Nghĩa và Hoàn Phúc. Hạ tầng và QA có An Khang và Tiến Bảo. Mã BE, FE và OP trên sheet không chỉ là tên nhóm; mỗi mã gắn với một tập đầu ra và dependency cụ thể.`,
  `Thiên phụ trách schema, migration, seed và upload. Minh phụ trách auth, RBAC, email và quy trình tuyển. Khương phụ trách API Tin tức, Sự kiện và Dự án. Backend cần thống nhất cấu trúc module, error response, cách validate và quy tắc quyền để FE không phải xử lý ba kiểu API khác nhau.`,
  `Huỳnh phụ trách router, layout, auth UI và component dùng chung. Gia Bảo phụ trách Tin tức và Sự kiện. Đăng Nghĩa phụ trách Dự án và form Gia nhập. Hoàn Phúc phụ trách CMS admin và test Frontend. Mỗi người cần chủ động thống nhất API contract với Backend tương ứng thay vì chờ đến cuối sprint mới tích hợp.`,
  `An Khang phụ trách CI, staging và backup. Tiến Bảo phụ trách QA, E2E, nội dung thật và cập nhật tài liệu. APC hoặc Ban Chủ nhiệm phải duyệt nội dung, hình ảnh và dữ liệu trước khi công bố. Đây là dependency thật của việc phát hành, không phải phần có thể để tới phút cuối.`,
  `Kế hoạch có bốn chặng. Sprint 1 xây nền tảng. Sprint 2 mở API và các trang public. Sprint 3 hoàn thiện CMS và Gia nhập. Ba ngày cuối dành cho staging, QA, backup và bàn giao. Deadline cứng là ngày 15 tháng 10, vì vậy task phụ thuộc phải được ưu tiên trước các phần tối ưu hoặc trang trí.`,
  `Sprint 1 có năm nút chặn: database, đăng nhập, router, CI và việc APC duyệt trang chủ. BE-3 chỉ bắt đầu auth đầy đủ sau khi BE-1 có schema user và role. Các trang Frontend cần router và layout của FE-1. CI phải chạy sớm để mọi PR sau đó được kiểm tra theo cùng tiêu chuẩn.`,
  `Sprint 2 tập trung RBAC, API nội dung, upload, email và các trang Tin tức, Sự kiện. Sprint 3 tập trung trang Dự án, form Gia nhập, CMS và xử lý hồ sơ. Sau đó nhóm chạy E2E, đưa nội dung thật lên staging, thử backup hoặc restore và rà checklist bàn giao.`,
  `Một task bắt đầu bằng mục tiêu và Definition of Done rõ ràng. Người phụ trách tạo branch theo mã task, triển khai trong phạm vi nhỏ, tự test và chạy pnpm check. Sau đó mở PR, mô tả thay đổi, bằng chứng kiểm tra và phần chưa kiểm tra. Một người khác review; chỉ merge khi CI xanh và phản hồi đã được xử lý.`,
  `Nếu bị kẹt quá nửa ngày, cập nhật trạng thái Blocked, ghi lý do và báo trong nhóm. Trước mỗi check-in, mọi người tự cập nhật tiến độ. P0 được làm trước P1; task có dependency chưa xong thì không tự mở rộng phạm vi. Không push trực tiếp vào main, vì review và CI là hàng rào chất lượng chung của cả đội.`,
  `Sau buổi kickoff, mỗi người cần chạy được dự án local. Nhóm chốt reviewer cho các task Sprint 1. Thiên, Huỳnh và An Khang mở branch hoặc PR đầu tiên cho DB, Router và CI. APC chốt nội dung và giao diện trang chủ trước ngày 5 tháng 9. Từ đây sheet là nơi cập nhật owner, trạng thái, tiến độ, deadline và blocker.`,
];

function box(slide, x, y, w, h, fill = C.card, radius = 18, line = C.hair) {
  return slide.shapes.add({
    geometry: "roundRect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line, width: line === "none" ? 0 : 1 },
    borderRadius: radius,
  });
}

function text(slide, value, x, y, w, h, opts = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: opts.name,
    position: { left: x, top: y, width: w, height: h },
    fill: opts.fill ?? "none",
    line: { style: "solid", fill: "none", width: 0 },
    borderRadius: opts.radius,
  });
  shape.text = value;
  shape.text.style = {
    fontFamily: opts.fontFamily ?? FONT,
    fontSize: opts.fontSize ?? 22,
    bold: opts.bold ?? false,
    color: opts.color ?? C.ink,
    alignment: opts.align ?? "left",
    verticalAlignment: opts.valign ?? "middle",
  };
  return shape;
}

function line(slide, x, y, w, color = C.hairStrong, weight = 1) {
  return slide.shapes.add({
    geometry: "line",
    position: { left: x, top: y, width: w, height: 0 },
    fill: "none",
    line: { style: "solid", fill: color, width: weight },
  });
}

function circleLabel(slide, label, x, y, d, fill, color = "#FFFFFF", fontSize = 20) {
  const c = slide.shapes.add({
    geometry: "ellipse",
    position: { left: x, top: y, width: d, height: d },
    fill,
    line: { style: "solid", fill: "none", width: 0 },
  });
  c.text = label;
  c.text.style = { fontFamily: FONT, fontSize, bold: true, color, alignment: "center", verticalAlignment: "middle" };
  return c;
}

function addHeader(slide, title, eyebrow = "APC PORTAL • TEAM KICKOFF") {
  text(slide, eyebrow, M, 36, 650, 22, { fontSize: 12, bold: true, color: C.red });
  text(slide, title, M, 68, W - 2 * M, 56, { fontSize: 36, bold: true, color: C.ink, name: "slide-title" });
  line(slide, M, 132, W - 2 * M, C.hair, 1);
}

function addFooter(slide, n) {
  text(slide, "APC PORTAL", M, 684, 200, 18, { fontSize: 11, bold: true, color: C.muted });
  text(slide, String(n).padStart(2, "0"), W - M - 40, 684, 40, 18, { fontSize: 11, bold: true, color: C.muted, align: "right" });
}

function baseSlide(title, eyebrow) {
  const slide = deck.slides.add();
  slide.background.fill = C.bg;
  addHeader(slide, title, eyebrow);
  addFooter(slide, deck.slides.items.length);
  return slide;
}

function addNotes(slide, talk, sources = []) {
  const sourceLines = sources.length ? sources.map((s) => `- ${s}`).join("\n") : "- Nội dung do nhóm dự án cung cấp.";
  const slideIndex = deck.slides.items.length - 1;
  const spoken = SPOKEN[slideIndex] ?? talk;
  slide.speakerNotes.textFrame.setText(`${spoken}\n\n[Sources]\n${sourceLines}`);
  slide.speakerNotes.setVisible(true);
}

function addCode(slide, code, x, y, w, h, label = "CODE TRONG REPO") {
  box(slide, x, y, w, h, C.code, 18, C.code);
  text(slide, label, x + 22, y + 16, w - 44, 20, { fontSize: 11, bold: true, color: "#8FB7FF" });
  text(slide, code, x + 22, y + 46, w - 44, h - 58, { fontSize: 18, fontFamily: MONO, color: C.codeText, valign: "top" });
}

function addList(slide, items, x, y, w, opts = {}) {
  const gap = opts.gap ?? 54;
  const color = opts.color ?? C.ink;
  const bullet = opts.bullet ?? C.red;
  const size = opts.fontSize ?? 22;
  items.forEach((item, i) => {
    circleLabel(slide, String(opts.numbered ? i + 1 : "•"), x, y + i * gap + 2, 30, bullet, "#FFFFFF", opts.numbered ? 15 : 18);
    text(slide, item, x + 46, y + i * gap, w - 46, gap - 6, { fontSize: size, color, bold: opts.bold ?? false });
  });
}

// 1 — Title
{
  const slide = deck.slides.add();
  slide.background.fill = C.navy;
  slide.images.add({ blob: IMG.hero, contentType: "image/png", alt: "Minh họa đội ngũ APC cùng phát triển sản phẩm", fit: "cover", position: { left: 640, top: 0, width: 640, height: 720 } });
  slide.shapes.add({ geometry: "rect", position: { left: 585, top: 0, width: 160, height: 720 }, fill: "linear(90deg, #081A33 0%, #081A33 45%, #081A3300 100%)", line: { style: "solid", fill: "none", width: 0 } });
  slide.images.add({ blob: IMG.logo, contentType: "image/png", alt: "Logo APC", fit: "contain", position: { left: 72, top: 52, width: 190, height: 72 } });
  text(slide, "APC PORTAL", 72, 184, 500, 42, { fontSize: 18, bold: true, color: C.gold });
  text(slide, "Chúng ta xây gì\nvà mỗi người làm gì?", 72, 236, 530, 170, { fontSize: 50, bold: true, color: "#FFFFFF", valign: "top" });
  text(slide, "Team kickoff • 01/09–15/10/2026", 72, 432, 500, 38, { fontSize: 22, color: "#DCEAFB" });
  text(slide, "Hiểu dự án  •  Hiểu công nghệ  •  Bắt đầu đúng việc", 72, 610, 520, 34, { fontSize: 16, color: "#B8C9E2" });
  addNotes(slide, "Mở đầu ngắn: hôm nay chúng ta không học toàn bộ kỹ thuật. Mục tiêu là để mỗi người hiểu sản phẩm, phần mình sở hữu và cách phối hợp với người tiếp theo.", ["imgs/hero-isometric-concept.png", "apps/web/public/assets/home/00-apc-logo.png"]);
}

// 2 — Outcomes
{
  const slide = baseSlide("Buổi kickoff cần chốt bốn việc");
  const items = [
    ["01", "Dự án giải quyết vấn đề gì?"],
    ["02", "Sản phẩm cuối cùng hoạt động ra sao?"],
    ["03", "Tôi sở hữu đầu ra nào?"],
    ["04", "Tôi bắt đầu từ đâu và phối hợp với ai?"],
  ];
  items.forEach(([n, t], i) => {
    const y = 174 + i * 108;
    text(slide, n, 84, y, 92, 70, { fontSize: 42, bold: true, color: i % 2 ? C.blue : C.red });
    text(slide, t, 200, y, 890, 70, { fontSize: 28, bold: true });
    line(slide, 200, y + 78, 920, C.hair, 1);
  });
  addNotes(slide, "Nói rõ kỳ vọng của buổi kickoff. Nếu cuối buổi ai vẫn chưa biết mình làm gì hoặc phải hỏi ai, deck chưa hoàn thành nhiệm vụ.");
}

// 3 — Problem
{
  const slide = baseSlide("Thông tin APC đang nằm ở quá nhiều nơi");
  slide.images.add({ blob: IMG.team, contentType: "image/png", alt: "Sinh viên cùng làm việc", fit: "cover", geometry: "roundRect", borderRadius: 18, position: { left: 730, top: 166, width: 478, height: 430 } });
  addList(slide, ["Fanpage và email", "Google Forms", "UMTOJ", "Website từng sự kiện"], 84, 190, 560, { gap: 72, fontSize: 25 });
  box(slide, 84, 500, 560, 96, C.redPale, 18, C.redPale);
  text(slide, "APC Portal trở thành nguồn thông tin chính thức và tập trung.", 112, 516, 504, 66, { fontSize: 23, bold: true, color: C.redDark });
  addNotes(slide, "Portal không thay thế fanpage hay email. Những kênh đó vẫn dùng để phân phối thông tin, nhưng sẽ dẫn người dùng về một nguồn dữ liệu chính thức.", ["docs/00-project-charter.md — Bối cảnh và tuyên bố vấn đề", "apps/web/public/assets/home/02-apc-students-working.png"]);
}

// 4 — Three areas
{
  const slide = baseSlide("APC Portal có ba khu vực sử dụng");
  slide.images.add({ blob: IMG.productZones, contentType: "image/png", alt: "Ba khu vực công khai, thành viên và quản trị của APC Portal", fit: "contain", position: { left: 72, top: 142, width: 1136, height: 420 } });
  text(slide, "CÔNG KHAI", 82, 552, 300, 26, { fontSize: 13, bold: true, color: C.red, align: "center" });
  text(slide, "Giới thiệu • Tin tức • Sự kiện • Dự án • Gia nhập", 82, 580, 300, 54, { fontSize: 17, color: C.ink, align: "center", valign: "top" });
  text(slide, "THÀNH VIÊN", 490, 552, 300, 26, { fontSize: 13, bold: true, color: C.blue, align: "center" });
  text(slide, "Hồ sơ • Lịch hoạt động • Tài liệu nội bộ", 490, 580, 300, 54, { fontSize: 17, color: C.ink, align: "center", valign: "top" });
  text(slide, "QUẢN TRỊ", 898, 552, 300, 26, { fontSize: 13, bold: true, color: C.gold, align: "center" });
  text(slide, "Nội dung • Tuyển • Thành viên • Quyền", 898, 580, 300, 54, { fontSize: 17, color: C.ink, align: "center", valign: "top" });
  addNotes(slide, "Giải thích đây là ba khu vực của cùng một sản phẩm, không phải ba dự án độc lập. Giai đoạn hiện tại chưa làm hết mọi chức năng của khu vực thành viên.", ["docs/01-prd.md — Tổng quan sản phẩm"]);
}

// 5 — Vision vs phase
{
  const slide = baseSlide("Tài liệu mô tả full MVP; kế hoạch 15/10 chỉ làm một phần");
  box(slide, 72, 174, 520, 414, C.surface, 24, C.surface);
  text(slide, "TẦM NHÌN MVP", 104, 202, 440, 30, { fontSize: 14, bold: true, color: C.blue });
  text(slide, "Portal công khai + thành viên + quản trị", 104, 250, 430, 78, { fontSize: 30, bold: true, valign: "top" });
  addList(slide, ["Hồ sơ và tài liệu thành viên", "Đăng ký, điểm danh sự kiện", "Audit và vòng đời dữ liệu"], 104, 360, 440, { gap: 58, fontSize: 20, bullet: C.blue });
  box(slide, 632, 174, 576, 414, C.redPale, 24, C.redPale);
  text(slide, "01/09–15/10/2026", 664, 202, 480, 30, { fontSize: 14, bold: true, color: C.red });
  text(slide, "Nền tảng + nội dung công khai + tuyển", 664, 250, 486, 78, { fontSize: 30, bold: true, valign: "top" });
  addList(slide, ["Database, auth và phân quyền", "Tin tức, sự kiện, dự án", "Form gia nhập và CMS admin"], 664, 360, 476, { gap: 58, fontSize: 20, bullet: C.red });
  addNotes(slide, "Nhấn mạnh: PRD là tầm nhìn sản phẩm, còn Excel là phạm vi thực thi hiện tại. Không được hiểu rằng nhóm phải hoàn thành toàn bộ 29 user flow trước 15/10.", ["docs/01-prd.md", "docs/05-feature-catalog.md", "APC-Portal-Ke-hoach-cong-viec.xlsx — Bảng nhiệm vụ"]);
}

// 6 — Current state
{
  const slide = baseSlide("Chúng ta không bắt đầu từ số 0");
  slide.images.add({ blob: IMG.homepage, contentType: "image/png", alt: "Ảnh chụp trang chủ APC Portal", fit: "cover", crop: { left: 0, top: 0, right: 0, bottom: 0.86 }, geometry: "roundRect", borderRadius: 18, position: { left: 72, top: 166, width: 598, height: 430 } });
  text(slide, "ĐÃ CÓ", 730, 176, 190, 28, { fontSize: 14, bold: true, color: C.green });
  addList(slide, ["Trang chủ React", "Fastify /health", "PostgreSQL • Mailpit • MinIO", "Lint • test • build cơ bản"], 730, 216, 440, { gap: 56, fontSize: 21, bullet: C.green });
  text(slide, "CẦN XÂY", 730, 462, 190, 28, { fontSize: 14, bold: true, color: C.red });
  text(slide, "Database nghiệp vụ, đăng nhập, API nội dung, CMS và quy trình gia nhập.", 730, 502, 430, 88, { fontSize: 22, bold: true, valign: "top" });
  addNotes(slide, "Cho cả đội cảm giác dự án đã có nền. Trang chủ và môi trường local đã sẵn; phần việc còn lại là biến giao diện tĩnh thành sản phẩm có dữ liệu và nghiệp vụ.", ["README.md — Trạng thái hiện tại", "design-reference/homepage/preview-full.png", "docs/06-architecture.md"]);
}

// 6A — Repository structure
{
  const slide = baseSlide("Repository được tổ chức theo monorepo TypeScript");
  addCode(slide, `apc-web-portal/\n├─ apps/web        React + Vite\n├─ apps/api        Fastify API\n├─ packages/       Phần dùng chung khi thật sự cần\n├─ docs/           Yêu cầu và luồng nghiệp vụ\n├─ design-reference/\n└─ compose.yaml    Hạ tầng local`, 72, 174, 610, 390, "CẤU TRÚC HIỆN TẠI");
  text(slide, "apps/web", 748, 188, 170, 34, { fontSize: 26, bold: true, color: C.blue });
  text(slide, "Trang, component, hook và giao tiếp API phía trình duyệt.", 748, 230, 410, 64, { fontSize: 20, color: C.muted, valign: "top" });
  text(slide, "apps/api", 748, 322, 170, 34, { fontSize: 26, bold: true, color: C.red });
  text(slide, "HTTP API, auth, phân quyền và nghiệp vụ phía server.", 748, 364, 410, 64, { fontSize: 20, color: C.muted, valign: "top" });
  text(slide, "docs", 748, 456, 170, 34, { fontSize: 26, bold: true, color: C.gold });
  text(slide, "Nguồn chuẩn để biết chức năng phải chạy thế nào và ai có quyền gì.", 748, 498, 410, 74, { fontSize: 20, color: C.muted, valign: "top" });
  addNotes(slide, "Giới thiệu nhanh vị trí code. Thành viên Frontend làm chủ yếu trong apps/web, Backend trong apps/api; trước khi làm nghiệp vụ phải đọc tài liệu liên quan trong docs.", ["docs/06-architecture.md — Ranh giới mã nguồn", "pnpm-workspace.yaml"]);
}

// 7 — Outcome
{
  const slide = baseSlide("Đến 15/10, sản phẩm phải demo được một vòng hoàn chỉnh");
  text(slide, "Một sinh viên có thể…", 72, 186, 470, 46, { fontSize: 30, bold: true, color: C.blue });
  addList(slide, ["Xem tin tức, sự kiện và dự án", "Gửi đơn Gia nhập APC", "Nhận xác nhận và kết quả"], 72, 254, 500, { gap: 68, fontSize: 23, bullet: C.blue });
  text(slide, "Một người quản trị có thể…", 672, 186, 510, 46, { fontSize: 30, bold: true, color: C.red });
  addList(slide, ["Đăng nhập đúng quyền", "Quản lý nội dung và hồ sơ", "Upload file, gửi email, kiểm tra staging"], 672, 254, 510, { gap: 68, fontSize: 23, bullet: C.red });
  box(slide, 72, 520, 1112, 78, C.navy, 20, C.navy);
  text(slide, "Điều kiện demo: dữ liệu lưu thật • quyền đúng • upload/email chạy • CI xanh • có staging", 104, 536, 1048, 46, { fontSize: 21, bold: true, color: "#FFFFFF", align: "center" });
  addNotes(slide, "Chuyển từ danh sách chức năng sang kết quả người dùng. Đây là cách để mọi thành viên hiểu vì sao phần việc của mình tồn tại.", ["APC-Portal-Ke-hoach-cong-viec.xlsx — Bảng nhiệm vụ", "docs/08-handover.md"]);
}

// 8 — Technology opener
{
  const slide = deck.slides.add();
  slide.background.fill = C.bg;
  slide.images.add({ blob: IMG.tech, contentType: "image/png", alt: "Minh họa luồng từ giao diện đến máy chủ, dữ liệu và dịch vụ hỗ trợ", fit: "cover", position: { left: 470, top: 0, width: 810, height: 720 } });
  slide.shapes.add({ geometry: "rect", position: { left: 400, top: 0, width: 210, height: 720 }, fill: "linear(90deg, #FAF8F5 0%, #FAF8F5 45%, #FAF8F500 100%)", line: { style: "solid", fill: "none", width: 0 } });
  text(slide, "PHẦN 02", 72, 122, 240, 24, { fontSize: 13, bold: true, color: C.red });
  text(slide, "Công nghệ đang dùng\ntrong APC Portal", 72, 174, 440, 150, { fontSize: 43, bold: true, color: C.ink, valign: "top" });
  text(slide, "Stack hiện có, phần sẽ bổ sung và cách các thành phần nối với nhau.", 72, 360, 420, 110, { fontSize: 22, color: C.muted, valign: "top" });
  addFooter(slide, deck.slides.items.length);
  addNotes(slide, "Dùng slide này làm điểm nghỉ. Phần tiếp theo không cố dạy công nghệ từ đầu, mà giải thích mỗi công nghệ nằm ở đâu trong luồng sản phẩm.", ["outputs/apc-portal-kickoff/assets/apc-portal-tech-illustration.png — generated with built-in image_gen"]);
}

// 9 — System flow
{
  const slide = baseSlide("Luồng xử lý cơ bản của một request");
  slide.images.add({ blob: IMG.requestFlow, contentType: "image/png", alt: "Luồng từ người dùng qua giao diện, API, database, file và email", fit: "contain", position: { left: 72, top: 142, width: 1136, height: 438 } });
  text(slide, "1. Người dùng", 72, 576, 230, 30, { fontSize: 17, bold: true, color: C.ink, align: "center" });
  text(slide, "2. React / Vite", 320, 576, 230, 30, { fontSize: 17, bold: true, color: C.blue, align: "center" });
  text(slide, "3. Fastify / Zod", 568, 576, 230, 30, { fontSize: 17, bold: true, color: C.red, align: "center" });
  text(slide, "4. PostgreSQL", 816, 576, 230, 30, { fontSize: 17, bold: true, color: C.blueDark, align: "center" });
  text(slide, "MinIO + Mailpit", 1026, 576, 176, 30, { fontSize: 15, bold: true, color: C.gold, align: "center" });
  addNotes(slide, "Đi từ trái sang phải. Frontend nhận thao tác, Backend kiểm tra quy tắc, Database lưu dữ liệu. File và email là hai nhánh hỗ trợ.", ["docs/06-architecture.md"]);
}

// 9A — Installed stack
{
  const slide = baseSlide("Stack đang được cài trong repository");
  const rows = [
    ["Runtime", "Node.js 22", "Chạy API, scripts và tooling"],
    ["Workspace", "pnpm 10", "Quản lý web + api trong cùng repo"],
    ["Frontend", "React 19 • Vite 8 • Tailwind 3", "Giao diện và build web"],
    ["Backend", "Fastify 5 • Zod 4 • pg 8", "API, validate và kết nối PostgreSQL"],
    ["Quality", "Vitest 4 • Oxlint", "Test và lint tự động"],
    ["Local infra", "PostgreSQL 17 • Mailpit • MinIO", "Dữ liệu, email thử và file"],
  ];
  rows.forEach((r, i) => {
    const y = 164 + i * 72;
    text(slide, r[0], 82, y, 180, 44, { fontSize: 16, bold: true, color: i % 2 ? C.red : C.blue });
    text(slide, r[1], 270, y, 380, 44, { fontSize: 22, bold: true });
    text(slide, r[2], 690, y, 470, 44, { fontSize: 18, color: C.muted });
    line(slide, 270, y + 52, 890, C.hair, 1);
  });
  box(slide, 72, 602, 1136, 48, C.surface, 14, C.surface);
  text(slide, "Chưa cài/chưa chốt: React Router, ORM (Prisma hoặc Drizzle), session/JWT và thư viện hash mật khẩu.", 94, 609, 1092, 34, { fontSize: 17, bold: true, color: C.ink, align: "center" });
  addNotes(slide, "Đây là danh sách theo package.json và compose hiện tại. Phân biệt rõ công nghệ đã cài với công nghệ nằm trong kế hoạch Sprint 1.", ["package.json", "apps/web/package.json", "apps/api/package.json", "compose.yaml"]);
}

// 10 — Frontend + React
{
  const slide = baseSlide("Frontend: React, TypeScript, Vite và Tailwind");
  text(slide, "React", 72, 180, 260, 42, { fontSize: 30, bold: true, color: C.blue });
  text(slide, "Chia trang thành component", 72, 226, 420, 34, { fontSize: 21, color: C.muted });
  text(slide, "TypeScript", 72, 292, 260, 42, { fontSize: 30, bold: true, color: C.blue });
  text(slide, "Giảm lỗi khi truyền dữ liệu", 72, 338, 420, 34, { fontSize: 21, color: C.muted });
  text(slide, "Vite + Tailwind", 72, 404, 300, 42, { fontSize: 30, bold: true, color: C.blue });
  text(slide, "Chạy nhanh và giữ giao diện nhất quán", 72, 450, 440, 62, { fontSize: 21, color: C.muted, valign: "top" });
  addCode(slide, `export function HomePage() {\n  return (\n    <main>\n      <HeroSection />\n      <NewsSection />\n    </main>\n  )\n}`, 580, 174, 628, 392, "RÚT GỌN TỪ HomePage.tsx");
  text(slide, "Mỗi section là một phần việc có thể phát triển và kiểm tra riêng.", 580, 580, 628, 38, { fontSize: 18, bold: true, color: C.blue });
  addNotes(slide, "Không cần giải thích JSX sâu. Chỉ chỉ ra rằng trang lớn được ghép từ phần nhỏ, nhờ vậy FE-2 hay FE-3 có thể sở hữu một nhóm màn hình.", ["apps/web/src/pages/home/HomePage.tsx", "apps/web/package.json"]);
}

// 10A — Frontend routes
{
  const slide = baseSlide("Frontend sẽ mở rộng từ một trang chủ sang nhiều route");
  const routes = [
    ["/", "Trang chủ", "Đã có"],
    ["/tin-tuc", "Danh sách và chi tiết tin", "FE-2"],
    ["/su-kien", "Danh sách và chi tiết sự kiện", "FE-2"],
    ["/du-an", "Danh sách và chi tiết dự án", "FE-3"],
    ["/gia-nhap", "Form ứng tuyển", "FE-3"],
    ["/login", "Đăng nhập", "FE-1"],
    ["/admin", "CMS và duyệt hồ sơ", "FE-4"],
  ];
  routes.forEach((r, i) => {
    const col = i < 4 ? 0 : 1;
    const row = col === 0 ? i : i - 4;
    const x = col === 0 ? 72 : 650;
    const y = 174 + row * 100;
    text(slide, r[0], x, y, 170, 38, { fontSize: 21, fontFamily: MONO, bold: true, color: col === 0 ? C.blue : C.red });
    text(slide, r[1], x + 190, y, 290, 38, { fontSize: 20, bold: true });
    text(slide, r[2], x + 190, y + 38, 290, 24, { fontSize: 14, color: C.muted });
    line(slide, x, y + 74, 480, C.hair, 1);
  });
  box(slide, 650, 488, 506, 96, C.bluePale, 18, C.bluePale);
  text(slide, "FE-1 tạo router và layout trước; các trang còn lại mới có khung để tích hợp.", 676, 506, 454, 60, { fontSize: 20, bold: true, color: C.blueDark, align: "center" });
  addNotes(slide, "Dùng route để giải thích dependency Frontend. FE-2 và FE-3 có thể chuẩn bị UI, nhưng router/layout chung do FE-1 mở đường.", ["APC-Portal-Ke-hoach-cong-viec.xlsx — FE1 đến FE7", "docs/04-sitemap.md"]);
}

// 11 — Backend + Fastify
{
  const slide = baseSlide("Backend: Fastify nhận request và trả JSON");
  addCode(slide, `const app = Fastify()\n\napp.get('/health', async () => ({\n  status: 'ok',\n  service: 'apc-api',\n}))`, 72, 174, 600, 360, "CODE HIỆN CÓ • app.ts");
  text(slide, "GET", 730, 184, 110, 42, { fontSize: 30, bold: true, color: C.red });
  text(slide, "Hành động đọc dữ liệu", 850, 184, 310, 42, { fontSize: 21, color: C.muted });
  text(slide, "/health", 730, 258, 180, 42, { fontSize: 30, bold: true, color: C.red });
  text(slide, "Địa chỉ API", 930, 258, 230, 42, { fontSize: 21, color: C.muted });
  text(slide, "JSON", 730, 332, 110, 42, { fontSize: 30, bold: true, color: C.red });
  text(slide, "Kết quả trả về cho Frontend", 850, 332, 310, 42, { fontSize: 21, color: C.muted });
  box(slide, 730, 432, 430, 102, C.redPale, 18, C.redPale);
  text(slide, "Frontend có thể ẩn nút, nhưng Backend vẫn phải kiểm tra quyền.", 756, 448, 378, 70, { fontSize: 21, bold: true, color: C.redDark });
  addNotes(slide, "Dùng endpoint health đang có làm ví dụ. Sau này news, events hay applications cũng là các endpoint với dữ liệu và quyền phức tạp hơn.", ["apps/api/src/app.ts", "apps/api/package.json"]);
}

// 11A — Backend modules and entities
{
  const slide = baseSlide("Database Sprint 1 cần sáu nhóm dữ liệu nền");
  const entities = [
    { x: 72, y: 176, t: "user", d: "Tài khoản và hồ sơ cơ bản", c: C.redPale, a: C.red },
    { x: 450, y: 176, t: "role", d: "Vai trò và quyền truy cập", c: C.goldPale, a: C.gold },
    { x: 828, y: 176, t: "news", d: "Tin tức và trạng thái công bố", c: C.bluePale, a: C.blue },
    { x: 72, y: 366, t: "event", d: "Ngày, địa điểm và chuyên mục", c: C.bluePale, a: C.blue },
    { x: 450, y: 366, t: "project", d: "Mô tả, công nghệ và hình ảnh", c: C.redPale, a: C.red },
    { x: 828, y: 366, t: "membership_application", d: "Đơn gia nhập và trạng thái xử lý", c: C.goldPale, a: C.gold },
  ];
  entities.forEach((e) => {
    box(slide, e.x, e.y, 332, 150, e.c, 20, e.c);
    text(slide, e.t, e.x + 24, e.y + 22, 284, 40, { fontSize: e.t.length > 15 ? 21 : 27, fontFamily: MONO, bold: true, color: e.a });
    text(slide, e.d, e.x + 24, e.y + 78, 284, 50, { fontSize: 18, color: C.muted, valign: "top" });
  });
  text(slide, "ORM/migration vẫn cần chốt giữa Prisma và Drizzle trước khi BE-1 triển khai.", 72, 566, 1136, 34, { fontSize: 18, bold: true, color: C.redDark, align: "center" });
  addNotes(slide, "Đây là schema mức khái niệm trong kế hoạch Sprint 1, chưa phải ERD cuối. BE-1 phải chốt ORM, quan hệ và migration rồi chia sẻ ERD ngắn cho nhóm.", ["APC-Portal-Ke-hoach-cong-viec.xlsx — BE1", "docs/01-prd.md — Mô hình dữ liệu nghiệp vụ"]);
}

// 12 — Zod
{
  const slide = baseSlide("Zod validate config và dữ liệu đầu vào");
  addCode(slide, `const environmentSchema = z.object({\n  API_PORT: z.coerce.number()\n    .int().positive().default(3000),\n\n  DATABASE_URL: z.string(),\n})`, 72, 174, 650, 372, "RÚT GỌN TỪ config.ts");
  addList(slide, ["Cổng API phải là số nguyên dương", "Thiếu giá trị thì dùng mặc định 3000", "Cấu hình sai: dừng sớm và báo lỗi rõ"], 782, 210, 400, { gap: 92, fontSize: 22, bullet: C.gold });
  box(slide, 782, 504, 400, 80, C.goldPale, 18, C.goldPale);
  text(slide, "Hiện dùng cho environment; sẽ tái dùng cho request schema.", 806, 520, 352, 48, { fontSize: 18, bold: true, color: "#6B4500", align: "center" });
  addNotes(slide, "Liên hệ Zod với form và API: dữ liệu phải được kiểm tra ở ranh giới. Frontend kiểm tra để hỗ trợ người dùng; Backend kiểm tra để bảo vệ hệ thống.", ["apps/api/src/config.ts", "apps/api/package.json"]);
}

// 12A — Authentication and authorization
{
  const slide = baseSlide("Đăng nhập và phân quyền là hai bước khác nhau");
  const steps = [
    { x: 72, t: "1. Login", d: "Email/mật khẩu gửi tới POST /auth/login", c: C.blue },
    { x: 366, t: "2. Xác thực", d: "Verify mật khẩu đã hash; tạo session hoặc JWT", c: C.red },
    { x: 660, t: "3. Nhận diện", d: "/auth/me trả user và vai trò hiện tại", c: C.gold },
    { x: 954, t: "4. Kiểm quyền", d: "Middleware cho phép hoặc trả 403", c: C.green },
  ];
  const shapes = steps.map((s) => {
    const b = box(slide, s.x, 206, 250, 196, C.card, 20, C.hair);
    text(slide, s.t, s.x + 22, 232, 206, 38, { fontSize: 22, bold: true, color: s.c });
    text(slide, s.d, s.x + 22, 292, 206, 84, { fontSize: 18, color: C.muted, valign: "top" });
    return b;
  });
  for (let i = 0; i < shapes.length - 1; i++) slide.shapes.connect(shapes[i], shapes[i + 1], { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.hairStrong, width: 2 }, tail: { type: "triangle", width: "sm", length: "sm" } });
  box(slide, 72, 462, 1132, 112, C.navy, 18, C.navy);
  text(slide, "Authentication: bạn là ai?     •     Authorization/RBAC: bạn được làm gì?", 96, 480, 1084, 72, { fontSize: 23, bold: true, color: "#FFFFFF", align: "center" });
  addNotes(slide, "Giải thích rõ auth và RBAC để FE-1, FE-4 và BE-2 dùng chung khái niệm. FE có route guard để điều hướng; API vẫn là nơi quyết định cuối cùng.", ["APC-Portal-Ke-hoach-cong-viec.xlsx — BE3, BE4, FE2", "docs/02-roles-permissions.md"]);
}

// 13 — Data services
{
  const slide = baseSlide("PostgreSQL, MinIO và Mailpit có ba mục đích riêng");
  const services = [
    { x: 72, c: C.blue, p: C.bluePale, n: "DB", t: "PostgreSQL", d: "User, vai trò, tin tức, sự kiện, hồ sơ" },
    { x: 450, c: C.red, p: C.redPale, n: "FILE", t: "MinIO", d: "Ảnh bài viết, ảnh dự án và tệp upload" },
    { x: 828, c: C.gold, p: C.goldPale, n: "MAIL", t: "Mailpit", d: "Nhận email thử nghiệm trên máy local" },
  ];
  services.forEach((s) => {
    box(slide, s.x, 188, 332, 360, s.p, 24, s.p);
    circleLabel(slide, s.n, s.x + 28, 216, 72, s.c, "#FFFFFF", s.n.length > 2 ? 15 : 22);
    text(slide, s.t, s.x + 28, 312, 272, 44, { fontSize: 29, bold: true });
    text(slide, s.d, s.x + 28, 378, 272, 112, { fontSize: 21, color: C.muted, valign: "top" });
  });
  text(slide, "Mailpit không gửi email thật ra Internet.", 72, 580, 1112, 32, { fontSize: 18, bold: true, color: C.muted, align: "center" });
  addNotes(slide, "Giải thích bằng loại dữ liệu. PostgreSQL giữ dữ liệu có quan hệ, MinIO giữ file lớn, Mailpit chỉ là hộp thư thử nghiệm cho môi trường local.", ["compose.yaml", "docs/07-local-development.md"]);
}

// 13A — Planned API surface
{
  const slide = baseSlide("Các API chính trong kế hoạch hiện tại");
  const groups = [
    ["/auth", "login • logout • me", "BE-2", C.red],
    ["/news", "list • detail • create • update • delete", "BE-3", C.blue],
    ["/events", "list • detail • CRUD", "BE-3", C.gold],
    ["/projects", "list • detail • CRUD", "BE-3", C.blue],
    ["/upload", "multipart → MinIO → URL/key", "BE-1", C.red],
    ["/applications", "submit • list • approve • reject", "BE-2", C.gold],
  ];
  groups.forEach((g, i) => {
    const y = 166 + i * 72;
    text(slide, g[0], 82, y, 210, 40, { fontSize: 22, fontFamily: MONO, bold: true, color: g[3] });
    text(slide, g[1], 310, y, 590, 40, { fontSize: 20, color: C.ink });
    text(slide, g[2], 996, y, 140, 40, { fontSize: 18, bold: true, color: C.muted, align: "right" });
    line(slide, 310, y + 50, 826, C.hair, 1);
  });
  box(slide, 72, 612, 1136, 42, C.redPale, 12, C.redPale);
  text(slide, "CRUD = Create • Read • Update • Delete. Các route ghi dữ liệu phải kiểm tra quyền ở Backend.", 90, 616, 1100, 34, { fontSize: 16, bold: true, color: C.redDark, align: "center" });
  addNotes(slide, "Đây là surface API lấy từ Excel, chưa phải hợp đồng OpenAPI cuối. BE và FE cần chốt field, trạng thái lỗi và response trước khi tích hợp.", ["APC-Portal-Ke-hoach-cong-viec.xlsx — BE3 đến BE10"]);
}

// 14 — Why Docker
{
  const slide = baseSlide("Vì sao local chỉ đưa hạ tầng vào Docker?");
  box(slide, 72, 178, 520, 398, C.bluePale, 24, C.bluePale);
  text(slide, "ĐƯA VÀO DOCKER", 104, 206, 430, 26, { fontSize: 14, bold: true, color: C.blue });
  text(slide, "PostgreSQL\nMailpit\nMinIO", 104, 264, 420, 156, { fontSize: 34, bold: true, color: C.blueDark, valign: "top" });
  text(slide, "Cần đúng phiên bản, port, volume và health check trên mọi máy.", 104, 456, 420, 82, { fontSize: 21, color: C.muted, valign: "top" });
  box(slide, 632, 178, 576, 398, C.redPale, 24, C.redPale);
  text(slide, "CHẠY TRỰC TIẾP", 664, 206, 450, 26, { fontSize: 14, bold: true, color: C.red });
  text(slide, "React/Vite\nFastify", 664, 264, 470, 112, { fontSize: 34, bold: true, color: C.redDark, valign: "top" });
  text(slide, "Thay đổi liên tục; chạy ngoài container giúp hot reload, debug và đọc log đơn giản hơn.", 664, 414, 480, 124, { fontSize: 21, color: C.muted, valign: "top" });
  addNotes(slide, "Nói rõ Docker hoàn toàn có thể chạy web và API. Cấu hình hiện tại chọn tách code ra ngoài container để phát triển local nhanh; đây là suy luận từ cấu hình, chưa phải ADR chính thức.", ["package.json", "compose.yaml", "scripts/compose.mjs", "docs/06-architecture.md"]);
}

// 15 — Local architecture
{
  const slide = baseSlide("Cách dự án đang chạy trên máy thành viên");
  box(slide, 72, 172, 1136, 424, C.card, 24, C.hairStrong);
  text(slide, "MÁY CỦA THÀNH VIÊN", 100, 190, 400, 24, { fontSize: 13, bold: true, color: C.muted });
  const web = box(slide, 118, 248, 246, 118, C.bluePale, 20, C.bluePale);
  text(slide, "React + Vite", 142, 270, 198, 34, { fontSize: 25, bold: true, color: C.blueDark, align: "center" });
  text(slide, ":5173", 142, 314, 198, 26, { fontSize: 17, color: C.muted, align: "center" });
  const api = box(slide, 430, 248, 246, 118, C.redPale, 20, C.redPale);
  text(slide, "Fastify API", 454, 270, 198, 34, { fontSize: 25, bold: true, color: C.redDark, align: "center" });
  text(slide, ":3000", 454, 314, 198, 26, { fontSize: 17, color: C.muted, align: "center" });
  box(slide, 742, 218, 414, 304, C.navy, 22, C.navy);
  text(slide, "DOCKER COMPOSE", 770, 240, 350, 28, { fontSize: 14, bold: true, color: C.gold, align: "center" });
  const db = box(slide, 774, 300, 156, 86, C.blueDark, 16, C.blueDark);
  text(slide, "PostgreSQL\n:5432", 790, 314, 124, 58, { fontSize: 18, bold: true, color: "#FFFFFF", align: "center" });
  const mail = box(slide, 968, 300, 156, 86, C.gold, 16, C.gold);
  text(slide, "Mailpit\n:8025", 984, 314, 124, 58, { fontSize: 18, bold: true, color: C.ink, align: "center" });
  const minio = box(slide, 870, 416, 156, 86, C.red, 16, C.red);
  text(slide, "MinIO\n:9000", 886, 430, 124, 58, { fontSize: 18, bold: true, color: "#FFFFFF", align: "center" });
  slide.shapes.connect(web, api, { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.hairStrong, width: 2 }, tail: { type: "triangle", width: "sm", length: "sm" } });
  slide.shapes.connect(api, db, { kind: "elbow", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.hairStrong, width: 2 }, tail: { type: "triangle", width: "sm", length: "sm" } });
  slide.shapes.connect(api, mail, { kind: "elbow", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.hairStrong, width: 2 }, tail: { type: "triangle", width: "sm", length: "sm" } });
  slide.shapes.connect(api, minio, { kind: "elbow", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.hairStrong, width: 2 }, tail: { type: "triangle", width: "sm", length: "sm" } });
  addNotes(slide, "Đây là slide giải thích riêng về Docker. Web và API chạy bằng Node trên máy; Docker Compose chỉ giữ các dịch vụ nền. Khi lên staging/production, web và API có thể được container hóa sau.", ["package.json", "compose.yaml", "docs/07-local-development.md"]);
}

// 16 — Compose code
{
  const slide = baseSlide("Cấu hình PostgreSQL trong Docker Compose");
  addCode(slide, `services:\n  postgres:\n    image: postgres:17-alpine\n    ports:\n      - "127.0.0.1:5432:5432"\n    volumes:\n      - postgres_data:/var/lib/postgresql/data`, 72, 170, 650, 420, "CODE HIỆN CÓ • compose.yaml");
  text(slide, "image", 786, 190, 140, 36, { fontSize: 27, bold: true, color: C.blue });
  text(slide, "Phiên bản môi trường", 942, 190, 230, 36, { fontSize: 20, color: C.muted });
  text(slide, "ports", 786, 284, 140, 36, { fontSize: 27, bold: true, color: C.red });
  text(slide, "Cầu nối vào container", 942, 284, 230, 56, { fontSize: 20, color: C.muted, valign: "top" });
  text(slide, "volume", 786, 394, 140, 36, { fontSize: 27, bold: true, color: C.gold });
  text(slide, "Giữ dữ liệu khi container tắt", 942, 394, 230, 64, { fontSize: 20, color: C.muted, valign: "top" });
  box(slide, 786, 500, 386, 90, C.surface, 18, C.surface);
  text(slide, "pnpm infra:up  →  bật hạ tầng", 810, 516, 338, 56, { fontSize: 21, bold: true, color: C.ink, align: "center" });
  addNotes(slide, "Không đọc từng ký tự YAML. Chỉ giải thích image, port và volume. Nhấn mạnh 127.0.0.1 nghĩa là dịch vụ local không mở công khai ra mạng.", ["compose.yaml", "package.json"]);
}

// 16A — Local development commands
{
  const slide = baseSlide("Quy trình chạy dự án trên máy local");
  addCode(slide, `corepack enable\npnpm install\nCopy-Item .env.example .env\npnpm infra:up\npnpm dev`, 72, 174, 570, 340, "CÀI LẦN ĐẦU");
  addCode(slide, `pnpm infra:up\npnpm dev\n\n# Trước khi mở PR\npnpm check\n\n# Khi kết thúc\npnpm infra:down`, 684, 174, 524, 340, "HẰNG NGÀY");
  box(slide, 72, 548, 1136, 66, C.goldPale, 16, C.goldPale);
  text(slide, "infra:down không xóa volume. Không dùng down -v nếu chưa chủ động muốn xóa dữ liệu local.", 94, 560, 1092, 42, { fontSize: 18, bold: true, color: "#6B4500", align: "center" });
  addNotes(slide, "Dừng ở các lệnh cần nhớ. URL local chi tiết nằm trong README và docs/07. Mỗi thành viên nên tự chạy quickstart trên máy mình.", ["README.md", "docs/07-local-development.md", "package.json"]);
}

// 16B — Open technical decisions
{
  const slide = baseSlide("Bốn quyết định kỹ thuật cần chốt trước khi đi sâu");
  const decisions = [
    ["ORM/migration", "Prisma hay Drizzle", "BE-1 + Tech Lead"],
    ["Phiên đăng nhập", "Session cookie hay JWT", "BE-2 + FE-1"],
    ["Hash mật khẩu", "Argon2 hay bcrypt", "BE-2"],
    ["Staging", "VPS/cloud, domain, TLS và cách build image", "OP-1 + Tech Lead"],
  ];
  decisions.forEach((d, i) => {
    const y = 172 + i * 100;
    text(slide, String(i + 1).padStart(2, "0"), 84, y, 70, 48, { fontSize: 30, bold: true, color: i % 2 ? C.blue : C.red });
    text(slide, d[0], 180, y, 250, 38, { fontSize: 23, bold: true });
    text(slide, d[1], 450, y, 440, 38, { fontSize: 20, color: C.ink });
    text(slide, d[2], 930, y, 240, 38, { fontSize: 17, bold: true, color: C.muted, align: "right" });
    line(slide, 180, y + 62, 990, C.hair, 1);
  });
  box(slide, 72, 588, 1136, 56, C.redPale, 14, C.redPale);
  text(slide, "Các quyết định trên cần được ghi bằng issue hoặc ADR trước khi triển khai phần liên quan.", 94, 596, 1092, 40, { fontSize: 18, bold: true, color: C.redDark, align: "center" });
  addNotes(slide, "Đây là các quyết định còn mở được ghi trong Architecture và kế hoạch. Chốt sớm để tránh BE và FE triển khai theo hai giả định khác nhau.", ["docs/06-architecture.md — Quyết định còn mở", "APC-Portal-Ke-hoach-cong-viec.xlsx"]);
}

// 17 — CI
{
  const slide = baseSlide("Mỗi PR tự chạy lint, type-check, test và build");
  addCode(slide, `- name: Verify repository\n  run: pnpm check\n\n"check": "pnpm lint &&\n          pnpm typecheck &&\n          pnpm test &&\n          pnpm build"`, 72, 174, 610, 390, "ci.yml + package.json");
  const stages = [
    { y: 182, n: "1", t: "Lint", d: "Quy ước và lỗi code" },
    { y: 278, n: "2", t: "Type-check", d: "Kiểu dữ liệu" },
    { y: 374, n: "3", t: "Test", d: "Hành vi quan trọng" },
    { y: 470, n: "4", t: "Build", d: "Có thể đóng gói" },
  ];
  stages.forEach((s, i) => {
    circleLabel(slide, s.n, 754, s.y, 44, i === stages.length - 1 ? C.green : C.blue, "#FFFFFF", 18);
    text(slide, s.t, 820, s.y - 2, 170, 34, { fontSize: 24, bold: true });
    text(slide, s.d, 990, s.y - 2, 200, 34, { fontSize: 18, color: C.muted });
    if (i < stages.length - 1) line(slide, 776, s.y + 56, 0, C.hairStrong, 2);
  });
  addNotes(slide, "CI không thay thế review, nhưng giúp review tập trung vào logic thay vì lỗi cơ bản. PR đỏ thì chưa merge.", [".github/workflows/ci.yml", "package.json", "CONTRIBUTING.md"]);
}

// 18 — News flow
{
  const slide = baseSlide("Ví dụ: luồng dữ liệu của trang Tin tức");
  text(slide, "VÍ DỤ MINH HỌA — route chưa được triển khai", 72, 152, 760, 24, { fontSize: 12, bold: true, color: C.red });
  const nodes = [
    { x: 72, c: C.blue, code: "FE-2", title: "Gọi /news", sub: "Hiển thị danh sách" },
    { x: 350, c: C.red, code: "BE-3", title: "Xử lý API", sub: "Kiểm tra và trả JSON" },
    { x: 628, c: C.blueDark, code: "BE-1", title: "Schema news", sub: "Lưu dữ liệu đúng cấu trúc" },
    { x: 906, c: C.gold, code: "OP-2", title: "Kiểm thử", sub: "Loading • lỗi • kết quả" },
  ];
  const shapes = nodes.map((n) => {
    const b = box(slide, n.x, 238, 230, 190, C.card, 22, C.hair);
    circleLabel(slide, n.code, n.x + 22, 260, 58, n.c, "#FFFFFF", 15);
    text(slide, n.title, n.x + 22, 336, 186, 34, { fontSize: 23, bold: true });
    text(slide, n.sub, n.x + 22, 378, 186, 42, { fontSize: 17, color: C.muted, valign: "top" });
    return b;
  });
  for (let i = 0; i < shapes.length - 1; i++) {
    slide.shapes.connect(shapes[i], shapes[i + 1], { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.hairStrong, width: 2 }, tail: { type: "triangle", width: "sm", length: "sm" } });
  }
  box(slide, 72, 486, 1064, 82, C.navy, 18, C.navy);
  text(slide, `fetch('/news')    →    app.get('/news')    →    SELECT ... FROM news`, 96, 503, 1016, 48, { fontSize: 20, fontFamily: MONO, color: "#FFFFFF", align: "center" });
  addNotes(slide, "Dùng ví dụ tin tức để nối phần công nghệ với phân công. FE có thể dựng giao diện bằng dữ liệu mẫu, nhưng tính năng chỉ xong khi API, database và kiểm thử cùng hoàn tất.", ["APC-Portal-Ke-hoach-cong-viec.xlsx — BE1, BE5, FE3, IN4", "Code trên slide là minh họa tương lai, không phải code hiện có"]);
}

// 18A — Recruitment flow
{
  const slide = baseSlide("Luồng Gia nhập APC nối Frontend, Backend, email và CMS");
  const steps = [
    { x: 72, t: "1. Điền form", d: "FE-3 validate từng trường", c: C.blue },
    { x: 300, t: "2. Nộp đơn", d: "POST /applications", c: C.red },
    { x: 528, t: "3. Lưu hồ sơ", d: "BE-2 + PostgreSQL", c: C.blueDark },
    { x: 756, t: "4. Gửi email", d: "Mailpit khi chạy local", c: C.gold },
    { x: 984, t: "5. Duyệt", d: "FE-4 CMS approve/reject", c: C.green },
  ];
  const shapes = steps.map((s) => {
    const b = box(slide, s.x, 214, 196, 188, C.card, 20, C.hair);
    text(slide, s.t, s.x + 18, 238, 160, 38, { fontSize: 20, bold: true, color: s.c, align: "center" });
    text(slide, s.d, s.x + 18, 302, 160, 70, { fontSize: 17, color: C.muted, align: "center", valign: "top" });
    return b;
  });
  for (let i = 0; i < shapes.length - 1; i++) slide.shapes.connect(shapes[i], shapes[i + 1], { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.hairStrong, width: 2 }, tail: { type: "triangle", width: "sm", length: "sm" } });
  box(slide, 72, 472, 1136, 98, C.surface, 18, C.surface);
  text(slide, "BE-10 phụ thuộc RBAC (BE-4) và email (BE-9); FE-6 chỉ hoàn tất khi API submit chạy ổn định.", 98, 490, 1084, 62, { fontSize: 20, bold: true, color: C.ink, align: "center" });
  addNotes(slide, "Dùng luồng này để giải thích dependency có ý nghĩa nghiệp vụ, không chỉ là mã task. Đây là một trong các vòng demo chính vào cuối giai đoạn.", ["APC-Portal-Ke-hoach-cong-viec.xlsx — BE9, BE10, FE6, FE7", "docs/03-user-flows.md — Luồng Gia nhập APC"]);
}

// 19 — Team map
{
  const slide = baseSlide("Chín thành viên, ba nhóm trách nhiệm");
  const lanes = [
    { y: 176, title: "BACKEND", color: C.red, pale: C.redPale, people: ["Thiên • BE-1", "Minh • BE-2", "Khương • BE-3"] },
    { y: 310, title: "FRONTEND", color: C.blue, pale: C.bluePale, people: ["Huỳnh • FE-1", "Gia Bảo • FE-2", "Đăng Nghĩa • FE-3", "Hoàn Phúc • FE-4"] },
    { y: 444, title: "HẠ TẦNG / QA", color: C.gold, pale: C.goldPale, people: ["An Khang • OP-1", "Tiến Bảo • OP-2"] },
  ];
  lanes.forEach((l) => {
    box(slide, 72, l.y, 1136, 104, l.pale, 20, l.pale);
    text(slide, l.title, 96, l.y + 22, 190, 58, { fontSize: 17, bold: true, color: l.color });
    const start = 306;
    const width = (850 / l.people.length);
    l.people.forEach((p, i) => text(slide, p, start + i * width, l.y + 22, width - 10, 58, { fontSize: l.people.length === 4 ? 18 : 20, bold: true, color: C.ink, align: "center" }));
  });
  addNotes(slide, "Giới thiệu tên theo nhóm trước, chưa đi vào từng task. Mỗi mã là một vùng trách nhiệm; không chỉ là chức danh.", ["Danh sách thành viên do người dùng cung cấp", "APC-Portal-Ke-hoach-cong-viec.xlsx — Thành viên"]);
}

// 20 — Backend owners
{
  const slide = baseSlide("Phân công Backend");
  const rows = [
    { code: "BE-1", name: "Phạm Đăng Hoàng Thiên", own: "DB • Seed • Upload", tech: "PostgreSQL • ORM • MinIO", tasks: "BE1 • BE2 • BE8" },
    { code: "BE-2", name: "Trương Phúc Minh", own: "Auth • RBAC • Email • Tuyển", tech: "Fastify • Zod • Mailpit", tasks: "BE3 • BE4 • BE9 • BE10" },
    { code: "BE-3", name: "Phan Anh Khương", own: "API tin • sự kiện • dự án", tech: "Fastify • REST • PostgreSQL", tasks: "BE5 • BE6 • BE7" },
  ];
  rows.forEach((r, i) => {
    const y = 178 + i * 132;
    circleLabel(slide, r.code, 78, y + 14, 70, C.red, "#FFFFFF", 16);
    text(slide, r.name, 176, y, 360, 48, { fontSize: 25, bold: true });
    text(slide, r.own, 176, y + 52, 380, 38, { fontSize: 20, color: C.redDark });
    text(slide, r.tech, 628, y + 14, 506, 54, { fontSize: 21, bold: true, color: C.muted });
    text(slide, r.tasks, 628, y + 62, 506, 26, { fontSize: 14, bold: true, color: C.red });
    line(slide, 176, y + 104, 958, C.hair, 1);
  });
  addNotes(slide, "Thiên xây nền dữ liệu; Minh giữ tài khoản, quyền và quy trình gia nhập; Khương cung cấp các API nội dung. Nhấn vào đầu ra, không chỉ nhắc tên công nghệ.", ["Danh sách thành viên do người dùng cung cấp", "APC-Portal-Ke-hoach-cong-viec.xlsx — Thành viên và Bảng nhiệm vụ"]);
}

// 21 — Frontend owners
{
  const slide = baseSlide("Phân công Frontend");
  const rows = [
    { code: "FE-1", name: "Lương Huỳnh", own: "Router • Layout • Auth UI • Component", tasks: "FE1 • FE2 • FE9" },
    { code: "FE-2", name: "Nguyễn Gia Bảo", own: "Trang Tin tức • Sự kiện", tasks: "FE3 • FE4" },
    { code: "FE-3", name: "Lê Đăng Nghĩa", own: "Trang Dự án • Form Gia nhập", tasks: "FE5 • FE6" },
    { code: "FE-4", name: "Huỳnh Hoàn Phúc", own: "CMS Admin • Test Frontend", tasks: "FE7 • FE8" },
  ];
  rows.forEach((r, i) => {
    const y = 168 + i * 102;
    circleLabel(slide, r.code, 78, y + 8, 64, C.blue, "#FFFFFF", 15);
    text(slide, r.name, 172, y, 360, 44, { fontSize: 24, bold: true });
    text(slide, r.own, 580, y, 574, 44, { fontSize: 21, color: C.blueDark, bold: true });
    text(slide, `React • TypeScript • Tailwind • API     ${r.tasks}`, 580, y + 44, 574, 34, { fontSize: 16, color: C.muted });
    line(slide, 172, y + 86, 982, C.hair, 1);
  });
  addNotes(slide, "Huỳnh chuẩn bị khung chung; Gia Bảo và Đăng Nghĩa làm các luồng public; Hoàn Phúc làm CMS và test. Người làm trang vẫn phải phối hợp với người cung cấp API.", ["Danh sách thành viên do người dùng cung cấp", "APC-Portal-Ke-hoach-cong-viec.xlsx — Thành viên và Bảng nhiệm vụ"]);
}

// 22 — Ops/QA
{
  const slide = baseSlide("Phân công Hạ tầng/QA và phần APC duyệt");
  box(slide, 72, 180, 530, 320, C.goldPale, 24, C.goldPale);
  circleLabel(slide, "OP-1", 104, 212, 72, C.gold, C.ink, 16);
  text(slide, "Đặng Phúc An Khang", 202, 214, 340, 42, { fontSize: 27, bold: true });
  text(slide, "CI • Staging • Backup", 104, 304, 440, 44, { fontSize: 25, bold: true, color: "#6B4500" });
  text(slide, "GitHub Actions • Docker • VPS", 104, 372, 440, 42, { fontSize: 20, color: C.muted });
  text(slide, "IN1 • IN2 • IN3", 104, 422, 440, 26, { fontSize: 14, bold: true, color: "#6B4500" });
  box(slide, 638, 180, 570, 320, C.surface, 24, C.surface);
  circleLabel(slide, "OP-2", 670, 212, 72, C.navy, "#FFFFFF", 16);
  text(slide, "Nguyễn Tiến Bảo", 768, 214, 360, 42, { fontSize: 27, bold: true });
  text(slide, "QA • E2E • Nội dung • Docs", 670, 304, 466, 44, { fontSize: 25, bold: true, color: C.navy });
  text(slide, "Checklist • test luồng • tài liệu", 670, 372, 466, 42, { fontSize: 20, color: C.muted });
  text(slide, "IN4 • CT2 • DOC1", 670, 422, 466, 26, { fontSize: 14, bold: true, color: C.navy });
  box(slide, 72, 532, 1136, 72, C.redPale, 18, C.redPale);
  text(slide, "APC/CLB chịu trách nhiệm duyệt nội dung, hình ảnh và dữ liệu thật trước khi công bố.", 102, 546, 1076, 44, { fontSize: 21, bold: true, color: C.redDark, align: "center" });
  addNotes(slide, "Nhấn mạnh QA không phải người kiểm tra sau cùng. OP-2 phối hợp từ lúc có user flow; OP-1 bảo đảm code có thể chạy, triển khai và khôi phục.", ["Danh sách thành viên do người dùng cung cấp", "APC-Portal-Ke-hoach-cong-viec.xlsx — Thành viên", "docs/08-handover.md"]);
}

// 23 — Timeline
{
  const slide = baseSlide("Kế hoạch từ 01/09 đến deadline 15/10");
  const phases = [
    { x: 72, w: 250, c: C.red, title: "01–12/09", sub: "NỀN TẢNG", body: "DB • Auth • Router\nCI • Duyệt trang chủ" },
    { x: 344, w: 250, c: C.blue, title: "15–26/09", sub: "NỘI DUNG", body: "CMS API\nTrang public" },
    { x: 616, w: 250, c: C.gold, title: "29/09–10/10", sub: "QUẢN TRỊ", body: "CMS admin\nForm Gia nhập" },
    { x: 888, w: 320, c: C.green, title: "13–15/10", sub: "CHỐT", body: "Staging • QA\nBackup • Bàn giao" },
  ];
  line(slide, 100, 330, 1050, C.hairStrong, 4);
  phases.forEach((p, i) => {
    circleLabel(slide, String(i + 1), p.x + 12, 306, 50, p.c, "#FFFFFF", 18);
    text(slide, p.title, p.x, 188, p.w, 42, { fontSize: 26, bold: true, color: p.c });
    text(slide, p.sub, p.x, 242, p.w, 24, { fontSize: 13, bold: true, color: C.muted });
    text(slide, p.body, p.x, 390, p.w, 92, { fontSize: 21, bold: true, valign: "top" });
  });
  box(slide, 72, 530, 1136, 68, C.navy, 18, C.navy);
  text(slide, "Deadline cứng: 15/10/2026", 96, 544, 1088, 40, { fontSize: 24, bold: true, color: "#FFFFFF", align: "center" });
  addNotes(slide, "Chỉ nói mục tiêu của từng chặng, không đọc từng task. Dùng Excel cho danh sách chi tiết.", ["APC-Portal-Ke-hoach-cong-viec.xlsx — Quy ước & Điều phối và Bảng nhiệm vụ"]);
}

// 24 — Sprint 1 blockers
{
  const slide = baseSlide("Sprint 1 phải mở được năm nút chặn");
  const items = [
    { x: 72, code: "BE1", t: "Database", owner: "Thiên", c: C.red },
    { x: 298, code: "BE3", t: "Đăng nhập", owner: "Minh", c: C.red },
    { x: 524, code: "FE1", t: "Router", owner: "Huỳnh", c: C.blue },
    { x: 750, code: "IN1", t: "CI", owner: "An Khang", c: C.gold },
    { x: 976, code: "CT1", t: "Duyệt UI", owner: "APC", c: C.green },
  ];
  items.forEach((it) => {
    circleLabel(slide, it.code, it.x + 36, 206, 82, it.c, it.c === C.gold ? C.ink : "#FFFFFF", 16);
    text(slide, it.t, it.x, 310, 154, 38, { fontSize: 23, bold: true, align: "center" });
    text(slide, it.owner, it.x, 354, 154, 28, { fontSize: 17, color: C.muted, align: "center" });
  });
  box(slide, 72, 442, 530, 118, C.surface, 18, C.surface);
  text(slide, "BE3 bắt đầu sau khi BE1 đủ nền database.", 100, 460, 474, 82, { fontSize: 22, bold: true, color: C.redDark, align: "center" });
  box(slide, 638, 442, 570, 118, C.bluePale, 18, C.bluePale);
  text(slide, "Không bắt đầu task khi dependency chưa Xong.", 666, 460, 514, 82, { fontSize: 22, bold: true, color: C.blueDark, align: "center" });
  addNotes(slide, "Năm nút chặn là cách dễ nhớ của Sprint 1. Auth phụ thuộc database; các trang sau phụ thuộc router và API.", ["APC-Portal-Ke-hoach-cong-viec.xlsx — Chi tiết Sprint 1 và Quy ước & Điều phối"]);
}

// 24A — Sprint 2 and 3 deliverables
{
  const slide = baseSlide("Sau nền tảng, đội chuyển sang nội dung và quản trị");
  box(slide, 72, 178, 540, 382, C.bluePale, 24, C.bluePale);
  text(slide, "SPRINT 2 • 15–26/09", 104, 204, 450, 28, { fontSize: 14, bold: true, color: C.blue });
  text(slide, "API + trang public", 104, 250, 450, 44, { fontSize: 29, bold: true });
  addList(slide, ["RBAC", "News / Events / Projects API", "Upload và email", "Trang Tin tức và Sự kiện"], 104, 322, 450, { gap: 52, fontSize: 19, bullet: C.blue });
  box(slide, 648, 178, 560, 382, C.redPale, 24, C.redPale);
  text(slide, "SPRINT 3 • 29/09–10/10", 680, 204, 470, 28, { fontSize: 14, bold: true, color: C.red });
  text(slide, "CMS + quy trình Gia nhập", 680, 250, 470, 44, { fontSize: 29, bold: true });
  addList(slide, ["Trang Dự án", "Form Gia nhập APC", "CMS admin", "Duyệt/từ chối đơn và nội dung thật"], 680, 322, 470, { gap: 52, fontSize: 19, bullet: C.red });
  box(slide, 72, 590, 1136, 56, C.navy, 14, C.navy);
  text(slide, "13–15/10: staging • QA/E2E • backup/restore • bàn giao", 96, 598, 1088, 40, { fontSize: 19, bold: true, color: "#FFFFFF", align: "center" });
  addNotes(slide, "Sau Sprint 1, công việc chuyển từ nền tảng sang các luồng nhìn thấy được. Sprint 2 mở API và public pages; Sprint 3 nối CMS và tuyển thành viên.", ["APC-Portal-Ke-hoach-cong-viec.xlsx — Bảng nhiệm vụ và Quy ước & Điều phối"]);
}

// 25 — Task lifecycle
{
  const slide = baseSlide("Quy trình làm một task trong repo");
  const steps = ["Nhận task", "Tạo branch", "Code + tự test", "Mở PR", "Review + CI", "Merge + cập nhật sheet"];
  const nodeShapes = steps.map((s, i) => {
    const x = 72 + i * 184;
    const b = box(slide, x, 220, 152, 126, i === 5 ? C.green : C.card, 18, i === 5 ? C.green : C.hair);
    circleLabel(slide, String(i + 1), x + 52, 238, 48, i === 5 ? "#FFFFFF" : (i % 2 ? C.blue : C.red), i === 5 ? C.green : "#FFFFFF", 17);
    text(slide, s, x + 12, 296, 128, 38, { fontSize: 16, bold: true, color: i === 5 ? "#FFFFFF" : C.ink, align: "center" });
    return b;
  });
  for (let i = 0; i < nodeShapes.length - 1; i++) {
    slide.shapes.connect(nodeShapes[i], nodeShapes[i + 1], { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.hairStrong, width: 2 }, tail: { type: "triangle", width: "sm", length: "sm" } });
  }
  box(slide, 72, 422, 1136, 138, C.navy, 20, C.navy);
  text(slide, "XONG = code chạy  +  test tối thiểu  +  pnpm check xanh  +  1 review  +  sheet cập nhật", 104, 448, 1072, 74, { fontSize: 22, bold: true, color: "#FFFFFF", align: "center" });
  addNotes(slide, "Giải thích Definition of Done. Viết code xong chưa phải hoàn thành; đầu ra phải kiểm tra được, review được và người tiếp theo dùng được.", ["APC-Portal-Ke-hoach-cong-viec.xlsx — Quy ước & Điều phối", "CONTRIBUTING.md"]);
}

// 26 — Collaboration
{
  const slide = baseSlide("Quy ước phối hợp và xử lý blocker");
  const rules = [
    { n: "01", t: "Kẹt quá nửa ngày", d: "Chuyển trạng thái Blocked và ghi lý do.", c: C.red },
    { n: "02", t: "Check-in hai lần/tuần", d: "Cập nhật trạng thái trước buổi họp.", c: C.blue },
    { n: "03", t: "P0 trước P1", d: "Không mở thêm việc khi nút chặn chưa xong.", c: C.gold },
    { n: "04", t: "Không push thẳng main", d: "Mỗi thay đổi đi qua PR, review và CI.", c: C.green },
  ];
  rules.forEach((r, i) => {
    const y = 174 + i * 104;
    text(slide, r.n, 84, y, 76, 62, { fontSize: 34, bold: true, color: r.c });
    text(slide, r.t, 190, y, 360, 34, { fontSize: 25, bold: true });
    text(slide, r.d, 570, y, 590, 54, { fontSize: 20, color: C.muted });
    line(slide, 190, y + 72, 970, C.hair, 1);
  });
  addNotes(slide, "Tạo văn hóa báo sớm. Blocked không phải thất bại; im lặng khiến dependency bị trễ mới là rủi ro.", ["APC-Portal-Ke-hoach-cong-viec.xlsx — Quy ước & Điều phối", "CONTRIBUTING.md"]);
}

// 27 — Next actions
{
  const slide = deck.slides.add();
  slide.background.fill = C.navy;
  text(slide, "BẮT ĐẦU NGAY", 72, 70, 360, 28, { fontSize: 14, bold: true, color: C.gold });
  text(slide, "Bốn việc sau buổi kickoff", 72, 118, 760, 64, { fontSize: 43, bold: true, color: "#FFFFFF" });
  const actions = [
    ["01", "Mỗi người chạy được dự án local", "Ngày mai"],
    ["02", "Chốt reviewer cho task Sprint 1", "Hôm nay"],
    ["03", "BE1 • FE1 • IN1 mở branch/PR đầu tiên", "Trước 05/09"],
    ["04", "APC chốt nội dung và giao diện trang chủ", "05/09"],
  ];
  actions.forEach((a, i) => {
    const y = 228 + i * 92;
    circleLabel(slide, a[0], 72, y, 52, i === 3 ? C.gold : C.red, i === 3 ? C.ink : "#FFFFFF", 15);
    text(slide, a[1], 150, y, 720, 48, { fontSize: 23, bold: true, color: "#FFFFFF" });
    text(slide, a[2], 932, y, 260, 48, { fontSize: 19, bold: true, color: "#B8C9E2", align: "right" });
    line(slide, 150, y + 64, 1042, "#233A59", 1);
  });
  text(slide, "Mục tiêu sau cùng: mỗi người biết đầu ra của mình và người đang chờ đầu ra đó.", 72, 626, 1120, 42, { fontSize: 20, color: "#DCEAFB", align: "center" });
  addNotes(slide, "Kết thúc bằng hành động, không kết thúc bằng cảm ơn. Chốt người làm, deadline và kênh cập nhật ngay sau buổi họp.", ["APC-Portal-Ke-hoach-cong-viec.xlsx — Chi tiết Sprint 1", "Danh sách thành viên do người dùng cung cấp"]);
}

await fs.mkdir(OUT, { recursive: true });
await fs.mkdir(RENDER, { recursive: true });

for (const [i, slide] of deck.slides.items.entries()) {
  const stem = `slide-${String(i + 1).padStart(2, "0")}`;
  const png = await deck.export({ slide, format: "png", scale: 1 });
  await fs.writeFile(`${RENDER}\\${stem}.png`, new Uint8Array(await png.arrayBuffer()));
  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(`${RENDER}\\${stem}.layout.json`, await layout.text());
}

const montage = await deck.export({ format: "webp", montage: true, scale: 0.7 });
await fs.writeFile(`${RENDER}\\deck-montage.webp`, new Uint8Array(await montage.arrayBuffer()));

const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(FINAL);

const inspect = await deck.inspect({ kind: "slide,textbox,shape,image,notes", maxChars: 18000 });
await fs.writeFile(`${RENDER}\\deck-inspect.ndjson`, inspect.ndjson, "utf8");

console.log(JSON.stringify({ final: FINAL, slides: deck.slides.items.length, rendered: RENDER }));
