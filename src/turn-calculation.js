import {runMonths} from './engine.js';

let worker;

export async function calculateTurn(state, count, policy) {
  if (typeof Worker !== 'function' || worker === false) return runMonths(state, count, policy);

  // The engine compares changes against the last entry. The UI keeps the
  // complete archive and appends new entries after the worker returns.
  const last = state.journal.at(-1);
  const journal = last ? [{policy:last.policy, parameters:last.parameters, world:last.world}] : [];
  let reply;
  try {
    worker ??= new Worker(new URL('./turn-worker.js', import.meta.url), {type:'module'});
    reply = await new Promise((resolve, reject) => {
      worker.onmessage = event => resolve(event.data);
      worker.onerror = reject;
      worker.onmessageerror = reject;
      worker.postMessage({state:{...state, journal}, count, policy});
    });
  } catch {
    worker?.terminate();
    worker = false;
    return runMonths(state, count, policy);
  } finally {
    if (worker) worker.onmessage = worker.onerror = worker.onmessageerror = null;
  }
  if (reply.error !== undefined) throw new Error(reply.error);
  reply.result.journal = state.journal.concat(reply.result.journal);
  return reply.result;
}
