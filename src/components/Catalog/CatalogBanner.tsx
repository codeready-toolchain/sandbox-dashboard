import {
  Card,
  CardBody,
  Content,
  ContentVariants,
  Skeleton,
  Popover,
  Button,
  Flex,
  FlexItem,
} from "@patternfly/react-core";
import OutlinedQuestionCircleIcon from "@patternfly/react-icons/dist/esm/icons/outlined-question-circle-icon";
import ExternalLinkAltIcon from "@patternfly/react-icons/dist/esm/icons/external-link-alt-icon";
import BannerImage from "../../assets/images/banner/sandbox-banner-image.svg";
import SalesImage from "../../assets/images/banner/sales.svg";
import { UserSignupPhase, useUserContext } from "../../hooks/UserContext";
import { calculateDaysBetweenDates } from "../../utils/common";
import { CommentAltIcon } from "@patternfly/react-icons";

export function CatalogBanner() {
  const { user, userSignupPhase } = useUserContext();

  const daysLeft = user?.endDate
    ? calculateDaysBetweenDates(new Date(), new Date(user?.endDate))
    : undefined;

  const popoverBody = (
    <div>
      <Content component={ContentVariants.p}>
        Once this trial expires, you can start a new one immediately. Your work
        from this trial will be deleted. To save your work, follow the
        instructions in our documentation.
      </Content>
      <a
        href="https://developers.redhat.com/learn/openshift/move-your-developer-sandbox-objects-another-cluster"
        target="_blank"
        rel="noopener noreferrer"
      >
        View documentation <ExternalLinkAltIcon />
      </a>
    </div>
  );

  const renderSubtitle = () => {
    if (userSignupPhase === UserSignupPhase.PENDING_PHONE_VERIFICATION) {
      return 'Click on "Try it" to initiate your free, no commitment 30-day trial.';
    }
    if (userSignupPhase === UserSignupPhase.PENDING_MANUAL_APPROVAL) {
      return "Please wait for your trial to be approved.";
    }
    if (user?.endDate && daysLeft !== undefined) {
      return `Your free trial expires in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`;
    }
    return "";
  };

  return (
    <Card isPlain isFullHeight={false} style={{ borderRadius: 0 }}>
      <CardBody style={{ padding: "21px 100px 0 100px" }}>
        <Flex
          alignItems={{ default: "alignItemsCenter" }}
          gap={{ default: "gapLg" }}
        >
          <FlexItem className="pf-v6-u-display-block-on-md">
            <img
              src={BannerImage}
              alt="Red Hat Trial"
              style={{ minWidth: "200px", height: "auto", display: "block" }}
            />
          </FlexItem>
          <FlexItem>
            {userSignupPhase === UserSignupPhase.FETCHING_DATA ? (
              <div>
                <Skeleton
                  width="500px"
                  height="25px"
                  style={{ marginBottom: "10px" }}
                  data-testid="banner-skeleton"
                />
                <Skeleton
                  width="510px"
                  height="25px"
                  style={{ marginBottom: "15px" }}
                />
                <Skeleton width="300px" height="25px" />
              </div>
            ) : user ? (
              <div>
                <Content component="h1">
                  Welcome, {user?.givenName || user?.username}
                </Content>
                <Flex
                  alignItems={{ default: "alignItemsCenter" }}
                  gap={{ default: "gapSm" }}
                >
                  <FlexItem>
                    <Content component={ContentVariants.p}>
                      {renderSubtitle()}
                    </Content>
                  </FlexItem>
                  {user?.endDate && (
                    <FlexItem>
                      <Popover
                        headerContent="Trial expiration"
                        bodyContent={popoverBody}
                        position="bottom"
                      >
                        <Button
                          variant="plain"
                          aria-label="Show trial information"
                          style={{ padding: 0 }}
                        >
                          <OutlinedQuestionCircleIcon />
                        </Button>
                      </Popover>
                    </FlexItem>
                  )}
                </Flex>
              </div>
            ) : (
              <div>
                <Content component="h1">Try Red Hat products</Content>
                <Content component={ContentVariants.p}>
                  Explore, experiment, and see what&apos;s possible
                </Content>
                <Content component={ContentVariants.p}>
                  Click on &quot;Try it&quot; to initiate your free, no
                  commitment 30-day trial.
                </Content>
              </div>
            )}
          </FlexItem>
          <FlexItem align={{ default: "alignRight" }}>
            <a href="https://redhat.com/en/contact" target="_blank">
              <Button variant="secondary" style={{ padding: "10px 15px" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <CommentAltIcon />
                  Contact sales
                  <ExternalLinkAltIcon />
                </span>
              </Button>
            </a>
          </FlexItem>
          <FlexItem>
            <img
              src={SalesImage}
              alt="Contact sales"
              style={{
                minWidth: "200px",
                height: "auto",
                display: "block",
                transform: "scaleX(-1)",
              }}
            />
          </FlexItem>
        </Flex>
      </CardBody>
    </Card>
  );
}
