# Treasury settlement — economic revision 14

## Diagnosis

Revision 12 save economy-01.2008, month 38: official FX assets existed and fiscal
funding was obtained, but Treasury FX conversion was capped by the consolidated
commercial bank's settlement reserve balance. With zero reserve requirement and
liquiditySupport=false, no facility replenished that balance. A bank plumbing
constraint therefore caused a sovereign payment failure without exhausting FX.
The fix addresses that channel; it does not assume the policy programme was sound.

## Primary references and boundary of inference

Bank of England, RTGS/CHAPS PFMI self-assessment, collateral section: intraday
liquidity supports settlement and requires acceptable collateral.
https://www.bankofengland.co.uk/payment-and-settlement/rtgs-and-chaps-2022-pfmi-self-assessment
Bank of England, Market Operations Guide, Our tools: regular Short-Term Repo
provides reserves for payments against collateral, separately from contingent
facilities and liquidity insurance.
https://www.bankofengland.co.uk/markets/bank-of-england-market-operations-guide/our-tools
ECB, TARGET Services Annual Report 2024, Intraday credit: balances, incoming
payments and collateralized credit are distinct sources of settlement liquidity.
https://www.ecb.europa.eu/press/targetservar/html/ecb.targetservar2024.en.html

These support the separation of settlement operations and emergency support;
they do NOT establish universal access, collateral haircuts or identical national
laws. The game models monthly secured refinancing, not actual intraday credit
with mandatory end-of-day repayment. No single central bank's rule is universal.

## New account operations

For discretion/rule regimes, banks with positive book equity may obtain ordinary
settlement reserves up to 80% of performing domestic sovereign bonds held by the
bank, less ALL existing central-bank borrowing. Household holdings, defaulted and
overdue bonds are excluded. The 20% haircut is an explicit scenario assumption,
not a calibrated or universal value. Existing borrowings consume the same capacity
so it cannot be reused in successive payments. Insolvent banks and monetary regimes
without discretionary domestic reserve issuance receive no such credit.

1. Draw: bank reserves +L; bank centralBorrowing +L. CB loans and reserve liabilities
   increase together. No bank equity, Treasury deposit or foreign asset is created.
2. Convert: actual CB FX assets decline; the bank's settlement balance declines;
   its correspondent FX position receives the same FX amount.
3. Pay: the Treasury deposit and bank FX position decline by the actual payment.

The bank loan remains owed. Existing monthly CB interest and reserve-repayment
rules apply; it is neither a grant nor a sovereign debt write-off. Only the
settlement funding deficit is drawn. FX conversion is capped by the request,
actual Treasury cash, official FX assets and obtainable settlement balances.
Ordinary conversion does not recapitalize the bank or close its private foreign
arrears. State/private-bank foreign obligations remain separate.

The existing liquiditySupport control is relabeled emergency liquidity support.
It controls additional support under the old reserve-management rule, not whether
routine collateralized payments are possible. No new player slider is added.
Emergency support itself remains an aggregate legacy mechanism, not a detailed
national lender-of-last-resort framework.

## Diagnostics and advance notice

Each external Treasury payment records requested/paid FX, initial Treasury cash,
official reserves and bank settlement balance, actual FX sale and secured credit.
Unpaid amounts distinguish budget-cash, foreign-currency and settlement-liquidity
constraints. The newspaper no longer always implies that official FX is absent.

A read-only three-month outlook sums scheduled coupons/principal and compares
current FX/settlement access and projected cash after primary expenses. It does
not grant financing, alter issuance, prepay bonds or guarantee future access.
The rare newspaper warning notes dependence on additional funding or insufficient
FX liquidity. Existing six-month global and twelve-month per-category cooldowns
remain. Forecast rates/revenue are provisional; this is not a full debt-management
optimizer or automatic debt-maturity smoothing.

## Evidence

372 tests passed: include zero reserve requirement/emergency support disabled,
collateral limits and regimes, no free Treasury money/FX, genuine FX scarcity,
genuine fiscal cash shortage, payment outlook/cooldown, audits, save/load and exact
recorded-revision replay. New games use revision 14; old games migrate at the next
month boundary. Completed history is retained and is not retrospectively forgiven.

Read-only reconstruction of the uploaded save at month 38:

| Outcome | Recorded revision 12 | Revision 14 from the same prior state/decisions |
|---|---:|---:|
| Sovereign default active | yes | no |
| Unpaid obligations, million LC | 10.0813 | 0 |
| Treasury cash at month end, million LC | 46.9526 | 36.2931 |
| Official reserves at month end, million USD | 191.2476 | 188.9572 |
| Additional settlement refinancing, million LC | 0 | 1.7333 |

Both scheduled external coupons (2.8691 million USD) and principal (8.6350 million
USD) were paid in the corrected branch. Historical reconstruction matches the
recorded metrics within relative 7.3e-13; accounting residuals in both branches
are below 1e-12. This verifies settlement for this state, NOT long-run optimality
or the absence of future crises. Changes in official FX sales/interest/credit
also affect the existing FX-clearing search; do not treat month-end differences
as an isolated fiscal multiplier.

Reproduce with:
`node scripts/recheck-treasury-payment.mjs SAVE.json JOURNAL_MONTH`
The script is read-only; it never changes the uploaded game file.

## Remaining aggregation

There is still one consolidated commercial-bank balance sheet with stylized
banks underneath, limited collateral classes, and no full Treasury Single Account,
interbank RTGS, country-specific legal rules, frozen reserves, multilateral rescue
programme or explicit repo maturity/margin-call model. Existing CB borrowing is
subtracted conservatively when evaluating new collateral headroom. These limits
should not be mistaken for a complete representation of real monetary systems.
