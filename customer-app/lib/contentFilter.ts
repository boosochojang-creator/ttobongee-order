// Phase 5-2-a: 게시글/댓글 공용 콘텐츠 필터 (욕설·비속어·전화번호) — 등록 시점 검사.
// 3곳(음악/오락실/게시판) 공통. 목록은 3분류(일반/최신/초성)로 분리 관리 — 운영하며 추가.
// 우회 방지 범위(v1): 공백·특수문자 제거 + 같은 글자 반복 축약.
// 확장 과제(추후): 실시간 입력중 차단, 모음 삽입형 우회(시이이발) 등 고급 우회 탐지.

const BADWORDS_COMMON = [ // 일반 욕설
  '시발', '씨발', '시팔', '씨팔', '개새끼', '새끼', '병신', '지랄', '좆', '좃', '존나', '엿먹어',
  '미친놈', '미친년', '개년', '창녀', '걸레', '보지', '자지', '섹스', '썅', '썅년', '닥쳐', '꺼져',
]
const BADWORDS_RECENT = [ // 최신 비속어/변형 (운영하며 추가)
  '한남충', '한녀', '김치녀', '급식충', '틀딱', '맘충', '진지충', '극혐',
]
const BADWORDS_CHOSUNG = [ // 초성 조합
  'ㅅㅂ', 'ㅄ', 'ㅂㅅ', 'ㅈㄹ', 'ㄷㅊ', 'ㄲㅈ', 'ㅆㅂ', 'ㅁㅊ', 'ㅗ',
]
const BADWORDS = [...BADWORDS_COMMON, ...BADWORDS_RECENT, ...BADWORDS_CHOSUNG]

// 우회 방지: 소문자화 + 공백/제로폭/특수문자 제거 + 반복문자 축약(시이이발→시발류)
export function normalizeForFilter(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[\s​‌‍﻿]+/g, '')
    .replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]/g, '')
    .replace(/(.)\1+/g, '$1')
}

export function hasProfanity(text: string): boolean {
  const n = normalizeForFilter(text)
  // 초성 금칙어는 원본 기준으로도 확인(반복축약이 초성을 뭉갤 수 있어 별도), 나머지는 정규화본 기준
  const rawNoSpace = (text || '').replace(/\s+/g, '')
  return BADWORDS.some(w => n.includes(normalizeForFilter(w)) || rawNoSpace.includes(w))
}

// 전화번호 패턴(휴대폰) — 구분자/공백 무관하게 숫자만 뽑아 판정
export function hasPhoneNumber(text: string): boolean {
  const digits = (text || '').replace(/\D/g, '')
  return /01[016789]\d{7,8}/.test(digits)
}

export type FilterResult = { ok: boolean; reason?: string }

export function checkContent(text: string): FilterResult {
  if (!text || !text.trim()) return { ok: false, reason: '내용을 입력해주세요' }
  if (hasProfanity(text)) return { ok: false, reason: '욕설·비속어가 포함되어 등록할 수 없어요' }
  if (hasPhoneNumber(text)) return { ok: false, reason: '전화번호 등 개인정보는 등록할 수 없어요' }
  return { ok: true }
}

// 닉네임 미설정 시 자동 부여 ("손님1234")
export function generateNickname(): string {
  return `손님${1000 + Math.floor(Math.random() * 9000)}`
}

export const BOARD_WARNING = '욕설·비속어·개인정보(전화번호 등) 포함 시 등록이 제한됩니다'
