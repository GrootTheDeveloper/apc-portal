export function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Chính sách Quyền riêng tư</h1>
      <div className="prose prose-slate max-w-none">
        <p>
          Chào mừng bạn đến với Cổng thông tin CLB Học thuật APC (UMT). Chúng tôi coi trọng quyền riêng tư của bạn và cam kết bảo vệ dữ liệu cá nhân của bạn.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">1. Thu thập thông tin</h2>
        <p>
          Khi bạn tạo tài khoản, gửi đơn ứng tuyển, hoặc đăng ký sự kiện, chúng tôi có thể thu thập các thông tin như họ tên, MSSV, email, số điện thoại, và các thông tin liên quan khác mà bạn tự nguyện cung cấp.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">2. Mục đích sử dụng</h2>
        <p>Chúng tôi sử dụng thông tin thu thập được để:</p>
        <ul className="list-disc pl-5 mb-4">
          <li>Quản lý thành viên và các hoạt động của câu lạc bộ.</li>
          <li>Xử lý hồ sơ ứng tuyển, điểm danh sự kiện.</li>
          <li>Liên lạc với bạn về các thông báo, thay đổi lịch trình.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-4">3. Đồng ý dữ liệu (Consent)</h2>
        <p>
          Hệ thống sẽ lưu lại bản ghi đồng ý (Consent Record) của bạn đối với từng mục đích xử lý dữ liệu. Hồ sơ đồng ý này sẽ ghi nhận mục đích, thời gian và địa chỉ IP khi bạn chấp nhận điều khoản. Bạn có quyền rút lại sự đồng ý bất cứ lúc nào qua phần Cài đặt tài khoản.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">4. Bảo mật dữ liệu</h2>
        <p>
          Mọi thông tin cá nhân của bạn được lưu trữ an toàn trên máy chủ của APC. Các dữ liệu nhạy cảm (như mật khẩu, token) được mã hóa một chiều. Ban chủ nhiệm và Tech Admin chỉ được cấp quyền xem dữ liệu khi có nhu cầu phục vụ nghiệp vụ câu lạc bộ.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">5. Liên hệ</h2>
        <p>
          Nếu có thắc mắc hoặc muốn yêu cầu xóa dữ liệu, vui lòng liên hệ với Ban Chủ nhiệm APC hoặc gửi yêu cầu trực tiếp qua chức năng Hỗ trợ dữ liệu trên hệ thống.
        </p>
        
        <p className="mt-8 text-sm text-slate-500">
          Cập nhật lần cuối: Tháng 10, 2026 (Phiên bản v1.0)
        </p>
      </div>
    </div>
  )
}
