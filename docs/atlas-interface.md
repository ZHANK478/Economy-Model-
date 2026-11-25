# Atlas play screen

Presentation update: a compact floating HUD, right-hand navigation, country flag dossier, demographic tab and news counter. Uses existing policy, politics, army, statistics and newspaper views; simulation calculations are unchanged.

The demographic tab reads population, ageCohorts (under 18, 18–64, 65+) and metrics from the current state. It does not invent regional observations. UN/NATO/EU entries are historical context for the UK 2000 opening, not active treaty simulations. EU membership is explicitly fixed to the opening scenario; eurozone membership is not implied.

The British scenario uses a Lambert conic sheet for Britain and neighboring Europe and an Equal Earth sheet for the world. One bounded camera moves the viewport through the desk scene. The SVG paths and screen-space typography are rendered live. At each zoom, labels are chosen by scale, priority and available space around other labels, symbols and controls. City pieces and national medallions use the same projected coordinates as their cities. The globe switches sheets. The London pin opens the current government action when available.

Regenerate the vector sheets and coordinates with `python scripts/build-desk-atlases.py`. Britain uses ONS topology. The neighboring coasts and world use Natural Earth admin-0 vectors at 1:10m and 1:50m respectively. Both sides of the Ireland–Northern Ireland land boundary share the ONS line. Selected roads, rivers and sea links are schematic.

The retained geography and populated-place extracts under `research/desk-*.json` record their Natural Earth sources. The underlying geographic data are generalized. The simulation calendar and its historical opening are separate from the atlas data.
