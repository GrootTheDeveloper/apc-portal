import { type CSSProperties, type FormEvent, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Button } from '../../../../components/Button'
import { Eyebrow } from '../../../../components/Eyebrow'
import { inputClass, labelClass } from '../../../../components/formClass'
import { Pagination } from '../../../../components/Pagination'
import { Seo } from '../../../../components/Seo'
import { useApi } from '../../../../hooks/useApi'
import type { Page } from '../../../../lib/api'
import { DirectoryRoleBadges, DirectoryTagList, MemberAvatar } from '../MemberBadges'
import type { DirectoryDepartment, DirectoryMember } from '../types'

const PAGE_SIZE = 12

/** PAGE-MEM-09 — Danh bạ thành viên nội bộ (T6, MEM-10): chỉ hiện họ tên, ảnh đại diện, ban, vai trò, kỹ năng, lĩnh vực quan tâm. */
export function MemberDirectoryListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()

  const q = searchParams.get('q') ?? ''
  const departmentId = searchParams.get('departmentId') ?? ''
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const from = `${location.pathname}${location.search}`

  const [searchDraft, setSearchDraft] = useState(q)
  const [syncedQ, setSyncedQ] = useState(q)
  if (q !== syncedQ) {
    setSyncedQ(q)
    setSearchDraft(q)
  }

  const aboutApi = useApi<{ departments: DirectoryDepartment[] }>('/public/about')
  const departments = aboutApi.data?.departments ?? []

  const query = new URLSearchParams()
  query.set('page', String(page))
  query.set('pageSize', String(PAGE_SIZE))
  if (q) query.set('q', q)
  if (departmentId) query.set('departmentId', departmentId)

  const members = useApi<Page<DirectoryMember>>(`/portal/members?${query.toString()}`)
  const items = members.data?.items ?? []
  const total = members.data?.total ?? 0
  const isFiltered = q !== '' || departmentId !== ''
  const listEmpty = !members.loading && !members.error && items.length === 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const firstItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const lastItem = Math.min(total, page * PAGE_SIZE)

  function updateParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    if (!('page' in changes)) next.delete('page')
    setSearchParams(next)
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateParams({ q: searchDraft.trim() || null })
  }

  function clearFilters() {
    setSearchDraft('')
    setSearchParams(new URLSearchParams())
  }

  return (
    <main>
      <Seo
        title="Danh bạ thành viên"
        description="Danh bạ nội bộ thành viên CLB APC."
        path="/portal/members"
        robots="noindex, nofollow"
      />
      <Eyebrow className="text-apc-blue">danh bạ nội bộ</Eyebrow>
      <h1 className="mt-2 font-display text-[clamp(30px,4vw,52px)] font-extrabold leading-none tracking-[-0.03em] text-ink">
        Danh bạ thành viên
      </h1>
      <p className="mt-3 max-w-[62ch] text-[17px] leading-relaxed text-muted">
        Tra cứu thành viên đang sinh hoạt tại APC theo họ tên, ban chuyên môn, kỹ năng và lĩnh vực quan tâm.
      </p>

      <section className="mt-8">
        <form
          onSubmit={handleSearchSubmit}
          role="search"
          aria-label="Tìm kiếm thành viên"
          className="grid gap-4 rounded-[20px] bg-soft p-5 sm:grid-cols-[minmax(0,1fr)_240px_auto] sm:items-end"
        >
          <label className={`${labelClass} min-w-0`}>
            Tìm theo tên
            <input
              type="search"
              maxLength={120}
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Nhập họ tên thành viên..."
              className={inputClass}
            />
          </label>

          <label className={`${labelClass} min-w-0`}>
            Ban chuyên môn
            <select
              value={departmentId}
              onChange={(event) => updateParams({ departmentId: event.target.value || null })}
              className={inputClass}
            >
              <option value="">Tất cả các ban</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button type="submit">Tìm kiếm</Button>
            {isFiltered && (
              <Button type="button" variant="outline" onClick={clearFilters}>
                Xóa bộ lọc
              </Button>
            )}
          </div>
        </form>

        <div className="mt-8">
          <AsyncState
            loading={members.loading}
            error={members.error}
            empty={listEmpty && !isFiltered}
            emptyText="Chưa có thành viên nào trong danh bạ."
            onRetry={members.reload}
          >
            {listEmpty && isFiltered ? (
              <div className="flex flex-col items-center gap-5 py-20 text-center">
                <p className="font-display text-[clamp(22px,2.4vw,30px)] font-bold leading-tight text-muted">
                  Không tìm thấy thành viên nào khớp bộ lọc.
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  Xóa bộ lọc
                </Button>
              </div>
            ) : (
              <>
                <p className="font-code text-[14px] font-bold text-muted">
                  {'// '}hiện {firstItem}–{lastItem} / {total} thành viên
                </p>
                <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((member, index) => (
                    <article
                      key={member.id}
                      data-rv
                      style={{ '--d': `${Math.min(index, 8) * 45}ms` } as CSSProperties}
                      className="group relative flex min-w-0 flex-col justify-between gap-5 rounded-[20px] bg-soft p-6 transition-colors hover:bg-apc-blue-pale/40"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <MemberAvatar fullName={member.fullName} avatarUrl={member.avatarUrl} />
                          <div className="min-w-0 flex-1">
                            <h2 className="font-display text-[20px] font-extrabold leading-snug tracking-[-0.02em] text-ink">
                              <Link
                                to={`/portal/members/${member.id}`}
                                state={{ from }}
                                className="transition-colors group-hover:text-apc-red after:absolute after:inset-0"
                              >
                                {member.fullName}
                              </Link>
                            </h2>
                            <p className="mt-1 truncate font-code text-[13px] font-bold text-apc-blue">
                              {member.department?.name ?? 'Chưa phân ban'}
                            </p>
                          </div>
                        </div>

                        <DirectoryRoleBadges roles={member.roles} />

                        {member.skills.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="font-code text-[12px] font-bold lowercase text-muted">kỹ năng</p>
                            <DirectoryTagList items={member.skills} limit={3} />
                          </div>
                        )}

                        {member.interestAreas.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="font-code text-[12px] font-bold lowercase text-muted">quan tâm</p>
                            <DirectoryTagList items={member.interestAreas} limit={3} />
                          </div>
                        )}
                      </div>

                      <p className="border-t-2 border-ink/10 pt-3 font-code text-[13px] font-bold text-ink transition-colors group-hover:text-apc-red">
                        Xem hồ sơ <span aria-hidden>→</span>
                      </p>
                    </article>
                  ))}
                </div>

                {total > PAGE_SIZE && (
                  <div className="mt-12">
                    <Pagination
                      currentPage={page}
                      totalPages={totalPages}
                      onPageChange={(nextPage) => updateParams({ page: nextPage <= 1 ? null : String(nextPage) })}
                    />
                  </div>
                )}
              </>
            )}
          </AsyncState>
        </div>
      </section>
    </main>
  )
}
