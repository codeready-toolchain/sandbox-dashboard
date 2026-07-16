export type DeploymentItem = {
  status: {
    conditions: {
      type: string;
      status: string;
    }[];
  };
  spec: {
    replicas: number;
    template: {
      metadata: {
        labels: {
          app: string;
          deployment: string;
        };
      };
      spec: {
        volumes?: {
          name: string;
          persistentVolumeClaim?: {
            claimName: string;
          };
          secret?: {
            secretName: string;
          };
        }[];
      };
    };
  };
  metadata: {
    name: string;
    uuid: string;
    creationTimestamp: string;
    labels: {
      app: string;
    };
  };
};

export type DeploymentData = {
  items: DeploymentItem[];
};

export type PersistentVolumeClaimItem = {
  metadata: {
    name: string;
    uuid: string;
    creationTimestamp: string;
    labels: {
      app: string;
    };
  };
};

export type PersistentVolumeClaimData = {
  items: PersistentVolumeClaimItem[];
};

export type StateFulSetItem = {
  status: {
    conditions: {
      type: string;
      status: string;
    }[];
  };
  spec: {
    replicas: number;
    template: {
      metadata: {
        labels: {
          app: string;
          deployment: string;
        };
      };
      spec: {
        volumes?: {
          name: string;
          persistentVolumeClaim?: {
            claimName: string;
          };
          secret?: {
            secretName: string;
          };
        }[];
      };
    };
    volumeClaimTemplates?: {
      metadata: {
        name: string;
      };
    }[];
  };
  metadata: {
    name: string;
    uuid: string;
    creationTimestamp: string;
    labels: {
      app: string;
    };
  };
};

export type StatefulSetData = {
  items: StateFulSetItem[];
};

/**
 * Defines the data structure for a Kubernetes secret.
 */
export type SecretItem = {
  data: {
    password: string;
  };
  metadata: {
    name: string;
    uuid: string;
    creationTimestamp: string;
  };
};
