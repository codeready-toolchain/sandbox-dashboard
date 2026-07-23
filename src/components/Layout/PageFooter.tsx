import { Cta } from "@rhds/elements/react/rh-cta/rh-cta.js";
import { FooterBlock } from "@rhds/elements/react/rh-footer/rh-footer-block.js";
import { FooterCopyright } from "@rhds/elements/react/rh-footer/rh-footer-copyright.js";
import { FooterSocialLink } from "@rhds/elements/react/rh-footer/rh-footer-social-link.js";
import { FooterUniversal } from "@rhds/elements/react/rh-footer/rh-footer-universal.js";
import { Footer } from "@rhds/elements/react/rh-footer/rh-footer.js";
import "@rhds/elements/rh-footer/rh-footer-lightdom.css";
import { RhIcon } from "@rhds/elements/rh-icon/rh-icon.js";
import iconFacebook from "@rhds/icons/social/facebook.js";
import iconLinkedin from "@rhds/icons/social/linkedin.js";
import iconX from "@rhds/icons/social/x.js";
import iconYoutube from "@rhds/icons/social/youtube.js";
import iconArrowRight from "@rhds/icons/ui/arrow-right.js";
import { useEffect, useState } from "react";
import RedHatLogo from "../../assets/logos/red_hat_logo_on_dark.svg";
import { Environment, getConfig } from "../../config/config";
import { Content, Modal, ModalBody, ModalHeader } from "@patternfly/react-core";

// Pre-bundled icons needed by rh-footer-social-link and rh-cta. We specify
// here so that Vite bundles them and so that we can access them when
// rendering the footer.
const iconRegistry = new Map<string, Node>([
  ["social/linkedin", iconLinkedin],
  ["social/youtube", iconYoutube],
  ["social/facebook", iconFacebook],
  ["social/x", iconX],
  ["ui/arrow-right", iconArrowRight],
]);

// Override the default resolver for the RhIcon utility. The default resolver
// uses dynamic imports depending on the requested icon, which does not work
// with Vite due to the bundling that it performs. Therefore, when the browser
// requests icons with the default resolver, the browser cannot find them.
// With this override and the bundled icons, we ensure that the icons are
// rendered.
const defaultResolve = RhIcon.resolve;
RhIcon.resolve = (set: string, icon: string) => {
  const entry = iconRegistry.get(`${set}/${icon}`);
  if (entry) {
    return entry.cloneNode(true);
  }

  // Fall back to the default resolver if the requested icon is not bundled.
  if (defaultResolve) {
    return defaultResolve(set, icon);
  }

  // Otherwise simply throw a descriptive error.
  throw new Error(`rh-icon: no icon "${icon}" registered in set "${set}"`);
};

/**
 * Loads the TrustArc "cookie preferences" script and renders the anchor
 * element that TrustArc populates with a preferences link. The script is
 * only injected in stage and production environments.
 */
function CookieConsentElement() {
  useEffect(() => {
    let environment: Environment;
    try {
      environment = getConfig().environment;
    } catch {
      return;
    }

    if (
      environment !== Environment.STAGE &&
      environment !== Environment.PRODUCTION
    ) {
      return;
    }

    if (!document.getElementById("trustarc")) {
      const script = document.createElement("script");
      script.id = "trustarc";
      script.src =
        "//static.redhat.com/libs/redhat/marketing/latest/trustarc/trustarc.js";
      document.body.appendChild(script);
    }
  }, []);

  return <li id="teconsent" />;
}

/**
 * A small modal which includes the information about Red Hat's browser
 * support.
 */
export function BrowserSupportModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      aria-label="Browser support"
      variant="small"
      data-testid="browser-support-modal"
    >
      <ModalHeader title="Browser support" />
      <ModalBody>
        <Content>
          <p>
            Red Hat captures and regularly reviews statistical data from our
            actual web visitors and registered users, rather than generic
            industry data, to identify the browsers we need to support in
            alignment with our customers’ needs. Additionally, to safeguard
            customer data, only browsers which receive security updates from the
            browser manufacturer are considered for support. We have implemented
            this policy to ensure that we can provide an excellent experience to
            a wide user base.
          </p>
          <h2>Cookies and Javascript</h2>
          <p>
            To successfully interact with our websites and services, your
            browser must meet the following feature requirements:
          </p>
          <ul>
            <li>The browser must be configured to accept cookies</li>
            <li>The browser must be configured to execute JavaScript</li>
          </ul>
          <h2>Specific browser support</h2>
          <p>
            We validate against and fully support our customers&#39; use of the
            past two major releases of the following browsers:
          </p>
          <ul>
            <li>Mozilla Firefox</li>
            <li>Google Chrome</li>
            <li>Apple Safari</li>
            <li>Microsoft Edge</li>
          </ul>
        </Content>
      </ModalBody>
    </Modal>
  );
}

export function PageFooter() {
  const [isBrowserSupportModalOpen, setBrowserSupportModalOpen] =
    useState<boolean>(false);

  return (
    <>
      <div id="consent_blackbar" />
      <Footer data-testid="rh-footer">
        <a slot="logo" href="https://redhat.com/en">
          <img alt="Red Hat logo" src={RedHatLogo} loading="lazy" />
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
              <a
                href="#"
                onClick={(event: React.MouseEvent) => {
                  event.preventDefault();
                  setBrowserSupportModalOpen(true);
                }}
              >
                Browser support
              </a>
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
      <BrowserSupportModal
        isOpen={isBrowserSupportModalOpen}
        onClose={() => setBrowserSupportModalOpen(false)}
      />
    </>
  );
}
