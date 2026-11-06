import "../common/Card.css";
import "./CatalogCard.css";

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

import {
  BulletPointIconType,
  type Product,
  type ProductDescription,
} from "../../types/product";
import type { DpalClickAttributes } from "../../utils/analytics";
import type { StatusLabel } from "./catalogCardTypes";
import { ButtonLabel } from "./catalogCardTypes";

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
  /**
   * Shows or hides the hint in the card that hints that the product has been
   * tried.
   */
  isTriedProductHintVisible: boolean;
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
  /**
   * Adobe click attributes for the primary button. Set only when that
   * click opens a product that is already provisioned. Signup, resume,
   * and setup clicks stay undecorated because Adobe records the click
   * itself, not the later outcome.
   */
  clickAnalytics?: DpalClickAttributes;
  /** Action to perform when the primary button is clicked. */
  onClickPrimaryButton: () => void;
  /** Action to perform when the "delete" button is clicked. */
  onClickDeleteButton?: () => void;
};

function DescriptionIcon({ type }: { type: BulletPointIconType | undefined }) {
  if (type === BulletPointIconType.WARNING) {
    return (
      <InfoCircleIcon className="catalog-card__description-item-icon catalog-card__description-item-icon-info" />
    );
  }
  return (
    <CheckCircleIcon className="catalog-card__description-item-icon catalog-card__description-item-icon-default" />
  );
}

/**
 * Renders a hint on the product card to mark it as "tried".
 * @param param0 whether the mark should be visible or not.
 * @returns the component.
 */
function TriedProductHint({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) {
    return null;
  }
  return (
    <Tooltip content="Tried" position="top">
      <div
        role="status"
        aria-label="Product tried"
        className="catalog-card__tried-product-hint"
      >
        <CheckIcon className="catalog-card__tried-product-hint-icon" />
      </div>
    </Tooltip>
  );
}

export function CatalogCard({
  product,
  statusLabel,
  primaryButtonLabel,
  isTriedProductHintVisible,
  isPrimaryButtonDisabled,
  isPrimaryButtonSpinnerVisible,
  isPrimaryButtonExtIconVisible,
  isDeleteButtonVisible,
  clickAnalytics,
  onClickPrimaryButton,
  onClickDeleteButton,
}: CatalogCardProps) {
  return (
    <Card
      isCompact
      aria-label={`${product.title} product card`}
      component="article"
      className="sandbox-card"
    >
      <CardHeader className="sandbox-card-header">
        <TriedProductHint isVisible={isTriedProductHintVisible} />
        <Flex
          alignItems={{ default: "alignItemsCenter" }}
          gap={{ default: "gapSm" }}
        >
          <FlexItem>
            <img
              src={product.image}
              alt={product.title}
              className="catalog-card__product-image"
            />
          </FlexItem>
          <FlexItem>
            <Flex direction={{ default: "column" }} gap={{ default: "gapXs" }}>
              <FlexItem>
                <Content component="h3" className="catalog-card__product-title">
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
            className="catalog-card__description-item"
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
              {...clickAnalytics}
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
