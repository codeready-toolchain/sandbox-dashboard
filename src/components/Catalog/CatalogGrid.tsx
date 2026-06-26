import { Grid, GridItem } from "@patternfly/react-core";
import { useCallback, useMemo, useState } from "react";
import { SHORT_INTERVAL } from "../../const";
import { useSandboxContext } from "../../hooks/SandboxContext";
import useGreenCorners from "../../hooks/useGreenCorners";
import useProductURLs, { Product } from "../../hooks/useProductURLs";
import { UserStatus } from "../../types";
import { AnsibleStatus } from "../../utils/aap-utils";
import { OpenClawStatus } from "../../utils/openclaw-utils";
import {
  AnsibleDeleteInstanceModal,
  AnsibleLaunchInfoModal,
  OpenClawDeleteInstanceModal,
  OpenClawLaunchInfoModal,
  PhoneVerificationModal,
} from "../Modals";
import {
  CatalogCard,
  type ButtonLabel,
  type DeleteButtonLabel,
} from "./CatalogCard";
import { productData } from "./productData";

function getOpenClawButtonLabel(status: OpenClawStatus): ButtonLabel {
  switch (status) {
    case OpenClawStatus.READY:
      return "Launch";
    case OpenClawStatus.IDLED:
      return "Re-provision";
    case OpenClawStatus.PROVISIONING:
    case OpenClawStatus.TERMINATING:
    case OpenClawStatus.DELETING:
      return "Provision";
    case OpenClawStatus.FAILED:
    case OpenClawStatus.UNKNOWN:
    case OpenClawStatus.NEW:
    default:
      return "Provision";
  }
}

function getOpenClawDeleteLabel(status: OpenClawStatus): DeleteButtonLabel {
  if (status === OpenClawStatus.DELETING) return "Deleting";
  if (status === OpenClawStatus.TERMINATING) return "Stop";
  return "Delete";
}

