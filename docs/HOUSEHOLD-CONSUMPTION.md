# Household consumption and household budgets — economic revision 8

The five visible groups are current disposable-income quintiles assembled from the engine's ten equally weighted household types. Every amount is an average **per person in that group per month**, including people living in shared households; it is not a quote for one adult living alone. The full-body figures are illustrations of the selected group, not measured individual people. All five have the same height; body size does not encode wealth.

## Evidence and scenario assumptions

- BLS, Examining U.S. inflation across households grouped by equivalized income (2024): https://www.bls.gov/opub/mlr/2024/article/examining-us-inflation-across-households-grouped-by-equivalized-income.htm — income groups have different expenditure patterns and hence different inflation exposure. Essentials generally take a higher budget share among lower incomes. This supplies directions, not country-invariant numerical elasticities.
- BLS CPI concepts: https://www.bls.gov/opub/hom/cpi/concepts.htm — actual spending, a fixed physical basket's current price, and a full cost-of-living index are distinct. Cutting purchases does not demonstrate falling living costs.
- ILO needs methodology (2025): https://www.ilo.org/publications/methodology-estimate-needs-workers-and-their-families-purpose-wage-setting — food, housing, healthcare, education and other needs should be assessed, with family composition specified. The game does not possess a locally priced normative diet or housing survey. Its **basic basket** is therefore an explicitly synthetic reference budget, not an official poverty line or a validated living wage.
- ONS pie/doughnut guidance: https://service-manual.ons.gov.uk/data-visualisation/chart-types/pie-and-doughnut-charts — use bars rather than multiple pies for group comparison. The interface keeps a zero baseline and a common monetary scale across all five selectable groups.
- ONS family expenditure: https://www.ons.gov.uk/peoplepopulationandcommunity/personalandhouseholdfinances/expenditure/bulletins/familyspendingintheuk/april2024tomarch2025 — income-group consumption comparisons and expenditure categories.

All behavioral coefficients live in `CONSUMPTION_ASSUMPTIONS` in source. They are scenario assumptions awaiting country-level estimation, not values fitted to these publications. The underlying national starting production and population calibrations are unchanged.

## Behavior and real settlement

Relative disposable income affects each group's physical five-sector consumption basket. Food/energy receive lower income elasticities than general services; modest substitution responds to relative purchaser prices. Near basic-needs budgets, the basket places additional weight on essentials. Desired expenditure puts available income and a bounded draw on liquid wealth toward unmet basic expenditure before discretionary smoothing, while existing borrowing limits, actual cash and the common market's physical/currency constraints remain binding. No food or housing floor manufactures goods or money.

Public services affect private demand through the preceding actual public delivery, not simply the existence of historical public facilities. Private education/health spending varies by income; entry restrictions and provider capacity remain active. Current-month public delivery also affects the out-of-pocket basic-basket estimate. This is adaptive aggregate behavior, not a model of individually optimized consumption or medical necessity.

Different group baskets change actual sector orders. Each group pays for its own basket at actual domestic/import prices, tariffs and applicable VAT. The existing common final-import share and the coarse sector mapping remain approximations; this patch does not create a detailed product-level trade model. The general-services producer still supplies housing and other services. Housing spending is a tagged share of **domestic** service purchases; imports are not relabeled as rent. There is no additional housing payment, invented landlord income, extra housing GDP, separate house-price market, ownership tenure or mortgage principal in this patch. Housing affordability feeds the existing housing-burden/demographic channel with a lag.

## Three distinct quantities

1. **Actual monthly budget:** after-tax labor income, transfers, capital/deposit income and remittances; actually paid consumption; actually paid loan interest. Income tax is not subtracted a second time. The displayed balance is income less these expenditures, not a change in financial wealth.
2. **Habitual basket:** the first delivered basket's physical quantities per person, valued subsequently at purchaser prices. Its reference prices and tax rates remain at observation start, including when a VAT change occurs in the first observed month. Purchases may later fall without shrinking this fixed basket. The index does not include interest payments, asset prices or a claim of exact welfare preservation under substitution.
3. **Basic basket:** a fixed real reference volume anchored to opening national consumption, separate from current poor-household expenditure. It covers coarse basic goods, shared-household housing services and out-of-pocket health/school requirements after public provision. Size-related housing sharing is explicit. The chosen real-volume fraction and weights are assumptions. Food/housing coverage ratios are internal scenario-target measures, not clinical nutrition or measured housing deprivation.

## Accounting and histories

`householdEconomy.records` stores ten reconciled monthly budgets, categories, income sources, cash changes and a residual of other financial flows. New loans, asset subscriptions, foreign-saving operations and bank conversions may change cash without being disposable income or consumption; this is why the balance is never labeled savings. Categories sum to paid consumption plus interest, income sources sum to income, and group consumption sums to the expenditure measure of GDP. The model throws if those identities fail. A bounded 240-month compact history is retained in the save.

Revision 7 (and revision 6 via its existing upgrade path) advances to revision 8 at the next month boundary; the journal records the revision. Historical entries replay with the recorded earlier equations. New games opt into revision 8. Earlier-revision saves can show actual aggregate household purchases from their existing calculation trace, without inventing detailed historical categories. There is no synthetic historical backfill. Opening income is an initialized estimate; actual expense detail appears after the first calculated month.

## Interface

The bottom of Statistics contains a single Consumption disclosure. Five small controls switch income groups. The previous full-height figure and its budget fade out, are replaced, and the next figure fades in; rapid changes cancel stale transitions. Reduced-motion preferences switch without animation. The selected group is presentation state and never changes the economic model. The visual shows income, expenditures, an explicitly signed remaining-income amount, and short category bars. Basic/habitual baskets and income sources are optional disclosures; equations remain in source.
