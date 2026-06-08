-- stores 테이블 PIN 컬럼 추가
alter table stores add column if not exists pin_code text not null default '1234';
