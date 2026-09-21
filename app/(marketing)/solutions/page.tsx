import { Check } from "@phosphor-icons/react/dist/ssr";
import {
  PageHero,
  ContactCTA,
  TextLink,
  solutionItems,
} from "@/components/marketing/Shared";
import { SOLUTION_DATA } from "@/lib/solution-catalog";
export default function Solutions() {
  return (
    <main id="top">
      <PageHero
        label="Our solutions"
        title="Practical capabilities. Ready for real work."
        description="Focused AI solutions for document processing, institutional knowledge, and customer experience. Configured around your organization."
        image="governance"
      />
      <section className="section" id="solutions-catalog">
        <div className="container solution-catalog">
          {solutionItems.map(({ slug, title, icon: Icon }) => (
            <article className="solution-entry" key={slug}>
              <Icon size={48} weight="light" aria-hidden />
              <div>
                <h2>{title}</h2>
                <p>{SOLUTION_DATA[slug].description}</p>
                <TextLink href={`/solutions/${slug}`}>
                  Explore solution
                </TextLink>
              </div>
              <ul className="benefit-list">
                {SOLUTION_DATA[slug].benefits.map((b) => (
                  <li key={b}>
                    <Check size={16} aria-hidden />
                    {b}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
      <ContactCTA />
    </main>
  );
}
