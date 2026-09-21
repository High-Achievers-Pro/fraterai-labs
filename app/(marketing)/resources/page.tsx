import { PageHero, TextLink, ContactCTA } from "@/components/marketing/Shared";
import { Architecture } from "@/components/marketing/Architecture";
const resources = [
  {
    title: "Building Resilient RAG Pipelines",
    text: "Document retrieval, knowledge foundations, and the engineering behind dependable answers.",
    image: "governance",
    href: "/solutions/knowledge-base",
  },
  {
    title: "The Cost of Context Windows",
    text: "Prompt lengths, token budgets, and practical tradeoffs in high-throughput environments.",
    image: "arcade",
    href: "/services/llm-generative-ai",
  },
  {
    title: "Agents in the Cloud",
    text: "Deploying data processing workflows securely while retaining meaningful human oversight.",
    image: "process",
    href: "/services/ai-agents",
  },
];
export default function Resources() {
  return (
    <main id="top">
      <PageHero
        label="Resources"
        title="Ideas grounded in practice."
        description="Engineering perspectives, strategic thinking, and lessons from bringing AI into real workflows."
        image="governance"
      />
      <section className="section">
        <div className="container">
          <div className="resource-grid">
            {resources.map((r) => (
              <article className="resource-entry" key={r.title}>
                <Architecture name={r.image} />
                <h2>{r.title}</h2>
                <p>{r.text}</p>
                <p className="resource-status">Article in preparation</p>
                <TextLink href={r.href}>
                  Explore the related capability
                </TextLink>
              </article>
            ))}
          </div>
          <div className="resource-notice">
            Our resource library is taking shape. For a question about your own
            workflow, <TextLink href="/contact">start a conversation</TextLink>.
          </div>
        </div>
      </section>
      <ContactCTA />
    </main>
  );
}
