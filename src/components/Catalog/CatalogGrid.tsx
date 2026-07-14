import { useCallback, useMemo } from "react";
import { AnsibleProvider } from "../../hooks/AnsibleProvider";
import { OpenClawProvider } from "../../hooks/OpenClawProvider";
import { useUIConfigurationContext } from "../../hooks/UIConfigurationContext";
import useProductURLResolver from "../../hooks/useProductURLResolver";
import { UserSignupPhase, useUserContext } from "../../hooks/UserContext";
import useTriedProducts from "../../hooks/useTriedProducts";
import { ProductType, type Product } from "../../types/product";
import { AnsibleCatalogCard } from "./AnsibleCatalogCard";
import { CatalogCard } from "./CatalogCard";
import { ButtonLabel } from "./catalogCardTypes";
import "./CatalogGrid.css";
import { OpenClawCatalogCard } from "./OpenClawCatalogCard";
import { products } from "./productData";
import { usePhoneVerificationContext } from "../../hooks/PhoneVerificationContext";

export function CatalogGrid() {
  const { getProductURL } = useProductURLResolver();
  const { disabledIntegrations } = useUIConfigurationContext();
  const { openPhoneVerificationModal } = usePhoneVerificationContext();
  const { signupUser, userSignupPhase } = useUserContext();

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
      switch (userSignupPhase) {
        case UserSignupPhase.NOT_STARTED:
          signupUser();
          return;
        case UserSignupPhase.PENDING_PHONE_VERIFICATION:
          openPhoneVerificationModal();
          return;
        case UserSignupPhase.READY:
          openProductURL(product);
          return;
        default:
          return;
      }
    },
    [openPhoneVerificationModal, openProductURL, signupUser, userSignupPhase],
  );

  // We treat not having the "disabledIntegrations" field set as all of them
  // being disabled.
  if (disabledIntegrations === undefined) {
    return null;
  }

  return (
    <>
      <div className="sandbox-catalog-grid" data-testid="sandbox-catalog-grid">
        {enabledProducts.map((product: Product) => {
          switch (product.type) {
            case ProductType.AAP:
              return (
                <div
                  key={product.type}
                  className="sandbox-catalog-card-wrapper"
                >
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
                <div
                  key={product.type}
                  className="sandbox-catalog-card-wrapper"
                >
                  <OpenClawProvider>
                    <OpenClawCatalogCard
                      product={product}
                      isGreenCornerVisible={isProductTried(product)}
                      markProductAsTried={markProductAsTried}
                    />
                  </OpenClawProvider>
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
    </>
  );
}
