import { Product } from "../../hooks/useProductURLs";
import OpenShiftIcon from "../../assets/logos/openshift.svg";
import AnsibleIcon from "../../assets/logos/ansible.svg";
import OpenShiftAIIcon from "../../assets/logos/openshift-ai.svg";
import DevSpacesIcon from "../../assets/logos/devspaces.svg";
import OpenshiftVirtualizationIcon from "../../assets/logos/openshift-virtualization.svg";

export type DescriptionIconType = "success" | "warning";

export type ProductDescription = {
  iconType: DescriptionIconType;
  value: string;
};

export type ProductData = {
  id: Product;
  title: string;
  image: string;
  description: ProductDescription[];
};

export const productData: ProductData[] = [
  {
    id: Product.OPENSHIFT_CONSOLE,
    title: "OpenShift",
    image: OpenShiftIcon,
    description: [
      {
        iconType: "success",
        value: "Comprehensive cloud-native application platform",
      },
      {
        iconType: "success",
        value: "Consistently develop and deploy applications at scale",
      },
      {
        iconType: "success",
        value: "Streamline application development with CI/CD tools",
      },
      {
        iconType: "success",
        value:
          "Manage containers, VMs, and serverless workloads across the hybrid cloud",
      },
    ],
  },
  {
    id: Product.OPENSHIFT_AI,
    title: "OpenShift AI",
    image: OpenShiftAIIcon,
    description: [
      { iconType: "success", value: "Scalable AI and ML platform" },
      { iconType: "success", value: "Optimized for AI workloads" },
      { iconType: "success", value: "Train, serve and monitor models" },
      {
        iconType: "success",
        value: "Supports predictive and generative AI",
      },
      { iconType: "success", value: "Scales across the hybrid cloud" },
    ],
  },
  {
    id: Product.DEVSPACES,
    title: "Dev Spaces",
    image: DevSpacesIcon,
    description: [
      { iconType: "success", value: "Cloud Development Environment" },
      {
        iconType: "success",
        value: "Developer workspaces defined as code",
      },
      {
        iconType: "success",
        value: "Kubernetes development made easy",
      },
      { iconType: "success", value: "Near instant onboarding" },
      { iconType: "success", value: "VS Code and JetBrains IDEs" },
    ],
  },
  {
    id: Product.AAP,
    title: "Ansible Automation Platform",
    image: AnsibleIcon,
    description: [
      {
        iconType: "success",
        value: "Scalable, centralized automation solution",
      },
      {
        iconType: "success",
        value: "Available on-prem, cloud, and hybrid",
      },
      {
        iconType: "success",
        value: "Manage and monitor workflows, content, and execution",
      },
      {
        iconType: "success",
        value: "Enforce policies and consistent configurations",
      },
      {
        iconType: "warning",
        value: "30-minute environment provisioning",
      },
    ],
  },
  {
    id: Product.OPENSHIFT_VIRT,
    title: "OpenShift Virtualization",
    image: OpenshiftVirtualizationIcon,
    description: [
      {
        iconType: "success",
        value: "Migrate traditional VM workloads to OpenShift",
      },
      {
        iconType: "success",
        value:
          "Unified platform for VMs, containers, and serverless workloads",
      },
      {
        iconType: "success",
        value: "Supports modernizing application development",
      },
      {
        iconType: "success",
        value: "Comprehensive development and operations tools",
      },
    ],
  },
];
