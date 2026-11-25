# Supply disruption — economic revision 5

This revision changes equations only. No UI, styles, decision cards or explanatory overlays are added.

## Evidence and limits

* Celasun et al., IMF WP/22/31 (2022), https://www.imf.org/en/Publications/WP/Issues/2022/02/15/Supply-Bottlenecks-Where-Why-How-Much-and-What-Next-513188 estimates euro-area manufacturing and GDP would have been about 6% and 2% higher without 2021 bottlenecks. This is an external plausibility comparison, not a universal shock elasticity or a target imposed on game GDP.
* De Michelis and Somale, Federal Reserve (2023), https://www.federalreserve.gov/econres/notes/feds-notes/a-sourcing-risk-index-for-u-s-manufacturing-industries-20230908.html explains heterogeneous sourcing risk and why inexpensive critical inputs can matter more than their expenditure share. It does not estimate our five-sector coefficients.
* Shirakawa, Bank of Japan (25 July 2011), https://www.boj.or.jp/en/about/press/koen_2011/ko110725a.htm describes the 2011 supply disruption and production recovery as supply constraints eased. It motivates distinguishing temporarily unfilled orders from disappearing demand; no Japanese coefficients are transferred.

## Equations and explicit scenario assumptions

Imported intermediate exposure equals imported intermediate coefficient divided by domestic plus imported intermediate coefficients, multiplied by criticality and capped at one. Sector order is agriculture, extraction, industry, construction, services. Criticality is [1.25, 1.25, 2.5, 1.75, 0.5]. These are assumptions, not measured country elasticities.

Logistics pressure approaches the external shortage with an exponential two-month time constant and recovers with a one-month time constant. Supplier replacement approaches half the shortage with a six-month time constant. Replacement inputs carry a 25% premium on their replacement share; the premium is actually paid and included in costs, imports and foreign-currency financing. Imported-component inventories are not separately measured: the logistics lag is a reduced-form buffer.

Sector capacity factor is one minus exposure times remaining shortage. Availability above normal cannot create machinery or workers. After a disruption, recovery releases constraints rather than granting a production bonus. Prolonged and severe shortages can still cause recession, bankruptcy and lasting damage.

When actual output is supply-rationed, solvent unfilled orders contribute to sales expectations, bounded by normal physical output. Lack of financing remains a real constraint. Temporary rationing does not automatically become lost demand and mass layoffs, but lower real incomes and profitability can still reduce demand and employment. Prices use that bounded demand signal and the extra cost of idle capacity.

The fixed-basket market allocator previously could consume unrelated finished-goods stocks and idle their producers to maximize a single month's deliveries. Revision 5 releases stocks where planned orders and intermediate requirements exceed feasible sector production, reserves the other stocks, then minimizes unnecessary withdrawals at the feasible delivery score. This is a planning heuristic with a fixed input matrix and deterministic sector order, not an estimated optimal inventory policy. All goods and monetary balances remain enforced.

## Migration and reproducibility

Revision 4 games upgrade at the next live month. Old journal entries retain their original revision and replay under their original equations. Migration reconstructs auxiliary logistics pressure from recorded world conditions, without rewriting historical cash, output, employment or elections. An already realized recession is not retroactively erased.

Run `npm test` and `npm run validate:supply`. The latter compares matched policies with/without a 20% availability disruption, across three income presets and two resource structures; it also varies disruption strength and duration and checks journal replay and accounting identities. Outputs are in `docs/supply-chain-validation.json`. These scenario results are technical and behavioral checks, not empirical certification.
