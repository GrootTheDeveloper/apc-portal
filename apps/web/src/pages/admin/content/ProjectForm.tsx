import { useState } from 'react'

import { Button } from '../../../components/Button.js'
import { FileUpload } from '../../../components/FileUpload.js'
import { inputClass, labelClass } from '../../../components/formClass.js'
import { useApi } from '../../../hooks/useApi.js'
import { safeHttpUrl } from '../../../lib/content.js'
import { fileSrc } from './postTypes.js'
import {
  type AdminProjectMember,
  type ProjectFormValues,
  type ProjectMemberOption,
  type ProjectType,
  PROJECT_TYPE_LABEL,
  consentMark,
} from './projectTypes.js'

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
const MAX_TECHNOLOGIES = 50
const MAX_MEMBERS = 200

/** Link chỉ nhận http/https (PRT-04) — chặn sớm phía client; server 422 vẫn là chốt cuối. */
function urlIssue(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return safeHttpUrl(trimmed) ? null : 'Chỉ nhận URL bắt đầu bằng http:// hoặc https://.'
}

type ProjectFormProps = {
  values: ProjectFormValues
  onChange: (patch: Partial<ProjectFormValues>) => void
  /** lỗi theo tên trường, từ `fieldErrors(error)` */
  fields: Record<string, string[]>
  /** khóa toàn bộ ô nhập (vd quản lý ban mở dự án đã công bố) */
  disabled?: boolean
  board: boolean
  /** Danh sách ban — chỉ BOARD thấy ô chọn ban. */
  departments?: { id: string; name: string }[]
  /** Thành viên hiện có của dự án (trang sửa) để hiện badge đồng ý công bố; dự án mới để trống. */
  members?: AdminProjectMember[]
}

/**
 * Form dự án/sản phẩm dùng chung cho trang tạo mới và trang sửa (C4). Không có ô slug: slug do server sinh lúc
 * tạo và đóng băng khi sửa (spec C4). Badge đồng ý công bố của thành viên chỉ đọc — không có chỗ bật/tắt ở đây.
 */
