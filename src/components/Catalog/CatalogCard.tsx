import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Content,
  Flex,
  FlexItem,
  Label,
  Spinner,
  Tooltip,
} from "@patternfly/react-core";
import CheckCircleIcon from "@patternfly/react-icons/dist/esm/icons/check-circle-icon";
import CheckIcon from "@patternfly/react-icons/dist/esm/icons/check-icon";
import ExternalLinkAltIcon from "@patternfly/react-icons/dist/esm/icons/external-link-alt-icon";
import InfoCircleIcon from "@patternfly/react-icons/dist/esm/icons/info-circle-icon";
import { useSandboxContext } from "../../hooks/SandboxContext";
import { Product } from "../../hooks/useProductURLs";
import { AnsibleStatus } from "../../utils/aap-utils";
import { OpenClawStatus } from "../../utils/openclaw-utils";
import "../common/Card.css";
import "./CatalogCard.css";
import type { DescriptionIconType, ProductData } from "./productData";

/**
 * Defines the possible labels for the card's main button.
 */
const enum ButtonLabel {
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
const enum StatusColor {
  BLUE = "blue",
  GREEN = "green",
  GREY = "grey",
  ORANGE = "orange",
  RED = "red",
}

/**
 * Defines the structure of a status label.
 */
type StatusLabel = {
  color: StatusColor;
  label: "Provisioning" | "Ready" | "Idled" | "Deleting" | "Failed";
};

type CatalogCardProps = {
  product: ProductData;
  link: string;
  isGreenCornerVisible: boolean;
  onTryIt: () => void;
  onDelete?: () => void;
};

/**
 * Obtains the main button's label.
 * @param status the status from which determine the button label.
 * @returns the label of the main button.
 */
function getButtonLabel(status: AnsibleStatus | OpenClawStatus): ButtonLabel {
  switch (status) {
    case AnsibleStatus.NEW:
    case AnsibleStatus.NOT_DEPLOYED:
    case AnsibleStatus.UNKNOWN:
    case OpenClawStatus.NEW:
    case OpenClawStatus.FAILED:
      return ButtonLabel.PROVISION;

    case AnsibleStatus.PROVISIONING:
    case OpenClawStatus.PROVISIONING:
      return ButtonLabel.PROVISIONING;

    case AnsibleStatus.READY:
    case OpenClawStatus.READY:
      return ButtonLabel.LAUNCH;

    case AnsibleStatus.IDLED:
    case OpenClawStatus.IDLED:
      return ButtonLabel.REPROVISION;

    case OpenClawStatus.TERMINATING:
    case OpenClawStatus.DELETING:
      return ButtonLabel.DELETING;

    default:
      return ButtonLabel.TRY_IT;
  }
}

/**
 * Obtains a label, if applicable.
 * @param status the status from which derive the label.
 * @returns a label text and color depending on the given status.
 */
function getStatusLabel(
  status: AnsibleStatus | OpenClawStatus,
): StatusLabel | undefined {
  switch (status) {
    case AnsibleStatus.PROVISIONING:
    case OpenClawStatus.PROVISIONING:
      return { label: "Provisioning", color: StatusColor.BLUE };
    case AnsibleStatus.READY:
    case OpenClawStatus.READY:
      return { label: "Ready", color: StatusColor.GREEN };
    case AnsibleStatus.IDLED:
    case OpenClawStatus.IDLED:
      return { label: "Idled", color: StatusColor.ORANGE };
    case OpenClawStatus.TERMINATING:
    case OpenClawStatus.DELETING:
      return { label: "Deleting", color: StatusColor.RED };
    case OpenClawStatus.FAILED:
      return { label: "Failed", color: StatusColor.RED };
    default:
      return undefined;
  }
}

function DescriptionIcon({ type }: { type: DescriptionIconType }) {
  if (type === "warning") {
    return (
      <InfoCircleIcon
        color="var(--pf-t--global--color--nonstatus--teal--default)"
        style={{ minWidth: "16px", width: "16px", marginTop: "2px" }}
      />
    );
  }
  return (
    <CheckCircleIcon
      color="var(--pf-t--global--color--nonstatus--purple--default)"
      style={{ minWidth: "16px", width: "16px", marginTop: "2px" }}
    />
  );
}

/**
 * Renders a green corner on the card to mark it as "tried".
 * @param param0 whether the mark should be visible or not.
 * @returns the component.
 */
function GreenCorner({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) {
    return null;
  }
  return (
    <Tooltip content="Tried" position="top">
      <div
        style={{
          width: "35px",
          height: "35px",
          backgroundColor: "#73C5C5",
          clipPath: "polygon(0 0, 100% 0, 0 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        <CheckIcon
          style={{
            color: "#fff",
            fontSize: "12px",
            position: "relative",
            top: "-6px",
            left: "-6px",
          }}
        />
      </div>
    </Tooltip>
  );
}

export function CatalogCard({
  product,
  link,
  isGreenCornerVisible,
  onTryIt,
  onDelete,
}: CatalogCardProps) {
  const { ansibleStatus, openclawStatus } = useSandboxContext();

  // Determine the labels and statuses if applicable, and whether we should be
  // showing the delete button or not.
  let buttonLabel: ButtonLabel = ButtonLabel.TRY_IT;
  let statusLabel: StatusLabel | undefined;
  let showDelete = false;

  if (product.id === Product.AAP) {
    buttonLabel = getButtonLabel(ansibleStatus);
    statusLabel = getStatusLabel(ansibleStatus);
    showDelete =
      ansibleStatus !== AnsibleStatus.NEW &&
      ansibleStatus !== AnsibleStatus.NOT_DEPLOYED;
  } else if (product.id === Product.OPENCLAW) {
    buttonLabel = getButtonLabel(openclawStatus);
    statusLabel = getStatusLabel(openclawStatus);
    showDelete =
      openclawStatus !== OpenClawStatus.NEW &&
      openclawStatus !== OpenClawStatus.DELETING &&
      openclawStatus !== OpenClawStatus.TERMINATING &&
      openclawStatus !== OpenClawStatus.UNKNOWN;
  }

  return (
    <Card isCompact data-testid="catalog-card" className="sandbox-card">
      <CardHeader className="sandbox-card-header">
        <GreenCorner isVisible={isGreenCornerVisible} />
        <Flex
          alignItems={{ default: "alignItemsCenter" }}
          gap={{ default: "gapSm" }}
        >
          <FlexItem>
            <img
              src={product.image}
              alt={product.title}
              style={{ width: "48px", height: "48px" }}
            />
          </FlexItem>
          <FlexItem>
            <Flex direction={{ default: "column" }} gap={{ default: "gapXs" }}>
              <FlexItem>
                <Content component="h3" style={{ fontWeight: 700 }}>
                  {product.title}
                </Content>
              </FlexItem>
              {statusLabel && (
                <FlexItem>
                  <Label color={statusLabel.color} isCompact>
                    {statusLabel.label}
                  </Label>
                </FlexItem>
              )}
            </Flex>
          </FlexItem>
        </Flex>
      </CardHeader>
      <CardBody>
        {product.description.map((desc) => (
          <Flex
            key={desc.value}
            gap={{ default: "gapSm" }}
            alignItems={{ default: "alignItemsFlexStart" }}
            style={{ paddingBottom: "8px", fontSize: "14px" }}
          >
            <FlexItem>
              <DescriptionIcon type={desc.iconType} />
            </FlexItem>
            <FlexItem>{desc.value}</FlexItem>
          </Flex>
        ))}
      </CardBody>
      <CardFooter>
        <Flex
          gap={{ default: "gapSm" }}
          alignItems={{ default: "alignItemsCenter" }}
        >
          <FlexItem>
            <Button
              variant="secondary"
              onClick={onTryIt}
              isDisabled={buttonLabel === ButtonLabel.DELETING}
              icon={
                buttonLabel === ButtonLabel.LAUNCH ||
                (buttonLabel === ButtonLabel.TRY_IT && !!link) ? (
                  <ExternalLinkAltIcon />
                ) : undefined
              }
              iconPosition="end"
              data-testid="try-it-button"
            >
              <Flex
                alignItems={{ default: "alignItemsCenter" }}
                gap={{ default: "gapSm" }}
              >
                {buttonLabel === ButtonLabel.DELETING ||
                buttonLabel === ButtonLabel.PROVISIONING ? (
                  <>
                    <Spinner size="md" /> {buttonLabel}
                  </>
                ) : (
                  buttonLabel
                )}
              </Flex>
            </Button>
          </FlexItem>
          {showDelete && onDelete && (
            <FlexItem>
              <Tooltip content="Delete instance">
                <Button
                  variant="danger"
                  onClick={onDelete}
                  aria-label="Delete instance"
                  data-testid="delete-instance-button"
                >
                  Delete instance
                </Button>
              </Tooltip>
            </FlexItem>
          )}
        </Flex>
      </CardFooter>
    </Card>
  );
}
