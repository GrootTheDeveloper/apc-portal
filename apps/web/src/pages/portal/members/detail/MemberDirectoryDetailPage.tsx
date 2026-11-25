import { Link, useLocation, useParams } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { buttonClass } from '../../../../components/buttonClass'
import { Eyebrow } from '../../../../components/Eyebrow'
import { Seo } from '../../../../components/Seo'
import { useApi } from '../../../../hooks/useApi'
import { NotFound } from '../../../NotFound'
import { DirectoryRoleBadges, DirectoryTagList, MemberAvatar } from '../MemberBadges'
import type { DirectoryMember } from '../types'

/** PAGE-MEM-10 — Hồ sơ danh bạ thành viên (T6, MEM-10): chỉ hiển thị thông tin cơ bản, không có MSSV/email/SĐT. */
export function MemberDirectoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const state = location.state as { from?: string } | null
  const backTo = state?.from && state.from.startsWith('/portal/members') ? state.from : '/portal/members'

  const { data: member, loading, error, reload } = useApi<DirectoryMember>(id ? `/portal/members/${id}` : null)

  if (!id || error?.status === 404) {
    return <NotFound compact home="/portal/members" />
  }

  return (
    <main>
      <AsyncState loading={loading} error={error} empty={!member} emptyText="Không tìm thấy thành viên." onRetry={reload}>
        {member && (
          <article>
            <Seo
              title={member.fullName}
              description="Hồ sơ danh bạ thành viên CLB APC."
              path={`/portal/members/${id}`}
              robots="noindex, nofollow"
            />

            <div className="flex flex-col gap-6 rounded-[20px] bg-soft p-6 sm:flex-row sm:items-center sm:p-8">
              <MemberAvatar fullName={member.fullName} avatarUrl={member.avatarUrl} size="lg" />
              <div className="min-w-0 flex-1">
                <Eyebrow className="text-apc-blue">hồ sơ danh bạ</Eyebrow>
                <h1 className="mt-2 font-display text-[clamp(28px,3.6vw,44px)] font-extrabold leading-tight tracking-[-0.03em] text-ink">
                  {member.fullName}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-apc-blue-pale px-3 py-1 font-code text-[13px] font-bold text-apc-blue">
                    {member.department?.name ?? 'Chưa phân ban'}
                  </span>
                </div>
              </div>
            </div>

            <section data-rv className="mt-8 space-y-6">
              <div className="border-t-2 border-ink pt-6">
                <h2 className="font-code text-[14px] font-bold lowercase text-muted">
                  {'// '}vai trò tại câu lạc bộ
                </h2>
                <div className="mt-3">
                  <DirectoryRoleBadges roles={member.roles} showAll />
                </div>
              </div>

              <div className="border-t-2 border-ink/20 pt-6">
                <h2 className="font-code text-[14px] font-bold lowercase text-muted">{'// '}kỹ năng</h2>
                <div className="mt-3">
                  <DirectoryTagList
                    items={member.skills}
                    tone="soft"
                    emptyText="Thành viên chưa cập nhật kỹ năng."
                  />
                </div>
              </div>

              <div className="border-t-2 border-ink/20 pt-6">
                <h2 className="font-code text-[14px] font-bold lowercase text-muted">
                  {'// '}lĩnh vực quan tâm
                </h2>
                <div className="mt-3">
                  <DirectoryTagList
                    items={member.interestAreas}
                    tone="soft"
                    emptyText="Thành viên chưa cập nhật lĩnh vực quan tâm."
                  />
                </div>
              </div>

              <div className="border-t-2 border-ink pt-6">
                <Link to={backTo} className={buttonClass('outline')}>
                  ← Quay lại danh bạ
                </Link>
              </div>
            </section>
          </article>
        )}
      </AsyncState>
    </main>
  )
}
