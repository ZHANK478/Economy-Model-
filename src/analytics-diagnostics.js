export const analyticsSections = [
  'startup','menu','onboarding','decisions','budget','economy','country','politics',
  'army','atlas','newspaper','saves','settings','notes','codex','other'
];
const decisionReasons = [
  [/большинство без|большинством без/i,'rivalMajority'],
  [/претендует на пост премьера/i,'premiership'],
  [/большинств|недостаточно мест|больше половины мест/i,'majority'],
  [/несовместим|программные разногласия|противоречат/i,'incompatible'],
  [/все 3 решения|нет свободных решений|лимит решений/i,'limit'],
  [/последнее решение|обязательн.*предложени/i,'requiredInitiative'],
  [/в оппозиции|полномочи|независимый центральный банк/i,'authority'],
  [/уже рассмотрен|завершен|уже принято/i,'alreadyResolved'],
  [/недоступ|не найден|соглашение соблюдается|нужна поддержка/i,'unavailable'],
  [/некорректн|неверн|значение/i,'invalid']
];

export function decisionFailureReason(error){
  const message = typeof error === 'string' ? error : error?.message ?? '';
  return decisionReasons.find(([pattern])=>pattern.test(message))?.[1] ?? 'other';
}

export function storageFailureReason(error){
  if (error?.name === 'QuotaExceededError') return 'quota';
  if (['SecurityError','NotAllowedError','InvalidStateError'].includes(error?.name)) return 'access';
  if (error?.name === 'SyntaxError' || /формат|верси|поврежд|файл/i.test(error?.message ?? '')) return 'format';
  return 'other';
}

export function installAnalyticsDiagnostics(analytics, target=globalThis){
  if (!analytics.available) return;
  const jsKinds = new Set(['TypeError','ReferenceError','SyntaxError','RangeError','EvalError','URIError','AggregateError']);
  target.addEventListener('error',event=>{
    const resource = event.target !== target && ['SCRIPT','LINK','IMG','AUDIO','VIDEO'].includes(event.target?.tagName);
    if (resource) analytics.diagnostic('asset','load');
    else analytics.diagnostic('js',jsKinds.has(event.error?.name)?event.error.name:'other');
  },true);
  target.addEventListener('unhandledrejection',event=>{
    analytics.diagnostic('promise',jsKinds.has(event.reason?.name)?event.reason.name:'other');
  });
}
