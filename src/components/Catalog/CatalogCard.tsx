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
import "../common/Card.css";
import "./CatalogCard.css";
import { ButtonLabel } from "./catalogCardTypes";
import type { StatusLabel } from "./catalogCardTypes";
import {
  BulletPointIconType,
  type Product,
  type ProductDescription,
} from "../../types/product";
import { Intcmp } from "./productData";

/**
 * Defines the properties of the CatalogCard component.
 */
type CatalogCardProps = {
  /** The product to be shown in the card. */
  product: Product;
  /** The status label to render in the card's header. */
  statusLabel?: StatusLabel;
  /**
   * The label of the primary button. Usually used for launching or opening
   * the product's page.
   */
  primaryButtonLabel: ButtonLabel;
  /** Shows or hides the green corner on the top left part of the card. */
  isGreenCornerVisible: boolean;
  /** Controls whether the primary button is disabled. */
  isPrimaryButtonDisabled: boolean;
  /** Controls whether the spinner is visible in the primary button. */
  isPrimaryButtonSpinnerVisible: boolean;
  /**
   * Controls whether the "external link" icon is visible in the primary
   * button.
   */
  isPrimaryButtonExtIconVisible: boolean;
  /** Controls whether the "delete" button is visible in the card. */
  isDeleteButtonVisible: boolean;
  /** Action to perform when the primary button is clicked. */
  onClickPrimaryButton: () => void;
  /** Action to perform when the "delete" button is clicked. */
  onClickDeleteButton?: () => void;
};

function DescriptionIcon({ type }: { type: BulletPointIconType | undefined }) {
  if (type === BulletPointIconType.WARNING) {
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
  statusLabel,
  primaryButtonLabel,
  isGreenCornerVisible,
  isPrimaryButtonDisabled,
  isPrimaryButtonSpinnerVisible,
  isPrimaryButtonExtIconVisible,
  isDeleteButtonVisible,
  onClickPrimaryButton,
  onClickDeleteButton,
}: CatalogCardProps) {
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
        {product.description.map((desc: ProductDescription, index: number) => (
          <Flex
            key={index}
            gap={{ default: "gapSm" }}
            alignItems={{ default: "alignItemsFlexStart" }}
            style={{ paddingBottom: "8px", fontSize: "14px" }}
          >
            <FlexItem>
              <DescriptionIcon type={desc.iconType} /> {desc.bulletPoint}
            </FlexItem>
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
              onClick={onClickPrimaryButton}
              isDisabled={isPrimaryButtonDisabled}
              icon={
                isPrimaryButtonExtIconVisible ? (
                  <ExternalLinkAltIcon />
                ) : undefined
              }
              iconPosition="end"
              data-testid="try-it-button"
              data-analytics-linktype="cta"
              data-analytics-text={primaryButtonLabel}
              data-analytics-category={`Developer Sandbox|Catalog|${product.title}`}
              data-analytics-region="sandbox-catalog"
              data-analytics-offerid={Intcmp[product.type]}
            >
              <Flex
                alignItems={{ default: "alignItemsCenter" }}
                gap={{ default: "gapSm" }}
              >
                {isPrimaryButtonSpinnerVisible ? (
                  <>
                    <Spinner size="md" /> {primaryButtonLabel}
                  </>
                ) : (
                  primaryButtonLabel
                )}
              </Flex>
            </Button>
          </FlexItem>
          {isDeleteButtonVisible && onClickDeleteButton && (
            <FlexItem>
              <Tooltip content="Delete instance">
                <Button
                  variant="danger"
                  onClick={onClickDeleteButton}
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
