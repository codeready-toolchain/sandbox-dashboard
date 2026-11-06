import "./FrequentlyAskedQuestions.css";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionToggle,
  Card,
  CardBody,
} from "@patternfly/react-core";
import { useState } from "react";

import { useAnalyticsContext } from "../../hooks/AnalyticsContext";
import { dpalClickAttributes, IntentEvent } from "../../utils/analytics";
import { frequentlyAskedQuestions } from "../common/faqQuestions";

export function FAQ() {
  const { trackIntent } = useAnalyticsContext();
  const [expandedItem, setExpandedItem] = useState<string | undefined>();

  const onToggle = (id: string, question: string) => {
    if (id === expandedItem) {
      setExpandedItem(undefined);
      return;
    }

    trackIntent(IntentEvent.supportQuestionOpened, "Support", { question });
    setExpandedItem(id);
  };

  return (
    <Card className="support-page__faq" isPlain>
      <CardBody>
        <Accordion>
          {frequentlyAskedQuestions.map((faq, index) => {
            const itemId = `faq-item-${index}`;
            const toggleId = `faq-toggle-${index}`;
            const contentId = `faq-content-${index}`;

            const isExpanded = expandedItem === itemId;

            return (
              <AccordionItem key={itemId} isExpanded={isExpanded}>
                <AccordionToggle
                  id={toggleId}
                  onClick={() => onToggle(itemId, faq.question)}
                  aria-controls={contentId}
                  {...(isExpanded
                    ? {}
                    : dpalClickAttributes({
                        text: faq.question,
                        section: "Support",
                        detail: "FAQ",
                        linkType: "default",
                      }))}
                >
                  {faq.question}
                </AccordionToggle>
                <AccordionContent id={contentId} aria-labelledby={toggleId}>
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardBody>
    </Card>
  );
}
