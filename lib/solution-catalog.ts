export const SOLUTION_DATA: Record<
  string,
  { title: string; iconPath: string; description: string; benefits: string[] }
> = {
  "document-processing": {
    title: "AI Document Processing",
    iconPath: "M3 3h18v18H3z M9 9h6 M9 13h6 M9 17h3",
    description:
      "Automate the extraction of unstructured data from complex legal contracts, invoices, and hand-written PDFs into structured, machine-readable formats. Instantly turn documents into accessible knowledge pipelines.",
    benefits: [
      "Optical Character Recognition (OCR)",
      "Semantic Entity Extraction",
      "Handwriting Recognition Models",
      "Automated Compliance & Redaction",
    ],
  },
  "knowledge-base": {
    title: "AI-Powered Knowledge Base",
    iconPath:
      "M12 2a9 3 0 1 0 0 6 9 3 0 1 0 0-6z M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5 M21 12c0 1.66-4 3-9 3s-9-1.34-9-3",
    description:
      "Deploy secure Retrieval-Augmented Generation (RAG) engines that give your workforce instant, cited answers grounded entirely in your proprietary internal documentation, completely insulated from open internet hallucination.",
    benefits: [
      "Direct Citation & Source Linking",
      "Secure RBAC & SSO Integration",
      "Zero-Hallucination Guardrails",
      "Multi-format Ingestion (Confluence, Jira, Word)",
    ],
  },
  "customer-experience": {
    title: "AI-Driven Customer Experience",
    iconPath:
      "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z",
    description:
      "Implement intelligent conversational agents that securely handle tiered support routing, complex account inquiries, and instantaneous multilingual resolutions, reducing expensive L1 queue bottlenecks.",
    benefits: [
      "Omnichannel Platform Deployment",
      "Sentiment Analysis & Escalation",
      "Seamless Human Agent Handoff",
      "Automated Ticketing Resolution",
    ],
  },
};
