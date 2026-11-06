import "../common/Card.css";

import { Card, CardBody, CardHeader, Content } from "@patternfly/react-core";

import { useAnalyticsContext } from "../../hooks/AnalyticsContext";
import { dpalClickAttributes } from "../../utils/analytics";
import type { Article } from "./articleData";

interface ActivitiesCardProps {
  article: Article;
}

export function ActivitiesCard({
  article: { img, title, description, link },
}: ActivitiesCardProps) {
  const { trackAnalytics } = useAnalyticsContext();

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none" }}
      onClick={() => trackAnalytics(title, "Activities", link, "cta")}
      {...dpalClickAttributes({
        text: title,
        section: "Activities",
        linkType: "cta",
      })}
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
