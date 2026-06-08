-- order_items 테이블 구조 개선
-- Supabase SQL Editor에서 실행하세요.

-- 1. 누락 컬럼 추가
alter table order_items add column if not exists subtotal              integer default 0;
alter table order_items add column if not exists menu_category_snapshot text;

-- 2. menu_id 컬럼 nullable로 변경 (메뉴 삭제 시 null 허용)
alter table order_items alter column menu_id drop not null;

-- 3. 기존 FK 제약 삭제 후 ON DELETE SET NULL으로 재설정
alter table order_items drop constraint if exists order_items_menu_id_fkey;
alter table order_items
  add constraint order_items_menu_id_fkey
  foreign key (menu_id)
  references menus(id)
  on delete set null;
