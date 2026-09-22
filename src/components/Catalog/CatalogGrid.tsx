import "./CatalogGrid.css";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAnalyticsContext } from "../../hooks/AnalyticsContext";
import { AnsibleProvider } from "../../hooks/AnsibleProvider";
import { OpenClawProvider } from "../../hooks/OpenClawProvider";
import { usePhoneVerificationContext } from "../../hooks/PhoneVerificationContext";
import { useSignupAction } from "../../hooks/signupAction/SignupActionContext";
import { SignupActionProvider } from "../../hooks/signupAction/SignupActionProvider";
import { useUIConfigurationContext } from "../../hooks/UIConfigurationContext";
import useProductURLResolver from "../../hooks/useProductURLResolver";
import { useUserContext } from "../../hooks/UserContext";
import { UserSignupPhase } from "../../hooks/userSignupPhase";
import useTriedProducts from "../../hooks/useTriedProducts";
import { type Product, ProductType } from "../../types/product";
import { isRhdhReady, RHDH_READY_DELAY_MS } from "../../utils/rhdh-utils";
import { AnsibleCatalogCard } from "./AnsibleCatalogCard";
import { CatalogCard } from "./CatalogCard";
import { ButtonLabel } from "./catalogCardTypes";
import { OpenClawCatalogCard } from "./OpenClawCatalogCard";
import { products } from "./productData";

/**
 * Product catalog grid. It is wrapped by the
 * SignupActionProvider so that we can store the pending signup actions,
 * if any, mainly for the stateful cards. The AAP and OpenClaw cards use
 * a NO-OP provider which then gets replaced as soon as the user gets in
 * a "ready" state, so we need to store those actions above the cards
 * themselves. And having a provider is the way to not have the
 * CatalogGrid cluttered with "unrelated" code.
 */
export function CatalogGrid() {
  return (
    <SignupActionProvider>
      <CatalogGridCards />
    </SignupActionProvider>
  );
}

/**
 * Renders the enabled catalog cards and wires simple-card primary
 * actions through the signup continuation.
 */
