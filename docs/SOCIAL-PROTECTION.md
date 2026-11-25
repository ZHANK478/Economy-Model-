# Housing and social protection — economic revision 9

This is a synthetic national simulation. The sources support mechanisms and
accounting distinctions, not the numerical coefficients, country calibration or
claims of empirically validated effects. No new statistics screen is introduced.

## Instruments

Three existing-style decision cards: Housing (social building budget, means-tested
housing allowance, planning regime, private entry); Pensions (gradually implemented
retirement age, employee PAYG contribution, price/wage indexation, private funded
programmes); Unemployment (replacement rate, benefit duration, retraining budget,
permission for supplementary private insurance). These are laws/budget decisions
and use existing parliamentary voting, opposition proposals, coalition and budget
rules. Party archetypes have preferences for every new instrument.

The old transfer envelope is split at activation: 70% establishes the opening
pension entitlement and 30% becomes the ordinary social-assistance appropriation.
The assistance slider subsequently specifies its actual GDP budget share. Public
unemployment insurance has a separate entitlement and is financed from general
revenue, an automatic stabiliser rather than an independent discretionary budget.
There is no duplicated old pension payment. The opening contributions rate is
zero: existing general taxation finances public pensions until a payroll
contribution is enacted. The opening UI cohorts are synthetic initial conditions,
not observations of a real employment history. New private accounts start at zero.

## Public pensions

Monthly age/sex demographic bins determine eligible population. Policy retirement
age phases in at at most six months per year. Previously granted pensions are
protected using a surviving-retiree stock: raising the age limits future entry,
not the rights of existing recipients. Labour-force participation reacts only
partially; higher eligible labour supply does not create jobs. Existing paid
employment matching remains binding.

Opening pensions preserve the 70% transfer envelope in aggregate, not the old
household distribution. Earnings points accrue from actual group payroll; new
retirees receive an earnings-related entitlement. Existing pensions are indexed
using observed previous-month consumer prices or nominal wages. The PAYG
contribution is deducted from paid wages, enters government revenue once, and is
excluded from take-home wages and household disposable labour income. Pension
outlays enter the existing transfer aggregate once. Unpaid pensions are recorded
as benefit arrears and requested again next month. Contributions do not
mechanically determine next month's pension: general revenues may cover a gap.

Within-group worker/retiree mixtures and earnings careers are synthetic averages,
not full individual lifetime histories. Pension eligibility does not imply a
mandatory employment ban. There is no gender-specific pension law in this model.

## Unemployment protection

Separate cohorts track unemployment duration, former nominal wage, formal
eligibility and pre-existing private cover within each income group. Actual hires
remove unemployment mass; separations and labour-force entry add it. New labour
entrants have no automatic contributory entitlement. Six observed working months
are the scenario vesting rule for new claims; the initial public cohort has an
explicit synthetic coverage fraction. The first month is prorated to 75% (one
week waiting-time approximation on a monthly clock), rather than imposing a full
month without benefits. Entitlement expires after the selected period. Ordinary
means-targeted assistance is a separate programme.

Higher replacement/duration can modestly reduce the matching rate but cannot
create or destroy vacancies directly. Paid retraining produces a cohort after six
months, improving skill matching only when workers and vacancies exist. This is a
scenario elasticity; it is not a fitted causal estimate or a claim that all
beneficiaries reduce job search.

## Private programmes and money

Two explicit deposit-funded financial actors: funded retirement saving and a
supplementary private unemployment insurer. They are included in bank deposits,
funding costs, bank books and resolution. Bank interest is paid from bank equity;
no exogenous investment return is granted. A deposit bail-in converts the fund's
cash into a marked bank-equity claim, and funded beneficiaries bear subsequent
valuation changes. Household wealth includes funded claims and insurer ownership
without double counting bank equity.

Private saving is voluntary, heterogeneous by income, and cash constrained; the
scenario saving rate is 2% of participating payroll. Insurer premiums are 1% of
participating payroll; coverage fractions match participation, with six months
vesting and a six-month supplementary benefit replacing 15% of old earnings.
Benefits are capped by actual liquid reserves, without a government guarantee.
Disabling new private entry stops new enrolment/contributions but does not erase
assets or previously insured claims. Returns, premiums and generosity are explicit
scenario parameters in code, not additional player sliders.

