import { Component, type ErrorInfo, type ReactNode } from "react";
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateActions,
  Button,
} from "@patternfly/react-core";
import ExclamationCircleIcon from "@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon";
import { SUPPORT_EMAIL } from "../const";
import { errorMessage } from "../utils/common";
import logger from "../utils/logger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  copyLabel: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      copyLabel: "Copy technical details",
    };
  }

  static getDerivedStateFromError(error: Error): Omit<State, "copyLabel"> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error("Uncaught error:", error, info);
  }

  private handleCopy = async () => {
    if (!this.state.error) return;
    try {
      await navigator.clipboard.writeText(errorMessage(this.state.error));
      this.setState({ copyLabel: "Copied!" });
      setTimeout(
        () => this.setState({ copyLabel: "Copy technical details" }),
        2000,
      );
    } catch (error) {
      logger.error("Failed to copy technical details", error);
      this.setState({ copyLabel: "Unable to copy" });
      setTimeout(
        () => this.setState({ copyLabel: "Copy technical details" }),
        2000,
      );
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <EmptyState
          titleText="Something went wrong"
          icon={ExclamationCircleIcon}
          status="danger"
          isFullHeight
          headingLevel="h1"
        >
          <EmptyStateBody>
            An unexpected error occurred. Please reload the page or contact{" "}
            {SUPPORT_EMAIL} if the issue persists.
          </EmptyStateBody>
          <EmptyStateFooter>
            <EmptyStateActions>
              <Button
                variant="primary"
                onClick={() => window.location.reload()}
              >
                Reload page
              </Button>
            </EmptyStateActions>
            {this.state.error && (
              <EmptyStateActions>
                <Button variant="link" onClick={this.handleCopy}>
                  {this.state.copyLabel}
                </Button>
              </EmptyStateActions>
            )}
          </EmptyStateFooter>
        </EmptyState>
      );
    }

    return this.props.children;
  }
}
