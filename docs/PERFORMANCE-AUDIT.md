# Performance audit — 2026-10-29

Reference source: 281746c228eb78fdf05fd80633ed74b99e169a0b.
Scope: source/dependency review and CPU sampling, followed by targeted changes
in monthly simulation, market allocation, serialization, reporting and rendering.
Economic revision remains 12; no equations, probabilities, policy effects,
iteration tolerances or interface layout have been changed.

## Findings and changes

| Area reviewed | Finding | Action |
|---|---|---|
| Engine/month state | JSON clone dominated sampled CPU; bounded consumption histories were nevertheless recopied on every trial | Copy live state only; slice append-only histories, retain immutable records like existing journal/history |
| Diagnostics | Previous calculation trace copied before being replaced; completed baseline never changes | Exclude previous trace and baseline from live clone; keep their read-only references until replaced |
| FX clearing | Up to 16 trial candidates construct diagnostic snapshots and journal records that are discarded | Trials calculate the same economics; record the selected candidate once, using the exact original trial log-rate |
| Production constraints | Successful full-delivery candidate solved twice | Return the already computed full candidate |
| Stock allocator | Fixed-point demand iterated 100 times after reaching exact equality; zero pivot factors still traversed every column | Stop only at exact equality; skip exact zero elimination factors, preserving arithmetic ordering |
| File import | UI parses the same potentially 50 MB file up to four times | Parse once; pass envelope through the same complete validation function |
| File export | UI serializes, parses, clones history/checkpoint, and serializes again | Construct an envelope directly, serialize synchronously once; retained file schema and diagnostics |
| Number rendering | Repeated locale-format construction for each displayed value | Cache Intl.NumberFormat by decimal count; same locale/options/missing value semantics |
| GDP charts | Each graph point scans all history to calculate its rolling population | Index chronological windows with binary search; sum in original order; fall back for unsorted history |
| Storage | IndexedDB with localStorage fallback; quota errors handled | Preserve storage keys, formats and save timing; no deferred autosave/data-loss window introduced |
| Politics/elections | Seeded state, many legacy revisions and commands | No political changes; compare full states across three regimes |
| Banks/bonds/budget | Actual accounting and FX constraints, not just UI counters | No finance shortcuts; retained all audits and obligations |
| Households/services/pensions | Recorded group budgets and histories, immutable completed records | No changes to consumption/health/pension calculations or historical data |
| Agriculture | New public projects excluded by the generic save validator | Accept revision-12 agriculture projects; keep amount/efficiency/future-date validation; no production formula changes |
| Army/infrastructure | Historical spending influences readiness; project completion has multiple types | Keep full histories and projects; historical arrays remain independently appendable |
| UI/events | Delegated handlers already used; render replaces main DOM | Keep render architecture/layout; broad DOM rewrite is outside this optimization and would risk focus/modal regressions |
| Build | Static native modules, no runtime third-party dependency | Keep deployment structure and diagnostic source fingerprinting |

The read-only history convention already applied to journal and main metrics.
Live arrays are separate, and the previous simulation must not mutate while
calculating the next month. A dedicated test checks this through FX searches.
Archives remain complete: no truncation, compression, recalculation or removal
of explanatory records was used to obtain these improvements.

## Measurements

Same Node runtime/container, sequential reference then optimized execution;
wall times are indicative, not browser/phone performance guarantees. Reference
was also run without the profiler for the comparison below. Each case invokes
180 months, with a weather shock at month 30 and a supply shock at month 70.
Politics disabled, army enabled as in normal country presets. In the rich case
the existing loss condition stops the game at month 167 in BOTH versions.

| Scenario | Reference ms | Optimized ms | Time reduction |
|---|---:|---:|---:|
| Poor | 2603.6 | 1475.3 | 43.3% |
| Middle | 2238.9 | 1393.5 | 37.8% |
| Rich | 5505.0 | 4739.3 | 13.9% |

All 540 monthly metric checks and the three complete final-state SHA-256 hashes
matched exactly (including archives, diagnostics and numerical results). File
sizes also matched: 48,406,723 / 47,526,574 / 49,048,273 bytes. These are development
source comparisons; a release naturally has a different source-build identifier.
A further 72-step comparison per presidential, parliamentary and personalist
scenario with fixed nameSeed=42 matched every complete state hash.

Microbenchmarks: 10,000 Russian number formats, 217 -> 5 ms; ten 2,400-point GDP
series constructions, 259 -> 14 ms. These measure helpers, not full page render.
The raw export/import engine functions still process the same large schema;
no consistent improvement is claimed for them. UI file handling avoids redundant
parse/stringify passes around those functions.

## Reproduction and checks

`node scripts/benchmark-performance.mjs /tmp/current.json [SOURCE_DIRECTORY]`

The script records runtime, import/export timing, size, every monthly metric hash
and final full-state hash. Optional SOURCE_DIRECTORY enables comparison against
an isolated reference checkout. Do not compare wall time with tests/profiling
running concurrently. Timing is observational; no flaky speed threshold is a test.

361 tests pass. Added regressions cover locale output, envelope equivalence and
validation, input-state immutability, chart gaps/duplicate/unsorted dates, and
agriculture-project save/load. One election UI test now fixes its previously
random name seed so the fixture is reproducible; production election code is
unchanged. Build and diff whitespace checks also pass.

## Remaining costs

Full journals are intentionally large. Autosave still serializes the complete
state, and very long manual exports remain costly on low-memory devices.
Incremental storage or a versioned compact archive would require a separate
migration design. The LP allocator and financial clearing remain real CPU costs;
no iteration count or numerical accuracy was reduced. State is not frozen at
runtime: external code must continue to treat completed archival entries as
immutable, consistent with the pre-existing engine convention.
