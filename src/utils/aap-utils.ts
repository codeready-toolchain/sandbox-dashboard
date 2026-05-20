import type { AAPData, StatusCondition } from "../types";

export const decode = (str: string): string => atob(str);

export enum AnsibleStatus {
  NEW = "new",
  PROVISIONING = "provisioning",
  UNKNOWN = "unknown",
  READY = "ready",
  IDLED = "idled",
  NOT_DEPLOYED = "NOT_DEPLOYED",
}

const isConditionTrue = (
  condType: string,
  conditions: StatusCondition[],
): [boolean, StatusCondition | null] => {
  for (const condition of conditions) {
    if (condition.type === condType && condition.status === "True") {
      return [true, condition];
    }
  }
  return [false, null];
};

export const getReadyCondition = (
  data: AAPData | undefined,
  setError: (errorDetails: string) => void,
): AnsibleStatus => {
  if (!data || data.items.length === 0) {
    return AnsibleStatus.NEW;
  }

  if (!data.items[0].status || data.items[0].status.conditions.length === 0) {
    return AnsibleStatus.UNKNOWN;
  }

  if (data.items[0].spec?.idle_aap) {
    return AnsibleStatus.IDLED;
  }

  const conditions = data.items[0].status.conditions;

  const [isSuccessful, conditionSuccessful] = isConditionTrue(
    "Successful",
    conditions,
  );
  if (isSuccessful && conditionSuccessful?.reason === "Successful") {
    return AnsibleStatus.READY;
  }

  const [hasFailed, condition] = isConditionTrue("Failure", conditions);
  if (hasFailed) {
    if (condition) {
      setError(condition.message);
    }
    return AnsibleStatus.UNKNOWN;
  }

  const [isStillRunning] = isConditionTrue("Running", conditions);
  if (isStillRunning) {
    return AnsibleStatus.PROVISIONING;
  }

  return AnsibleStatus.UNKNOWN;
};

