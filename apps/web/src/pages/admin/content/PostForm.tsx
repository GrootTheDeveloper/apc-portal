import { FileUpload } from '../../../components/FileUpload'
import { inputClass, labelClass } from '../../../components/formClass'
import { NEWS_CATEGORIES } from '../../../lib/content'
import { type ContentScope, type PostFormValues, SCOPE_LABEL, fileSrc } from './postTypes'

/** Lỗi 422 của một ô, lấy từ `fieldErrors(error)`. */
function FieldMessages({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null
  return (
    <>
      {messages.map((message) => (
        <span key={message} className="font-body text-[15px] text-apc-red">
          {message}
        </span>
      ))}
    </>
  )
}

const counterClass = 'self-end font-body text-[13px] font-bold text-muted'

type PostFormProps = {
  values: PostFormValues
  onChange: (patch: Partial<PostFormValues>) => void
  /** lỗi theo tên trường, từ `fieldErrors(error)` */
  fields: Record<string, string[]>
  /** khóa toàn bộ ô nhập (vd quản lý ban mở bài đã công bố) */
  disabled?: boolean
  board: boolean
}

/**
 * Form soạn bài viết dùng chung cho trang tạo mới và trang sửa (CMS-01). Nội dung là văn bản thuần, giữ xuống
 * dòng khi hiển thị; không render HTML từ nội dung để tránh XSS. Không có ô slug: slug do server sinh lúc tạo.
 */
export function PostForm({ values, onChange, fields, disabled = false, board }: PostFormProps) {
  const set = (key: keyof PostFormValues) => (value: string) =>
    onChange({ [key]: value } as Partial<PostFormValues>)
  const thumbnail = fileSrc(values.thumbnailUrl)
  // Bài cũ có thể mang chuyên mục ngoài danh sách chuẩn: giữ nguyên để không âm thầm đổi dữ liệu khi lưu.
  const categories: readonly string[] = NEWS_CATEGORIES
  const extraCategory = !!values.category && !categories.includes(values.category)

  return (
    <div className="flex flex-col gap-6">
      <label className={labelClass} htmlFor="post-title">
        tiêu đề
        <input
          id="post-title"
          className={inputClass}
          value={values.title}
          maxLength={255}
          required
          disabled={disabled}
          aria-invalid={!!fields.title}
          onChange={(event) => set('title')(event.target.value)}
        />
        <FieldMessages messages={fields.title} />
      </label>

      <div className="grid gap-6 md:grid-cols-2">
        <label className={labelClass} htmlFor="post-category">
          chuyên mục
          <select
            id="post-category"
            className={inputClass}
            value={values.category}
            required
            disabled={disabled}
            aria-invalid={!!fields.category}
            onChange={(event) => set('category')(event.target.value)}
          >
            <option value="">— chọn chuyên mục —</option>
            {NEWS_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
            {extraCategory && <option value={values.category}>{values.category}</option>}
          </select>
          <FieldMessages messages={fields.category} />
        </label>

        <fieldset className="flex flex-col gap-2" disabled={disabled}>
          <legend className={labelClass}>phạm vi</legend>
          <div className="flex flex-wrap gap-3">
            {(['PUBLIC', 'INTERNAL'] as ContentScope[]).map((scope) => (
              <label
                key={scope}
                className={`flex min-h-12 flex-1 cursor-pointer items-center gap-3 rounded-xl px-4 text-[16px] font-bold transition-colors ${
                  values.scope === scope ? 'bg-ink text-paper' : 'bg-soft text-ink hover:bg-apc-blue-pale'
                }`}
              >
                <input
                  type="radio"
                  name="post-scope"
                  value={scope}
                  checked={values.scope === scope}
                  onChange={() => onChange({ scope })}
                  className="h-4 w-4 accent-apc-red"
                />
                {SCOPE_LABEL[scope]}
              </label>
            ))}
          </div>
          <FieldMessages messages={fields.scope} />
          <span className="font-body text-[15px] text-muted">
            {board
              ? 'Công khai: hiện ở /news sau khi công bố. Nội bộ: chỉ thành viên thấy trong portal.'
              : 'Bạn soạn được cả hai, nhưng chỉ Ban Chủ nhiệm công bố tin Công khai; bạn chỉ công bố thông báo Nội bộ của ban.'}
          </span>
        </fieldset>
      </div>

      <label className={labelClass} htmlFor="post-summary">
        tóm tắt
        <textarea
          id="post-summary"
          className={`${inputClass} min-h-24 resize-y`}
          value={values.summary}
          maxLength={500}
          rows={3}
          required
          disabled={disabled}
          aria-invalid={!!fields.summary}
          onChange={(event) => set('summary')(event.target.value)}
        />
        <span className={counterClass}>
          {values.summary.length}/500
        </span>
        <FieldMessages messages={fields.summary} />
      </label>

      <label className={labelClass} htmlFor="post-content">
        nội dung
        <textarea
          id="post-content"
          className={`${inputClass} min-h-[320px] resize-y font-body text-[17px] leading-relaxed`}
          value={values.content}
          rows={14}
          required
          disabled={disabled}
          aria-invalid={!!fields.content}
          onChange={(event) => set('content')(event.target.value)}
        />
        <FieldMessages messages={fields.content} />
        <span className="font-body text-[15px] text-muted">
          Văn bản thuần, xuống dòng được giữ nguyên khi hiển thị (tách đoạn bằng một dòng trống). Không hỗ trợ HTML.
        </span>
      </label>

      <div className="flex flex-col gap-3">
        <p className={labelClass}>ảnh bìa</p>
        {thumbnail && (
          <div className="flex flex-wrap items-end gap-4">
            <img
              src={thumbnail}
              alt="Ảnh bìa hiện tại"
              className="aspect-[16/9] w-full max-w-[320px] rounded-apc bg-soft object-cover"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange({ thumbnailUrl: null })}
                className="font-body text-[15px] font-extrabold text-apc-red underline decoration-2 underline-offset-4"
              >
                Xóa ảnh
              </button>
            )}
          </div>
        )}
        {!disabled && (
          <FileUpload
            purpose="CONTENT_IMAGE"
            label={thumbnail ? 'Đổi ảnh bìa' : 'Chọn ảnh bìa'}
            onUploaded={(id) => onChange({ thumbnailUrl: id })}
          />
        )}
        <FieldMessages messages={fields.thumbnailUrl} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <label className={labelClass} htmlFor="post-meta-title">
          metaTitle (SEO)
          <input
            id="post-meta-title"
            className={inputClass}
            value={values.metaTitle}
            maxLength={70}
            disabled={disabled}
            aria-invalid={!!fields.metaTitle}
            placeholder="Để trống thì dùng tiêu đề"
            onChange={(event) => set('metaTitle')(event.target.value)}
          />
          <span className={counterClass}>{values.metaTitle.length}/70</span>
          <FieldMessages messages={fields.metaTitle} />
        </label>

        <label className={labelClass} htmlFor="post-meta-description">
          metaDescription (SEO)
          <textarea
            id="post-meta-description"
            className={`${inputClass} min-h-24 resize-y`}
            value={values.metaDescription}
            maxLength={160}
            rows={3}
            disabled={disabled}
            aria-invalid={!!fields.metaDescription}
            placeholder="Để trống thì dùng tóm tắt"
            onChange={(event) => set('metaDescription')(event.target.value)}
          />
          <span className={counterClass}>{values.metaDescription.length}/160</span>
          <FieldMessages messages={fields.metaDescription} />
        </label>
      </div>
    </div>
  )
}
