-- =====================================================================
-- 報修登記系統：Supabase 建表 SQL
-- ---------------------------------------------------------------------
-- 用途：建立報修資料表 repair_requests，並設定三層安全保護：
--   第 1 層 GRANT：決定 anon（未登入的網頁訪客）能碰哪張表、哪些欄位、能做哪些動作。
--   第 2 層 RLS  ：決定 anon 能讀、能新增「哪些資料列」。
--   第 3 層 CHECK：不管是誰寫入，欄位值與文字長度都必須合規。
-- 使用方式：到 Supabase 後台的 SQL Editor 貼上整份內容後執行。
-- 本檔可以重複執行（已存在的物件會略過或先移除再建立）。
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 建立資料表（含第 3 層 CHECK 限制）
-- ---------------------------------------------------------------------
-- 說明：
--   * id、created_at 由資料庫自動產生，網頁端不需要也不能填。
--   * 文字欄位先用 btrim() 去掉前後空白再算長度，避免只填空白就送出。
--   * category、urgency、status 只允許固定選項，填其他值會被資料庫拒絕。
create table if not exists public.repair_requests (
  -- 主鍵：自動產生的 uuid
  id            uuid        primary key default gen_random_uuid(),

  -- 建立時間：寫入當下自動填入（含時區）
  created_at    timestamptz not null default now(),

  -- 報修人姓名：1～50 字
  reporter_name text        not null
    constraint repair_requests_reporter_name_len
    check (char_length(btrim(reporter_name)) between 1 and 50),

  -- 地點或部門：1～100 字
  location      text        not null
    constraint repair_requests_location_len
    check (char_length(btrim(location)) between 1 and 100),

  -- 類別：只能是 設備／網路／環境／其他
  category      text        not null
    constraint repair_requests_category_allowed
    check (category in ('設備', '網路', '環境', '其他')),

  -- 問題說明：1～1000 字
  description   text        not null
    constraint repair_requests_description_len
    check (char_length(btrim(description)) between 1 and 1000),

  -- 緊急程度：只能是 低／中／高，沒填時預設「中」
  urgency       text        not null default '中'
    constraint repair_requests_urgency_allowed
    check (urgency in ('低', '中', '高')),

  -- 處理狀態：只能是 待處理／處理中／已完成，沒填時預設「待處理」
  status        text        not null default '待處理'
    constraint repair_requests_status_allowed
    check (status in ('待處理', '處理中', '已完成'))
);

comment on table public.repair_requests is '報修登記資料（示範用，請勿填入真實個人資料）';

-- 依建立時間排序清單時使用的索引（清單通常由新到舊顯示）
create index if not exists repair_requests_created_at_idx
  on public.repair_requests (created_at desc);

-- ---------------------------------------------------------------------
-- 第 1 層：GRANT（資料表與欄位權限）
-- ---------------------------------------------------------------------
-- 說明：
--   * 先把 public（所有角色）、anon、authenticated 的權限全部收回，
--     確保沒有任何預設或殘留的權限。
--   * 再只開放 anon 需要的最小權限：
--       - SELECT：可以讀取清單。
--       - INSERT：只能填 reporter_name、location、category、description、urgency。
--         id、created_at、status 不開放，網頁端無法自行指定，一律用預設值。
--   * 不給 UPDATE、DELETE、TRUNCATE，所以 anon 不能修改或刪除任何資料。
--   * authenticated（已登入使用者）本次不做登入，因此不給任何權限。
revoke all on table public.repair_requests from public;
revoke all on table public.repair_requests from anon;
revoke all on table public.repair_requests from authenticated;

grant select on table public.repair_requests to anon;

grant insert (reporter_name, location, category, description, urgency)
  on table public.repair_requests to anon;

-- ---------------------------------------------------------------------
-- 第 2 層：RLS（資料列安全）
-- ---------------------------------------------------------------------
-- 說明：
--   * 啟用 RLS 後，沒有被政策允許的動作一律拒絕。
--   * 只建立兩條政策：讀取、新增。沒有修改、刪除的政策，
--     所以即使日後不小心多給了 GRANT，RLS 仍會擋下修改與刪除。
alter table public.repair_requests enable row level security;

-- 讀取政策：任何人（anon）都可以讀取全部清單
drop policy if exists "anon 可以讀取報修清單" on public.repair_requests;
create policy "anon 可以讀取報修清單"
  on public.repair_requests
  for select
  to anon
  using (true);

-- 新增政策：任何人（anon）都可以新增，但 status 只能是「待處理」
-- （GRANT 已不讓 anon 指定 status，這裡是第二道保險）
drop policy if exists "anon 可以新增報修，狀態限待處理" on public.repair_requests;
create policy "anon 可以新增報修，狀態限待處理"
  on public.repair_requests
  for insert
  to anon
  with check (status = '待處理');

commit;
