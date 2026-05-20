export type Status =
  | "unknown"
  | "new"
  | "verify"
  | "pending-approval"
  | "provisioning"
  | "ready";

export type SignupData = {
  name: string;
  compliantUsername: string;
  username: string;
  givenName: string;
  familyName: string;
  company: string;
  email?: string;
  userID?: string;
  accountID?: string;
  accountNumber?: string;
  status: SignUpStatusData;
  consoleURL?: string;
  proxyURL?: string;
  rhodsMemberURL?: string;
  cheDashboardURL?: string;
  apiEndpoint?: string;
  clusterName?: string;
  defaultUserNamespace?: string;
  startDate?: string;
  endDate?: string;
};

export type SignUpStatusData = {
  ready: boolean;
  reason: string;
  verificationRequired: boolean;
};

export type CommonResponse = {
  status: string;
  code: number;
  message: string;
  details: string;
};
