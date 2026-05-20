import { loadRecaptchaScript } from "../recaptcha";

describe("recaptcha utils", () => {
  const mockApiKey = "test-api-key";
  const expectedScriptUrl = `https://www.google.com/recaptcha/enterprise.js?render=${mockApiKey}`;

  beforeEach(() => {
    document.head.innerHTML = "";
  });

  it("should add recaptcha script when API key is provided", () => {
    loadRecaptchaScript(mockApiKey);

    const scriptElement = document.querySelector(
      `script[src="${expectedScriptUrl}"]`,
    ) as HTMLScriptElement;
    expect(scriptElement).toBeTruthy();
    expect(scriptElement.getAttribute("type")).toBe("text/javascript");
    expect(scriptElement.async).toBe(true);
    expect(scriptElement.defer).toBe(true);
  });

  it("should not add script when API key is empty", () => {
    loadRecaptchaScript("");

    const scriptElement = document.querySelector("script");
    expect(scriptElement).toBeFalsy();
  });

  it("should not add duplicate script if already exists", () => {
    loadRecaptchaScript(mockApiKey);
    loadRecaptchaScript(mockApiKey);

    const scriptElements = document.querySelectorAll(
      `script[src="${expectedScriptUrl}"]`,
    );
    expect(scriptElements.length).toBe(1);
  });
});
