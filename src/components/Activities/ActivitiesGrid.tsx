import { Content, Gallery, GalleryItem } from "@patternfly/react-core";
import { ActivitiesCard } from "./ActivitiesCard";
import { articleData } from "./articleData";

function FeaturedArticles() {
  return (
    <div style={{ padding: "36px 60px 48px 60px" }}>
      <Content component="h2" style={{ fontWeight: 700, marginBottom: "16px" }}>
        Featured
      </Content>
      <Gallery hasGutter minWidths={{ default: "326px" }}>
        {articleData.featured.map((article) => (
          <GalleryItem key={article.link}>
            <ActivitiesCard article={article} />
          </GalleryItem>
        ))}
      </Gallery>
    </div>
  );
}

function OtherArticles() {
  return (
    <div style={{ padding: "36px 60px 48px 60px" }}>
      <Gallery hasGutter minWidths={{ default: "326px" }}>
        {articleData.other.map((article) => (
          <GalleryItem key={article.link}>
            <ActivitiesCard article={article} />
          </GalleryItem>
        ))}
      </Gallery>
    </div>
  );
}

export function ActivitiesGrid() {
  return (
    <>
      <FeaturedArticles />
      <OtherArticles />
    </>
  );
}
