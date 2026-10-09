import "./SupportPage.css";

import { FAQ } from "./FrequentlyAskedQuestions";
import { SupportBanner } from "./SupportBanner";

export function SupportPage() {
  return (
    <div className="support-page__content-wrapper">
      <SupportBanner />
      <FAQ />
    </div>
  );
}
