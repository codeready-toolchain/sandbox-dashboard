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

import { frequentlyAskedQuestions } from "../common/faqQuestions";

export function FAQ() {
  const [expandedItem, setExpandedItem] = useState<string | undefined>();

  const onToggle = (id: string) => {
    if (id === expandedItem) {
      setExpandedItem(undefined);
    } else {
      setExpandedItem(id);
    }
  };

  return (
    <Card className="support-page__faq" isPlain>
      <CardBody>
        <Accordion>
          {frequentlyAskedQuestions.map((faq, index) => {
            const itemId = `faq-item-${index}`;
            const toggleId = `faq-toggle-${index}`;
            const contentId = `faq-content-${index}`;

            return (
              <AccordionItem key={itemId} isExpanded={expandedItem === itemId}>
                <AccordionToggle
                  id={toggleId}
                  onClick={() => onToggle(itemId)}
                  aria-controls={contentId}
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
