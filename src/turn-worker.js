import {runMonths} from './engine.js';

self.onmessage = ({data:{state, count, policy}}) => {
  try {
    const result = runMonths(state, count, policy);
    result.journal = result.journal.slice(state.journal.length);
    self.postMessage({result});
  } catch (error) {
    self.postMessage({error:error.message});
  }
};
