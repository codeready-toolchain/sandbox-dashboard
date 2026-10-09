import type { ReactNode } from "react";

type FrequentlyAskedQuestion = {
  question: string;
  answer: ReactNode;
  shouldBeVisibleLandingPage?: boolean;
};

export const frequentlyAskedQuestions: FrequentlyAskedQuestion[] = [
  {
    question: "What is the Developer Sandbox?",
    answer:
      "The Developer Sandbox is a free, no-commitment trial environment. It gives users private access to a shared, multi-tenant OpenShift cluster pre-configured with select Red Hat technologies.",
  },
  {
    question: "What is my cost for the Developer Sandbox?",
    answer:
      "It is free. There is no credit card required. All you need is a Red Hat account.",
  },
  {
    question: "How long can I use the Sandbox for?",
    answer:
      "Your Sandbox is good for 30 days, after which, the Sandbox is deleted. If you feel like you'll need more than 30 days for your trial, you can request a new one free of charge after the deletion of your Sandbox. We have guides on how to export your work so that you don't lose any progress as well!",
  },
  {
    question: "Can I deploy my software on the Developer Sandbox?",
    answer:
      "That's the idea! You'll find that some software will deploy as-is, while other code might require some minor changes. You'll quickly see how easy it is to create a container running your software on your cluster. Java, Node.js, Python, Go, C#, and more are supported.",
  },
  {
    question:
      "We're not a Red Hat Enterprise Linux or a Red Hat customer. Can we still use the Developer Sandbox?",
    answer: (
      <>
        Absolutely. You don't need to install anything to get started. You may
        want to{" "}
        <a href="https://developers.redhat.com/learning/learn:openshift:download-and-install-red-hat-openshift-cli/resource/resources:download-and-install-oc">
          install a command-line tool
        </a>{" "}
        for your environment (Linux, macOS, or Windows -- all are welcome), but
        it's not necessary.
      </>
    ),
  },
  {
    question: "Which developer tools are available in my Developer Sandbox?",
    answer:
      "We have a broad understanding of what it means to be a developer. Whether you're developing automation, LLMs or more traditional code we've got you covered. We provide the developer experience on OpenShift, including a catalog of Helm charts, Red Hat builder images, s2i build tool, OpenShift AI, and OpenShift Dev Spaces.",
  },
  {
    question:
      "How can I install additional developer tools in my Developer Sandbox?",
    answer:
      "The Developer Sandbox provides a pre-configured set of tools and services. We would love to learn from you about other tools and services that we should consider adding to the sandbox.",
  },
  {
    question: "How can I save the work I've done in my Developer Sandbox?",
    answer: (
      <>
        Here's a guide to{" "}
        <a href="https://developers.redhat.com/learning/learn:openshift:move-your-developer-sandbox-objects-another-cluster/resource/resources:export-objects-openshift-cluster">
          exporting your work to another cluster
        </a>
        . In the Developer Sandbox, you can export your work before one trial
        ends, and import it when you've started your next 30 day trial.
      </>
    ),
  },
  {
    question: "How long will my workloads run?",
    answer:
      "Pods are automatically deleted after running for 12 consecutive hours. However, this does not affect the availability of your applications; you simply need to start a new pod. Note that Linux virtual machines (VMs) will be shutdown after one hour of continuous operation.",
  },
  {
    question:
      "Why do I have to validate my phone number to access the Developer Sandbox?",
    answer:
      "We require a valid phone number to reduce the creation of fraudulent accounts on the Developer Sandbox. Red Hat will not use this information for any other reason, and you will never receive a phone call from Red Hat or any third party as a result of trying the Developer Sandbox.",
  },
  {
    question: "Why doesn't my windows virtual machine work?",
    answer: (
      <>
        While{" "}
        <a href="https://docs.redhat.com/en/documentation/red_hat_virtualization/4.0/html/virtual_machine_management_guide/chap-installing_windows_virtual_machines">
          Openshift Virtualization supports windows VMs
        </a>
        , Developer Sandbox only guarantees extended runtime privileges to
        pre-configured images. Custom images may be automatically shut down by
        our system.
      </>
    ),
  },
];
