const WRITE_FLAG = "RADARRISAS_WRITE_ENABLED";

export function automationWritesEnabled() {
  return process.env[WRITE_FLAG]?.trim().toLowerCase() === "true";
}

function automationConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const apiKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.SUPABASE_AUTOMATION_EMAIL;
  const password = process.env.SUPABASE_AUTOMATION_PASSWORD;

  if (!url || !apiKey || !email || !password) {
    throw new Error(
      "Las escrituras requieren NEXT_PUBLIC_SUPABASE_URL, " +
        "SUPABASE_PUBLISHABLE_KEY, SUPABASE_AUTOMATION_EMAIL y " +
        "SUPABASE_AUTOMATION_PASSWORD."
    );
  }

  return { url, apiKey, email, password };
}

let cachedToken;

function decodeJwtPayload(token) {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("Supabase Auth devolvió un access token inválido.");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

async function automationAccessToken(configuration) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken?.expiresAt > now + 60) return cachedToken.value;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(
      `${configuration.url}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: configuration.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: configuration.email,
          password: configuration.password,
        }),
        signal: controller.signal,
      }
    );
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok || !payload?.access_token) {
      throw new Error(
        `Supabase Auth falló con HTTP ${response.status}: ${
          payload?.msg ?? payload?.message ?? payload?.error_description ?? "sin detalle"
        }`
      );
    }

    const claims = decodeJwtPayload(payload.access_token);
    if (claims.role !== "radarrisas_automation") {
      throw new Error(
        `Supabase Auth emitió el rol inesperado ${claims.role ?? "ausente"}.`
      );
    }

    cachedToken = {
      value: payload.access_token,
      expiresAt: Number(claims.exp) || now,
    };
    return cachedToken.value;
  } finally {
    clearTimeout(timeout);
  }
}

export async function callAutomationRpc(name, body = {}, options = {}) {
  if (!automationWritesEnabled()) {
    return { dryRun: true, rpc: name };
  }

  const configuration = automationConfiguration();
  const accessToken = await automationAccessToken(configuration);
  const { url, apiKey } = configuration;
  const retries = options.retries ?? 2;
  const timeoutMs = options.timeoutMs ?? 15000;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: {
          apikey: apiKey,
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await response.text();
      const payload = text ? JSON.parse(text) : null;

      if (response.ok) return payload;

      const error = new Error(
        `RPC ${name} falló con HTTP ${response.status}: ${payload?.message ?? "sin detalle"}`
      );
      error.status = response.status;

      if (response.status < 500 || attempt === retries) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (attempt === retries || (error.status && error.status < 500)) throw error;
    } finally {
      clearTimeout(timeout);
    }

    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }

  throw lastError;
}

export function candidateRpcPayload(action) {
  return {
    idempotency_key: action.idempotencyKey,
    ...action.candidate,
  };
}

export function observationRpcPayload(observation) {
  return {
    observation_key: observation.observationKey,
    event_id: observation.eventId,
    provider: observation.provider,
    source_url: observation.sourceUrl ?? null,
    price_from: observation.priceFrom ?? null,
    availability_status: observation.availabilityStatus ?? "unknown",
    availability_source: observation.availabilitySource ?? null,
    availability_evidence: observation.availabilityEvidence ?? [],
    attempted_at: observation.attemptedAt,
    verified_at: observation.verifiedAt ?? null,
    error_code: observation.errorCode ?? null,
  };
}
