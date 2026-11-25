import {BRITISH_CITIES} from './city-dossier.js';
import {CODEX_REGIONS} from './codex-locations.js';
import {UK_CODEX_ARTICLES,UK_CODEX_ORGANIZATION_CONTEXT} from './codex-uk-reference.js';
import {WORLD_CODEX_ARTICLES} from './codex-world-reference.js';

const worldOnly={articles:WORLD_CODEX_ARTICLES,regions:[],cities:[],organizationContext:{}};
const byScenario={
  'uk-2000':{
    articles:[...WORLD_CODEX_ARTICLES,...UK_CODEX_ARTICLES],
    regions:CODEX_REGIONS,
    cities:BRITISH_CITIES,
    organizationContext:UK_CODEX_ORGANIZATION_CONTEXT,
    contextTitle:'Соединённое Королевство · январь 2000',
    legislature:'Палате общин',
  },
};

export const codexContent=scenarioId=>Object.hasOwn(byScenario,scenarioId)?byScenario[scenarioId]:worldOnly;
