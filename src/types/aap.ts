/**
 * Defines the structure of the Ansible Automation Platform's CR.
 */
export type AAPCR = {
  metadata: {
    name: string;
    uuid: string;
    creationTimestamp: string;
  };
  spec: {
    idle_aap: boolean;
  };
  status?: {
    adminPasswordSecret?: string;
    adminUser?: string;
    conditions?: StatusCondition[];
    URL?: string;
  };
};

/**
 * Defines the structure of the "Ansible Automation Platform"
 */
export type AAPCRList = {
  items: AAPCR[];
};

/**
 * Defines the administrator credentials for the user's provisioned Ansible
 * Automation Platform instance.
 */
export type AAPInstanceCredentials = {
  username: string;
  password: string;
  url: string;
};

export type StatusCondition = {
  type: string;
  status: string;
  reason: string;
  message: string;
};
