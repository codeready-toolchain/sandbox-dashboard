import { Button, Content } from "@patternfly/react-core";
import { useState } from "react";
import { useUserContext } from "../../hooks/UserContext";
import { AccessCodeInputModal } from "../Modals";
import { CatalogBanner } from "./CatalogBanner";
import { CatalogGrid } from "./CatalogGrid";

export function CatalogPage() {
  const { refetchUserData } = useUserContext();
  const [isAccessCodeModalOpen, setIsAccessCodeModalOpen] =
    useState<boolean>(false);

  const handleActivationCodeVerified = () => {
    setIsAccessCodeModalOpen(false);
    // refetchUserData already logs errors internally. The catch here prevents
    // an unhandled rejection when the modal invokes onVerified without
    // awaiting the returned promise.
    void refetchUserData().catch(() => undefined);
  };

  return (
    <>
      <CatalogBanner />
      <div style={{ padding: "0 100px 0 100px", minHeight: "100%" }}>
        <CatalogGrid />
      </div>
      <div style={{ padding: "16px", textAlign: "center" }}>
        <Content component="p">
          Have an activation code?{" "}
          <Button
            variant="link"
            isInline
            onClick={() => setIsAccessCodeModalOpen(true)}
            data-testid="activation-code-link"
          >
            Click here
          </Button>
        </Content>
        <div id="consent_blackbar" />
      </div>
      <AccessCodeInputModal
        isOpen={isAccessCodeModalOpen}
        onClose={() => setIsAccessCodeModalOpen(false)}
        onVerified={handleActivationCodeVerified}
      />
    </>
  );
}
