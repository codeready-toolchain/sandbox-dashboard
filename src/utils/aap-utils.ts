import { UNIDLE_REQUESTED_AT_ANNOTATION } from "../const";
import type { AAPCR, StatusCondition } from "../types";
import { anyConditionMatches } from "./condition-utils";
import logger from "./logger";

/**
 * Defines fifty minutes in milliseconds, which is the SLA we show in the UI
 * for the AAP instance provisioinng.
 */
const FIFTY_MINUTES = 50 * 60 * 1000;

export const decode = (str: string): string => atob(str);

/**
 * Defines the result type that the "fetchCR" function can return. The type
 * narrowing helps in managing the different states of the instance more
 * easily.
 */
export type FetchCRResult =
  | { kind: "absent" }
  | { kind: "ok"; cr: AAPCR; status: AAPInstanceStatus }
  | {
      kind: "failed";
      cr: AAPCR;
      status: AAPInstanceStatus;
      failedCondition: StatusCondition;
    };

export enum AAPInstanceErrorType {
  /** The instance reports a failure condition. */
  CONDITION_REPORTS_FAILURE,
  /** Error while polling to verify that the deletion succeeded. */
  DELETING_POLLING_REPORTS_FAILURE,
  /** The instance could not be deleted. */
  DELETION_ERROR,
  /**
   * The deletion of the instance's resources like PVCs, deployments and such
   * failed.
   */
  DELETION_RESOURCES_ERROR,
  /** The initial fetching of the instance's status failed. */
  INITIAL_FETCH_FAILED,
  /** The instance could not be created.  */
  INSTANCE_CREATION_FAILED,
  /** The instance could not be unidled. */
  INSTANCE_UNIDLING_FAILED,
  /**
   * The instance ended up in a "failing" state when we were polling to see if
   * the provisioning instance was becoming ready.
   */
  PROVISIONING_POLLING_REPORTS_FAILURE,
  /**
   * The instance ended up in a "failing" state when we were polling to see if
   * the idled instance was becoming ready.
   */
  UNIDLING_POLLING_REPORTS_FAILURE,
}

/**
 * Defines the different statuses the Ansible Automation Platform instance can
 * be in.
 */
export type AAPInstanceStatus =
  | { kind: "userNotReady" }
  | { kind: "initialFetch" }
  | { kind: "new" }
  | { kind: "provisioning" }
  | { kind: "ready" }
  | { kind: "idled" }
  | { kind: "unidling" }
  | { kind: "deleting" }
  | { kind: "deleted" }
  | { kind: "error"; errorType: AAPInstanceErrorType }
  | { kind: "notDeployed" }
  | { kind: "unknown" };

/**
 * Maps the current ansible status to a format the UI can understand.
 * @param crList The CR List response that the back end returns.
 * @param now the timestamp of the current instant in time. Used to compare it
 * with the CR's timestamps to determine the grace period. Having it in the
 * function's signature helps with testing.
 * @returns the status of the AAP instance.
 */
export const mapAnsibleStatus = (
  cr: AAPCR | undefined,
  now: number = Date.now(),
): [AAPInstanceStatus, StatusCondition | undefined] => {
  // When there's no CR object that means that it's not provisioned yet.
  if (!cr) {
    return [{ kind: "new" }, undefined];
  }

  // A CR without the elements to determine its status will be considered as
  // "unknown". We could make assumptions, but we prefer not to do so.
  if (
    !cr.status ||
    !cr.status.conditions ||
    cr.status.conditions.length === 0
  ) {
    return [{ kind: "unknown" }, undefined];
  }

  // When there is a failure condition, but the failure is recoverable and/or
  // we're in the grace period, we let the error slide and keep the operation
  // going. Otherwise we hard fail and notify it to the rest of the codebase.
  const aapInstanceConditions = cr.status.conditions;
  const failedCondition = anyConditionMatches(
    "Failure",
    "True",
    aapInstanceConditions,
  );
  if (failedCondition) {
    if (
      isErrorRecoverable(failedCondition, cr.metadata.creationTimestamp, now)
    ) {
      return [{ kind: "provisioning" }, failedCondition];
    }

    const unidleTimestamp =
      cr.metadata.annotations?.[UNIDLE_REQUESTED_AT_ANNOTATION];
    if (
      unidleTimestamp &&
      isErrorRecoverable(failedCondition, unidleTimestamp, now)
    ) {
      return [{ kind: "unidling" }, failedCondition];
    }

    return [
      {
        kind: "error",
        errorType: AAPInstanceErrorType.CONDITION_REPORTS_FAILURE,
      },
      failedCondition,
    ];
  }

  // The AAP instance can be idled even if it is in a failure state, so we
  // need to check for the idling after checking for any failures. Otherwise
  // the instances show up as idled, and attempting to unidle them results in
  // cascading errors.
  if (cr.spec?.idle_aap) {
    return [{ kind: "idled" }, undefined];
  }

  // On success we simply can report it back.
  const successfulCondition = anyConditionMatches(
    "Successful",
    "True",
    aapInstanceConditions,
  );
  if (successfulCondition) {
    return [{ kind: "ready" }, successfulCondition];
  }

  // When the instance is still reconciling determine if it's a provisioning
  // or unidling state.
  const runningCondition = anyConditionMatches(
    "Running",
    "True",
    aapInstanceConditions,
  );
  if (runningCondition) {
    if (cr.metadata.annotations?.[UNIDLE_REQUESTED_AT_ANNOTATION]) {
      return [{ kind: "unidling" }, runningCondition];
    } else {
      return [{ kind: "provisioning" }, runningCondition];
    }
  }

  return [{ kind: "unknown" }, undefined];
};

/**
 * Checks whether the instance's errors are considered "recoverable" or not.
 * @param failedCondition the failed condition to check.
 * @param timestamp the timestamp of the object that we will use to determine
 * the grace period.
 * @param now the timestamp of the current instant to determine the grace
 * period with.
 * @returns `true` if the failed condition is recoverable and the grace period
 * has not been depleted.
 */
export const isErrorRecoverable = (
  failedCondition: StatusCondition,
  timestamp: string,
  now: number,
): boolean => {
  if (
    failedCondition.message === "unknown playbook failure" &&
    now - new Date(timestamp).getTime() < FIFTY_MINUTES
  ) {
    logger.warn(
      "AAP instance is reporting recoverable errors",
      failedCondition.message,
    );

    return true;
  } else {
    return false;
  }
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
      "proxy":{
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
      "metrics":{
         "disabled":true
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
