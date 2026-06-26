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
import type { DescriptionIconType, ProductDescription } from "./productData";

export type ButtonLabel = "Try it" | "Provision" | "Launch" | "Re-provision";
export type DeleteButtonLabel = "Delete" | "Stop" | "Deleting";

type CatalogCardProps = {
  title: string;
  image: string;
  description: ProductDescription[];
  link: string;
  greenCorner: boolean;
  onTryIt: () => void;
  loading?: boolean;
  showDelete?: boolean;
  onDelete?: () => void;
  buttonLabel?: ButtonLabel;
  deleteButtonLabel?: DeleteButtonLabel;
  statusLabel?: string;
  statusColor?: "blue" | "green" | "orange" | "red" | "grey";
};

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

function GreenCorner({ show }: { show: boolean }) {
  if (!show) {
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
  title,
  image,
  description,
  link,
  greenCorner,
  onTryIt,
  loading = false,
  showDelete = false,
  onDelete,
  buttonLabel = "Try it",
  deleteButtonLabel = "Delete",
  statusLabel,
  statusColor,
}: CatalogCardProps) {
  const isDeleting = deleteButtonLabel === "Deleting";
  const showExternalIcon =
    buttonLabel === "Launch" || (buttonLabel === "Try it" && !!link);

  return (
    <Card isCompact data-testid="catalog-card" className="sandbox-card">
      <CardHeader className="sandbox-card-header">
        <GreenCorner show={greenCorner} />
        <Flex
          alignItems={{ default: "alignItemsCenter" }}
          gap={{ default: "gapSm" }}
        >
          <FlexItem>
            <img
              src={image}
              alt={title}
              style={{ width: "48px", height: "48px" }}
            />
          </FlexItem>
          <FlexItem>
            <Flex direction={{ default: "column" }} gap={{ default: "gapXs" }}>
              <FlexItem>
                <Content component="h3" style={{ fontWeight: 700 }}>
                  {title}
                </Content>
              </FlexItem>
              {statusLabel && statusColor && (
                <FlexItem>
                  <Label color={statusColor} isCompact>
                    {statusLabel}
                  </Label>
                </FlexItem>
              )}
            </Flex>
          </FlexItem>
        </Flex>
      </CardHeader>
      <CardBody>
        {description.map((point) => (
          <Flex
            key={point.value}
            gap={{ default: "gapSm" }}
            alignItems={{ default: "alignItemsFlexStart" }}
            style={{ paddingBottom: "8px", fontSize: "14px" }}
          >
            <FlexItem>
              <DescriptionIcon type={point.iconType} />
            </FlexItem>
            <FlexItem>{point.value}</FlexItem>
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
              isDisabled={loading}
              icon={showExternalIcon ? <ExternalLinkAltIcon /> : undefined}
              iconPosition="end"
              data-testid="try-it-button"
            >
              {loading ? (
                <>
                  <Spinner size="sm" /> Loading...
                </>
              ) : (
                buttonLabel
              )}
            </Button>
          </FlexItem>
          {showDelete && onDelete && (
            <FlexItem>
              <Tooltip content={`${deleteButtonLabel} instance`}>
                <Button
                  variant="danger"
                  onClick={onDelete}
                  isDisabled={isDeleting}
                  aria-label={`${deleteButtonLabel} instance`}
                  data-testid="delete-instance-button"
                >
                  Delete instance
                  {isDeleting ? <Spinner size="sm" /> : null}
                </Button>
              </Tooltip>
            </FlexItem>
          )}
        </Flex>
      </CardFooter>
    </Card>
  );
}
