/**
 * Defines a User entity. Basically it's a map of the "Signup" resource from
 * the registration service.
 */
export type User = {
  accountID?: string;
  accountNumber?: string;
  apiEndpoint?: string;
  cheDashboardURL?: string;
  clusterName?: string;
  company: string;
  compliantUsername: string;
  consoleURL?: string;
  defaultUserNamespace?: string;
  email?: string;
  endDate?: string;
  familyName: string;
  givenName: string;
  name: string;
  proxyURL?: string;
  rhodsMemberURL?: string;
  startDate?: string;
  status: UserStatus;
  userID?: string;
  username: string;
};

/**
 * Defines the structure for the information that tells us which status the
 * user is in.
 */
export type UserStatus = {
  ready: boolean;
  reason: string;
  verificationRequired: boolean;
};
