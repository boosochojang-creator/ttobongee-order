-- 또봉이통닭 메뉴 테이블 수정
-- Supabase SQL Editor에서 실행하세요.

-- 1. 컬럼 추가 (없으면 추가)
alter table menus add column if not exists sort_order  integer default 0;
alter table menus add column if not exists is_available boolean default true;

-- 2. baegun 메뉴 전체 초기화
delete from menus where store_id = 'baegun';

-- 3. 세트메뉴
insert into menus (store_id, category, name, price, sort_order, is_available) values
('baegun', '세트메뉴', '또봉이통닭 두마리',              26900, 10, true),
('baegun', '세트메뉴', '또봉이통닭+똥집튀김',             22900, 20, true),
('baegun', '세트메뉴', '또봉이통닭+양념통닭',             28000, 30, true),
('baegun', '세트메뉴', '또봉이통닭+국물떡볶이',            24900, 40, true),
('baegun', '세트메뉴', '또봉이통닭+왕고추튀김(3개)',        25000, 50, true),
('baegun', '세트메뉴', '또봉이통닭+치즈볼(5개)',           18000, 60, true);

-- 4. 치킨류
insert into menus (store_id, category, name, price, sort_order, is_available) values
('baegun', '치킨류', '또봉이통닭',      14000, 10, true),
('baegun', '치킨류', '반반',            15000, 20, true),
('baegun', '치킨류', '양념통닭',        15000, 30, true),
('baegun', '치킨류', 'THE크리스피',     15000, 40, true),
('baegun', '치킨류', '맵닭',           16000, 50, true),
('baegun', '치킨류', '갈비통닭',        16000, 60, true),
('baegun', '치킨류', '깐풍통닭',        16000, 70, true),
('baegun', '치킨류', '고추통닭',        16000, 80, true),
('baegun', '치킨류', '간장마늘통닭',     17000, 90, true),
('baegun', '치킨류', '고추마요통닭',     16000, 100, true),
('baegun', '치킨류', '고추마요순살',     17000, 110, true),
('baegun', '치킨류', '조청간장통닭',     17000, 120, true),
('baegun', '치킨류', '레드갓치킨',      17000, 130, true),
('baegun', '치킨류', '파닭',           17000, 140, true),
('baegun', '치킨류', '빠다후추순살',     18000, 150, true),
('baegun', '치킨류', '조청간장순살',     17000, 160, true),
('baegun', '치킨류', '레드갓순살',      18000, 170, true),
('baegun', '치킨류', '순살후라이드',     16000, 180, true),
('baegun', '치킨류', '양념순살',        17000, 190, true),
('baegun', '치킨류', '날개&다리',       20000, 200, true);

-- 5. 안주류
insert into menus (store_id, category, name, price, sort_order, is_available) values
('baegun', '안주류', '똥집튀김',               10000, 10, true),
('baegun', '안주류', '양념똥집튀김',            10000, 20, true),
('baegun', '안주류', '국물떡볶이',              12000, 30, true),
('baegun', '안주류', '어묵탕',                 15000, 40, true),
('baegun', '안주류', '얼큰새뱅이탕',            16000, 50, true),
('baegun', '안주류', '무배/튤립닭발',           15000, 60, true),
('baegun', '안주류', '치즈볼 5개',              5000, 70, true),
('baegun', '안주류', '치즈볼 10개',            10000, 80, true),
('baegun', '안주류', '새우볼 5개',              5000, 90, true),
('baegun', '안주류', '새우볼 10개',            10000, 100, true),
('baegun', '안주류', '김치어묵우동전골',         20000, 110, true),
('baegun', '안주류', '소떡소떡 1개',             3000, 120, true),
('baegun', '안주류', '마른안주모듬',             15000, 130, true),
('baegun', '안주류', '먹대',                   15000, 140, true),
('baegun', '안주류', '골뱅이소면',              20000, 150, true),
('baegun', '안주류', '킬바사소세지',             13000, 160, true),
('baegun', '안주류', '오돌뼈',                  13000, 170, true),
('baegun', '안주류', '꼬꼬닭껍질만두 10ea',      10000, 180, true),
('baegun', '안주류', '한입츄러스 10ea',          10000, 190, true),
('baegun', '안주류', '편노가리 3ea',             8000, 200, true),
('baegun', '안주류', '왕새우튀김 5ea',            8000, 210, true),
('baegun', '안주류', '왕새우튀김 10ea',          15000, 220, true),
('baegun', '안주류', '대왕고추튀김 3ea',         12000, 230, true),
('baegun', '안주류', '감자튀김 500g',             8000, 240, true),
('baegun', '안주류', '짬뽕탕',                  20000, 250, true),
('baegun', '안주류', '두부김치',                18000, 260, true),
('baegun', '안주류', '황도',                    8000, 270, true),
('baegun', '안주류', '번데기탕',                 8000, 280, true),
('baegun', '안주류', '우동',                    6000, 290, true),
('baegun', '안주류', '라면',                    4000, 300, true),
('baegun', '안주류', '닭가슴살샐러드',           16000, 310, true),
('baegun', '안주류', '제철과일',                16000, 320, true),
('baegun', '안주류', '공깃밥+계란',              3000, 330, true),
('baegun', '안주류', '민물새우깡',               8000, 340, true),
('baegun', '안주류', '샐러드추가(3번부터)',        1500, 350, true);

-- 6. 음료/주류 (카테고리명 '음료/주류' 로 통일 — 기존 '주류&음료' 버그 수정)
insert into menus (store_id, category, name, price, sort_order, is_available) values
('baegun', '음료/주류', '생맥주 300cc',      3400, 10, true),
('baegun', '음료/주류', '생맥주 500cc',      4500, 20, true),
('baegun', '음료/주류', '생맥주 1000cc(포장)', 8000, 30, true),
('baegun', '음료/주류', '음료(소)',           2500, 40, true),
('baegun', '음료/주류', '음료(대)',           4000, 50, true),
('baegun', '음료/주류', '병맥주',            5000, 60, true),
('baegun', '음료/주류', '소주',              5000, 70, true),
('baegun', '음료/주류', '청하',              6000, 80, true),
('baegun', '음료/주류', '막걸리',            4000, 90, true),
('baegun', '음료/주류', '진도울금막걸리',     5000, 100, true);