function getOpenClawStatusLabel(status: OpenClawStatus): {
  label: string;
  color: "blue" | "green" | "orange" | "red" | "grey";
} | null {
  switch (status) {
    case OpenClawStatus.PROVISIONING:
      return { label: "Provisioning", color: "blue" };
    case OpenClawStatus.READY:
      return { label: "Ready", color: "green" };
    case OpenClawStatus.IDLED:
      return { label: "Idled", color: "orange" };
    case OpenClawStatus.TERMINATING:
      return { label: "Terminating", color: "orange" };
    case OpenClawStatus.DELETING:
      return { label: "Deleting", color: "red" };
    case OpenClawStatus.FAILED:
      return { label: "Failed", color: "red" };
    default:
      return null;
  }
}

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
    openclawStatus,
    openclawError,
    openclawUILink,
    handleOpenClawInstance,
    deleteOpenClaw,
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
  const [openclawInfoModalOpen, setOpenclawInfoModalOpen] = useState(false);
  const [openclawDeleteModalOpen, setOpenclawDeleteModalOpen] = useState(false);
  const [openclawDeleting, setOpenclawDeleting] = useState(false);
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

  const handleTryIt = useCallback(
    async (productId: Product) => {
      if (userStatus === UserStatus.NEW || userStatus === UserStatus.UNKNOWN) {
        setLoadingProduct(productId);
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
          } else if (resolved.status === UserStatus.READY) {
            if (productId === Product.AAP) {
              await handleAAPInstance(resolved.namespace || "");
              setAnsibleInfoModalOpen(true);
            } else if (productId === Product.OPENCLAW) {
              setOpenclawInfoModalOpen(true);
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

        if (productId === Product.OPENCLAW) {
          if (openclawStatus === OpenClawStatus.READY && openclawUILink) {
            window.open(openclawUILink, "_blank", "noopener,noreferrer");
            markAsTried(productId);
          } else if (openclawStatus === OpenClawStatus.IDLED) {
            setLoadingProduct(productId);
            try {
              await handleOpenClawInstance(
                userData?.defaultUserNamespace || "",
              );
            } finally {
              setLoadingProduct(null);
            }
          } else if (
            openclawStatus === OpenClawStatus.PROVISIONING ||
            openclawStatus === OpenClawStatus.TERMINATING
          ) {
            setOpenclawInfoModalOpen(true);
          } else {
            setOpenclawInfoModalOpen(true);
          }
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
      handleOpenClawInstance,
      openProductURL,
      markAsTried,
      openclawStatus,
      openclawUILink,
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

  const handleOpenClawProvision = useCallback(
    async (
      credentials: import("../../utils/openclaw-providers").AddedCredential[],
    ): Promise<boolean> => {
      if (!userData?.defaultUserNamespace) return false;
      const success = await handleOpenClawInstance(
        userData.defaultUserNamespace,
        credentials,
        false,
      );
      if (success) {
        markAsTried(Product.OPENCLAW);
      }
      return success;
    },
    [handleOpenClawInstance, userData, markAsTried],
  );

  const handleOpenClawDelete = useCallback(async () => {
    if (!userData?.defaultUserNamespace) return;
    setOpenclawDeleting(true);
    try {
      await deleteOpenClaw(userData.defaultUserNamespace);
    } finally {
      setOpenclawDeleting(false);
      setOpenclawDeleteModalOpen(false);
    }
  }, [deleteOpenClaw, userData?.defaultUserNamespace]);

  const showAAPDelete =
    ansibleStatus !== AnsibleStatus.NEW &&
    ansibleStatus !== AnsibleStatus.NOT_DEPLOYED;

  const showOpenClawDelete =
    openclawStatus !== OpenClawStatus.NEW &&
    openclawStatus !== OpenClawStatus.DELETING &&
    openclawStatus !== OpenClawStatus.UNKNOWN;

  if (disabledIntegrations === undefined) {
    return null;
  }

  return (
    <>
      <Grid hasGutter>
        {enabledProducts.map((product) => {
          const isAAP = product.id === Product.AAP;
          const isOpenClaw = product.id === Product.OPENCLAW;

          let buttonLabel: "Try it" | "Provision" | "Launch" | "Re-provision" =
            "Try it";
          let deleteButtonLabel: "Delete" | "Stop" | "Deleting" = "Delete";
          let statusLabel: string | undefined;
          let statusColor:
            | "blue"
            | "green"
            | "orange"
            | "red"
            | "grey"
            | undefined;
          let showDelete = false;
          let onDelete: (() => void) | undefined;

          if (isAAP) {
            showDelete = showAAPDelete;
            onDelete = () => setAnsibleDeleteModalOpen(true);
          } else if (isOpenClaw) {
            buttonLabel = getOpenClawButtonLabel(openclawStatus);
            deleteButtonLabel = getOpenClawDeleteLabel(openclawStatus);
            const statusInfo = getOpenClawStatusLabel(openclawStatus);
            if (statusInfo) {
              statusLabel = statusInfo.label;
              statusColor = statusInfo.color;
            }
            showDelete = showOpenClawDelete;
            onDelete = () => setOpenclawDeleteModalOpen(true);
          }

          return (
            <GridItem key={product.id} span={4}>
              <CatalogCard
                title={product.title}
                image={product.image}
                description={product.description}
                link={productURLs.find((pu) => pu.id === product.id)?.url || ""}
                greenCorner={
                  greenCorners?.find((gc) => gc.id === product.id)?.show ||
                  false
                }
                onTryIt={() => handleTryIt(product.id)}
                loading={loadingProduct === product.id}
                showDelete={showDelete}
                onDelete={onDelete}
                buttonLabel={buttonLabel}
                deleteButtonLabel={deleteButtonLabel}
                statusLabel={statusLabel}
                statusColor={statusColor}
              />
            </GridItem>
          );
        })}
      </Grid>

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
        <>
          <AnsibleDeleteInstanceModal
            isOpen={ansibleDeleteModalOpen}
            onClose={() => setAnsibleDeleteModalOpen(false)}
            onDeleted={handleAAPDeleted}
            proxyURL={userData.proxyURL}
            userNamespace={userData.defaultUserNamespace}
          />

          <OpenClawLaunchInfoModal
            isOpen={openclawInfoModalOpen}
            onClose={() => setOpenclawInfoModalOpen(false)}
            productId={Product.OPENCLAW}
            openclawStatus={openclawStatus}
            openclawError={openclawError}
            openclawUILink={openclawUILink}
            onProvision={handleOpenClawProvision}
            onLaunch={markAsTried}
          />

          <OpenClawDeleteInstanceModal
            isOpen={openclawDeleteModalOpen}
            onClose={() => setOpenclawDeleteModalOpen(false)}
            onDelete={handleOpenClawDelete}
            deleting={openclawDeleting}
          />
        </>
      )}
    </>
  );
}