function CatalogGridCards() {
  const { trackAnalytics } = useAnalyticsContext();
  const { getProductURL } = useProductURLResolver();
  const { disabledIntegrations } = useUIConfigurationContext();
  const { openPhoneVerificationModal } = usePhoneVerificationContext();
  const { user, userSignupPhase } = useUserContext();
  const { isSignupInProgress, signupAndRun, registerAction } =
    useSignupAction();

  /**
   * Filters the disabled products so that they do not get shown in the
   * catalog, and so that they are not used for the green corners.
   */
  const enabledProducts: Product[] = useMemo(() => {
    const disabledIntegs: string[] = disabledIntegrations ?? [];
    const filtered: Product[] = [];

    for (const product of products) {
      if (!disabledIntegs.includes(product.type)) {
        filtered.push(product);
      }
    }

    return filtered;
  }, [disabledIntegrations]);

  // Grab the utilities to check and mark if the products have been tried.
  const { isProductTried, markProductAsTried } =
    useTriedProducts(enabledProducts);

  /**
   * Gets the URL for the given product and opens it in a new tab. It also
   * marks the product as "tried" so that a green mark can be applied to the
   * card.
   */
  const openProductURL = useCallback(
    (product: Product) => {
      const url = getProductURL(product);
      if (url) {
        trackAnalytics(product, "Catalog", url, "cta");
        window.open(url, "_blank", "noopener,noreferrer");
        markProductAsTried(product);
      }
    },
    [getProductURL, markProductAsTried, trackAnalytics],
  );

  // Register the primary actions for the stateless cards. The goal is to
  // either auto-execute them if we are in the user gesture window of the
  // browser, or show them in the corresponding primary button of the "signup"
  // modal.
  useEffect(() => {
    for (const product of enabledProducts) {
      // Skip the AAP and OpenClaw products because their actions get
      // registered in their own cards.
      if (
        product.type === ProductType.AAP ||
        product.type === ProductType.OPENCLAW
      ) {
        continue;
      }

      const productToOpen = product;
      registerAction(productToOpen.type, {
        buttonLabel: ButtonLabel.TRY_IT,
        canEnable: userSignupPhase === UserSignupPhase.READY,
        onReady: () => {
          openProductURL(productToOpen);
        },
      });
    }
  }, [enabledProducts, openProductURL, registerAction, userSignupPhase]);

  /**
   * Handles opening the product's URL for the cards that do not hold any
   * state, and only require opening a new tab with the product's URL.
   */
  const handleOnClickPrimaryButtonSimpleCards = useCallback(
    (product: Product) => {
      switch (userSignupPhase) {
        case UserSignupPhase.NOT_STARTED:
        case UserSignupPhase.SIGNING_UP:
        case UserSignupPhase.PROVISIONING:
          signupAndRun(product.type);
          return;
        case UserSignupPhase.PENDING_PHONE_VERIFICATION:
          openPhoneVerificationModal();
          return;
        case UserSignupPhase.READY:
          openProductURL(product);
          return;
        case UserSignupPhase.BLOCKED:
        default:
          return;
      }
    },
    [signupAndRun, openPhoneVerificationModal, openProductURL, userSignupPhase],
  );

  // Force a rerender when the RHDH grace period expires so isRhdhReady is
  // reevaluated at startDate plus the delay, without waiting for another
  // user or signup-phase update.
  const [, setRhdhReadyAt] = useState<number>(0);
  useEffect(() => {
    if (userSignupPhase !== UserSignupPhase.READY || isRhdhReady(user)) {
      return undefined;
    }

    const startMs = Date.parse(user?.startDate ?? "");
    if (Number.isNaN(startMs)) {
      return undefined;
    }

    // isRhdhReady uses a strict greater-than check, so fire just after the
    // delay rather than at the exact threshold.
    const timeoutId = window.setTimeout(
      () => {
        setRhdhReadyAt(Date.now());
      },
      Math.max(startMs + RHDH_READY_DELAY_MS + 1 - Date.now(), 0),
    );

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [user, userSignupPhase]);

  // RHDH cannot be opened until the account is READY and the 15-second
  // window after startDate has elapsed. Signup and phone verification stay
  // on the other catalog cards.
  const isRhdhProvisioning =
    userSignupPhase === UserSignupPhase.READY && !isRhdhReady(user);
  const isRhdhButtonEnabled =
    userSignupPhase === UserSignupPhase.READY && isRhdhReady(user);

  // We treat not having the "disabledIntegrations" field set as all of them
  // being disabled.
  if (disabledIntegrations === undefined) {
    return null;
  }

  return (
    <section aria-label="Product catalog" className="sandbox-catalog-grid">
      {enabledProducts.map((product: Product) => {
        switch (product.type) {
          case ProductType.AAP:
            return (
              <div key={product.type} className="sandbox-catalog-card-wrapper">
                <AnsibleProvider>
                  <AnsibleCatalogCard
                    product={product}
                    isGreenCornerVisible={isProductTried(product)}
                    markProductAsTried={markProductAsTried}
                  />
                </AnsibleProvider>
              </div>
            );
          case ProductType.OPENCLAW:
            return (
              <div key={product.type} className="sandbox-catalog-card-wrapper">
                <OpenClawProvider>
                  <OpenClawCatalogCard
                    product={product}
                    isGreenCornerVisible={isProductTried(product)}
                    markProductAsTried={markProductAsTried}
                  />
                </OpenClawProvider>
              </div>
            );
          case ProductType.RHDH:
            return (
              <div key={product.type} className="sandbox-catalog-card-wrapper">
                <CatalogCard
                  product={product}
                  primaryButtonLabel={
                    isRhdhProvisioning
                      ? ButtonLabel.PROVISIONING
                      : ButtonLabel.TRY_IT
                  }
                  isGreenCornerVisible={isProductTried(product)}
                  isPrimaryButtonDisabled={
                    isSignupInProgress || !isRhdhButtonEnabled
                  }
                  isPrimaryButtonSpinnerVisible={isRhdhProvisioning}
                  isPrimaryButtonExtIconVisible
                  isDeleteButtonVisible={false}
                  onClickPrimaryButton={() =>
                    handleOnClickPrimaryButtonSimpleCards(product)
                  }
                />
              </div>
            );
          default:
            return (
              <div key={product.type} className="sandbox-catalog-card-wrapper">
                <CatalogCard
                  product={product}
                  primaryButtonLabel={ButtonLabel.TRY_IT}
                  isGreenCornerVisible={isProductTried(product)}
                  isPrimaryButtonDisabled={
                    isSignupInProgress ||
                    userSignupPhase === UserSignupPhase.INITIAL_FETCH
                  }
                  isPrimaryButtonSpinnerVisible={false}
                  isPrimaryButtonExtIconVisible
                  isDeleteButtonVisible={false}
                  onClickPrimaryButton={() =>
                    handleOnClickPrimaryButtonSimpleCards(product)
                  }
                />
              </div>
            );
        }
      })}
    </section>
  );
}
