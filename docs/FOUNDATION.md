# Economic foundation, equation revision 6

New games created by the standard start screen select equation revision 6.
Revisions 1–5 and their journals remain executable by the previous equations.
There is NO automatic conversion of a historical 2050 balance sheet into a
new-model initial condition. Engine file version remains 5.0.0; equation revision,
source-build hash, initial calibration and assumptions identify the experiment.

## Scope and evidence

This is a research-informed, reduced-form game economy. It is NOT MFMod, a full
HANK model, an empirically estimated national forecasting model, or a calibrated
prediction that a political doctrine succeeds/fails. References justify mechanisms;
they do not estimate the game's adjustment speeds or prove its outcomes.

The existing five-sector input/output market, real goods allocation, population
cohorts, fiscal/foreign accounts, political institutions and ownership contracts
remain. The revision adds a common financial/resource treatment across these
blocks rather than independently adding percentage bonuses.

Sources (primary research / official guidance):

* World Bank MFMod: https://www.worldbank.org/en/programs/economicpolicy-macro-modeling/mfmod
  National-account identities and explicitly calibrated behavioural relationships.
* Auclert, Rognlie, Straub, 2024/25, https://www.nber.org/papers/w32991
  Household liquidity, income risk and distribution matter for policy transmission.
* Bank of England 2014, https://www.bankofengland.co.uk/quarterly-bulletin/2014/q1/money-creation-in-the-modern-economy
  Loans/deposits, repayment, capital and liquidity are different transactions.
* Bank of England transfer-resolution guidance, https://www.bankofengland.co.uk/paper/2026/operational-guide-to-transfer-resolution
  Recognized losses, owner/creditor allocation and continuation of useful banking functions.
* Pissarides Nobel lecture, https://www.nobelprize.org/uploads/2018/06/pissarides-lecture.pdf
  Employment matching, vacancies and separation flows rather than imposed unemployment.
* Comin/Hobijn AER 2010, https://doi.org/10.1257/aer.100.5.2031
  Technology diffusion is gradual and varies across technologies/countries.
* World Bank firm technology surveys, https://www.worldbank.org/en/topic/competitiveness/publication/technology-adoption-by-firms-in-developing-countries
  Implementation/skills/finance matter; technology is not an ownership-label reward.
* WHO UHC, https://www.who.int/news-room/questions-and-answers/item/what-is-universal-health-coverage
  Capacity, trained staff, needed resources and financial protection differ from expenditure.
* WHO workforce, https://www.who.int/health-topics/health-workforce
  Training and deployment constraints.
* World Bank WDR 2018, https://www.worldbank.org/en/publication/wdr2018
  School attendance, actual learning and adult attainment are distinct.
* Engel/Fischer/Galetovic 2020, https://www.nber.org/papers/w26766
  Project cash flows, construction/maintenance contracts and allocation of risk.
* IMF public investment/maintenance, https://www.elibrary.imf.org/view/journals/001/2014/073/article-A001-en.xml
  Investment and maintenance are complementary; installed stock and useful service differ.

## One account system

Money is millions of LC, FX is millions of USD, physical output/capital is volume at
initial prices, population/workers is millions. The consolidated bank identity is:

    borrower loans + bank-held bonds + reserves + FX assets
      = all deposits + CB borrowing + external arrears + bank equity

Infrastructure operator deposits and loans participate in this identity and in FX
exposure/debt servicing. Household equity subscriptions move existing deposits;
operator loans create matching assets/liabilities. Project purchases pass through
the same goods/FX allocator as other investment and enter GDP once. Commissioning
adds actual capital after construction; it creates no additional nominal spending.

Loans are not revenue; equity subscriptions and creditor conversions are not GDP.
A recognized bank loss is not deducted again during resolution. Liquidity support
is CB debt/reserves, not recapitalization. Government bank support remains an actual
paid fiscal transfer. Monthly audits cover money, goods, population, fiscal debt,
external NFA and the sum of institution books/interbank claims.

## Banking

Three initial institution books partition the common settlement pool. They retain
separate equity and different loss exposure weights; positive capital contributes
to the credit gate, and negative capital triggers institution-specific resolution.
Private capital requires investor deposits. Allowed entry can establish an additional
paid-capital institution annually if lending margins and contract conditions permit.
No free bank assets appear when `bankEntry` is enabled.