Funded retirement withdrawals transfer the participant's own wealth to liquid
cash; they are neither newly produced income nor GDP. Premiums are an expense but
not an additional consumption/GDP flow. Private insurance benefits enter disposable
income, with a matching reduction in insurer reserves. These are coarse mutual
risk transfers; the model does not separately estimate insurers' SNA service
margin. Funded portfolios currently hold deposits and bank claims after resolution,
not a diversified equities/bonds/global-assets portfolio. There are no unfunded
private promises, implicit government rescue or invented opening pension assets.

## Housing

An aggregate rental-housing market is a subaccount of the services enterprise.
Private landlords receive real rental receipts through that enterprise and its
existing equity owners. Public stock charges discounted rent to lower-income
households; the public rental receipt is remitted once to government property
income. Operating resources remain inside the existing services-sector inputs and
payroll; maintenance sufficiency affects additional public-stock deterioration.

Physical stocks depreciate. Household formation determines housing need; a slowly
adjusting relative rent responds to vacancy and allowance-funded demand. This
reflects the distinction between demand subsidies and supply expansion. Housing
benefits target the lowest four current income deciles. Social rent allocation
uses the lower four underlying strata as an approximation; there is no simulated
individual tenancy queue or eviction process.

Private builders assess rental yield, real financing costs, risk, planning regime
and cash available after ordinary investment commitments. Construction orders use
actual domestic/imported investment goods and paid financing from the existing
services enterprise. They enter investment expenditure once. Social construction
is an earmarked part of actual government procurement, not an extra GDP flow.
Projects complete after roughly 19–31 months depending on planning rules. Stock is
not installed when a budget slider moves. Closing private entry stops new projects
but previously financed projects finish. A project's private asset enters the
services enterprise's capital at completion; the physical rental stock is a
subaccount rather than another separately counted household asset.

Housing's relative price changes purchaser costs and services-producer receipts;
the nominal GDP production account includes exactly the rental-price premium,
with no artificial real-output creation. Public rent discounts reduce recorded
paid housing services. A constant-weight rent component enters consumer prices.
Existing aggregate VAT treatment is retained: country-specific rent exemptions,
imputed owner-occupied rent, house purchases, mortgages, location/land markets,
landlord-specific balance sheets and property taxation are not yet represented.
These limitations should not be described as a complete real-estate market.

## UI, accounting and migration

No new top-level page or statistics row. Three minimal decision cards with native
icons, normal parliamentary procedures, and optional social-income/asset-flow
breakdown inside the existing five-class consumption view. Gross/take-home wages
retain a common employed-person denominator; take-home now includes public
pension deductions. Saving into a private pension remains saving, not income tax.

Revision-8 games activate at the next month boundary. Past history/journals are
unchanged; replay uses the recorded economic revision. The transfer-envelope
calibration is persisted separately to avoid splitting the same starting pension
budget twice on replay. Save validation checks fund assets/beneficiary claims,
cohort duration/eligibility, stocks, project types and scenario parameters. Tests
cover funded money, GDP/tax identities, exhaustion, delayed construction,
grandfathered pension rights, three country scenarios and exact migration replay.

## Primary references

- OECD (2019), housing-supply responsiveness and land-use restrictions:
  https://www.oecd.org/en/publications/how-responsive-are-housing-markets-in-the-oecd-national-level-estimates_4777e29a-en.html
- OECD (2021), Brick by Brick: housing allowances, supply and rental pressure:
  https://www.oecd.org/en/publications/brick-by-brick_b453b043-en/full-report/component-3.html
- OECD (2025), Pensions at a Glance: contributions, retirement age, indexation,
  earnings-related rights, mandatory/voluntary funded provision:
  https://www.oecd.org/en/publications/pensions-at-a-glance-2025_e40274c1-en.html
- ILO Convention 168, qualifying periods, waiting periods and continued support:
  https://www.ilo.org/dyn/normlex/en/f?p=1000:12100:0::NO::P12100_ILO_CODE:C168
- US Department of Labor, unemployment insurance eligibility, financing and
  time-limited benefits (institutional example, not a universal prescription):
  https://oui.doleta.gov/unemploy/uitopic.asp
