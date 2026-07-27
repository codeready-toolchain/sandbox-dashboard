import { Grid, GridItem } from "@patternfly/react-core";
import { ActivitiesCard } from "./ActivitiesCard";
import "./ActivitiesPage.css";
import { articleData, type Article } from "./articleData";

export function ActivitiesPage() {
  return (
    <>
      <div className="activites-wrapper">
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
