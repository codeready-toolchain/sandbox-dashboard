/**
 * Defines the possible labels for the card's main button.
 */
export enum ButtonLabel {
  TRY_IT = "Try it",
  PROVISION = "Provision",
  PROVISIONING = "Provisioning...",
  LAUNCH = "Launch",
  REPROVISION = "Re-provision",
  DELETING = "Deleting...",
}

/**
 * Defines the colors which the status label can have.
 */
export enum StatusColor {
  BLUE = "blue",
  GREEN = "green",
  GREY = "grey",
  ORANGE = "orange",
  RED = "red",
}

/**
 * Defines the structure of a status label.
 */
export type StatusLabel = {
  color: StatusColor;
  label: "Provisioning" | "Ready" | "Idled" | "Deleting" | "Failed";
};
