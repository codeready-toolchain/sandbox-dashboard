export const SHORT_INTERVAL = 2_000;
export const MEDIUM_INTERVAL = 20_000;
export const LONG_INTERVAL = 60_000;

/** Shared support email address used across error messages and contact links. */
export const SUPPORT_EMAIL = "devsandbox@redhat.com";

/** Annotation key used to timestamp when an AAP unidle was requested. */
export const UNIDLE_REQUESTED_AT_ANNOTATION =
  "sandbox.redhat.com/unidle-requested-at";

/**
 * Label selector that matches all AAP-related operators. Used when listing
 * Deployments and StatefulSets for cleanup during instance deletion.
 */
export const AAP_OPERATOR_LABEL_SELECTOR =
  "app.kubernetes.io/managed-by in (aap-gateway-operator, aap-operator, automationcontroller-operator, automationhub-operator, eda-operator, lightspeed-operator)";
