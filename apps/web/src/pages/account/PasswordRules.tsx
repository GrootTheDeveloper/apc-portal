/** Điều kiện mật khẩu mới (SEC-11) — khớp `apps/api/src/modules/auth/password-policy.ts`. */
export function PasswordRules({ extra }: { extra: string }) {
  const rules = [
    'Dài 15–128 ký tự. Được dùng khoảng trắng và tiếng Việt, không bắt buộc trộn chữ, số, ký hiệu.',
    'Không dùng mật khẩu phổ biến hoặc lặp lại kiểu “abcabcabc…”.',
    'Không trùng tên đăng nhập (tên từ 4 ký tự trở lên thì cũng không được chứa nó).',
    extra,
  ]
  return (
    <ul className="flex flex-col gap-2 rounded-2xl bg-soft p-5 text-[15px] leading-relaxed text-muted">
      {rules.map((rule) => (
        <li key={rule} className="flex gap-2">
          <span aria-hidden className="font-bold text-apc-blue">
            ✓
          </span>
          {rule}
        </li>
      ))}
    </ul>
  )
}
