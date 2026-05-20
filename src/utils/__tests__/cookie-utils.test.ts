import { getCookie, setCookie } from "../cookie-utils";

describe("cookie-utils", () => {
  beforeEach(() => {
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0].trim();
      if (name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
      }
    });
  });

  describe("setCookie", () => {
    it("sets a cookie with the given name and value", () => {
      setCookie("testName", "testValue");
      expect(document.cookie).toContain("testName=testValue");
    });
  });

  describe("getCookie", () => {
    it("returns the value of an existing cookie", () => {
      document.cookie = "myCookie=hello;path=/";
      expect(getCookie("myCookie")).toBe("hello");
    });

    it("returns empty string for a non-existent cookie", () => {
      expect(getCookie("nonexistent")).toBe("");
    });
  });
});
