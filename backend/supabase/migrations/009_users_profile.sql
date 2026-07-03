-- 그룹 B-2: 회원 상태 확장 + 추가정보(생일·주소·이메일·마케팅동의)
-- Supabase SQL Editor에서 실행하세요. (배포 전에 반드시 먼저 실행!)

-- 1. 추가정보 필드
alter table users add column if not exists birthday date;
alter table users add column if not exists address  text;
alter table users add column if not exists email    text;

-- 2. 상태값 체계 (guest는 DB에 행이 없는 비회원이므로 저장 안 함)
alter table users add column if not exists member_status text not null default 'phone_member';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_member_status_check') then
    alter table users add constraint users_member_status_check
      check (member_status in ('phone_member', 'profile_incomplete', 'profile_complete'));
  end if;
end $$;

-- 3. 마케팅 동의 + 추적 필드 (아렌 문서 체계)
alter table users add column if not exists marketing_opt_in             boolean not null default false;
alter table users add column if not exists profile_completed_at         timestamptz;
alter table users add column if not exists profile_prompt_dismissed_at  timestamptz;
alter table users add column if not exists profile_prompt_dismiss_count integer not null default 0;
alter table users add column if not exists last_profile_prompt_shown_at timestamptz;
alter table users add column if not exists address_saved                boolean not null default false;
alter table users add column if not exists birthday_saved               boolean not null default false;

-- 4. 기존 회원은 전부 '전화번호만 가입' 상태로 시작
update users set member_status = 'phone_member' where member_status is null;
