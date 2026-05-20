import { useEffect, useRef } from "react";
import { Content, Button } from "@patternfly/react-core";
import { FooterCopyright } from "@rhds/elements/react/rh-footer/rh-footer-copyright.js";
import { FooterUniversal } from "@rhds/elements/react/rh-footer/rh-footer-universal.js";
import "@rhds/elements/rh-footer/rh-footer-lightdom.css";

let trustArcElement: HTMLSpanElement | null = null;

const createTrustArcElement = () => {
  if (!trustArcElement) {
    trustArcElement = document.createElement("span");
    trustArcElement.id = "teconsent";
    trustArcElement.style.display = "none";
  }
  return trustArcElement;
};

function CookieConsentElement() {
  const consentRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const spanElement = createTrustArcElement();
    if (consentRef.current && !consentRef.current.contains(spanElement)) {
      consentRef.current.appendChild(spanElement);
    }
  });

  return <li ref={consentRef} />;
}

export function CatalogFooter() {
  // TODO: Phase 4 will wire this up to AccessCodeInputModal
  const handleActivationCodeClick = () => {
    // Placeholder — modal added in Phase 4
  };

  return (
    <>
      <div style={{ padding: "16px", textAlign: "center" }}>
        <Content component="p">
          Have an activation code?{" "}
          <Button
            variant="link"
            isInline
            onClick={handleActivationCodeClick}
          >
            Click here
          </Button>
        </Content>
        <div id="consent_blackbar" />
      </div>
      <FooterUniversal slot="universal" data-testid="rh-footer-universal">
        <h3 slot="links-primary" className="pf-v6-u-w-100 pf-v6-u-pb-md">
          About
        </h3>
        <ul slot="links-primary">
          <li>
            <a href="https://redhat.com/en/about/company">About Red Hat</a>
          </li>
          <li>
            <a href="https://redhat.com/en/jobs">Jobs</a>
          </li>
          <li>
            <a href="https://redhat.com/en/events">Events</a>
          </li>
          <li>
            <a href="https://redhat.com/en/about/office-locations">Locations</a>
          </li>
          <li>
            <a href="https://redhat.com/en/contact">Contact Red Hat</a>
          </li>
          <li>
            <a href="https://redhat.com/en/blog">Red Hat Blog</a>
          </li>
          <li>
            <a href="https://redhat.com/en/about/our-culture/inclusion">
              Inclusion at Red Hat
            </a>
          </li>
          <li>
            <a href="https://coolstuff.redhat.com/">Cool Stuff Store</a>
          </li>
          <li>
            <a href="https://www.redhat.com/en/summit">Red Hat Summit</a>
          </li>
        </ul>
        <h3 slot="links-secondary" className="pf-v6-u-w-100 pf-v6-u-pb-md">
          Privacy and legal
        </h3>
        <ul slot="links-secondary">
          <li>
            <a href="https://redhat.com/en/about/privacy-policy">
              Privacy statement
            </a>
          </li>
          <li>
            <a href="https://redhat.com/en/about/terms-use">Terms of use</a>
          </li>
          <li>
            <a href="https://redhat.com/en/about/all-policies-guidelines">
              All policies and guidelines
            </a>
          </li>
          <li>
            <a href="https://redhat.com/en/about/digital-accessibility">
              Digital accessibility
            </a>
          </li>
          <CookieConsentElement />
        </ul>
        <FooterCopyright
          slot="links-secondary"
          className="pf-v6-u-pt-md"
          data-testid="rh-footer-copyright"
        >
          &copy; {new Date().getFullYear()} Red Hat, Inc.
        </FooterCopyright>
      </FooterUniversal>
    </>
  );
}
