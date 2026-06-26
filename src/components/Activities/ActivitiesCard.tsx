import { Card, CardBody, CardHeader, Content } from "@patternfly/react-core";
import "../common/Card.css";
import type { Article } from "./articleData";

interface ActivitiesCardProps {
  article: Article;
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
      <Card isCompact className="sandbox-card">
        <CardHeader className="sandbox-card-activity-header">
          <img src={img} alt={title} />
        </CardHeader>
        <CardBody className="sandbox-card-body">
          <Content
            component="h3"
            style={{ fontWeight: 600, marginTop: "10px" }}
          >
            {title}
          </Content>
          <Content component="p">{description}</Content>
        </CardBody>
      </Card>
    </a>
  );
}
