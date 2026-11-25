create table public.mandatewright_batch_receipts (
  batch uuid primary key,
  received date not null default ((now() at time zone 'UTC')::date)
);
alter table public.mandatewright_batch_receipts enable row level security;
revoke all on public.mandatewright_batch_receipts from public, anon, authenticated;
grant select, insert on public.mandatewright_batch_receipts to service_role;

create function public.record_mandatewright_counters(
  version text, batch_id uuid, counters jsonb, cohort_day integer default null
) returns void
language sql security invoker set search_path = ''
as $$
  with period as (
    select coalesce(date '1970-01-01' + cohort_day,(now() at time zone 'UTC')::date) as report_day,
      (now() at time zone 'UTC')::date as today
  ), claimed as (
    insert into public.mandatewright_batch_receipts (batch)
    select batch_id from period where report_day between today - 89 and today
    on conflict do nothing returning batch
  )
  insert into public.mandatewright_counters as c (day,build,metric,total)
  select report_day,version,key,value::bigint
  from period cross join claimed cross join jsonb_each_text(counters)
  on conflict (day,build,metric) do update set total=c.total+excluded.total;
$$;
revoke execute on function public.record_mandatewright_counters(text,uuid,jsonb,integer) from public, anon, authenticated;
grant execute on function public.record_mandatewright_counters(text,uuid,jsonb,integer) to service_role;

select cron.schedule('mandatewright-prune-batches','23 2 * * *',
  $$delete from public.mandatewright_batch_receipts where received < (now() at time zone 'UTC')::date - 2$$);

create view public.mandatewright_funnel with (security_invoker=true) as
with cohort as (
  select day, build, total from public.mandatewright_counters where metric='funnel.begin'
)
select cohort.day as campaign_day,cohort.build,step.name as stage,step.ordinality as stage_number,
  cohort.total as started,coalesce(t.total,0) as reached,
  round(100.0*coalesce(t.total,0)/nullif(cohort.total,0),1) as pct_reached
from cohort cross join unnest(array['begin','party','launch','cabinet','vote','month1','month3','month12','election','nextCabinet'])
  with ordinality as step(name,ordinality)
left join public.mandatewright_counters t on (t.day,t.build,t.metric)=(cohort.day,cohort.build,'funnel.'||step.name)
order by cohort.day desc,cohort.build,step.ordinality;

create view public.mandatewright_load_times with (security_invoker=true) as
select day,build, sum(total) filter(where metric='load.samples') as loads,
  round(sum(total) filter(where metric='load.ms') /
    nullif(sum(total) filter(where metric='load.samples'),0) / 1000.0,2) as avg_seconds,
  coalesce(sum(total) filter(where metric='load.under1'),0) as under_1s,
  coalesce(sum(total) filter(where metric='load.under3'),0) as from_1_to_3s,
  coalesce(sum(total) filter(where metric='load.under10'),0) as from_3_to_10s,
  coalesce(sum(total) filter(where metric='load.over10'),0) as at_least_10s
from public.mandatewright_counters where metric like 'load.%'
group by day,build order by day desc,build;

create view public.mandatewright_issues with (security_invoker=true) as
select day,build,split_part(metric,'.',1) as category,split_part(metric,'.',2) as section_or_action,
  split_part(metric,'.',3) as kind_or_reason,nullif(split_part(metric,'.',4),'') as reason,total
from public.mandatewright_counters
where metric like 'error.%' or metric like 'failure.%' or metric like 'attempt.%'
order by day desc,build,total desc;

create view public.mandatewright_balance with (security_invoker=true) as
with daily as (
  select day,build,jsonb_object_agg(split_part(metric,'.',2),total) as totals
  from public.mandatewright_counters where metric like 'balance.%' group by day,build
)
select day,build,coalesce((totals->>'campaignMonths')::bigint,0) as campaign_months,
  coalesce((totals->>'defaults')::bigint,0) as defaults,
  round(1200.0*coalesce((totals->>'defaults')::bigint,0)/nullif((totals->>'campaignMonths')::bigint,0),2) as defaults_per_100_campaign_years,
  coalesce((totals->>'coalitionBreakups')::bigint,0) as coalition_breakups,
  coalesce((totals->>'elections')::bigint,0) as elections,
  coalesce((totals->>'electionLosses')::bigint,0) as election_losses,
  coalesce((totals->>'cabinetsEnded')::bigint,0) as cabinets_ended,
  round((totals->>'cabinetMonths')::numeric/nullif((totals->>'cabinetsEnded')::bigint,0),1) as avg_completed_cabinet_months
from daily order by day desc,build;

create view public.mandatewright_reforms with (security_invoker=true) as
select day,build,split_part(metric,'.',3) as reform,
  coalesce(sum(total) filter(where metric like 'reform.proposed.%'),0) as proposed,
  coalesce(sum(total) filter(where metric like 'reform.passed.%'),0) as passed
from public.mandatewright_counters where metric like 'reform.%'
group by day,build,split_part(metric,'.',3) order by day desc,build,proposed desc;

revoke all on public.mandatewright_funnel, public.mandatewright_load_times, public.mandatewright_issues,
  public.mandatewright_balance, public.mandatewright_reforms from public, anon, authenticated;
