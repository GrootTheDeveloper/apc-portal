import { useState } from 'react'

import { DIRECTORY_ROLE_LABEL, type DirectoryRole, formatDirectoryRole, safeAvatarSrc } from './types'

export function MemberAvatar({
  fullName,
  avatarUrl,
  size = 'md',
}: {
  fullName: string
  avatarUrl: string | null
  size?: 'md' | 'lg'
}) {
  const [broken, setBroken] = useState(false)
  const src = broken ? null : safeAvatarSrc(avatarUrl)
  const initial = fullName.trim().charAt(0).toUpperCase() || '?'
  const boxClass = size === 'lg' ? 'h-24 w-24 text-3xl' : 'h-14 w-14 text-xl'

  return (
    <div
      className={`${boxClass} shrink-0 overflow-hidden rounded-full bg-apc-blue-pale shadow-[inset_0_0_0_2px_#081F3D]`}
    >
      {src ? (
        <img
          src={src}
          alt={fullName}
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <div
          aria-hidden
          className="flex h-full w-full items-center justify-center font-display font-extrabold text-apc-blue"
        >
          {initial}
        </div>
      )}
    </div>
  )
}

export function DirectoryRoleBadges({
  roles,
  showAll = false,
}: {
  roles: DirectoryRole[]
  showAll?: boolean
}) {
  const elevated = roles.filter((r) => r.role !== 'MEMBER')
  const visible = showAll || elevated.length === 0 ? roles : elevated

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((grant, index) => {
        const badgeClass =
          grant.role === 'BOARD'
            ? 'bg-apc-red-pale text-apc-red'
            : grant.role === 'DEPARTMENT_MANAGER'
              ? 'bg-apc-gold-pale text-apc-gold-deep'
              : grant.role === 'TECH_ADMIN'
                ? 'bg-ink text-paper'
                : 'bg-paper text-ink'
        return (
          <span
            key={`${grant.role}-${grant.departmentId ?? 'all'}-${index}`}
            className={`rounded-md px-2.5 py-1 font-code text-[12px] font-bold ${badgeClass}`}
          >
            {showAll ? formatDirectoryRole(grant) : (DIRECTORY_ROLE_LABEL[grant.role] ?? grant.role)}
          </span>
        )
      })}
    </div>
  )
}

export function DirectoryTagList({
  items,
  limit,
  emptyText,
  tone = 'paper',
}: {
  items: string[]
  limit?: number
  emptyText?: string
  tone?: 'paper' | 'soft'
}) {
  if (items.length === 0) {
    return emptyText ? <p className="text-[15px] text-muted">{emptyText}</p> : null
  }
  const shown = limit ? items.slice(0, limit) : items
  const remaining = limit ? Math.max(0, items.length - limit) : 0
  const chipBg = tone === 'soft' ? 'bg-soft text-ink' : 'bg-paper text-ink'

  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((item) => (
        <span
          key={item}
          className={`rounded-md px-2.5 py-1 font-code text-[12px] font-bold ${chipBg}`}
        >
          {item}
        </span>
      ))}
      {remaining > 0 && (
        <span className="rounded-md bg-apc-blue-pale px-2.5 py-1 font-code text-[12px] font-bold text-apc-blue">
          +{remaining}
        </span>
      )}
    </div>
  )
}
