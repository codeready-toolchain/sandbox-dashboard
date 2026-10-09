import "./SupportBanner.css";

import {
  Card,
  CardBody,
  Content,
  ContentVariants,
  Flex,
  FlexItem,
} from "@patternfly/react-core";

import BookShelf from "../../assets/images/support/mini-collage-bookshelf-light-RH.Small_square_transparent.png";
import ChatImage from "../../assets/images/support/mini-collage-talk-bubble-light-RH.Small_square_transparent.png";
import { SUPPORT_EMAIL } from "../../const";

export function SupportBanner() {
  return (
    <Card isPlain isFullHeight={false}>
      <CardBody className="support-banner__body">
        <Flex className="support-banner__content-wrapper">
          <FlexItem className="pf-v6-u-display-block-on-md">
            <img
              className="support-banner__image"
              src={BookShelf}
              alt="Book shelf"
            />
          </FlexItem>
          <FlexItem>
            <Content component="h1">Need help?</Content>
            <Flex
              alignItems={{ default: "alignItemsCenter" }}
              gap={{ default: "gapSm" }}
            >
              <FlexItem>
                <Content component={ContentVariants.p}>
                  Find answers to the frequently asked questions, or reach out
                  to us directly at{" "}
                  <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
                </Content>
              </FlexItem>
            </Flex>
          </FlexItem>
          <FlexItem className="pf-v6-u-display-block-on-md">
            <img
              className="support-banner__image"
              src={ChatImage}
              alt="Chat bubbles"
            />
          </FlexItem>
        </Flex>
      </CardBody>
    </Card>
  );
}
