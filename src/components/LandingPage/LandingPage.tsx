import "./LandingPage.css";

import { Accordion } from "@rhds/elements/react/rh-accordion/rh-accordion.js";
import { AccordionHeader } from "@rhds/elements/react/rh-accordion/rh-accordion-header.js";
import { AccordionPanel } from "@rhds/elements/react/rh-accordion/rh-accordion-panel.js";
import { BackToTop } from "@rhds/elements/react/rh-back-to-top/rh-back-to-top.js";
import { Icon } from "@rhds/elements/react/rh-icon/rh-icon.js";
import { Fragment, useEffect, useMemo } from "react";

import RepoDetective from "../../assets/images/landing/Repo_Detective.webp";
import RepoRocket from "../../assets/images/landing/Repo_Rocket.webp";
import RedHatLogo from "../../assets/logos/rh_developer_sandbox_logo.svg?react";
import { usePublicConfigurationContext } from "../../hooks/PublicConfigurationContext";
import type { Product } from "../../types/product";
import { products } from "../Catalog/productData";
import { frequentlyAskedQuestions } from "../common/faqQuestions";
import { PageFooter } from "../Layout/PageFooter";
import { SandboxCta } from "./SandboxCta";

/**
 * Full-viewport hero with minimal information, a CTA to try the Sandbox and
 * some links to get some information.
 */
function HeroSection() {
  /** Sections shown as anchor links at the bottom of the hero. */
  const sections = [
    { id: "how-it-works", label: "How it works" },
    { id: "faq", label: "Frequently asked questions" },
    { id: "catalog", label: "Product catalog" },
  ] as const;

  return (
    <section id="top" className="landing-hero">
      <RedHatLogo
        className="landing-hero__logo rh-hat-tip"
        aria-label="Red Hat Developer Sandbox"
      />
      <div className="landing-hero__content">
        <h1 className="landing-hero__title">
          Trying <span className="landing-hero__title--rh">Red Hat</span>{" "}
          products made easy
        </h1>
        <p className="landing-hero__subtitle">
          A free, pre-configured environment with OpenShift, Ansible, AI/ML
          tools and more. No setup required.
        </p>
        <div className="landing-hero__cta-row">
          <SandboxCta />
        </div>
      </div>
      <a
        className="landing-hero__scroll-hint"
        href="#how-it-works"
        aria-label="Scroll down"
      />
      <nav className="landing-hero__section-links" aria-label="Page sections">
        {sections.map((section, i) => (
          <Fragment key={section.id}>
            {i > 0 && (
              <span className="landing-hero__section-separator">|</span>
            )}
            <span>
              <a className="landing-hero__section-link" href={`#${section.id}`}>
                {section.label}
              </a>
            </span>
          </Fragment>
        ))}
      </nav>
    </section>
  );
}

/**
 * Compact product tiles in a 3-column grid showing the available
 * products with their icons and short descriptions.
 */
function ProductTilesSection() {
  const { disabledIntegrations, isLoading: isPublicConfigLoading } =
    usePublicConfigurationContext();

  const filteredProducts: Product[] = useMemo(() => {
    return products.filter((product: Product) => {
      return (
        product.landingPage.isShownInLandingPage !== false &&
        !disabledIntegrations.has(product.type)
      );
    });
  }, [disabledIntegrations]);

  // Don't render the section until the configuration has loaded so
  // that disabled products are never briefly visible.
  if (isPublicConfigLoading) {
    return null;
  }

  return (
    <section id="catalog" className="landing-section landing-section--dark">
      <div className="landing-section__content">
        <img
          className="landing-section__mascot-magnifying-glass"
          src={RepoDetective}
          alt="Repo Detective mascot"
        />
        <h2 className="landing-section__heading">Explore the catalog</h2>
        <p className="landing-section__subheading">
          These are the Red Hat products made available to you in the Sandbox.
        </p>
        <div className="landing-product-grid">
          {filteredProducts.map((product) => (
            <div key={product.type} className="landing-product-tile">
              <img
                className="landing-product-tile__icon"
                src={product.image}
                alt={product.title}
              />
              <h3 className="landing-product-tile__title">{product.title}</h3>
              <p className="landing-product-tile__desc">
                {product.landingPage.productDescription}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Three-step guide showing how to get started, with numbered
 * dots and no connecting line.
 */
function HowItWorksSection() {
  const steps = [
    {
      number: "1",
      title: "Create an account",
      description: "Sign up for a free Red Hat account.",
    },
    {
      number: "2",
      title: "Pick a product",
      description: "Browse the catalog and choose what to try.",
    },
    {
      number: "3",
      title: "Start building",
      description: "Your environment is ready — jump right in.",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="landing-section landing-section--dark"
    >
      <div className="landing-section__content">
        <h2 className="landing-section__heading">How it works</h2>
        <div className="landing-timeline">
          {steps.map((step) => (
            <div key={step.number} className="landing-timeline__step">
              <div className="landing-timeline__dot">{step.number}</div>
              <h3 className="landing-timeline__title">{step.title}</h3>
              <p>{step.description}</p>
            </div>
          ))}
          <div className="landing-timeline__destination">
            <img
              className="landing-timeline__rocket"
              src={RepoRocket}
              alt="Launch!"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Frequently asked questions with check-circle icons and an
 * illustrative mascot on the side.
 */
function FAQSection() {
  return (
    <section id="faq" className="landing-section">
      <div className="landing-section__content">
        <h2 className="landing-section__heading">Frequently asked questions</h2>
        <div className="landing-faq__list">
          <Accordion>
            {frequentlyAskedQuestions.map((faq, index) => {
              return (
                <Fragment key={index}>
                  <AccordionHeader>
                    <Icon
                      set="ui"
                      icon="check-circle"
                      className="landing-faq__icon"
                    />{" "}
                    {faq.question}
                  </AccordionHeader>
                  <AccordionPanel>
                    <p>{faq.answer}</p>
                  </AccordionPanel>
                </Fragment>
              );
            })}
          </Accordion>
        </div>
      </div>
    </section>
  );
}

/** Dark closing CTA to bookend the page with the hero. */
function FinalCTASection() {
  return (
    <section className="landing-cta" aria-label="Call to action">
      <div className="landing-cta__content">
        <h2 className="landing-cta__heading">Ready to dive in?</h2>
        <p className="landing-cta__subtitle">
          Your sandbox is a click away. Start exploring today.
        </p>
        <SandboxCta />
      </div>
    </section>
  );
}

/** Landing page shown at /welcome before the user enters the app. */
export function LandingPage() {
  // The effect adds the PatternFly dark theme class to the root element,
  // because we want to make any PatternFly component we use match the RHDS'
  // dark theme of the landing page.
  useEffect(() => {
    document.documentElement.classList.add("pf-v6-theme-dark");
    return () => {
      document.documentElement.classList.remove("pf-v6-theme-dark");
    };
  }, []);

  return (
    <div className="landing-page">
      <HeroSection />
      <HowItWorksSection />
      <FAQSection />
      <ProductTilesSection />
      <FinalCTASection />
      <PageFooter />
      <BackToTop href="#top" scrollableSelector=".landing-page">
        Back to top
      </BackToTop>
    </div>
  );
}
