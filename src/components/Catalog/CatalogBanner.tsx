import "./CatalogBanner.css";

import {
  Button,
  Card,
  CardBody,
  Content,
  ContentVariants,
  Flex,
  FlexItem,
} from "@patternfly/react-core";
import { CommentAltIcon } from "@patternfly/react-icons";
import ExternalLinkAltIcon from "@patternfly/react-icons/dist/esm/icons/external-link-alt-icon";

import AutomationIllustration from "../../assets/images/banner/rh-automation-general-illustration.svg";
import WorkFromHomeIllustration from "../../assets/images/banner/rh-work-from-home-illustration.svg";
import { useAnalyticsContext } from "../../hooks/AnalyticsContext";
import { useUserContext } from "../../hooks/UserContext";
import { dpalClickAttributes, IntentEvent } from "../../utils/analytics";
import { calculateDaysBetweenDates } from "../../utils/common";
import { type BannerContent, resolveBannerContent } from "./bannerContent";
import { CatalogBannerSkeleton } from "./CatalogBannerSkeleton";
import { CatalogBannerTrialExpirationPopover } from "./CatalogBannerTrialExpirationPopover";

export function CatalogBanner() {
  const { trackIntent } = useAnalyticsContext();
  const { user, userSignupPhase } = useUserContext();

  // Calculate the number of days that are left in the trial.
  const daysLeft = user?.endDate
    ? calculateDaysBetweenDates(new Date(), new Date(user?.endDate))
    : undefined;

  // Resolve which content we are going to show in the banner.
  const bannerContent: BannerContent | undefined = resolveBannerContent(
    userSignupPhase,
    user,
    daysLeft,
  );

  return (
    <Card isPlain isFullHeight={false}>
      <CardBody className="banner-body">
        <Flex className="banner-body-content-wrapper">
          <FlexItem className="pf-v6-u-display-block-on-md">
            <img
              src={AutomationIllustration}
              alt=""
              className="banner-body__image"
            />
          </FlexItem>
          <FlexItem>
            <Flex direction={{ default: "column" }}>
              <FlexItem>
                {bannerContent ? (
                  <>
                    <Content component={ContentVariants.h1}>
                      {bannerContent.title}
                    </Content>
                    <Flex
                      alignItems={{ default: "alignItemsCenter" }}
                      gap={{ default: "gapSm" }}
                    >
                      <FlexItem>
                        <Content component={ContentVariants.p}>
                          {bannerContent.subtitle}
                        </Content>
                      </FlexItem>
                      {user?.endDate && (
                        <FlexItem>
                          <CatalogBannerTrialExpirationPopover />
                        </FlexItem>
                      )}
                    </Flex>
                  </>
                ) : (
                  <CatalogBannerSkeleton />
                )}
              </FlexItem>
            </Flex>
          </FlexItem>
          <FlexItem align={{ default: "alignRight" }}>
            <Content
              component={ContentVariants.a}
              href="https://redhat.com/en/contact"
              target="_blank"
            >
              <Button
                variant="secondary"
                style={{ padding: "10px 15px" }}
                onClick={() =>
                  trackIntent(IntentEvent.contactSalesClicked, "Catalog", {
                    surface: "catalog",
                  })
                }
                {...dpalClickAttributes({
                  text: "Contact sales",
                  section: "Catalog",
                  linkType: "cta",
                })}
              >
                <Flex
                  display={{ default: "inlineFlex" }}
                  alignItems={{ default: "alignItemsCenter" }}
                  gap={{ default: "gapSm" }}
                >
                  <FlexItem>
                    <CommentAltIcon />
                  </FlexItem>
                  <FlexItem>Contact sales</FlexItem>
                  <FlexItem>
                    <ExternalLinkAltIcon />
                  </FlexItem>
                </Flex>
              </Button>
            </Content>
          </FlexItem>
          <FlexItem>
            <img
              src={WorkFromHomeIllustration}
              alt=""
              className="banner-body__image banner-body__image-mirror"
            />
          </FlexItem>
        </Flex>
      </CardBody>
    </Card>
  );
}
