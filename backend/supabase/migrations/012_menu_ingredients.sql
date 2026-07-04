-- 그룹 F-1: 자재마이닝용 레시피 테이블 (DDL 초안 — Supabase SQL Editor에서 실행)
-- 메뉴 1개 판매당 들어가는 자재량을 등록해 두면, 통계 화면이 기간별 자재 소요량을 계산합니다.

create table if not exists menu_ingredients (
  id                  uuid primary key default uuid_generate_v4(),
  menu_id             uuid not null references menus(id) on delete cascade,
  ingredient_name     text not null,        -- 예: 생닭, 튀김가루, 식용유
  amount_per_serving  numeric not null,     -- 1개 판매당 소요량 (예: 1, 150)
  unit                text not null,        -- 단위 (마리, g, ml, 개 ...)
  created_at          timestamptz default now()
);

create index if not exists idx_menu_ingredients_menu on menu_ingredients(menu_id);

-- 입력 예시 (menus 테이블에서 메뉴 id 확인 후):
-- insert into menu_ingredients (menu_id, ingredient_name, amount_per_serving, unit) values
--   ('<또봉이통닭 메뉴 id>', '생닭(10호)', 1, '마리'),
--   ('<또봉이통닭 메뉴 id>', '튀김가루', 180, 'g'),
--   ('<또봉이통닭 메뉴 id>', '식용유', 120, 'ml');
