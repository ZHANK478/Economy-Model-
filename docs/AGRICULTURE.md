# Agriculture resilience — economic revision 12

## Evidence and scope

IPCC AR6 SYR SPM, C.3: effective adaptation includes improved cultivars, water
management/storage, irrigation, soil moisture conservation and diversification:
https://www.ipcc.ch/report/ar6/syr/summary-for-policymakers/
IPCC AR6 WGII Technical Summary describes limits from water availability and
financial barriers; adaptation is not complete immunity:
https://www.ipcc.ch/report/ar6/wg2/chapter/technical-summary/
FAO water harvesting and storage describes water reliability and tradeoffs:
https://www.fao.org/land-water/water/agricultural-water-management/water-harvesting-and-storage/en
FAO anticipatory action connects risk analysis to support BEFORE impacts:
https://www.fao.org/emergencies/our-focus/anticipatory-action/15/en

These establish directions, NOT fitted coefficients. This module aggregates water
infrastructure, extension and adapted practices. It does not simulate individual
crops, river basins, rainfall, flood protection or crop insurance.

## One decision, actual accounts

`agricultureProtection` is 0–2% trailing-year GDP (monthly flow /12), default zero
for migration neutrality. It is part of existing government final purchases,
with the same financing and goods/FX rationing. Only delivered purchases count.
Maintenance takes precedence; the rest becomes 12-month projects, subject to
investment efficiency. Completion accumulates a separate public protection stock,
not generic transport capital. Annual public decay 6%; maintenance requirement
4%, extra deterioration up to 2% monthly if maintenance is not met.

Private farms choose a 0–30% adaptation share of their already funded investment
from expected avoided gross revenue loss versus borrowing/depreciation cost,
limited by profit relative to investment. No extra free investment or loan is
created. On project completion that share is diverted from ordinary capital to
private adaptation assets; ownership valuations include those assets. Annual
private adaptation depreciation 8%. This is a coarse expected-return heuristic,
not an optimizer and not a firm-by-firm model.

Protection is 0.65*(1-exp(-adaptation stock/(0.2*initial annual farm output))).
A bad weather index applies only the unprotected fraction of the shortfall;
good weather is unchanged. The 65% ceiling summarizes finite water and remaining
risks; it is not an empirically measured national irrigation coverage rate.
Protection starts at zero; current bad weather never produces an instant return
on today's public spending. Long-run scale uses initial output: a simplification.

## Stocks

Finished farm inventories are existing physical goods, not a government grain
reserve. Expected weather loss adjusts their target (8–55% of initial monthly
output); forecast risk raises it temporarily, lending cost lowers it. Existing
production/restocking and feasible allocation supply the stock and release it
when needed; an unfunded target does not create goods. There is 1% monthly
spoilage. Existing farm inputs/payroll finance actual restocking; no separate
warehouse-services sector is added. Spoilage is an asset-volume loss outside
GDP, recorded explicitly in the report. Physical reconciliation:
ending = opening - spoilage + production - intermediate use - final deliveries.
National-accounts inventory contribution excludes spoilage as a volume loss.

## Automatic food import substitution

Weather shortfall or forecast risk causes traders gradually to replace part of
domestic final food orders with imports. Normal expectations alone do not trigger
extra imports. Entry adjustment 2 months, exit 4; maximum 70%; supplier availability
limits the target. These are scenario assumptions, not trade elasticities.
Only the food component changes; domestic non-food order quantities are preserved.
Household budgets, purchaser prices, tariffs, VAT, categories, government/military
orders, final-demand volumes and the FX feasibility constraint all use the same
procurement split. Actual imports are paid through the existing bank FX accounts;
no reserve stock or credit is fabricated. Foreign goods are still a composite
priced by the existing import index, not a separate world grain market. Intermediate
food inputs remain in the domestic input matrix; trade cannot replace every input.

## Forecast and remaining limitations

Seeded world weather events have a stable three-month imperfect signal (85%
detection, 10% false-positive episode probability). Signals do not alter event
selection or economic randomness. They influence stocking and procurement whether
or not the newspaper popup is displayed. Newspaper uses existing cooldowns and
one ID per risk episode; no exact loss or inevitable outcome is announced.
These frequencies are gameplay assumptions. Arbitrary player-injected or sudden
unscheduled shocks are not guaranteed an early warning.

Review found the old common domestic-basket fulfillment factor still propagates
food scarcity to unrelated final orders. Sector exports already clear separately.
Paid food substitution reduces this channel without inventing domestic output;
it does NOT remove the coarse common final-demand basket constraint. A complete
sector-specific household rationing system would require wider accounting changes.
No GDP floor or forced recovery is introduced.

Old equations remain replayable through revision 11; live games migrate at their
next calculated month and preserve recorded historical accounts.
