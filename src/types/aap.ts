export type AAPItem = {
  status: {
    conditions: StatusCondition[];
    URL: string;
    adminPasswordSecret: string;
    adminUser: string;
  };
  spec: {
    idle_aap: boolean;
  };
  metadata: {
    name: string;
    uuid: string;
    creationTimestamp: string;
  };
};

export type AAPData = {
  items: AAPItem[];
};

export type StatusCondition = {
  type: string;
  status: string;
  reason: string;
  message: string;
};
