import { createGroq } from "@ai-sdk/groq";

const primaryKey = process.env.GROQ_API_KEY ?? "";
const backupKey = process.env.GROQ_API_KEY_BACKUP ?? "";

async function fetchWithGroqKeyFallback(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const primaryRequest = new Request(input, init);
  const hasBackup = Boolean(backupKey) && backupKey !== primaryKey;

  if (!hasBackup) {
    return fetch(primaryRequest);
  }

  const primaryResponse = await fetch(primaryRequest);
  if (
    ![401, 403, 429].includes(primaryResponse.status) &&
    primaryResponse.status < 500
  ) {
    return primaryResponse;
  }

  const backupHeaders = new Headers(primaryRequest.headers);
  backupHeaders.set("Authorization", `Bearer ${backupKey}`);

  return fetch(new Request(primaryRequest.clone(), { headers: backupHeaders }));
}

export const groq = createGroq({
  apiKey: primaryKey,
  fetch: fetchWithGroqKeyFallback,
});
