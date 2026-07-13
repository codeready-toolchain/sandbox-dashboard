import { useEffect, useRef, useState } from "react";
import { Content, Button } from "@patternfly/react-core";
import { Footer } from "@rhds/elements/react/rh-footer/rh-footer.js";
import { FooterBlock } from "@rhds/elements/react/rh-footer/rh-footer-block.js";
import { FooterCopyright } from "@rhds/elements/react/rh-footer/rh-footer-copyright.js";
import { FooterSocialLink } from "@rhds/elements/react/rh-footer/rh-footer-social-link.js";
import { FooterUniversal } from "@rhds/elements/react/rh-footer/rh-footer-universal.js";
import { Cta } from "@rhds/elements/react/rh-cta/rh-cta.js";
import "@rhds/elements/rh-footer/rh-footer-lightdom.css";
import { AccessCodeInputModal } from "../Modals";
import { useUserContext } from "../../hooks/UserContext";

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
  const { refetchUserData } = useUserContext();
  const [isAccessCodeModalOpen, setIsAccessCodeModalOpen] = useState(false);

  const handleActivationCodeVerified = async () => {
    setIsAccessCodeModalOpen(false);
    await refetchUserData();
  };

  return (
    <>
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
      <Footer data-testid="rh-footer">
        <a slot="logo" href="https://redhat.com/en">
          <img
            alt="Red Hat logo"
            src="https://static.redhat.com/libs/redhat/brand-assets/2/corp/logo--on-dark.svg"
            loading="lazy"
          />
        </a>
        <FooterSocialLink
          slot="social-links"
          icon="linkedin"
          href="https://www.linkedin.com/company/red-hat"
        />
        <FooterSocialLink
          slot="social-links"
          icon="youtube"
          href="https://www.youtube.com/user/RedHatVideos"
        />
        <FooterSocialLink
          slot="social-links"
          icon="facebook"
          href="https://www.facebook.com/redhatinc"
        />
        <FooterSocialLink
          slot="social-links"
          icon="x"
          href="https://twitter.com/RedHat"
        />

        <h3 slot="links">Products</h3>
        <ul slot="links">
          <li>
            <a href="https://redhat.com/en/technologies/linux-platforms/enterprise-linux">
              Red Hat Enterprise Linux
            </a>
          </li>
          <li>
            <a href="https://redhat.com/en/technologies/cloud-computing/openshift">
              Red Hat OpenShift
            </a>
          </li>
          <li>
            <a href="https://redhat.com/en/technologies/management/ansible">
              Red Hat Ansible Automation Platform
            </a>
          </li>
          <li>
            <a href="https://redhat.com/en/technologies/cloud-computing/openshift/cloud-services">
              Cloud services
            </a>
          </li>
          <li>
            <a href="https://redhat.com/en/technologies/all-products">
              See all products
            </a>
          </li>
        </ul>

        <h3 slot="links">Tools</h3>
        <ul slot="links">
          <li>
            <a href="https://sso.redhat.com">My account</a>
          </li>
          <li>
            <a href="https://redhat.com/en/services/training-and-certification">
              Training and certification
            </a>
          </li>
          <li>
            <a href="https://access.redhat.com">Customer support</a>
          </li>
          <li>
            <a href="https://developers.redhat.com/">Developer resources</a>
          </li>
          <li>
            <a href="https://learn.redhat.com/">Learning community</a>
          </li>
          <li>
            <a href="https://connect.redhat.com/">Partner resources</a>
          </li>
          <li>
            <a href="https://redhat.com/en/resources">Resource library</a>
          </li>
        </ul>

        <h3 slot="links">Try, buy &amp; sell</h3>
        <ul slot="links">
          <li>
            <a href="https://redhat.com/en/products/trials">
              Product trial center
            </a>
          </li>
          <li>
            <a href="https://catalog.redhat.com/">Red Hat Ecosystem Catalog</a>
          </li>
          <li>
            <a href="http://redhat.force.com/finder/">Find a partner</a>
          </li>
          <li>
            <a href="https://www.redhat.com/en/store">Red Hat Store</a>
          </li>
          <li>
            <a href="https://cloud.redhat.com/">Console</a>
          </li>
        </ul>

        <h3 slot="links">Communicate</h3>
        <ul slot="links">
          <li>
            <a href="https://redhat.com/en/services/consulting-overview#contact-us">
              Contact consulting
            </a>
          </li>
          <li>
            <a href="https://redhat.com/en/contact">Contact sales</a>
          </li>
          <li>
            <a href="https://redhat.com/en/services/training-and-certification/contact-us">
              Contact training
            </a>
          </li>
          <li>
            <a href="https://redhat.com/en/about/social">Social</a>
          </li>
        </ul>

        <FooterBlock slot="main-secondary">
          <h3 slot="header">About Red Hat</h3>
          <p>
            We&rsquo;re the world&rsquo;s leading provider of enterprise open
            source solutions&#8212;including Linux, cloud, container, and
            Kubernetes. We deliver hardened solutions that make it easier for
            enterprises to work across platforms and environments, from the core
            datacenter to the network edge.
          </p>
        </FooterBlock>
        <FooterBlock slot="main-secondary">
          <h3 slot="header">Subscribe to our newsletter, Red Hat Shares</h3>
          <Cta>
            <a href="https://www.redhat.com/en/email-preferences?newsletter=RH-Shares&intcmp=7016000000154xCAAQ">
              Sign up now
            </a>
          </Cta>
        </FooterBlock>

        <FooterUniversal slot="universal" data-testid="rh-footer-universal">
          <h3
            slot="links-primary"
            style={{ width: "100%", paddingBottom: "8px" }}
          >
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
              <a href="https://redhat.com/en/about/office-locations">
                Locations
              </a>
            </li>
            <li>
              <a href="https://redhat.com/en/contact">Contact Red Hat</a>
            </li>
            <li>
              <a href="https://redhat.com/en/blog">Red Hat Blog</a>
            </li>
            <li>
              <a href="https://redhat.com/en/about/our-culture/diversity-equity-inclusion">
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
          <h3
            slot="links-secondary"
            style={{ width: "100%", paddingBottom: "8px" }}
          >
            Privacy and legal
          </h3>
          <ul
            slot="links-secondary"
            style={{ width: "100%", paddingBottom: "8px" }}
          >
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
            <li>
              <a href="#">Browser support</a>
            </li>
            <CookieConsentElement />
          </ul>
          <FooterCopyright
            slot="links-secondary"
            data-testid="rh-footer-copyright"
            style={{ width: "100%", paddingTop: "12px" }}
          >
            &copy; {new Date().getFullYear()} Red Hat
          </FooterCopyright>
        </FooterUniversal>
      </Footer>

      <AccessCodeInputModal
        isOpen={isAccessCodeModalOpen}
        onClose={() => setIsAccessCodeModalOpen(false)}
        onVerified={handleActivationCodeVerified}
      />
    </>
  );
}