export function ProjectForm({
  values,
  onChange,
  fields,
  disabled = false,
  board,
  departments = [],
  members = [],
}: ProjectFormProps) {
  const [tagDraft, setTagDraft] = useState('')
  const [memberDraft, setMemberDraft] = useState('')

  // Thành viên ACTIVE toàn CLB cho ô chọn (endpoint chỉ trả id + fullName).
  const options = useApi<ProjectMemberOption[]>('/admin/content/projects/member-options')
  const available = (options.data ?? []).filter((option) => !values.memberIds.includes(option.id))
  const memberConsent = new Map(members.map((member) => [member.userId, member]))

  const thumbnail = fileSrc(values.thumbnailUrl)
  const projectUrlIssue = urlIssue(values.projectUrl)
  const sourceUrlIssue = urlIssue(values.sourceUrl)

  function commitTags() {
    const tags = tagDraft
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
    if (tags.length === 0) return
    const next = [...values.technologies]
    for (const tag of tags) {
      if (next.length >= MAX_TECHNOLOGIES) break
      if (!next.includes(tag)) next.push(tag)
    }
    onChange({ technologies: next })
    setTagDraft('')
  }

  function addMember() {
    if (!memberDraft || values.memberIds.length >= MAX_MEMBERS) return
    onChange({ memberIds: [...values.memberIds, memberDraft] })
    setMemberDraft('')
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2" disabled={disabled}>
        <legend className={labelClass}>loại</legend>
        <div className="flex flex-wrap gap-3">
          {(['PROJECT', 'PRODUCT'] as ProjectType[]).map((type) => (
            <label
              key={type}
              className={`flex min-h-12 flex-1 cursor-pointer items-center gap-3 rounded-xl px-4 text-[16px] font-bold transition-colors ${
                values.type === type ? 'bg-ink text-paper' : 'bg-soft text-ink hover:bg-apc-blue-pale'
              }`}
            >
              <input
                type="radio"
                name="project-type"
                value={type}
                checked={values.type === type}
                onChange={() => onChange({ type })}
                className="h-4 w-4 accent-apc-red"
              />
              {PROJECT_TYPE_LABEL[type]}
            </label>
          ))}
        </div>
        <FieldMessages messages={fields.type} />
      </fieldset>

      <label className={labelClass} htmlFor="project-title">
        tiêu đề
        <input
          id="project-title"
          className={inputClass}
          value={values.title}
          maxLength={200}
          required
          disabled={disabled}
          aria-invalid={!!fields.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
        <span className={counterClass}>{values.title.length}/200</span>
        <FieldMessages messages={fields.title} />
      </label>

      <label className={labelClass} htmlFor="project-description">
        mô tả
        <textarea
          id="project-description"
          className={`${inputClass} min-h-32 resize-y`}
          value={values.description}
          rows={6}
          disabled={disabled}
          aria-invalid={!!fields.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />
        <FieldMessages messages={fields.description} />
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

      <div className="flex flex-col gap-3">
        <p className={labelClass}>công nghệ</p>
        {values.technologies.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {values.technologies.map((tech) => (
              <li key={tech} className="inline-flex items-center gap-2 rounded-full bg-soft px-3 py-1.5 text-[14px] font-bold">
                {tech}
                {!disabled && (
                  <button
                    type="button"
                    aria-label={`Bỏ công nghệ ${tech}`}
                    onClick={() => onChange({ technologies: values.technologies.filter((item) => item !== tech) })}
                    className="text-apc-red"
                  >
                    <span aria-hidden>✕</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {!disabled && (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              commitTags()
            }}
          >
            <label className={`${labelClass} min-w-[280px] flex-1`} htmlFor="project-tech">
              thêm công nghệ
              <input
                id="project-tech"
                className={inputClass}
                value={tagDraft}
                placeholder="vd: React, TypeScript — Enter hoặc dấu phẩy để thêm"
                aria-invalid={!!fields.technologies}
                onChange={(event) => setTagDraft(event.target.value)}
              />
            </label>
            <Button type="submit" variant="outline">
              Thêm
            </Button>
          </form>
        )}
        <span className={counterClass}>
          {values.technologies.length}/{MAX_TECHNOLOGIES}
        </span>
        <FieldMessages messages={fields.technologies} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <label className={labelClass} htmlFor="project-url">
          link dùng thử / demo
          <input
            id="project-url"
            className={inputClass}
            value={values.projectUrl}
            type="url"
            disabled={disabled}
            placeholder="https://…"
            aria-invalid={!!fields.projectUrl || !!projectUrlIssue}
            onChange={(event) => onChange({ projectUrl: event.target.value })}
          />
          {projectUrlIssue && <span className="font-body text-[15px] text-apc-red">{projectUrlIssue}</span>}
          <FieldMessages messages={fields.projectUrl} />
        </label>

        <label className={labelClass} htmlFor="project-source">
          link mã nguồn
          <input
            id="project-source"
            className={inputClass}
            value={values.sourceUrl}
            type="url"
            disabled={disabled}
            placeholder="https://…"
            aria-invalid={!!fields.sourceUrl || !!sourceUrlIssue}
            onChange={(event) => onChange({ sourceUrl: event.target.value })}
          />
          {sourceUrlIssue && <span className="font-body text-[15px] text-apc-red">{sourceUrlIssue}</span>}
          <FieldMessages messages={fields.sourceUrl} />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <p className={labelClass}>thành viên tham gia</p>
        {values.memberIds.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {values.memberIds.map((id) => {
              const option = (options.data ?? []).find((item) => item.id === id)
              const member = memberConsent.get(id)
              const name = option?.fullName ?? member?.name ?? id
              return (
                <li key={id} className="inline-flex items-center gap-3 rounded-full bg-soft px-4 py-1.5 text-[14px] font-bold">
                  <span>{name}</span>
                  <span className="font-code text-[13px] font-bold">
                    Tên: {consentMark(member?.publicNameConsent)} · Ảnh: {consentMark(member?.publicPhotoConsent)}
                  </span>
                  {!disabled && (
                    <button
                      type="button"
                      aria-label={`Bỏ chọn ${name}`}
                      onClick={() => onChange({ memberIds: values.memberIds.filter((item) => item !== id) })}
                      className="text-apc-red"
                    >
                      <span aria-hidden>✕</span>
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {!disabled && (
          <div className="flex flex-wrap items-end gap-3">
            <label className={`${labelClass} min-w-[280px] flex-1`} htmlFor="project-member">
              chọn thành viên
              <select
                id="project-member"
                className={inputClass}
                value={memberDraft}
                disabled={options.loading}
                aria-invalid={!!fields.memberIds}
                onChange={(event) => setMemberDraft(event.target.value)}
              >
                <option value="">— chọn thành viên —</option>
                {available.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.fullName}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" variant="outline" disabled={!memberDraft} onClick={addMember}>
              Chọn
            </Button>
          </div>
        )}
        {options.error && (
          <p className="font-body text-[15px] text-apc-red">
            Không tải được danh sách thành viên.{' '}
            <button
              type="button"
              onClick={options.reload}
              className="font-extrabold underline decoration-2 underline-offset-4"
            >
              Thử lại
            </button>
          </p>
        )}
        <span className={counterClass}>
          {values.memberIds.length}/{MAX_MEMBERS}
        </span>
        <span className="font-body text-[15px] text-muted">
          Tên / Ảnh là trạng thái đồng ý công bố của từng thành viên — mỗi người tự bật/tắt trong portal, không sửa
          được ở đây. Dấu ? nghĩa là chưa có dữ liệu đồng ý (ví dụ dự án mới chưa tồn tại).
        </span>
        <FieldMessages messages={fields.memberIds} />
      </div>

      {board && (
        <label className={labelClass} htmlFor="project-department">
          ban sở hữu
          <select
            id="project-department"
            className={inputClass}
            value={values.departmentId}
            disabled={disabled}
            aria-invalid={!!fields.departmentId}
            onChange={(event) => onChange({ departmentId: event.target.value })}
          >
            <option value="">Toàn CLB (không thuộc ban nào)</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <FieldMessages messages={fields.departmentId} />
        </label>
      )}
    </div>
  )
}
