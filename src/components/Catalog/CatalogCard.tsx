import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Button,
  Content,
  Flex,
  FlexItem,
  Tooltip,
} from "@patternfly/react-core";
import CheckCircleIcon from "@patternfly/react-icons/dist/esm/icons/check-circle-icon";
import InfoCircleIcon from "@patternfly/react-icons/dist/esm/icons/info-circle-icon";
import ExternalLinkAltIcon from "@patternfly/react-icons/dist/esm/icons/external-link-alt-icon";
import CheckIcon from "@patternfly/react-icons/dist/esm/icons/check-icon";
import type { Product } from "../../hooks/useProductURLs";
import type { DescriptionIconType, ProductDescription } from "./productData";

type CatalogCardProps = {
  id: Product;
  title: string;
  image: string;
  description: ProductDescription[];
  link: string;
  greenCorner: boolean;
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
    return <div style={{ width: "32px", height: "32px" }} />;
  }
  return (
    <Tooltip content="Tried" position="top">
      <div
        style={{
          width: "32px",
          height: "32px",
          backgroundColor: "#73C5C5",
          clipPath: "polygon(0 0, 100% 0, 0 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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
}: CatalogCardProps) {
  return (
    <Card
      isCompact
      style={{ width: "330px", height: "372px" }}
      data-testid="catalog-card"
    >
      <GreenCorner show={greenCorner} />
      <CardHeader>
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
            <Content component="h3" style={{ fontWeight: 700 }}>
              {title}
            </Content>
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
        {link ? (
          <Button
            variant="secondary"
            component="a"
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            icon={<ExternalLinkAltIcon />}
            iconPosition="end"
          >
            Try it
          </Button>
        ) : (
          <Button variant="secondary">Try it</Button>
        )}
      </CardFooter>
    </Card>
  );
}
