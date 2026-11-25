create view public.mandatewright_returns with (security_invoker = true) as
with daily as (
  select day,
    coalesce(sum(total) filter (where metric = 'newBrowser'),0) as new_browsers,
    coalesce(sum(total) filter (where metric = 'returnD1'),0) as d1,
    coalesce(sum(total) filter (where metric = 'returnD7'),0) as d7
  from public.mandatewright_counters
  where metric in ('newBrowser','returnD1','returnD7')
  group by day
)
select start.day as first_play_day, start.new_browsers,
  case when start.day + 1 < (now() at time zone 'UTC')::date then coalesce(next_day.d1,0) end as returned_next_day,
  case when start.day + 7 < (now() at time zone 'UTC')::date then coalesce(next_week.d7,0) end as returned_day_7
from daily start
left join daily next_day on next_day.day = start.day + 1
left join daily next_week on next_week.day = start.day + 7
where start.new_browsers > 0
order by start.day desc;
revoke all on public.mandatewright_returns from public, anon, authenticated;
