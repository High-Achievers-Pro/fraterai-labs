import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { SERVICE_DATA } from "@/lib/service-catalog";
import { PageHero, ContactCTA } from "@/components/marketing/Shared";
export function generateStaticParams() {
  return Object.keys(SERVICE_DATA).map((slug) => ({ slug }));
}
export default async function ServiceDetailRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = SERVICE_DATA[slug];
  if (!data) notFound();
  return (
    <main id="top">
      <PageHero
        label={`Services / ${data.subtitle}`}
        title={data.title}
        description={data.description}
      />
      <section className="detail-section">
        <div className="container detail-layout">
          <div className="detail-context">
            <Link href="/services" className="breadcrumb">
              <ArrowLeft size={16} aria-hidden />
              All services
            </Link>
            <h2>Designed around your operating reality.</h2>
            <p>
              We start with your goals, constraints, and existing workflow.
              Together, we define what success looks like and build a practical
              path to get there.
            </p>
            <div className="hero-actions">
              <Link href="/contact" className="btn btn-primary">
                Start a conversation
                <ArrowRight size={18} aria-hidden />
              </Link>
              <Link href="/process" className="btn btn-ghost">
                Our process
              </Link>
            </div>
          </div>
          <div className="detail-features">
            <h2>What we bring to the work</h2>
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
