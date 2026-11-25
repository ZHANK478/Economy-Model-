create extension if not exists pg_cron with schema pg_catalog;

create table public.mandatewright_sessions (
  browser_hash text not null check (browser_hash ~ '^[0-9a-f]{64}$'),
  visit uuid not null,
  day date not null,
  build text not null check (build ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'),
  active_seconds integer not null check (active_seconds between 0 and 86400),
  milestones integer not null check (milestones between 1 and 32767),
  arrival bigint generated always as identity,
  primary key (browser_hash, visit, day)
);
alter table public.mandatewright_sessions enable row level security;
revoke all on public.mandatewright_sessions from public, anon, authenticated;

create function public.record_mandatewright_session(
  browser text, session_id uuid, utc_day date, version text, seconds integer, flags integer
) returns void
language sql security invoker set search_path = ''
as $$
  insert into public.mandatewright_sessions as s
    (browser_hash, visit, day, build, active_seconds, milestones)
  select browser, session_id, utc_day, version, seconds, flags
  where utc_day between (now() at time zone 'UTC')::date - 1 and (now() at time zone 'UTC')::date + 1
  on conflict (browser_hash, visit, day) do update set
    active_seconds = greatest(s.active_seconds, excluded.active_seconds),
    milestones = s.milestones | excluded.milestones;
$$;
revoke execute on function public.record_mandatewright_session(text, uuid, date, text, integer, integer) from public, anon, authenticated;
grant execute on function public.record_mandatewright_session(text, uuid, date, text, integer, integer) to service_role;
grant insert, update, select on public.mandatewright_sessions to service_role;

create view public.mandatewright_daily with (security_invoker = true) as
select day, build,
  count(distinct browser_hash) as menu_browsers,
  count(distinct browser_hash) filter (where milestones & 4 <> 0) as playing_browsers,
  count(*) filter (where milestones & 4 <> 0) as playing_sessions,
  round((percentile_cont(0.5) within group (order by active_seconds)
    filter (where milestones & 4 <> 0) / 60.0)::numeric, 1) as median_minutes,
  count(distinct browser_hash) filter (where milestones & 1024 <> 0) as budget,
  count(distinct browser_hash) filter (where milestones & 2048 <> 0) as parliament,
  count(distinct browser_hash) filter (where milestones & 4096 <> 0) as map,
  count(distinct browser_hash) filter (where milestones & 8192 <> 0) as newspaper,
  count(distinct browser_hash) filter (where milestones & 16384 <> 0) as saved
from public.mandatewright_sessions group by day, build order by day desc, build;

create view public.mandatewright_cohorts with (security_invoker = true) as
with first_play as (
  select distinct on (browser_hash) browser_hash, day, build, visit
  from public.mandatewright_sessions where milestones & 4 <> 0
  order by browser_hash, day, arrival
), players as (
  select f.browser_hash, f.day, f.build,
    sum(s.active_seconds) filter (where s.visit = f.visit) as first_session_seconds,
    bit_or(s.milestones) filter (where s.visit = f.visit) as first_session_steps,
    bit_or(s.milestones) as steps,
    bool_or(s.day = f.day + 1 and s.visit <> f.visit and s.milestones & 4 <> 0) as d1,
    bool_or(s.day = f.day + 7 and s.visit <> f.visit and s.milestones & 4 <> 0) as d7
  from first_play f join public.mandatewright_sessions s using (browser_hash)
  group by f.browser_hash, f.day, f.build
)
select day as first_play_day, build, count(*) as new_players,
  case when day + 1 < (now() at time zone 'UTC')::date then count(*) filter (where d1) end as returned_d1,
  case when day + 7 < (now() at time zone 'UTC')::date then count(*) filter (where d7) end as returned_d7,
  round((percentile_cont(0.5) within group (order by first_session_seconds) / 60.0)::numeric, 1) as first_session_median_minutes,
  count(*) filter (where first_session_steps & 2 <> 0) as first_session_party_chosen,
  count(*) filter (where first_session_steps & 8 <> 0) as first_session_cabinet,
  count(*) filter (where first_session_steps & 16 <> 0) as first_session_vote,
  count(*) filter (where first_session_steps & 32 <> 0) as first_session_month_1,
  count(*) filter (where first_session_steps & 64 <> 0) as first_session_month_3,
  count(*) filter (where steps & 128 <> 0) as month_12,
  count(*) filter (where steps & 256 <> 0) as election,
  count(*) filter (where steps & 512 <> 0) as second_cabinet
from players group by day, build order by day desc, build;
revoke all on public.mandatewright_daily, public.mandatewright_cohorts from public, anon, authenticated;

select cron.schedule('mandatewright-delete-old-analytics', '37 2 * * *',
  $$delete from public.mandatewright_sessions where day < (now() at time zone 'UTC')::date - 89$$);