Recognized loss allocation uses available large claims after a six-income-month
household deposit buffer, then conversion into capital. If eligible resources are
insufficient, residual negative equity and constrained credit remain visible.
The buffer, entry pace, exposure weights and subscription speeds are scenario
assumptions, NOT a legal deposit-insurance scheme. They are stored in source/state;
there is no invented taxpayer insurance payout. Public bailout is the existing
`bankRescue` policy and must be financed.

Limit: banks still share settlement, average borrower pricing and proportional
asset books. This is a multi-institution reduced form, not individual loan
underwriting, a full interbank contagion network or bank-level empirical calibration.
Five sector financial accounts remain aggregated; individual businesses are not
claimed to be independently simulated. Firm entry/exit and intra-sector capital
reallocation remain a future extension, not hidden behind a fictitious firm count.

## Employment and hours

Monthly separations and demand-driven layoffs determine survivors. Vacancies equal
positive desired employment less survivors. Hires are:

    min(unemployed, vacancies, matchingEfficiency * skillMatch * sqrt(U * V))

They are allocated by vacancies. Total employment cannot exceed labour supply;
there is no hard 1.5% unemployment floor. Delays produce frictional unemployment.
Hiring/separation parameters are assumptions, not national estimates. Hours above
40 have a smooth fatigue penalty for productive labour; pay still covers contracted
hours, so longer legal hours are not a free linear productivity bonus.

## Technology and investment expectations

Initial sector production coefficients stay calibrated in their own units. The
new adoption frontier is a dimensionless index relative to initial productivity,
with an explicitly fictional initial catch-up gap and exogenous global growth.
Paid installed projects allocate 2.5% to knowledge and the rest to physical capital.
Knowledge cannot simultaneously be installed as equipment. Implementation depends
on funded intensity, accumulated skills, contract execution and the frontier gap.
Innovation depends on funded knowledge; public research buys actual services and
accumulates a depreciating public knowledge stock. Ownership itself adds no TFP.

An initial historical growth prior is updated gradually from realized growth.
Investment appraisal combines capacity and realized value-added expectations. This
is adaptive expectations, not perfect foresight and not a policy-independent fixed
2000 trend forever.

## Independent network operators

Roads, freight rail and electricity grids have their own cash, debt, subscribed
equity, construction pipeline, maintenance payments and actual fee receipts.
Subscriptions debit investors and credit operators. Investment is constrained by
paid equity and debt capacity, not a fraction of the service sector investment plan.

Appraisal combines sector-specific prospective utilisation/fees and smoothed actual
fee yield, operating cost and financing hurdle. Positive NPV is insufficient without
money. The three sectors have distinct commercial assumptions, but geography and
full transport-network topology are not simulated. Initial private operators are
fictionally domestic-owned; household claims track subsequent paid subscriptions.

Households pay fees as part of existing services purchases. Receipts are transferred
from the consolidated services seller to operator accounts, never added to GDP a
second time. Maintenance payments buy an allocation of that sector's already
recorded inputs; they are not additional unproduced maintenance services. Public
and private physical assets share wear laws. Under-maintenance also reduces useful
network service, separately from the physical stock. Concession guarantees keep
the existing paid fiscal-contingency contract.

## Providers and household distributions

Health and school providers are public/private resource subaccounts of the services
sector, not duplicate workers or GDP. Capacity requires staff AND facilities AND
paid operating resources. Paid training builds a delayed pipeline (72/48 months);
facilities require capital allocation and wear. Opening training pipelines are
explicit initial conditions, not future free additions funded by today's budget.
A growing population dilutes per-person capacities. Both owners use the same
production constraints. Private capacity is allocated over all paid group demand,
not independently granted in full to every income group. Unfunded installed
capacity delivers no service. Access, quality and health spending hardship are
separate internal quantities. Staff/facility resource coefficients are assumptions.

Adult schooling changes via cohort replacement. Learning quality changes skills
gradually; neither today's education budget nor private-entry permission instantly
raises every adult's qualifications.

