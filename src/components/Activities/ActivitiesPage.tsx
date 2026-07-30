import "./ActivitiesPage.css";

import { Grid, GridItem } from "@patternfly/react-core";

import { ActivitiesCard } from "./ActivitiesCard";
import { type Article, articleData } from "./articleData";

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
