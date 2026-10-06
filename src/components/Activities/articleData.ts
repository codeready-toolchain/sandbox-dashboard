import GetStartedDevSandvbox from "../../assets/images/activities/get-started-developer-sandbox.svg";
import StreamlineAutomationOpenShiftDevspaces from "../../assets/images/activities/streamline-automation-openshift-ansible.svg";
import DeployJavaApplication from "../../assets/images/activities/deploy-java-application.svg";
import FoundationsOfOpenShift from "../../assets/images/activities/foundations-of-openshift.svg";
import UsingOpenShiftPipelines from "../../assets/images/activities/using-openshift-pipelines.svg";
import OpenShiftVirtualizationApplicationModernization from "../../assets/images/activities/openshift-virtualization-application-modernization.svg";
import OpenShiftAI from "../../assets/images/activities/openshift-ai.png";
import PodmanDesktop from "../../assets/images/activities/podman-desktop.png";
import MoveObjectsAnotherCluster from "../../assets/images/activities/move-devsandbox-objects-another-cluster.png";

enum DifficultyLevel {
  FOUNDATIONAL = "Foundational",
  BEGINNER = "Beginner",
  INTERMEDIATE = "Intermediate",
}

export type Article = {
  img: string;
  title: string;
  description: string;
  link: string;
  level?: DifficultyLevel;
};

export const articleData: Article[] = [
  {
    img: GetStartedDevSandvbox,
    title: "Get started with your Developer Sandbox",
    description:
      "Learn how to set up and use the Developer Sandbox, and learn to develop quicker than ever before.",
    link: "https://developers.redhat.com/learn/openshift/get-started-your-developer-sandbox",
    level: DifficultyLevel.FOUNDATIONAL,
  },
  {
    img: FoundationsOfOpenShift,
    title: "Foundations of OpenShift",
    description:
      "Learn the foundations of OpenShift through hands-on experience deploying and working with applications.",
    link: "https://developers.redhat.com/learn/openshift/foundations-openshift",
    level: DifficultyLevel.FOUNDATIONAL,
  },
  {
    img: StreamlineAutomationOpenShiftDevspaces,
    title: "Streamline automation in OpenShift Dev Spaces with Ansible",
    description:
      "Learn how to transform the way you develop and test Ansible automations by using OpenShift Dev Spaces, which provides isolated and tailored development environments.",
    link: "https://developers.redhat.com/learn/openshift/streamline-automation-openshift-dev-spaces-ansible",
    level: DifficultyLevel.BEGINNER,
  },
  {
    img: DeployJavaApplication,
    title: "How to deploy a Java application on Kubernetes in minutes",
    description:
      "Modernize a legacy Java application by creating microservices, moving it into a container, then deploying it to Red Hat OpenShift using only Kubernetes commands.",
    link: "https://developers.redhat.com/learn/java/how-deploy-java-application-kubernetes-minutes",
    level: DifficultyLevel.BEGINNER,
  },
  {
    img: UsingOpenShiftPipelines,
    title: "Using OpenShift Pipelines",
    description:
      "Learn how to use OpenShift Pipelines for automated builds and deployments – known as CI/CD – of container-based applications to reduce mistakes, improve productivity, and promote more thorough testing.",
    link: "https://developers.redhat.com/learn/openshift/using-openshift-pipelines",
  },
  {
    img: OpenShiftVirtualizationApplicationModernization,
    title:
      "OpenShift virtualization and application modernization using the Developer Sandbox",
    description:
      "Learn how to create and manage your virtual machines (VMs) using Red Hat OpenShift and the Developer Sandbox, a no-cost OpenShift cluster with no need for setup or configuration.",
    link: "https://developers.redhat.com/learn/openshift/openshift-virtualization-and-application-modernization-using-developer-sandbox",
  },
  {
    img: OpenShiftAI,
    title:
      "Get started with consuming GPU-hosted large language models on Developer Sandbox",
    description:
      "Learn the many ways you can interact with GPU-hosted large language models (LLMs) on Developer Sandbox, including connecting the model endpoints, interacting with the API endpoints using the hosted Red Hat OpenShift AI component, and standing up a web-based chat user interface.",
    link: "https://developers.redhat.com/learn/ai/get-started-consuming-gpu-hosted-large-language-models-developer-sandbox",
  },
  {
    img: PodmanDesktop,
    title: "Install Podman Desktop and connect it to your Developer Sandbox",
    description:
      "Podman Desktop and the Developer Sandbox are both valuable tools for learning about and creating apps for Red Hat OpenShift. Combining the two creates a developer environment rich with tools and benefits. This learning path guides you in the installation of Podman Desktop and its connection to your sandbox account.",
    link: "https://developers.redhat.com/learn/openshift/install-podman-desktop-and-connect-it-your-developer-sandbox",
  },
  {
    img: MoveObjectsAnotherCluster,
    title: "Move your Developer Sandbox objects to another cluster",
    description:
      "This learning path walks you through the process of exporting your OpenShift objects from one cluster and importing them into another.",
    link: "https://developers.redhat.com/learn/openshift/move-your-developer-sandbox-objects-another-cluster",
  },
];
