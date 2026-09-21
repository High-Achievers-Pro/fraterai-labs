import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { SOLUTION_DATA } from "@/lib/solution-catalog";
import { PageHero, ContactCTA } from "@/components/marketing/Shared";
export function generateStaticParams() {
  return Object.keys(SOLUTION_DATA).map((slug) => ({ slug }));
}
export default async function SolutionDetailRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = SOLUTION_DATA[slug];
  if (!data) notFound();
  return (
    <main id="top">
      <PageHero
        label="Turnkey capabilities"
        title={data.title}
        description={data.description}
        image="governance"
      />
      <section className="detail-section">
        <div className="container detail-layout">
          <div className="detail-context">
            <Link href="/solutions" className="breadcrumb">
              <ArrowLeft size={16} aria-hidden />
              All solutions
            </Link>
            <h2>
              A focused solution.
              <br />
              Built into your world.
            </h2>
            <p>
              Start with a proven capability, then configure it to your data,
              tools, and operating context. We work with your team on
              integration, evaluation, and adoption.
            </p>
            <div className="hero-actions">
              <Link href="/contact" className="btn btn-primary">
                Start a conversation
                <ArrowRight size={18} aria-hidden />
              </Link>
              <Link href="/services/ai-integration" className="btn btn-ghost">
                Explore integration
              </Link>
            </div>
          </div>
          <div className="detail-features">
            <h2>Included capabilities</h2>
            <ul className="benefit-list">
              {data.benefits.map((b) => (
                <li key={b}>
                  <Check size={17} aria-hidden />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <ContactCTA />
    </main>
  );
}
