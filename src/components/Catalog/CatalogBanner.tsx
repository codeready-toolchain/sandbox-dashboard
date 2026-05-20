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
import BannerImage from "../../assets/images/sandbox-banner-image.svg";
import { useSandboxContext } from "../../hooks/SandboxContext";
import { calculateDaysBetweenDates } from "../../utils/common";

export function CatalogBanner() {
  const { userData, pendingApproval, verificationRequired, loading } =
    useSandboxContext();

  const daysLeft = userData?.endDate
    ? calculateDaysBetweenDates(new Date(), new Date(userData.endDate))
    : undefined;

  const popoverBody = (
    <div>
      <Content component={ContentVariants.p}>
        Once this trial expires, you can start a new one immediately. Your work
        from this trial will be deleted. To save your work, follow the
        instructions in our documentation.
      </Content>
      <a
        href="https://developers.redhat.com/learn/openshift/export-your-application-sandbox-red-hat-openshift-service-aws?source=sso"
        target="_blank"
        rel="noopener noreferrer"
      >
        View documentation <ExternalLinkAltIcon />
      </a>
    </div>
  );

  const renderSubtitle = () => {
    if (verificationRequired) {
      return 'Click on "Try it" to initiate your free, no commitment 30-day trial.';
    }
    if (pendingApproval) {
      return "Please wait for your trial to be approved.";
    }
    if (userData?.endDate && daysLeft !== undefined) {
      return `Your free trial expires in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`;
    }
    return "";
  };

  return (
    <Card isPlain isFullHeight={false} style={{ borderRadius: 0 }}>
      <CardBody>
        <Flex
          alignItems={{ default: "alignItemsCenter" }}
          gap={{ default: "gapLg" }}
        >
          <FlexItem
            style={{ display: "none" }}
            className="pf-v6-u-display-block-on-md"
          >
            <img
              src={BannerImage}
              alt="Red Hat Trial"
              style={{ maxWidth: "207px", height: "auto", display: "block" }}
            />
          </FlexItem>
          <FlexItem>
            {loading ? (
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
            ) : userData ? (
              <div>
                <Content component="h1">
                  Welcome, {userData.givenName || userData.compliantUsername}
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
                  {userData.endDate && (
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
        </Flex>
      </CardBody>
    </Card>
  );
}
