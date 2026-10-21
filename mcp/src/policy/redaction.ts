/**
 * Redaction utility to scrub sensitive credentials, auth tokens,
 * passwords, and session cookies from tool outputs and logs.
 */

const SENSITIVE_PATTERNS = [
  // Bearer tokens & JWTs
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g,

  // Passwords, secrets, api keys in JSON or query params
  /("(?:password|secret|api_key|apikey|access_token|refresh_token|auth_token|token|private_key)"\s*:\s*)"[^"]+"/gi,
  /(password|secret|api_key|apikey|token)=([^&\s]+)/gi,

  // Authorization / Cookie headers
  /Authorization:\s*[^\r\n]+/gi,
  /Cookie:\s*[^\r\n]+/gi,
  /Set-Cookie:\s*[^\r\n]+/gi,
];

export function redactSecrets(input: string): string {
  if (!input || typeof input !== "string") return input;

  let result = input;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, (match, p1) => {
      if (p1) {
        return `${p1}"[REDACTED_SECRET]"`;
      }
      return "[REDACTED_SECRET]";
    });
  }
  return result;
}

export function redactObject<T>(obj: T): T {
  if (!obj) return obj;
  try {
    const serialized = JSON.stringify(obj);
    const sanitized = redactSecrets(serialized);
    return JSON.parse(sanitized);
  } catch {
    return obj;
  }
}
