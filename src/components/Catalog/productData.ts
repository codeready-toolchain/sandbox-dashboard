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

export const products: Product[] = [
  {
    type: ProductType.OPENSHIFT_CONSOLE,
    title: "OpenShift",
    image: OpenShiftIcon,
    urlTemplate: "{{consoleURL}}/k8s/cluster/projects/{{defaultUserNamespace}}",
    description: [
      {
        bulletPoint: "Comprehensive cloud-native application platform",
        iconType: BulletPointIconType.SUCCESS,
      },
      {
        iconType: BulletPointIconType.SUCCESS,
        bulletPoint: "Consistently develop and deploy applications at scale",
      },
      {
        iconType: BulletPointIconType.SUCCESS,
        bulletPoint: "Streamline application development with CI/CD tools",
      },
      {
        iconType: BulletPointIconType.SUCCESS,
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
        iconType: BulletPointIconType.SUCCESS,
        bulletPoint: "Scalable AI and ML platform",
      },
      {
        iconType: BulletPointIconType.SUCCESS,
        bulletPoint: "Optimized for AI workloads",
      },
      {
        iconType: BulletPointIconType.SUCCESS,
        bulletPoint: "Train, serve and monitor models",
      },
      {
        iconType: BulletPointIconType.SUCCESS,
        bulletPoint: "Supports predictive and generative AI",
      },
      {
        iconType: BulletPointIconType.SUCCESS,
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
        iconType: BulletPointIconType.SUCCESS,
      },
      {
        bulletPoint: "Developer workspaces defined as code",
        iconType: BulletPointIconType.SUCCESS,
      },
      {
        bulletPoint: "Kubernetes development made easy",
        iconType: BulletPointIconType.SUCCESS,
      },
      {
        bulletPoint: "Near instant onboarding",
        iconType: BulletPointIconType.SUCCESS,
      },
      {
        bulletPoint: "VS Code and JetBrains IDEs",
        iconType: BulletPointIconType.SUCCESS,
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
        iconType: BulletPointIconType.SUCCESS,
      },
      {
        bulletPoint: "Available on-prem, cloud, and hybrid",
        iconType: BulletPointIconType.SUCCESS,
      },
      {
        bulletPoint: "Manage and monitor workflows, content, and execution",
        iconType: BulletPointIconType.SUCCESS,
      },
      {
        bulletPoint: "Enforce policies and consistent configurations",
        iconType: BulletPointIconType.SUCCESS,
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
        iconType: BulletPointIconType.SUCCESS,
      },
      {
        bulletPoint:
          "Unified platform for VMs, containers, and serverless workloads",
        iconType: BulletPointIconType.SUCCESS,
      },
      {
        bulletPoint: "Supports modernizing application development",
        iconType: BulletPointIconType.SUCCESS,
      },
      {
        bulletPoint: "Comprehensive development and operations tools",
        iconType: BulletPointIconType.SUCCESS,
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
        iconType: BulletPointIconType.SUCCESS,
      },
      {
        bulletPoint:
          "Bring your own LLM API keys (OpenAI, Anthropic, Google, etc.)",
        iconType: BulletPointIconType.SUCCESS,
      },
      {
        bulletPoint: "Full workspace access — code, debug, and deploy",
        iconType: BulletPointIconType.SUCCESS,
      },
      {
        bulletPoint: "Kubernetes-native with managed lifecycle",
        iconType: BulletPointIconType.SUCCESS,
      },
      {
        bulletPoint: "Requires at least one AI provider credential",
        iconType: BulletPointIconType.WARNING,
      },
    ],
  },
];