export const AAPObject: string = `
{
   "apiVersion":"aap.ansible.com/v1alpha1",
   "kind":"AnsibleAutomationPlatform",
   "metadata":{
      "name":"sandbox-aap"
   },
   "spec":{
      "idle_aap":false,
      "no_log":false,
      "api":{
         "replicas":1,
         "resource_requirements":{
            "requests":{
               "cpu":"100m",
               "memory":"256Mi"
            },
            "limits":{
               "cpu":"500m",
               "memory":"1000Mi"
            }
         }
      },
      "redis":{
         "replicas":1,
         "resource_requirements":{
            "requests":{
               "cpu":"100m",
               "memory":"256Mi"
            },
            "limits":{
               "cpu":"500m",
               "memory":"500Mi"
            }
         }
      },
      "database":{
         "replicas":1,
         "resource_requirements":{
            "requests":{
               "cpu":"100m",
               "memory":"256Mi"
            },
            "limits":{
               "cpu":"500m",
               "memory":"800Mi"
            }
         }
      },
      "controller":{
         "extra_settings":[
            {
               "setting":"DEFAULT_EXECUTION_QUEUE_POD_SPEC_OVERRIDE",
               "value":{
                  "resources":{
                     "limits":{
                        "cpu":"200m",
                        "memory":"500Mi"
                     },
                     "requests":{
                        "cpu":"200m",
                        "memory":"100Mi"
                     }
                  }
               }
            }
         ],
         "garbage_collect_secrets":true,
         "disabled":false,
         "uwsgi_processes":2,
         "task_resource_requirements":{
            "requests":{
               "cpu":"100m",
               "memory":"150Mi"
            },
            "limits":{
               "cpu":"1000m",
               "memory":"1200Mi"
            }
         },
         "web_resource_requirements":{
            "requests":{
               "cpu":"100m",
               "memory":"200Mi"
            },
            "limits":{
               "cpu":"200m",
               "memory":"1600Mi"
            }
         },
         "ee_resource_requirements":{
            "requests":{
               "cpu":"100m",
               "memory":"64Mi"
            },
            "limits":{
               "cpu":"1000m",
               "memory":"500Mi"
            }
         },
         "redis_resource_requirements":{
            "requests":{
               "cpu":"50m",
               "memory":"64Mi"
            },
            "limits":{
               "cpu":"100m",
               "memory":"200Mi"
            }
         },
         "rsyslog_resource_requirements":{
            "requests":{
               "cpu":"100m",
               "memory":"128Mi"
            },
            "limits":{
               "cpu":"500m",
               "memory":"250Mi"
            }
         },
         "init_container_resource_requirements":{
            "requests":{
               "cpu":"100m",
               "memory":"128Mi"
            },
            "limits":{
               "cpu":"500m",
               "memory":"200Mi"
            }
         }
      },
      "eda":{
         "disabled":false,
         "api":{
            "replicas":1,
            "resource_requirements":{
               "requests":{
                  "cpu":"50m",
                  "memory":"350Mi"
               },
               "limits":{
                  "cpu":"500m",
                  "memory":"700Mi"
               }
            }
         },
         "ui":{
            "replicas":1,
            "resource_requirements":{
               "requests":{
                  "cpu":"25m",
                  "memory":"64Mi"
               },
               "limits":{
                  "cpu":"500m",
                  "memory":"150Mi"
               }
            }
         },
         "scheduler":{
            "replicas":1,
            "resource_requirements":{
               "requests":{
                  "cpu":"50m",
                  "memory":"200Mi"
               },
               "limits":{
                  "cpu":"500m",
                  "memory":"250Mi"
               }
            }
         },
         "worker":{
            "replicas":2,
            "resource_requirements":{
               "requests":{
                  "cpu":"25m",
                  "memory":"200Mi"
               },
               "limits":{
                  "cpu":"250m",
                  "memory":"250Mi"
               }
            }
         },
         "default_worker":{
            "replicas":1,
            "resource_requirements":{
               "requests":{
                  "cpu":"25m",
                  "memory":"200Mi"
               },
               "limits":{
                  "cpu":"500m",
                  "memory":"400Mi"
               }
            }
         },
         "activation_worker":{
            "replicas":1,
            "resource_requirements":{
               "requests":{
                  "cpu":"25m",
                  "memory":"150Mi"
               },
               "limits":{
                  "cpu":"500m",
                  "memory":"400Mi"
               }
            }
         },
         "event_stream":{
            "replicas":1,
            "resource_requirements":{
               "requests":{
                  "cpu":"50m",
                  "memory":"300Mi"
               },
               "limits":{
                  "cpu":"150m",
                  "memory":"600Mi"
               }
            }
         }
      },
      "hub":{
         "redis_data_persistence":false,
         "disabled":false,
         "storage_type":"file",
         "file_storage_storage_class":"efs-sc",
         "file_storage_size":"10Gi",
         "api":{
            "replicas":1,
            "resource_requirements":{
               "requests":{
                  "cpu":"150m",
                  "memory":"256Mi"
               },
               "limits":{
                  "cpu":"800m",
                  "memory":"500Mi"
               }
            }
         },
         "content":{
            "replicas":1,
            "resource_requirements":{
               "requests":{
                  "cpu":"150m",
                  "memory":"256Mi"
               },
               "limits":{
                  "cpu":"800m",
                  "memory":"1200Mi"
               }
            }
         },
         "worker":{
            "replicas":1,
            "resource_requirements":{
               "requests":{
                  "cpu":"150m",
                  "memory":"256Mi"
               },
               "limits":{
                  "cpu":"800m",
                  "memory":"400Mi"
               }
            }
         },
         "web":{
            "replicas":1,
            "resource_requirements":{
               "requests":{
                  "cpu":"100m",
                  "memory":"256Mi"
               },
               "limits":{
                  "cpu":"500m",
                  "memory":"300Mi"
               }
            }
         },
         "redis":{
            "replicas":1,
            "resource_requirements":{
               "requests":{
                  "cpu":"100m",
                  "memory":"250Mi"
               },
               "limits":{
                  "cpu":"300m",
                  "memory":"400Mi"
               }
            }
         }
      }
   }
}
`;
