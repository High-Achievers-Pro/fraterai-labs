import { PageHero, ContactCTA } from "@/components/marketing/Shared";
import ProcessExplorer from "@/components/marketing/ProcessExplorer";
const details = [
  [
    "Discovery",
    "Initial consultation to define goals, requirements, constraints, and your current workflow reality.",
  ],
  [
    "Organize",
    "Developing a tailored implementation strategy, roadmap, data pipelines, and a concrete project timeline.",
  ],
  [
    "Develop",
    "Setting up your environment, training models, crafting intelligent agents, and integrating foundational tools.",
  ],
  [
    "Deploy",
    "Safely bringing agents and models into the workflow. Integrating with identity, access, and observability platforms.",
  ],
  [
    "Solutions & enablement",
    "Rolling out document processing, knowledge bases, and conversational channels with training and clear ownership.",
  ],
  [
    "Measure & improve",
    "Ongoing support, human oversight, evaluation, and audits for continuous improvement.",
  ],
];
export default function Process() {
  return (
    <main id="top">
      <PageHero
        label="Our process"
        title="A practical path to working systems."
        description="We combine strategic clarity, operator-level expertise, and disciplined engineering to turn AI from possibility into measurable results."
        image="process"
      />
      <section className="section" id="process">
        <div className="container">
          <ProcessExplorer />
          <div className="process-long-form">
            {details.map(([title, text], i) => (
              <article key={title}>
                <span className="sequence">0{i + 1}</span>
                <h2>{title}</h2>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <ContactCTA />
    </main>
  );
}