Ten reporting deciles are retained for political/UI compatibility, with five income
quadrature points and employed/unemployed subtypes within each (100 weighted types).
Population and each decile's income means are preserved. Unemployment replacement
and within-group dispersion alter poverty, Gini and nonlinear consumption response.
This is a distribution approximation, not individually evolving households or a
full age/skill/wealth transition matrix. Household dispersion is explicit and
uncertain; poverty is no longer inferred from ten group means alone.

## Public instruments and nominal mechanics

Only two new sliders: public research spending and tax administration spending.
The old direct tax-enforcement slider is hidden for revision 6. Effective capacity
now follows actually paid administration, merit and disclosure with a lag; legacy
policy fields are retained solely for old files/equations. New party programmes
cover the actual spending instruments. No formula tables or tutorial panels added.

Appropriations are a fraction of the preceding rolling 12-month GDP / 12. Fiscal
results report actual payments. Debt coupons first accrue the month after issuance,
including household-held new bonds; borrowing no longer creates an unbudgeted
same-month coupon. Resource saving is limited by the current fiscal surplus.

Sovereign spread no longer feeds the unestimated logistic risk index into an
actuarial probability formula. Cash-flow service, debt ratio, reserves and confidence
price the new spread under explicit coefficients. The old diagnostic risk metric
is still a synthetic index, not a measured default probability. The coefficients
are not market-estimated sovereign yields.

Price adjustment uses expected inflation, costs and demand with separate speeds.
Nominal expectation anchors and lag lengths are explicit regime assumptions;
no stable equilibrium or empirical shock response is certified. The free-banking
block is a reduced-form regime, not a validated historical model of competitive
currency issuance. Long deterministic oscillations are diagnostic findings to
investigate, not proof that an ideology causes crises.

## Validation and remaining scientific work

`tests/economic-foundation.test.js` exercises accounting of subscriptions/resolution,
labour flows, paid technology, delayed services, distribution moments, rolling GDP
budgets, corruption rejection, old/new replay and multi-decade country scenarios.
Run the full repository tests as well. Fifty-year explorations cover poor/middle/rich
archetypes; baseline deficits/defaults can occur and are not suppressed to produce
politically convenient winners. These runs test accounting and numerical behaviour,
not empirical validity. Some scenarios still have large endogenous transitions.

Next empirical work is parameter identification, uncertainty ranges, historical
out-of-sample shock/transition comparisons, age/skill household transitions and
independent enterprise/loan cohorts. Increasing simulated complexity alone does
not establish accuracy. No claim of full scientific validation accompanies revision 6.


## Revision 7: sector export orders and stable electoral preferences

A failed harvest still reduces agricultural capacity by the existing weather factor. No GDP loss cap, free goods, weather assistance or protection against unemployment was added. Export fulfillment now has one constrained variable per producing sector. Real input-output requirements, stocks and foreign-currency funding remain binding; receipts, GDP and inventory accounts use actual delivered sector quantities. Domestic final orders remain a fixed basket, a remaining limitation requiring a separate demand/settlement redesign.

Revision 6 games advance to revision 7 at the next month boundary, recorded in that month's journal. Earlier journal entries replay with their original equations. Revisions 1–5 are not advanced to this foundation by this patch.

New political games retain their calibrated background voter preferences rather than mechanically fading them over 24 months. Existing games record a free `stabilizePreferences` command when opened: preferences are first scaled to their current effective value, preserving support at transition. The remaining effects of income, employment, prices, policy decisions, campaign events, identities and turnout still operate. This is a scenario correction, not an empirically estimated permanent party advantage. The independent seat share rule is unchanged: assigning the residual after two 20–40% parties creates a large independent bloc by construction, not because of presidential institutions.

Sources: Zappalà, IMF WP 2023/053, https://www.imf.org/en/publications/wp/issues/2023/03/10/sectoral-impact-and-propagation-of-weather-shocks-530798 — evidence of heterogeneous weather losses and input-output propagation; it does not validate a universal export multiplier. International IDEA, https://www.idea.int/data-tools/data/electoral-system-design-database — legislative electoral rules and the distinction between party-list and candidate-centered systems. Neither source calibrates the fictional country's coefficients.
