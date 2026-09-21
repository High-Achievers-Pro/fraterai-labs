import {
  PageHero,
  ServicesGrid,
  ContactCTA,
} from "@/components/marketing/Shared";
export default function Services() {
  return (
    <main id="top">
      <PageHero
        label="Our services"
        title="From strategic clarity to working intelligence."
        description="Strategy, engineering, and team enablement. The expertise to bring AI into your real workflows, from first idea to production."
      />
      <section className="section" id="services">
        <div className="container">
          <ServicesGrid />
        </div>
      </section>
      <ContactCTA />
    </main>
  );
}
