const publishableKeys = Object.values(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}'));
const legacyAnon = Deno.env.get('SUPABASE_ANON_KEY');
const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
const secret = secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const backend = Deno.env.get('SUPABASE_URL');
const allowedOrigin = /^https:\/\/(?:[a-z0-9-]+\.)*itch\.zone$/i;
const milestones = new Set([
  'menu','play','newGame','resume','newBrowser','returnD1','returnD7','played5','played15','party','cabinet','vote',
  'month1','month3','month12','election','nextCabinet','budget','parliament','map','newspaper','save'
]);

const reformKeys = new Set<string>(["agricultureProtection","antitrustBudget","associationFreedom","automaticRestructuring","bankCapitalRequirement","bankEntry","bankRescue","bargainingSystem","boardAutonomy","businessAccess","businessSupport","capitalControls","censorshipScope","childcareBudget","cityBudgetTransfers","collectiveBargaining","competitiveElections","concessionEntry","concessionGuarantee","cooperativeEntry","corporateBondMarket","corporateTax","courtBudget","defensePersonnelTarget","defensePosture","defensePriority","defenseProcurement","defenseSalary","defenseService","depositPortability","education","electionAdministration","eliteRecruitment","employmentProtection","energyPricing","energyTariff","familyBenefits","foreignBorrowingShare","foreignBusinessEntry","freeMedia","fuelPricing","fuelTariff","fxIntervention","governmentConsumption","healthcare","housingAllowance","housingRules","incomeTax","incomeTaxProgressivity","independentSoeAudit","inflationTarget","infrastructureFeeCap","infrastructureMaintenance","infrastructurePricing","judicialReview","liquiditySupport","localAdministrationBudget","localElections","meritAppointments","meritCivilService","migrationOpenness","militaryBudget","minimumWage","monetaryRegime","municipalInvestmentShare","municipalServicesShare","normalWorkweek","openProcurement","parentalLeaveMonths","parliamentOversight","patronageBudget","pensionContribution","pensionIndexation","privateBusinessEntry","privateEducationEntry","privateHealthEntry","privateHealthInsurance","privateHousingEntry","privateInfrastructureEntry","privatePensions","privateUnemploymentInsurance","protectedJudges","protestResponse","publicDisclosure","publicInvestment","rate","rateDisclosure","regionalBudgetTransfers","registrationProcedures","researchBudget","reserveRequirement","retirementAge","retrainingBudget","royalty","securityBudget","securityGovernance","socialHousingBudget","soeAuditBudget","stabilizationSaving","strikeRights","successionProcedure","tariff","taxAdministrationBudget","taxEnforcement","transfers","unemploymentDuration","unemploymentReplacement","vat","workerRepresentation"]);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const funnelStage = /^funnel\.(begin|party|launch|cabinet|vote|month1|month3|month12|election|nextCabinet)$/;
const issue = /^error\.(startup|menu|onboarding|decisions|budget|economy|country|politics|army|atlas|newspaper|saves|settings|notes|codex|other)\.(js|promise|asset|load|save|autosave|turn|campaign)\.(TypeError|ReferenceError|SyntaxError|RangeError|EvalError|URIError|AggregateError|load|quota|access|format|other)$/;
const failure = /^failure\.(coalition|vote|decision)\.(majority|rivalMajority|premiership|incompatible|limit|requiredInitiative|authority|alreadyResolved|unavailable|invalid|other|noMajority|quorum|court)$/;
const extra = new Set([
  'load.samples','load.ms','load.under1','load.under3','load.under10','load.over10',
  'balance.campaignMonths','balance.defaults','balance.coalitionBreakups','balance.elections','balance.electionLosses',
  'balance.cabinetsEnded','balance.cabinetMonths','attempt.coalition','attempt.vote','attempt.decision'
]);

function validCounter(key: string,value: unknown,cohort: boolean,legacy: boolean){
  if(typeof value!=='number'||!Number.isInteger(value)||value<1)return false;
  if(cohort)return funnelStage.test(key)&&value===1;
  if(key==='seconds')return value<=3600;
  if(milestones.has(key))return value===1;
  if(legacy)return false;
  const reform=/^reform\.(proposed|passed)\.([a-zA-Z0-9]+)$/.exec(key);
  const limit=key==='load.ms'?600000:10000;
  return value<=limit&&(extra.has(key)||issue.test(key)||failure.test(key)||Boolean(reform&&reformKeys.has(reform[2])));
}

Deno.serve(async request => {
  const origin = request.headers.get('origin') ?? '';
  if (!allowedOrigin.test(origin)) return new Response(null, {status: 403});

  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'apikey, content-type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    Vary: 'Origin'
  };
  const respond = (status: number) => new Response(null, {status, headers});
  if (request.method === 'OPTIONS') return respond(204);
  if (request.method !== 'POST') return respond(405);

  const key = request.headers.get('apikey');
  if (!key || (!publishableKeys.includes(key) && key !== legacyAnon)) return respond(401);
  if (!backend || !secret) return respond(503);
  if (!request.body) return respond(400);

  let payload;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  try {
    let bytes = 0;
    let body = '';
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096) {
        void reader.cancel();
        return respond(413);
      }
      body += decoder.decode(value, {stream: true});
    }
    payload = JSON.parse(body + decoder.decode());
  } catch {
    return respond(400);
  }

  if (!payload || typeof payload !== 'object') return respond(400);
  const {build,counters,batch,day} = payload;
  const legacy = batch===undefined && day===undefined;
  const attributed = day!==undefined;
  const today = Math.floor(Date.now()/86_400_000);
  if (Object.keys(payload).some(key=>!['build','counters','batch','day'].includes(key)) ||
      typeof build!=='string' || !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(build) ||
      !counters || typeof counters!=='object' || Array.isArray(counters) ||
      (!legacy && (typeof batch!=='string' || !uuid.test(batch))) ||
      (attributed && (!Number.isInteger(day) || day < today-89 || day > today))) return respond(400);
  const entries = Object.entries(counters);
  if (!entries.length || entries.length>32 || entries.some(([key,value])=>!validCounter(key,value,attributed,legacy))) return respond(400);

  try {
    const rpc=legacy?'increment_mandatewright_counters':'record_mandatewright_counters';
    const result = await fetch(backend + '/rest/v1/rpc/'+rpc, {
      method: 'POST',
      headers: {apikey: secret, 'Content-Type': 'application/json', ...(!secret.startsWith('sb_secret_') ? {Authorization: 'Bearer ' + secret} : {})},
      body:JSON.stringify({version:build,counters,...(legacy?{}:{batch_id:batch,cohort_day:day??null})})
    });
    return respond(result.ok ? 204 : 503);
  } catch {
    return respond(503);
  }
});
