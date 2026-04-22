const DEFAULT_RETRIES = 3;
const DEFAULT_BASE_MS = 2000;

function isTransientError(err) {
  const status = err?.response?.status ?? err?.status;
  if (status && (status === 429 || status >= 500)) return true;

  const code = err?.code || err?.cause?.code;
  if (code && ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN', 'ENOTFOUND', 'ECONNABORTED'].includes(code)) {
    return true;
  }

  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('timeout') || msg.includes('rate limit') || msg.includes('econnreset') || msg.includes('network')) {
    return true;
  }

  return false;
}

export async function retryWithBackoff(fn, { retries = DEFAULT_RETRIES, baseMs = DEFAULT_BASE_MS, label = 'op' } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isTransientError(err)) {
        throw err;
      }
      const delay = baseMs * Math.pow(2, attempt);
      console.warn(`[Retry] ${label} falhou (tentativa ${attempt + 1}/${retries + 1}): ${err.message} → retry em ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
