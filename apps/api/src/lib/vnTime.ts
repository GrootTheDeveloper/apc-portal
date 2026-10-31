// Giờ Việt Nam = UTC + 7h cố định, không có giờ mùa hè (BR-14): một nguồn định dạng ngày giờ
// dùng chung cho thông báo từ chối và email, thay vì mỗi nơi tự dựng Intl.DateTimeFormat.

const VN_DATE_TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Ngày giờ sự kiện theo giờ Việt Nam, dùng trong thông báo và email gửi người dùng. */
export const formatVnDateTime = (value: Date) => VN_DATE_TIME.format(value)
