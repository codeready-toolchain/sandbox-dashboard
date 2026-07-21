import type { StatusCondition } from "./aap";

export type SpaceRequestItem = {
  metadata: {
    name: string;
  };
  spec: {
    tierName: string;
  };
  status?: {
    conditions?: StatusCondition[];
    namespaceAccess?: { name: string; secretRef: string }[];
  };
};

export type OpenClawCredentialRef = {
  name: string;
  key: string;
};

export type OpenClawGcpConfig = {
  project?: string;
  location?: string;
};

export type OpenClawCredential = {
  name: string;
  type: string;
  secretRef: OpenClawCredentialRef[];
  provider?: string;
  domain?: string;
  gcp?: OpenClawGcpConfig;
};

export type OpenClawCustomProviderModel = {
  name: string;
  alias?: string;
};

export type OpenClawCustomProvider = {
  name: string;
  baseUrl: string;
  api?: string;
  credentialRef: string;
  models: OpenClawCustomProviderModel[];
};

export type OpenClawWebSearch = {
  provider: string;
};

export type OpenClawWorkspace = {
  skipBootstrap?: boolean;
  files?: Record<string, string>;
};

export type OpenClawCR = {
  metadata: {
    name: string;
    uid?: string;
    creationTimestamp?: string;
  };
  spec: {
    credentials?: OpenClawCredential[];
    customProviders?: OpenClawCustomProvider[];
    webSearch?: OpenClawWebSearch;
    idle?: boolean;
    auth?: {
      disableDevicePairing?: boolean;
    };
    workspace?: OpenClawWorkspace;
    skills?: Record<string, string>;
  };
  status?: {
    conditions?: StatusCondition[];
    url?: string;
  };
};

interface AuthorizedUserCredential {
  type: "authorized_user";
  client_id: string;
  client_secret: string;
  refresh_token: string;
  quota_project_id?: string;
}

interface ServiceAccountCredential {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

export type JsonCredentialSchema =
  | AuthorizedUserCredential
  | ServiceAccountCredential;
