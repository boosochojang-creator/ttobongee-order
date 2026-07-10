// 그룹 B-2: 회원 상태값 체계
// guest(비회원) / phone_member(전화번호만) / profile_incomplete(일부 입력) / profile_complete(전부 입력)
// 저장 위치: pwaInstall.ts의 ttobongee-member-v1 키를 그대로 확장 (status 없는 옛 데이터 = phone_member로 인식)
import { MEMBER_KEY } from './pwaInstall'

export type MemberStatus = 'guest' | 'phone_member' | 'profile_incomplete' | 'profile_complete'

export type MemberLocal = {
  userId: string
  phone: string
  joinedAt?: number
  status?: MemberStatus
  marketingOptIn?: boolean
}

const PROMPT_DATE_KEY = 'profile-prompt-dismissed-date'   // "오늘은 안 하기" 누른 날짜 (당일 재노출 금지)
const PROMPT_COUNT_KEY = 'profile-prompt-dismiss-count'   // 누적 닫기 횟수 (3회 이상이면 자동 카드 중단)
export const PROMPT_MAX_DISMISS = 3

// 사용자 식별용 표시명 — 닉네임을 설정했으면 그것을, 없으면 전화번호 끝 4자리를 반환.
// 인사말·안내 등 '○○님' 형태로 쓰는 모든 곳에서 공통 사용 (닉네임 우선 표시).
export function greetingLabel(nickname: string | null | undefined, phone: string | null | undefined): string {
  const nk = (nickname || '').trim()
  return nk || (phone || '').slice(-4)
}

export function getMemberLocal(): MemberLocal | null {
  try {
    const raw = localStorage.getItem(MEMBER_KEY)
    if (!raw) return null
    const m = JSON.parse(raw)
    return m && m.userId ? m : null
  } catch { return null }
}

export function getMemberStatus(): MemberStatus {
  const m = getMemberLocal()
  if (!m) return 'guest'
  return m.status || 'phone_member' // 그룹 A 보강분(최소 상태) 데이터는 status가 없음 → phone_member
}

export function updateMemberLocal(patch: Partial<MemberLocal>) {
  const m = getMemberLocal()
  if (!m) return
  try { localStorage.setItem(MEMBER_KEY, JSON.stringify({ ...m, ...patch })) } catch {}
}

// 입력값 조합 → 상태 계산: 셋 다 비면 phone_member, 일부만 있으면 incomplete, 셋 다 있으면 complete
export function computeStatus(birthday: string, address: string, email: string): MemberStatus {
  const filled = [birthday, address, email].filter(v => (v || '').trim() !== '').length
  if (filled === 0) return 'phone_member'
  if (filled === 3) return 'profile_complete'
  return 'profile_incomplete'
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function getPromptDismissCount(): number {
  try { return Number(localStorage.getItem(PROMPT_COUNT_KEY) || 0) } catch { return 0 }
}

// 추가정보 안내 카드 노출 조건
export function shouldShowProfilePrompt(): boolean {
  const status = getMemberStatus()
  if (status !== 'phone_member' && status !== 'profile_incomplete') return false
  try {
    if (localStorage.getItem(PROMPT_DATE_KEY) === todayStr()) return false // 오늘은 안 하기
    if (getPromptDismissCount() >= PROMPT_MAX_DISMISS) return false        // 3회 이상 → 자동 카드 중단
  } catch {}
  return true
}

// "오늘은 안 하기" 처리 — 새 누적 횟수 반환 (DB 기록은 호출부에서)
export function dismissProfilePromptToday(): number {
  const count = getPromptDismissCount() + 1
  try {
    localStorage.setItem(PROMPT_DATE_KEY, todayStr())
    localStorage.setItem(PROMPT_COUNT_KEY, String(count))
  } catch {}
  return count
}
