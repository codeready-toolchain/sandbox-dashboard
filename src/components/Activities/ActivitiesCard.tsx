import { Card, CardBody, CardHeader, Content } from "@patternfly/react-core";
import type { ArticleData } from "./articleData";

interface ActivitiesCardProps {
  article: ArticleData;
}

export function ActivitiesCard({
  article: { img, title, description, link },
}: ActivitiesCardProps) {
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none" }}
      data-analytics-linktype="cta"
      data-analytics-category="Developer Sandbox|Activities"
      data-analytics-text={title}
      data-analytics-region="sandbox-activities"
    >
      <Card
        isCompact
        style={{
          maxWidth: "326px",
          minHeight: "368px",
          borderRadius: "8px",
        }}
      >
        <img
          src={img}
          alt={title}
          style={{ width: "100%", height: "120px", objectFit: "cover" }}
        />
        <CardHeader>
          <Content component="h3" style={{ fontWeight: 600 }}>
            {title}
          </Content>
        </CardHeader>
        <CardBody>
          <Content component="p" style={{ fontStyle: "italic" }}>
            {description}
          </Content>
        </CardBody>
      </Card>
    </a>
  );
}
