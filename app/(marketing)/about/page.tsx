import { PageHero, ContactCTA } from "@/components/marketing/Shared";
const people = [
  [
    "Software & ML Engineer",
    "Amazon",
    "Bringing deep expertise in scaling machine learning infrastructure and building resilient, high-volume backend architectures.",
  ],
  [
    "ML Scientist",
    "Expedia",
    "Specializing in predictive modeling, personalization algorithms, and transforming massive consumer datasets into actionable intelligence.",
  ],
  [
    "Senior Data Scientist",
    "Wesco",
    "Focused on enterprise analytics, supply chain optimization, and driving critical operational efficiency through applied statistical models.",
  ],
];
export default function About() {
  return (
    <main id="top">
      <PageHero
        label="About FraterAI"
        title="Deep expertise. A practical point of view."
        description="Built by a team of engineers and scientists from technology and enterprise companies. Focused on the way your people actually work."
        image="library"
      />
      <section className="section" id="about">
        <div className="container">
          <div className="catalog-intro">
            <h2>
              Engineering experience,
              <br />
              applied to your challenges.
            </h2>
            <p>
              Our team brings experience across software engineering, machine
              learning, and enterprise data science.
            </p>
          </div>
          <div className="expertise-people">
            {people.map(([role, company, text]) => (
              <article className="expertise-person" key={role}>
                <h3>{role}</h3>
                <span>Experience at {company}</span>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="section audience-section" id="stories">
        <div className="container">
          <h2>What better work can look like.</h2>
          <p className="lead" style={{ marginTop: 18 }}>
            Illustrative engagements, grounded in everyday operational
            challenges.
          </p>
          <div className="stories-grid">
            <article className="story">
              <h3>From scattered documents to useful answers.</h3>
              <p>
                A growing team navigating shared drives and wikis. A knowledge
                assistant helps surface the right page at the moment it is
                needed.
              </p>
              <p className="story-outcome">
                The goal: faster onboarding and fewer “where is that document?”
                questions.
              </p>
            </article>
            <article className="story">
              <h3>From manual operations to a connected workflow.</h3>
              <p>
                Operations teams copy information between tools every day. An
                agent workflow handles routine coordination and asks for help
                when judgment matters.
              </p>
              <p className="story-outcome">
                The goal: more time for edge cases, decisions, and higher-value
                work.
              </p>
            </article>
          </div>
        </div>
      </section>
      <ContactCTA />
    </main>
  );
}
