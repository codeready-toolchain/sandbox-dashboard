import {
  Button,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
} from "@patternfly/react-core";
import ExclamationCircleIcon from "@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon";
import { useMemo } from "react";
import { SUPPORT_EMAIL } from "../const";
import { ApiError } from "../error/ApiError";
import type { CriticalError } from "../error/CriticalError";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import { errorMessage } from "../utils/common";

type CriticalErrorPageProps = {
  error: CriticalError;
};

/**
 * A component that renders whenever there is an unrecoverable critical error
 * in the application, like for example when the user signup data cannot be
 * retrieved.
 * @param param0 the error to render in the page.
 */
export function CriticalErrorPage({ error }: CriticalErrorPageProps) {
  const technicalDetails = useMemo(() => {
    if (!error.cause) return undefined;
    if (error.cause instanceof ApiError) {
      return error.cause.body;
    }
    return errorMessage(error.cause);
  }, [error.cause]);

  const { copyToClipboard, copyToClipboardLabel } =
    useCopyToClipboard(technicalDetails);

  return (
    <EmptyState
      titleText="Unable to load the Developer Sandbox"
      icon={ExclamationCircleIcon}
      status="danger"
      isFullHeight
      headingLevel="h1"
    >
      <EmptyStateBody>{error.userMessage}</EmptyStateBody>
      <EmptyStateFooter>
        <EmptyStateActions>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </EmptyStateActions>
        <EmptyStateActions>
          <Button variant="link" component="a" href={`mailto:${SUPPORT_EMAIL}`}>
            Contact support
          </Button>
          {technicalDetails && (
            <Button variant="link" onClick={copyToClipboard}>
              {copyToClipboardLabel}
            </Button>
          )}
        </EmptyStateActions>
      </EmptyStateFooter>
    </EmptyState>
  );
}
