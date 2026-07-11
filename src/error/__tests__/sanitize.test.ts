import { sanitizeErrorBody } from "../sanitize";

describe("sanitizeErrorBody", () => {
  it("returns null/undefined unchanged", () => {
    expect(sanitizeErrorBody(null)).toBeNull();
    expect(sanitizeErrorBody(undefined)).toBeUndefined();
  });

  it("passes through short strings unchanged", () => {
    expect(sanitizeErrorBody("simple error message")).toBe(
      "simple error message",
    );
  });

  it("redacts token values in key-value patterns", () => {
    const input = '{"token": "FAKE-TOKEN-aaa111bbb222"}';
    const result = sanitizeErrorBody(input) as string;
    expect(result).not.toContain("FAKE-TOKEN-aaa111bbb222");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts short token values", () => {
    const input = '{"token": "abc"}';
    const result = sanitizeErrorBody(input) as string;
    expect(result).not.toContain('"abc"');
    expect(result).toContain("[REDACTED]");
  });

  it("redacts password fields", () => {
    const input = '{"password": "FAKE-pass-0000"}';
    const result = sanitizeErrorBody(input) as string;
    expect(result).not.toContain("FAKE-pass-0000");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts Bearer tokens", () => {
    const input = "Authorization: Bearer FAKE.bearer.placeholder";
    const result = sanitizeErrorBody(input) as string;
    expect(result).not.toContain("FAKE.bearer.placeholder");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts api_key fields", () => {
    const input = '{"api_key": "FAKE-key-00000000"}';
    const result = sanitizeErrorBody(input) as string;
    expect(result).not.toContain("FAKE-key-00000000");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts unquoted query-string values", () => {
    const input = "token=FAKE-qs-value&other=keep";
    const result = sanitizeErrorBody(input) as string;
    expect(result).not.toContain("FAKE-qs-value");
    expect(result).toContain("token=[REDACTED]");
    expect(result).toContain("other=keep");
  });

  it("stops query-string redaction at JSON delimiters", () => {
    const input = '{"url":"host?token=secret123","status":"error"}';
    const result = sanitizeErrorBody(input) as string;
    expect(result).not.toContain("secret123");
    expect(result).toContain("token=[REDACTED]");
    expect(result).toContain('"status"');
    expect(result).toContain('"error"');
  });

  it("stops query-string redaction at closing braces and brackets", () => {
    const input = "{token=mysecret}";
    const result = sanitizeErrorBody(input) as string;
    expect(result).not.toContain("mysecret");
    expect(result).toContain("token=[REDACTED]");
    expect(result).toContain("}");
  });

  it("redacts access_token fields", () => {
    const input = '{"access_token": "FAKE-at-value"}';
    const result = sanitizeErrorBody(input) as string;
    expect(result).not.toContain("FAKE-at-value");
    expect(result).toContain('"access_token"');
    expect(result).toContain("[REDACTED]");
  });

  it("redacts access-token fields (hyphenated variant)", () => {
    const input = '{"access-token": "FAKE-at-hyphen"}';
    const result = sanitizeErrorBody(input) as string;
    expect(result).not.toContain("FAKE-at-hyphen");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts refresh_token fields", () => {
    const input = '{"refresh_token": "FAKE-rt-value"}';
    const result = sanitizeErrorBody(input) as string;
    expect(result).not.toContain("FAKE-rt-value");
    expect(result).toContain('"refresh_token"');
    expect(result).toContain("[REDACTED]");
  });

  it("redacts client_secret fields", () => {
    const input = '{"client_secret": "FAKE-cs-value"}';
    const result = sanitizeErrorBody(input) as string;
    expect(result).not.toContain("FAKE-cs-value");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts multiple sensitive fields in a single string", () => {
    const input =
      '{"token": "FAKE-t1", "password": "FAKE-p1", "status": "error"}';
    const result = sanitizeErrorBody(input) as string;
    expect(result).not.toContain("FAKE-t1");
    expect(result).not.toContain("FAKE-p1");
    expect(result).toContain('"status"');
    expect(result).toContain('"error"');
  });

  it("preserves key names and delimiters while only redacting values", () => {
    const input = '{"token": "FAKE-val"}';
    const result = sanitizeErrorBody(input) as string;
    expect(result).toBe('{"token": "[REDACTED]"}');
  });

  it("redacts unquoted colon-delimited values", () => {
    const input = "password: hunter2plain";
    const result = sanitizeErrorBody(input) as string;
    expect(result).not.toContain("hunter2plain");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts colon-delimited values without whitespace", () => {
    const input = "token:abc123secret";
    const result = sanitizeErrorBody(input) as string;
    expect(result).not.toContain("abc123secret");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts multiple query-string sensitive params", () => {
    const input = "token=FAKE-a&password=FAKE-b&page=1";
    const result = sanitizeErrorBody(input) as string;
    expect(result).not.toContain("FAKE-a");
    expect(result).not.toContain("FAKE-b");
    expect(result).toContain("token=[REDACTED]");
    expect(result).toContain("password=[REDACTED]");
    expect(result).toContain("page=1");
  });

  it("truncates strings exceeding 2048 characters", () => {
    const marker = "... [truncated]";
    const long = "x".repeat(3000);
    const result = sanitizeErrorBody(long) as string;
    expect(result.length).toBe(2048 + marker.length);
    expect(result).toContain(marker);
  });

  it("serializes objects and applies redaction", () => {
    const input = { secret: "FAKE-secret-value-000", status: 401 };
    const result = sanitizeErrorBody(input) as string;
    expect(result).not.toContain("FAKE-secret-value-000");
    expect(result).toContain("401");
  });

  it("redacts credential-bearing string values inside objects before serialization", () => {
    const input = { message: 'token="abc123"' };
    const result = sanitizeErrorBody(input) as string;
    expect(result).not.toContain("abc123");
    expect(result).toContain("[REDACTED]");
  });

  it("converts numbers to string", () => {
    expect(sanitizeErrorBody(42)).toBe("42");
  });
});
