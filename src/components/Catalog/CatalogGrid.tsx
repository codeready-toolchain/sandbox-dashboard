import "./CatalogGrid.css";
import { useCallback, useMemo, useRef, useState } from "react";
import { SHORT_INTERVAL } from "../../const";
import { useSandboxContext } from "../../hooks/SandboxContext";
import useProductURLResolver from "../../hooks/useProductURLResolver";
import useTriedProducts from "../../hooks/useTriedProducts";
import { UserStatus } from "../../types";
import { ProductType, type Product } from "../../types/product";
import { PhoneVerificationModal } from "../Modals";
import { AnsibleCatalogCard } from "./AnsibleCatalogCard";
import { CatalogCard } from "./CatalogCard";
import { ButtonLabel, type EnsureUserIsReadyResult } from "./catalogCardTypes";
import { OpenClawCatalogCard } from "./OpenClawCatalogCard";
import { products } from "./productData";

export function CatalogGrid() {
  const {
    userStatus,
    userReady,
    verificationRequired,
    userData,
    signupUser,
    refetchUserData,
    disabledIntegrations,
  } = useSandboxContext();

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

  const { isProductTried, markProductAsTried } =
    useTriedProducts(enabledProducts);
  const { getProductURL } = useProductURLResolver();

  const [isPhoneModalOpen, setPhoneModalOpen] = useState<boolean>(false);
  const userSignupCreationInFlight = useRef(false);

  /**
   * Polls for the user signup until the back end returns a known status for
   * the resource.
   */
  const pollUntilStatusKnown = useCallback(async (): Promise<{
    status: UserStatus;
    namespace?: string;
  }> => {
    const data = await refetchUserData();
    if (!data) return { status: UserStatus.NEW };

    const namespace = data.defaultUserNamespace;
    if (data.status.ready) return { status: UserStatus.READY, namespace };
    if (data.status.verificationRequired)
      return { status: UserStatus.VERIFY, namespace };
    if (data.status.reason === "Provisioning")
      return { status: UserStatus.PROVISIONING, namespace };

    return { status: UserStatus.PENDING_APPROVAL, namespace };
  }, [refetchUserData]);

  /**
   * Sign's up the user and it might trigger the phone verification flow if
   * it is so required. Useful function so that the dependents know that it is
   * safe to do further actions on the user data.
   */
  const ensureUserIsReady =
    useCallback(async (): Promise<EnsureUserIsReadyResult> => {
      if (userStatus === UserStatus.NEW || userStatus === UserStatus.UNKNOWN) {
        if (userSignupCreationInFlight.current) {
          return { ready: false };
        }

        userSignupCreationInFlight.current = true;
        try {
          await signupUser();

          let resolved: { status: UserStatus; namespace?: string } = {
            status: UserStatus.UNKNOWN,
          };

          const maxAttempts = 30;
          for (let i = 0; i < maxAttempts; i++) {
            await new Promise((r) => setTimeout(r, SHORT_INTERVAL));
            resolved = await pollUntilStatusKnown();
            if (
              resolved.status !== UserStatus.NEW &&
              resolved.status !== UserStatus.UNKNOWN
            )
              break;
          }

          if (resolved.status === UserStatus.VERIFY) {
            setPhoneModalOpen(true);
            return { ready: false };
          }

          if (resolved.status === UserStatus.READY) {
            return { ready: true, namespace: resolved.namespace || "" };
          }
        } finally {
          userSignupCreationInFlight.current = false;
        }

        return { ready: false };
      }

      if (verificationRequired) {
        setPhoneModalOpen(true);
        return { ready: false };
      }

      if (userReady) {
        return { ready: true, namespace: userData?.defaultUserNamespace || "" };
      }

      return { ready: false };
    }, [
      userStatus,
      verificationRequired,
      userReady,
      userData?.defaultUserNamespace,
      signupUser,
      pollUntilStatusKnown,
    ]);

  /**
   * Closes the phone verification model and updates the user signup's data.
   */
  const handlePhoneVerified = useCallback(async () => {
    setPhoneModalOpen(false);
    await refetchUserData();
  }, [refetchUserData]);

  /**
   * Gets the URL for the given product and opens it in a new tab. It also
   * marks the product as "tried" so that a green mark can be applied to the
   * card.
   */
  const openProductURL = useCallback(
    (product: Product) => {
      const url = getProductURL(product);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        markProductAsTried(product);
      }
    },
    [getProductURL, markProductAsTried],
  );

  /**
   * Handles opening the product's URL for the cards that do not hold any
   * state, and only require opening a new tab with the product's URL.
   */
  const handleOnClickPrimaryButtonSimpleCards = useCallback(
    async (product: Product) => {
      const isUserReady = await ensureUserIsReady();
      if (!isUserReady.ready) {
        return;
      }

      openProductURL(product);
    },
    [ensureUserIsReady, openProductURL],
  );

  // We treat not having the "disabledIntegrations" field set as all of them
  // being disabled.
  if (disabledIntegrations === undefined) {
    return null;
  }

  return (
    <>
      <div className="sandbox-catalog-grid">
        {enabledProducts.map((product: Product) => {
          switch (product.type) {
            case ProductType.AAP:
              return (
                <div
                  key={product.type}
                  className="sandbox-catalog-card-wrapper"
                >
                  <AnsibleCatalogCard
                    product={product}
                    isGreenCornerVisible={isProductTried(product)}
                    ensureUserIsReady={ensureUserIsReady}
                    markProductAsTried={markProductAsTried}
                  />
                </div>
              );
            case ProductType.OPENCLAW:
              return (
                <div
                  key={product.type}
                  className="sandbox-catalog-card-wrapper"
                >
                  <OpenClawCatalogCard
                    product={product}
                    isGreenCornerVisible={isProductTried(product)}
                    ensureUserIsReady={ensureUserIsReady}
                    markProductAsTried={markProductAsTried}
                  />
                </div>
              );
            default:
              return (
                <div
                  key={product.type}
                  className="sandbox-catalog-card-wrapper"
                >
                  <CatalogCard
                    product={product}
                    primaryButtonLabel={ButtonLabel.TRY_IT}
                    isGreenCornerVisible={isProductTried(product)}
                    isPrimaryButtonDisabled={false}
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
      </div>

      <PhoneVerificationModal
        isOpen={isPhoneModalOpen}
        onClose={() => setPhoneModalOpen(false)}
        onVerified={handlePhoneVerified}
      />
    </>
  );
}
