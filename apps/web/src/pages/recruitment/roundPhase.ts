import type { RecruitmentRound } from './types'

export type RoundPhase = 'open' | 'upcoming' | 'closed'

type RoundTiming = Pick<RecruitmentRound, 'status' | 'opensAt' | 'closesAt'>

/** Đợt OPEN đang trong khoảng opensAt–closesAt là đang nhận đơn; OPEN mà chưa tới giờ là sắp mở; còn lại là đã đóng. */
export function roundPhase(round: RoundTiming, now = new Date()): RoundPhase {
  if (round.status !== 'OPEN' || now > new Date(round.closesAt)) return 'closed'
  return now < new Date(round.opensAt) ? 'upcoming' : 'open'
}

const PHASE_ORDER: Record<RoundPhase, number> = { open: 0, upcoming: 1, closed: 2 }

/** Đang mở lên đầu, rồi sắp mở, rồi đã đóng; cùng nhóm thì đợt mở gần đây đứng trước. */
export function sortRounds<T extends RoundTiming>(rounds: readonly T[], now = new Date()): T[] {
  return [...rounds].sort(
    (a, b) =>
      PHASE_ORDER[roundPhase(a, now)] - PHASE_ORDER[roundPhase(b, now)] ||
      new Date(b.opensAt).getTime() - new Date(a.opensAt).getTime(),
  )
}
