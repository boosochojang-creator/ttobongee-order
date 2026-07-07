-- Phase 5-2 오락실/음악감상실/자유게시판 — 통합 게시판 + 게임/음악 관리 + 스토리지 버킷
-- Supabase SQL Editor에서 실행. (닉네임은 users.nickname(016) 재사용 — 추가 없음)

-- 통합 게시글 (source로 3곳 구분, 손님 화면은 분리·오너는 한곳에서 조회)
create table if not exists posts (
  id              uuid primary key default uuid_generate_v4(),
  store_id        text references stores(id) default 'baegun',
  source          text not null check (source in ('music', 'arcade', 'board')),
  user_id         uuid references users(id) on delete set null,
  author_name     text not null,                  -- 표시명(닉네임 스냅샷 또는 '익명')
  is_anonymous    boolean not null default false,
  is_secret       boolean not null default false, -- 자유게시판 전용
  secret_pw_hash  text,                            -- 비밀글 비번(해시)
  image_url       text,                            -- 비밀글 첨부(압축본), 90일 후 null 처리
  image_purged_at timestamptz,
  content         text not null,
  created_at      timestamptz default now()
);
create index if not exists idx_posts_source on posts(store_id, source, created_at desc);

-- 댓글 (3곳 글 모두 가능)
create table if not exists comments (
  id           uuid primary key default uuid_generate_v4(),
  post_id      uuid not null references posts(id) on delete cascade,
  user_id      uuid references users(id) on delete set null,
  author_name  text not null,
  is_anonymous boolean not null default false,
  content      text not null,
  created_at   timestamptz default now()
);
create index if not exists idx_comments_post on comments(post_id, created_at);

-- 오락실 게임 목록 (온/오프, 확장 대비)
create table if not exists arcade_games (
  id         uuid primary key default uuid_generate_v4(),
  store_id   text references stores(id) default 'baegun',
  name       text not null,            -- 오리지널 이름
  file_key   text not null,            -- public/games/<file_key>.html
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

-- 음악감상실 곡 목록
create table if not exists music_tracks (
  id         uuid primary key default uuid_generate_v4(),
  store_id   text references stores(id) default 'baegun',
  title      text not null,
  url        text not null,            -- Supabase Storage (music 버킷)
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

-- 스토리지 버킷: music(공개·재생용), post-images(비공개·비밀글 사진)
insert into storage.buckets (id, name, public)
values ('music', 'music', true), ('post-images', 'post-images', false)
on conflict (id) do nothing;
