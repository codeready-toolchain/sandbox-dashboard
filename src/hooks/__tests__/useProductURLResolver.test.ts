import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { products } from "../../components/Catalog/productData";
import { readyUserFixture } from "../../mocks/fixtures";
import type { User } from "../../types";
import {
  ProductType,
  type Product,
  type URLTemplateVars,
} from "../../types/product";
import type { UserContextType } from "../UserContext";
import { UserContext, UserSignupPhase } from "../UserContext";
import useProductURLResolver from "../useProductURLResolver";

function makeContext(
  overrides: Partial<UserContextType> = {},
): UserContextType {
  return {
    user: readyUserFixture,
    userSignupPhase: UserSignupPhase.READY,
    refetchUserData: vi.fn().mockResolvedValue(undefined),
    signupUser: vi.fn(),
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    type: ProductType.OPENSHIFT_CONSOLE,
    title: "Test Product",
    image: "",
    description: [],
    ...overrides,
  };
}

function renderResolver(contextOverrides: Partial<UserContextType> = {}) {
  const ctx = makeContext(contextOverrides);
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(UserContext.Provider, { value: ctx }, children);

  return renderHook(() => useProductURLResolver(), { wrapper });
}

describe("useProductURLResolver", () => {
  describe("when the user is not ready", () => {
    const notReadyUserData: User = {
      ...readyUserFixture,
      status: { ready: false, reason: "", verificationRequired: false },
    };

    it("returns empty string when user status is not ready", () => {
      const { result } = renderResolver({
        user: notReadyUserData,
        userSignupPhase: UserSignupPhase.PENDING_MANUAL_APPROVAL,
      });

      const product = makeProduct({
        urlTemplate: "{{consoleURL}}/dashboard",
      });

      expect(result.current.getProductURL(product)).toBe("");
    });

    it("returns empty string for a product with a custom resolver", () => {
      const { result } = renderResolver({
        user: notReadyUserData,
        userSignupPhase: UserSignupPhase.PENDING_MANUAL_APPROVAL,
      });

      const product = makeProduct({
        resolveURL: () => "https://custom.example.com",
      });

      expect(result.current.getProductURL(product)).toBe("");
    });

    it("returns empty string when user is undefined", () => {
      const { result } = renderResolver({
        user: undefined,
        userSignupPhase: UserSignupPhase.NOT_STARTED,
      });

      const product = makeProduct({
        urlTemplate: "{{consoleURL}}/dashboard",
      });

      expect(result.current.getProductURL(product)).toBe("");
    });
  });

  describe("custom resolver (Dev Spaces resolveURL)", () => {
    const devSpacesProduct = products.find(
      (p) => p.type === ProductType.DEVSPACES,
    )!;

    it("returns cheDashboardURL when it is available", () => {
      const { result } = renderResolver();

      expect(result.current.getProductURL(devSpacesProduct)).toBe(
        readyUserFixture.cheDashboardURL,
      );
    });

    it("derives the URL from consoleURL when cheDashboardURL is empty", () => {
      const user: User = {
        ...readyUserFixture,
        cheDashboardURL: "",
        consoleURL:
          "https://console-openshift-console.apps.cluster1.example.com",
      };
      const { result } = renderResolver({ user });

      expect(result.current.getProductURL(devSpacesProduct)).toBe(
        "https://devspaces.apps.cluster1.example.com",
      );
    });

    it("returns empty string when both cheDashboardURL and consoleURL are empty", () => {
      const user: User = {
        ...readyUserFixture,
        cheDashboardURL: "",
        consoleURL: "",
      };
      const { result } = renderResolver({ user });

      expect(result.current.getProductURL(devSpacesProduct)).toBe("");
    });

    it("returns empty string when consoleURL has no '.apps' segment", () => {
      const user: User = {
        ...readyUserFixture,
        cheDashboardURL: "",
        consoleURL: "https://console.example.com",
      };
      const { result } = renderResolver({ user });

      expect(result.current.getProductURL(devSpacesProduct)).toBe("");
    });
  });

  describe("URL template without parameters", () => {
    it("returns the template string as-is", () => {
      const { result } = renderResolver();

      const product = makeProduct({
        urlTemplate: "https://static.example.com/dashboard",
      });

      expect(result.current.getProductURL(product)).toBe(
        "https://static.example.com/dashboard",
      );
    });
  });

  describe("URL template with parameters", () => {
    it("replaces a single placeholder", () => {
      const { result } = renderResolver();

      const product = makeProduct({
        urlTemplate: "{{rhodsMemberURL}}",
      });

      expect(result.current.getProductURL(product)).toBe(
        readyUserFixture.rhodsMemberURL,
      );
    });

    it("replaces multiple placeholders", () => {
      const { result } = renderResolver();

      const product = makeProduct({
        urlTemplate:
          "{{consoleURL}}/k8s/cluster/projects/{{defaultUserNamespace}}",
      });

      expect(result.current.getProductURL(product)).toBe(
        `${readyUserFixture.consoleURL}/k8s/cluster/projects/${readyUserFixture.defaultUserNamespace}`,
      );
    });

    it("replaces an unknown placeholder with empty string", () => {
      const { result } = renderResolver();

      const product = makeProduct({
        urlTemplate: "https://example.com/{{unknownVar}}/page",
      });

      expect(result.current.getProductURL(product)).toBe(
        "https://example.com//page",
      );
    });
  });

  describe("when neither resolveURL nor urlTemplate is set", () => {
    it("returns empty string", () => {
      const { result } = renderResolver();

      const product = makeProduct();

      expect(result.current.getProductURL(product)).toBe("");
    });
  });

  describe("resolveURL takes precedence over urlTemplate", () => {
    it("uses resolveURL when both are defined", () => {
      const { result } = renderResolver();

      const product = makeProduct({
        urlTemplate: "{{consoleURL}}/should-not-use",
        resolveURL: (vars: URLTemplateVars) =>
          `https://custom.example.com/${vars.defaultUserNamespace}`,
      });

      expect(result.current.getProductURL(product)).toBe(
        `https://custom.example.com/${readyUserFixture.defaultUserNamespace}`,
      );
    });
  });
});
