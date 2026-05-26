import { useMemo, useState, useCallback } from "react";
import { Gallery, GalleryItem } from "@patternfly/react-core";
import { productData } from "./productData";
import useGreenCorners from "../../hooks/useGreenCorners";
import useProductURLs, { Product } from "../../hooks/useProductURLs";
import { useSandboxContext } from "../../hooks/SandboxContext";
import { CatalogCard } from "./CatalogCard";
import {
  PhoneVerificationModal,
  AnsibleLaunchInfoModal,
  AnsibleDeleteInstanceModal,
} from "../Modals";
import { AnsibleStatus } from "../../utils/aap-utils";
import { SHORT_INTERVAL } from "../../const";
import { UserStatus } from "../../types";

export function CatalogGrid() {
  const {
    userStatus,
    userReady,
    verificationRequired,
    userData,
    signupUser,
    refetchUserData,
    handleAAPInstance,
    refetchAAP,
    ansibleUILink,
    ansibleUIUser,
    ansibleUIPassword,
    ansibleStatus,
    ansibleError,
    disabledIntegrations,
  } = useSandboxContext();

  const enabledProducts = useMemo(
    () =>
      productData.filter((p) => !(disabledIntegrations ?? []).includes(p.id)),
    [disabledIntegrations],
  );
  const { greenCorners, setGreenCorners } = useGreenCorners(enabledProducts);
  const productURLs = useProductURLs();

  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [ansibleInfoModalOpen, setAnsibleInfoModalOpen] = useState(false);
  const [ansibleDeleteModalOpen, setAnsibleDeleteModalOpen] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState<Product | null>(null);

  const markAsTried = useCallback(
    (productId: Product) => {
      setGreenCorners((prev) =>
        prev.map((gc) => (gc.id === productId ? { ...gc, show: true } : gc)),
      );
    },
    [setGreenCorners],
  );

  const openProductURL = useCallback(
    (productId: Product) => {
      const url = productURLs.find((pu) => pu.id === productId)?.url;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      markAsTried(productId);
    },
    [productURLs, markAsTried],
  );

  const pollUntilStatusKnown = useCallback(async (): Promise<UserStatus> => {
    const data = await refetchUserData();
    if (!data) return UserStatus.NEW;

    if (data.status.ready) return UserStatus.READY;
    if (data.status.verificationRequired) return UserStatus.VERIFY;
    if (data.status.reason === "Provisioning") return UserStatus.PROVISIONING;

    return UserStatus.PENDING_APPROVAL;
  }, [refetchUserData]);

  const handleTryIt = useCallback(
    async (productId: Product) => {
      if (userStatus === UserStatus.NEW || userStatus === UserStatus.UNKNOWN) {
        setLoadingProduct(productId);
        try {
          await signupUser();

          let resolvedStatus: UserStatus = UserStatus.UNKNOWN;
          const maxAttempts = 30;
          for (let i = 0; i < maxAttempts; i++) {
            await new Promise((r) => setTimeout(r, SHORT_INTERVAL));
            resolvedStatus = await pollUntilStatusKnown();
            if (
              resolvedStatus !== UserStatus.NEW &&
              resolvedStatus !== UserStatus.UNKNOWN
            )
              break;
          }

          if (resolvedStatus === UserStatus.VERIFY) {
            setPhoneModalOpen(true);
          } else if (resolvedStatus === UserStatus.READY) {
            if (productId === Product.AAP) {
              await handleAAPInstance(userData?.defaultUserNamespace || "");
              setAnsibleInfoModalOpen(true);
            } else {
              openProductURL(productId);
            }
          }
        } finally {
          setLoadingProduct(null);
        }
        return;
      }

      if (verificationRequired) {
        setPhoneModalOpen(true);
        return;
      }

      if (userReady) {
        if (productId === Product.AAP) {
          setLoadingProduct(productId);
          try {
            await handleAAPInstance(userData?.defaultUserNamespace || "");
          } finally {
            setLoadingProduct(null);
          }
          setAnsibleInfoModalOpen(true);
          markAsTried(productId);
          return;
        }

        openProductURL(productId);
      }
    },
    [
      userStatus,
      verificationRequired,
      userReady,
      userData?.defaultUserNamespace,
      signupUser,
      pollUntilStatusKnown,
      handleAAPInstance,
      openProductURL,
      markAsTried,
    ],
  );

  const handlePhoneVerified = useCallback(async () => {
    setPhoneModalOpen(false);
    await refetchUserData();
  }, [refetchUserData]);

  const handleAAPDeleted = useCallback(async () => {
    setAnsibleDeleteModalOpen(false);
    if (userData?.defaultUserNamespace) {
      await refetchAAP(userData.defaultUserNamespace);
    }
  }, [refetchAAP, userData]);

  const showAAPDelete =
    ansibleStatus !== AnsibleStatus.NEW &&
    ansibleStatus !== AnsibleStatus.NOT_DEPLOYED;

  if (disabledIntegrations === undefined) {
    return null;
  }

  return (
    <>
      <Gallery hasGutter minWidths={{ default: "330px" }}>
        {enabledProducts.map((product) => (
          <GalleryItem key={product.id}>
            <CatalogCard
              title={product.title}
              image={product.image}
              description={product.description}
              link={productURLs.find((pu) => pu.id === product.id)?.url || ""}
              greenCorner={
                greenCorners?.find((gc) => gc.id === product.id)?.show || false
              }
              onTryIt={() => handleTryIt(product.id)}
              loading={loadingProduct === product.id}
              showDelete={product.id === Product.AAP && showAAPDelete}
              onDelete={
                product.id === Product.AAP
                  ? () => setAnsibleDeleteModalOpen(true)
                  : undefined
              }
            />
          </GalleryItem>
        ))}
      </Gallery>

      <PhoneVerificationModal
        isOpen={phoneModalOpen}
        onClose={() => setPhoneModalOpen(false)}
        onVerified={handlePhoneVerified}
      />

      <AnsibleLaunchInfoModal
        isOpen={ansibleInfoModalOpen}
        onClose={() => setAnsibleInfoModalOpen(false)}
        ansibleUILink={ansibleUILink}
        ansibleUIUser={ansibleUIUser}
        ansibleUIPassword={ansibleUIPassword}
        ansibleStatus={ansibleStatus}
        ansibleError={ansibleError}
      />

      {userData?.proxyURL && userData?.defaultUserNamespace && (
        <AnsibleDeleteInstanceModal
          isOpen={ansibleDeleteModalOpen}
          onClose={() => setAnsibleDeleteModalOpen(false)}
          onDeleted={handleAAPDeleted}
          proxyURL={userData.proxyURL}
          userNamespace={userData.defaultUserNamespace}
        />
      )}
    </>
  );
}
