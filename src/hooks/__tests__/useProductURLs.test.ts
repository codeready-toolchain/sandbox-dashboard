import { productsURLMapping, Product } from "../useProductURLs";
import type { SignupData } from "../../types";
import { readyUserFixture } from "../../mocks/fixtures";

describe("productsURLMapping", () => {
  it("returns empty URLs when user is not provisioned", () => {
    const unprovisioned: SignupData = {
      ...readyUserFixture,
      status: { ready: false, reason: "", verificationRequired: false },
    };
    const urls = productsURLMapping(unprovisioned);
    urls.forEach((u) => {
      expect(u.url).toBe("");
    });
  });

  it("returns correct URLs when user is provisioned", () => {
    const urls = productsURLMapping(readyUserFixture);

    const osConsole = urls.find((u) => u.id === Product.OPENSHIFT_CONSOLE);
    expect(osConsole?.url).toContain("/k8s/cluster/projects/");
    expect(osConsole?.url).toContain(readyUserFixture.defaultUserNamespace);

    const osAI = urls.find((u) => u.id === Product.OPENSHIFT_AI);
    expect(osAI?.url).toBe(readyUserFixture.rhodsMemberURL);

    const devSpaces = urls.find((u) => u.id === Product.DEVSPACES);
    expect(devSpaces?.url).toBe(readyUserFixture.cheDashboardURL);

    const aap = urls.find((u) => u.id === Product.AAP);
    expect(aap?.url).toBe("");

    const virt = urls.find((u) => u.id === Product.OPENSHIFT_VIRT);
    expect(virt?.url).toContain("/virtualization-overview");
  });

  it("returns empty URLs when userData is undefined", () => {
    const urls = productsURLMapping(undefined);
    urls.forEach((u) => {
      expect(u.url).toBe("");
    });
  });
});
