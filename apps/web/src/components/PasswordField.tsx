// Cùng kiểu ô nhập với trang đăng nhập: viền 2px màu mực, focus viền xanh kèm quầng (DESIGN.md).
const inputClass =
  'w-full rounded-xl bg-paper px-4 py-3 text-[17px] text-ink shadow-[inset_0_0_0_2px_#081F3D] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_#1568C9,0_0_0_4px_rgba(21,104,201,0.2)] disabled:opacity-60 aria-[invalid=true]:shadow-[inset_0_0_0_2px_#C23B22]'

type PasswordFieldProps = {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  autoComplete: 'current-password' | 'new-password'
  errors?: string[] | undefined
  disabled?: boolean
}

/** Ô mật khẩu có nhãn và danh sách lỗi riêng của ô (lỗi 422 từ API). */
export function PasswordField({ label, name, value, onChange, autoComplete, errors = [], disabled }: PasswordFieldProps) {
  const errorId = `${name}-errors`
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="font-code text-[13px] font-bold">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="password"
        className={inputClass}
        autoComplete={autoComplete}
        maxLength={1024}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={errors.length > 0}
        aria-describedby={errors.length > 0 ? errorId : undefined}
      />
      {errors.length > 0 && (
        <ul id={errorId} className="flex flex-col gap-1 text-[15px] font-bold text-apc-red">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
