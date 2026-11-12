import { type FormEvent, useState } from 'react'

import { Button } from '../../../components/Button'
import { FileUpload } from '../../../components/FileUpload'
import { inputClass, labelClass } from '../../../components/formClass'
import { useAuth } from '../../../hooks/useAuth'
import { api, ApiError } from '../../../lib/api'
import { hasRole } from '../../../lib/auth'
import { fieldErrors } from '../../../lib/formErrors'
import type { AboutData } from '../../about/types'
import type { DocumentItem, DocumentRole } from './types'

const ROLES: DocumentRole[] = ['MEMBER', 'DEPARTMENT_MANAGER', 'BOARD']

export function DocumentForm({
  departments,
  document,
  onSaved,
}: {
  departments: AboutData['departments']
  document?: DocumentItem
  onSaved: (document: DocumentItem) => void
}) {
  const { user } = useAuth()
  const board = hasRole(user, 'BOARD')
  const managerDepartments = user?.roles.flatMap((grant) => grant.role === 'DEPARTMENT_MANAGER' && grant.departmentId ? [grant.departmentId] : []) ?? []
  const firstDepartment = managerDepartments[0] ?? user?.departmentId ?? ''
  const [title, setTitle] = useState(document?.title ?? '')
  const [description, setDescription] = useState(document?.description ?? '')
  const [category, setCategory] = useState(document?.category ?? '')
  const [departmentId, setDepartmentId] = useState(document?.departmentId ?? firstDepartment)
  const [scope, setScope] = useState<'DEPARTMENT' | 'CLUB'>(document?.scope ?? 'DEPARTMENT')
  const [allowedRoles, setAllowedRoles] = useState<DocumentRole[]>(document?.allowedRoles ?? [])
  const [storedFileId, setStoredFileId] = useState('')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<{ message: string; fields: Record<string, string[]> } | null>(null)

  const activeDepartments = departments.filter((department) => board || managerDepartments.includes(department.id))
  const selectableDepartments = document?.department && !activeDepartments.some((department) => department.id === document.department?.id)
    ? [...activeDepartments, { id: document.department.id, name: document.department.name }]
    : activeDepartments
  const fieldErrorsByName = error?.fields ?? {}

  function toggleRole(role: DocumentRole) {
    setAllowedRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role])
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const input = {
        title,
        description: description || null,
        category,
        departmentId: scope === 'CLUB' && !board ? null : departmentId || null,
        scope,
        allowedRoles,
        reason,
        ...(document ? { updatedAt: document.updatedAt } : { storedFileId }),
      }
      const saved = document
        ? await api<DocumentItem>(`/admin/documents/${document.id}`, { method: 'PATCH', body: input })
        : await api<DocumentItem>('/admin/documents', { body: input })
      onSaved(saved)
    } catch (caught) {
      setError({
        message: caught instanceof ApiError ? caught.message : 'Không thể lưu tài liệu. Vui lòng thử lại.',
        fields: fieldErrors(caught),
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <label className={labelClass}>
        Tên tài liệu
        <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} aria-invalid={!!fieldErrorsByName.title} />
        {fieldErrorsByName.title?.map((message) => <span key={message} className="font-body text-apc-red">{message}</span>)}
      </label>
      <label className={labelClass}>
        Mô tả
        <textarea className={`${inputClass} min-h-24 resize-y`} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} />
      </label>
      <label className={labelClass}>
        Chuyên mục
        <input className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)} required maxLength={80} placeholder="Ví dụ: Quy trình" aria-invalid={!!fieldErrorsByName.category} />
        {fieldErrorsByName.category?.map((message) => <span key={message} className="font-body text-apc-red">{message}</span>)}
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          Phạm vi xem
          <select className={inputClass} value={scope} onChange={(event) => setScope(event.target.value as 'DEPARTMENT' | 'CLUB')}>
            <option value="DEPARTMENT">Theo ban</option>
            {board && <option value="CLUB">Toàn câu lạc bộ</option>}
          </select>
        </label>
        {scope === 'DEPARTMENT' && (
          <label className={labelClass}>
            Ban sở hữu
            <select className={inputClass} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} required>
              <option value="">Chọn ban</option>
              {selectableDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
            {fieldErrorsByName.departmentId?.map((message) => <span key={message} className="font-body text-apc-red">{message}</span>)}
          </label>
        )}
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="font-code text-[13px] font-bold">Giới hạn vai trò (để trống nếu mọi thành viên trong phạm vi đều xem được)</legend>
        <div className="flex flex-wrap gap-4">
          {ROLES.map((role) => (
            <label key={role} className="flex items-center gap-2 font-body text-sm">
              <input type="checkbox" checked={allowedRoles.includes(role)} onChange={() => toggleRole(role)} />
              {role === 'MEMBER' ? 'Thành viên' : role === 'DEPARTMENT_MANAGER' ? 'Quản lý Ban' : 'Ban Chủ nhiệm'}
            </label>
          ))}
        </div>
      </fieldset>
      {!document && <FileUpload purpose="DOCUMENT" label="Tải tệp tài liệu lên" onUploaded={setStoredFileId} />}
      {fieldErrorsByName.storedFileId?.map((message) => <span key={message} className="font-body text-apc-red">{message}</span>)}
      <label className={labelClass}>
        Lý do cập nhật
        <textarea className={`${inputClass} min-h-20 resize-y`} value={reason} onChange={(event) => setReason(event.target.value)} required minLength={3} maxLength={500} aria-invalid={!!fieldErrorsByName.reason} />
        {fieldErrorsByName.reason?.map((message) => <span key={message} className="font-body text-apc-red">{message}</span>)}
      </label>
      {error && <p role="alert" className="font-body font-bold text-apc-red">{error.message}</p>}
      <Button type="submit" disabled={pending || (!document && !storedFileId)}>{pending ? 'Đang lưu…' : document ? 'Lưu thay đổi' : 'Tạo tài liệu'}</Button>
    </form>
  )
}
