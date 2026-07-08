/**
 * Defines the different product types we support in Developer Sandbox.
 */
export enum ProductType {
  AAP = "ansible-automation-platform",
  DEVSPACES = "devspaces",
  OPENCLAW = "openclaw",
  OPENSHIFT_AI = "red-hat-data-science",
  OPENSHIFT_CONSOLE = "openshift-console",
  OPENSHIFT_VIRTUALIZATION = "openshift-virtualization",
}

/**
 * Defines the icon type for every bullet point in the product's description.
 */
export enum BulletPointIconType {
  SUCCESS = "success",
  WARNING = "warning",
}

/**
 * Defines a product's description.
 */
export type ProductDescription = {
  /** The phrase or line to show. */
  bulletPoint: string;
  /** The type of icon to render before the bullet point. Defaults to
   * "success" if nothing is specified.
   */
  iconType?: BulletPointIconType;
};

/**
 * Defines the template variables used for the URL interpolation.
 */
export type URLTemplateVars = {
  /** The Eclipse Che dashboard's url. */
  cheDashboardURL: string;
  /** The user cluster's main url. */
  consoleURL: string;
  /** The user's default namespace. */
  defaultUserNamespace: string;
  /** The Red Hat OpenShift AI member cluster's URL. */
  rhodsMemberURL: string;
};

/**
 * Defines the product object.
 */
export type Product = {
  /** The product's type. */
  type: ProductType;
  /** The product's title. */
  title: string;
  /** The product's image. */
  image: string;
  /**
   * A URL template with the appropriate {@link URLTemplateVars} to be
   * interpolated.
   */
  urlTemplate?: string;
  /**
   * A custom resolver for returning the product's URL.
   * @param urlTemplateVars the template variables used for the interpolation.
   * @returns the computed URL.
   */
  resolveURL?: (urlTemplateVars: URLTemplateVars) => string;
  /**
   * The description of the characteristics of this product.
   */
  description: ProductDescription[];
};
