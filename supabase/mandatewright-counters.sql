create table public.mandatewright_counters (
  day date not null,
  build text not null,
  metric text not null,
  total bigint not null check (total > 0),
  primary key (day, build, metric)
);
alter table public.mandatewright_counters enable row level security;
revoke all on public.mandatewright_counters from public, anon, authenticated;
grant select, insert, update on public.mandatewright_counters to service_role;

create function public.increment_mandatewright_counters(version text, counters jsonb) returns void
language sql security invoker set search_path = ''
as $$
  insert into public.mandatewright_counters as c (day, build, metric, total)
  select (now() at time zone 'UTC')::date, version, key, value::bigint
  from jsonb_each_text(counters)
  on conflict (day, build, metric) do update set total = c.total + excluded.total;
$$;
revoke all on function public.increment_mandatewright_counters(text,jsonb) from public, anon, authenticated;
grant execute on function public.increment_mandatewright_counters(text,jsonb) to service_role;

create view public.mandatewright_gameplay with (security_invoker = true) as
select day, build,
  coalesce(sum(total) filter (where metric = 'menu'),0) as clicked_new_or_load,
  coalesce(sum(total) filter (where metric = 'play'),0) as play_starts,
  coalesce(sum(total) filter (where metric = 'newGame'),0) as new_campaigns,
  coalesce(sum(total) filter (where metric = 'resume'),0) as resumed_campaigns,
  round(coalesce(sum(total) filter (where metric = 'seconds'),0) / 60.0,1) as total_minutes,
  coalesce(sum(total) filter (where metric = 'played5'),0) as played_5_minutes,
  coalesce(sum(total) filter (where metric = 'played15'),0) as played_15_minutes,
  coalesce(sum(total) filter (where metric = 'party'),0) as chose_party,
  coalesce(sum(total) filter (where metric = 'cabinet'),0) as formed_cabinet,
  coalesce(sum(total) filter (where metric = 'vote'),0) as voted,
  coalesce(sum(total) filter (where metric = 'month1'),0) as month_1,
  coalesce(sum(total) filter (where metric = 'month3'),0) as month_3,
  coalesce(sum(total) filter (where metric = 'month12'),0) as month_12,
  coalesce(sum(total) filter (where metric = 'election'),0) as election,
  coalesce(sum(total) filter (where metric = 'nextCabinet'),0) as next_cabinet,
  coalesce(sum(total) filter (where metric = 'budget'),0) as budget,
  coalesce(sum(total) filter (where metric = 'parliament'),0) as parliament,
  coalesce(sum(total) filter (where metric = 'map'),0) as map,
  coalesce(sum(total) filter (where metric = 'newspaper'),0) as newspaper,
  coalesce(sum(total) filter (where metric = 'save'),0) as saved
from public.mandatewright_counters
group by day, build order by day desc, build;
revoke all on public.mandatewright_gameplay from public, anon, authenticated;
