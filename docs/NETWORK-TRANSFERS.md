# Infrastructure transfers — revision 13

The former transfer used the services enterprise's cash, while maintenance,
financing and receipts used independent network-operator accounts. It rejected
all sales below a fixed required return at book value, even though a lower sale
price could make acquisition viable. Corporate infrastructure was also included
in services-enterprise valuation despite operators having their own equity.

Revision 13 makes each operator a separate household-owned private aggregate
company. Existing operator owner contributions remain its ownership ledger.
Operators buy/sell their own assets and receive concession compensation directly.
Services-company assets and public/private infrastructure metrics no longer
attribute operator property to services-sector government ownership. Direct
state and municipal ownership, concessions and their contractual expiry remain.
Initialisation and live migration do not invent deposits, stocks or borrowers.
Historical revision 12 and earlier continue to use their recorded equations.

The transfer quote uses book replacement price multiplied by the positive
expected net return / required real return, capped at book price. This is a
simplified income valuation, not an observed market price or full project DCF.
Loss-making assets have no private buyer under this rule. Buyer funding uses
operator cash above a three-month maintenance reserve, a bounded 0.3% of
households' liquid surplus above six incomes, and bank credit subject to the
existing equity/leverage and credit-supply restrictions. Equity contributions
transfer household deposits; bank lending creates matching loans/deposits through
the normal engine. These coefficients are explicit scenario assumptions.

Sales pay the treasury once and remove proportional state/municipal stocks;
buybacks pay the operator and transfer assets to the state. Both use the same
valuation, avoiding a simultaneous buy/sell price mismatch. Transfers do not
construct assets, create GDP or move the operator's old debt to government.
Acquisition credit is included in the money-created report. Network fees and
maintenance transfers are included in the service intermediary's profit accounts
without adding a second production flow. Operators retain their receipts for
maintenance, debt servicing and future investments; individual companies,
auctions, asset-level lenders and securities markets remain aggregated.

UI: short private-operator label and indicative price/funding reason in the
existing transfer card. Actual settlement still depends on conditions at month
end. An approved vote is not a completed financial transaction. A concise result
dialog after settlement reports actual percentage, payment, partial completion
or the reason for refusal. Old saves adopt revision 13 on the next month boundary.

Regression tests cover normal sale in all three income scenarios, operator-only
cash settlement, buyback, stock and money conservation, discounted positive
returns, closed entry, no assets, no funds, partial settlement, import and exact
replay across the migration boundary.
