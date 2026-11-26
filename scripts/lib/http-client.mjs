const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryable(error, status) {
  if (error?.name === "AbortError" || error?.name === "TimeoutError") {
    return true;
  }

  return status === 408 || status === 429 || status >= 500;
}

export async function fetchPage(url, options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    backoffMs = DEFAULT_BACKOFF_MS,
    headers = {},
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const attemptedAt = new Date().toISOString();
    let response;

    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": "RadarRisas-Discovery/1.0",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "es-CL,es;q=0.9",
          ...headers,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }

      return {
        html: await response.text(),
        finalUrl: response.url,
        status: response.status,
        attemptedAt,
        verifiedAt: new Date().toISOString(),
        attempts: attempt + 1,
      };
    } catch (error) {
      lastError = error;

      if (
        attempt >= retries ||
        !retryable(error, response?.status ?? error?.status)
      ) {
        break;
      }

      await sleep(backoffMs * 2 ** attempt);
    }
  }

  throw lastError;
}

export async function fetchJson(url, options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    backoffMs = DEFAULT_BACKOFF_MS,
    headers = {},
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let response;

    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": "RadarRisas-Discovery/1.0",
          Accept: "application/json",
          ...headers,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }

      return {
        json: await response.json(),
        finalUrl: response.url,
        status: response.status,
        attemptedAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        attempts: attempt + 1,
      };
    } catch (error) {
      lastError = error;

      if (
        attempt >= retries ||
        !retryable(error, response?.status ?? error?.status)
      ) {
        break;
      }

      await sleep(backoffMs * 2 ** attempt);
    }
  }

  throw lastError;
}
