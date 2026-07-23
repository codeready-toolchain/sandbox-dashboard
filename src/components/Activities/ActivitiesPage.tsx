import { Grid, GridItem } from "@patternfly/react-core";
import { ActivitiesCard } from "./ActivitiesCard";
import { articleData, type Article } from "./articleData";

export function ActivitiesPage() {
  return (
    <>
      <div style={{ padding: "50px", minHeight: "100%" }}>
        <Grid hasGutter>
          {articleData.map((article: Article) => (
            <GridItem key={article.link} span={3}>
              <ActivitiesCard article={article} />
            </GridItem>
          ))}
        </Grid>
      </div>
    </>
  );
}
