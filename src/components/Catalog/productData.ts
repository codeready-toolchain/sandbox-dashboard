import AnsibleIcon from "../../assets/logos/ansible.svg";
import DevSpacesIcon from "../../assets/logos/devspaces.svg";
import OpenClawIcon from "../../assets/logos/openclaw.svg";
import OpenShiftAIIcon from "../../assets/logos/openshift-ai.svg";
import OpenshiftVirtualizationIcon from "../../assets/logos/openshift-virtualization.svg";
import OpenShiftIcon from "../../assets/logos/openshift.svg";
import {
  BulletPointIconType,
  ProductType,
  type Product,
  type URLTemplateVars,
} from "../../types/product";

export const Intcmp: Record<string, string> = {
  [ProductType.OPENSHIFT_CONSOLE]: "701Pe00000dnCEYIA2",
  [ProductType.DEVSPACES]: "701Pe00000doTQCIA2",
  [ProductType.OPENSHIFT_AI]: "701Pe00000do2uiIAA",
  [ProductType.OPENSHIFT_VIRTUALIZATION]: "701Pe00000dov6IIAQ",
  [ProductType.AAP]: "701Pe00000dowQXIAY",
  [ProductType.OPENCLAW]: "",
};

export const products: Product[] = [
  {
    type: ProductType.OPENSHIFT_CONSOLE,
    title: "OpenShift",
    image: OpenShiftIcon,
    urlTemplate: "{{consoleURL}}/k8s/cluster/projects/{{defaultUserNamespace}}",
    description: [
      {
        bulletPoint: "Comprehensive cloud-native application platform",
      },
      {
        bulletPoint: "Consistently develop and deploy applications at scale",
      },
      {
        bulletPoint: "Streamline application development with CI/CD tools",
      },
      {
        bulletPoint:
          "Manage containers, VMs, and serverless workloads across the hybrid cloud",
      },
    ],
  },
  {
    type: ProductType.OPENSHIFT_AI,
    title: "OpenShift AI",
    image: OpenShiftAIIcon,
    urlTemplate: "{{rhodsMemberURL}}",
    description: [
      {
        bulletPoint: "Scalable AI and ML platform",
      },
      {
        bulletPoint: "Optimized for AI workloads",
      },
      {
        bulletPoint: "Train, serve and monitor models",
      },
      {
        bulletPoint: "Supports predictive and generative AI",
      },
      {
        bulletPoint: "Scales across the hybrid cloud",
      },
    ],
  },
  {
    type: ProductType.DEVSPACES,
    title: "Dev Spaces",
    image: DevSpacesIcon,
    resolveURL: (urlTemplateVars: URLTemplateVars): string => {
      // Prefer the given "Che Dashboard" url from the user signup.
      if (urlTemplateVars.cheDashboardURL) {
        return urlTemplateVars.cheDashboardURL;
      }

      // Otherwise, derive the Dev Spaces URL from the Console URL. Basically
      // obtain the OpenShift domain and use it by prepending "devspaces" to
      // it.
      //
      // - https://console-openshift-console.apps.cluster1.example.com
      // - https://devspaces.apps.cluster1.example.com.
      if (!urlTemplateVars.consoleURL) {
        return "";
      }

      const index = urlTemplateVars.consoleURL.indexOf(".apps");
      if (index === -1) {
        return "";
      }

      return `https://devspaces${urlTemplateVars.consoleURL.substring(index)}`;
    },
    description: [
      {
        bulletPoint: "Cloud Development Environment",
      },
      {
        bulletPoint: "Developer workspaces defined as code",
      },
      {
        bulletPoint: "Kubernetes development made easy",
      },
      {
        bulletPoint: "Near instant onboarding",
      },
      {
        bulletPoint: "VS Code and JetBrains IDEs",
      },
    ],
  },
  {
    type: ProductType.AAP,
    title: "Ansible Automation Platform",
    image: AnsibleIcon,
    description: [
      {
        bulletPoint: "Scalable, centralized automation solution",
      },
      {
        bulletPoint: "Available on-prem, cloud, and hybrid",
      },
      {
        bulletPoint: "Manage and monitor workflows, content, and execution",
      },
      {
        bulletPoint: "Enforce policies and consistent configurations",
      },
      {
        bulletPoint: "30-minute environment provisioning",
        iconType: BulletPointIconType.WARNING,
      },
    ],
  },
  {
    type: ProductType.OPENSHIFT_VIRTUALIZATION,
    title: "OpenShift Virtualization",
    image: OpenshiftVirtualizationIcon,
    urlTemplate:
      "{{consoleURL}}/k8s/ns/{{defaultUserNamespace}}/virtualization-overview",
    description: [
      {
        bulletPoint: "Migrate traditional VM workloads to OpenShift",
      },
      {
        bulletPoint:
          "Unified platform for VMs, containers, and serverless workloads",
      },
      {
        bulletPoint: "Supports modernizing application development",
      },
      {
        bulletPoint: "Comprehensive development and operations tools",
      },
    ],
  },
  {
    type: ProductType.OPENCLAW,
    title: "OpenClaw",
    image: OpenClawIcon,
    description: [
      {
        bulletPoint: "Personal AI assistant running on your cluster",
      },
      {
        bulletPoint:
          "Bring your own LLM API keys (OpenAI, Anthropic, Google, etc.)",
      },
      {
        bulletPoint: "Full workspace access — code, debug, and deploy",
      },
      {
        bulletPoint: "Kubernetes-native with managed lifecycle",
      },
      {
        bulletPoint: "Requires at least one AI provider credential",
        iconType: BulletPointIconType.WARNING,
      },
    ],
  },
];
