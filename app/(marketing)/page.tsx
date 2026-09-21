import Link from "next/link";
import {
  ArrowRight,
  Buildings,
  UsersThree,
  Headset,
  ChartBar,
  Database,
  ShieldCheck,
  LockKey,
  UserCheck,
  FileMagnifyingGlass,
  PlugsConnected,
  SlidersHorizontal,
  Infinity,
} from "@phosphor-icons/react/dist/ssr";
import { Architecture } from "@/components/marketing/Architecture";
import {
  ServicesGrid,
  ContactCTA,
  SolutionsLinks,
  TextLink,
} from "@/components/marketing/Shared";
import OperatingModel from "@/components/marketing/OperatingModel";
import ProcessExplorer from "@/components/marketing/ProcessExplorer";

const audiences = [
  {
    label: "Operations leaders",
    title: "Remove friction from critical workflows.",
    text: "Reduce manual coordination and give your teams more time for higher-value work.",
    href: "/services/ai-agents",
  },
  {
    label: "Customer experience",
    title: "Resolve more. Escalate with care.",
    text: "Connect the right answers, better routing, and human judgment across every channel.",
    href: "/solutions/customer-experience",
  },
  {
    label: "Finance & back office",
    title: "Turn repetitive work into reliable systems.",
    text: "Bring structure and consistency to document-heavy financial and operational processes.",
    href: "/solutions/document-processing",
  },
  {
    label: "Data & IT teams",
    title: "Deploy AI with control and clarity.",
    text: "Build governed data foundations and secure integrations that fit your business.",
    href: "/services/data-engineering",
  },
];
const controls = [
  {
    icon: ShieldCheck,
    title: "Secure deployment",
    text: "Integrate with your operating environment.",
  },
  {
    icon: LockKey,
    title: "Access control",
    text: "Connect identity and role-based permissions.",
  },
  {
    icon: UserCheck,
    title: "Human oversight",
    text: "Keep judgment where it belongs.",
  },
  {
    icon: FileMagnifyingGlass,
    title: "Observability",
    text: "See how your workflows are performing.",
  },
  {
    icon: Database,
    title: "Data governance",
    text: "Build on your institutional knowledge.",
  },
  {
    icon: SlidersHorizontal,
    title: "Model evaluation",
    text: "Test quality against real work.",
  },
  {
    icon: PlugsConnected,
    title: "API integrations",
    text: "Work with your existing tools and data.",
  },
  {
    icon: Infinity,
    title: "Team ownership",
    text: "The skills and code to keep evolving.",
  },
];

export default function Home() {
  return (
    <main id="top">
      <section className="home-hero">
        <Architecture name="library" className="hero-architecture" preload />
        <div className="container hero-layout">
          <div className="hero-copy">
            <p className="eyebrow hero-enter">AI for real operators</p>
            <h1 className="hero-enter">
              Your next business
              <br />
              advantage, built with AI.
            </h1>
            <p className="hero-description hero-enter">
              Strategic clarity, operator-level expertise, and disciplined
              engineering. We turn AI and machine learning into measurable
              progress for your business.
            </p>
            <div className="hero-actions hero-enter">
              <Link href="/contact" className="btn btn-primary">
                Start a conversation
              </Link>
              <Link href="/services" className="btn btn-ghost">
                Explore services
                <ArrowRight size={19} aria-hidden />
              </Link>
            </div>
            <div className="hero-principles">
              <div>
                <span>Practical by design</span>
                <strong>Real workflows</strong>
              </div>
              <div>
                <span>Built to deliver</span>
                <strong>Pilot to production</strong>
              </div>
              <div>
                <span>Made to last</span>
                <strong>With your team</strong>
              </div>
            </div>
          </div>
          <div className="hero-model">
            <div className="margin-note" aria-hidden>
              Practical AI.
              <br />
              Lasting impact.
              <span />
            </div>
            <OperatingModel />
          </div>
        </div>
      </section>
      <div className="audience-strip">
        <div className="container">
          {[
            { icon: Buildings, text: "Mid-market operators", href: "/about" },
            {
              icon: UsersThree,
              text: "Operations teams",
              href: "/services/ai-agents",
            },
            {
              icon: Headset,
              text: "Customer experience",
              href: "/solutions/customer-experience",
            },
            {
              icon: ChartBar,
              text: "Finance & back office",
              href: "/solutions/document-processing",
            },
            {
              icon: Database,
              text: "Data platforms",
              href: "/services/data-engineering",
            },
          ].map(({ icon: Icon, text, href }) => (
            <Link key={text} href={href}>
              <Icon size={31} weight="light" aria-hidden />
              <span>{text}</span>
            </Link>
          ))}
        </div>
      </div>
      <section className="expertise-section section" id="services">
        <div className="container">
          <div className="section-intro with-art">
            <Architecture name="arcade" />
            <div data-reveal>
              <p className="eyebrow">Comprehensive expertise</p>
              <h2>
                From strategy to deployment,
                <br className="desktop-break" /> built around real workflows.
              </h2>
              <p>
                We bring strategic clarity, operator-level expertise, and deep
                engineering capability to the work that matters to your team.
              </p>
            </div>
          </div>
          <ServicesGrid />
          <div className="principles-band" id="principles">
            <div>
              <span className="eyebrow">Platform principles</span>
              <h3>
                A foundation for
                <br />
                lasting impact.
              </h3>
            </div>
            <div className="principles-list">
              {[
                [
                  "Experience Orchestration",
                  "People, data, and AI working together in intuitive workflows.",
                ],
                [
                  "Knowledge Layer",
                  "The right context, grounded in your institutional knowledge.",
                ],
                [
                  "Interaction Philosophy",
                  "Useful, trustworthy experiences that keep people in control.",
                ],
                [
                  "Modern Composition",
                  "Built to integrate, extend, and evolve with your team.",
                ],
              ].map(([title, text], i) => (
                <div key={title}>
                  <span>0{i + 1}</span>
                  <div>
                    <h4>{title}</h4>
                    <p>{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="section audience-section" id="teams">
        <div className="container">
          <div className="section-intro" data-reveal>
            <h2>
              Built for teams with real workflows.
              <br className="desktop-break" /> And real outcomes to deliver.
            </h2>
            <p>
              Practical intelligence for the people turning everyday work into
              meaningful progress.
            </p>
          </div>
          <div className="audience-cards">
            {audiences.map((a, i) => (
              <Link className="audience-card" key={a.label} href={a.href}>
                <div className="audience-card-copy">
                  <span className="eyebrow">{a.label}</span>
                  <ArrowRight
                    size={20}
                    className="audience-arrow"
                    aria-hidden
                  />
                  <h3>{a.title}</h3>
                  <p>{a.text}</p>
                </div>
                <div
                  className={`audience-portrait portrait-${i}`}
                  aria-hidden
                />
              </Link>
            ))}
          </div>
          <div className="audience-caption">
            <span>People. Process. AI.</span>
            <TextLink href="/solutions">Explore solutions</TextLink>
          </div>
        </div>
      </section>
      <section className="section governance-section" id="enterprise">
        <div className="container">
          <div className="governance-grid">
            <div className="governance-copy" data-reveal>
              <p className="eyebrow">Built for enterprise adoption</p>
              <h2>
                Confidence,
                <br />
                by architecture.
              </h2>
              <p>
                Production AI needs more than a good model. We bring together
                secure infrastructure, thoughtful governance, and integration
                with the way your organization works.
              </p>
              <TextLink href="/services/ai-integration">
                Explore our approach
              </TextLink>
              <Architecture name="governance" />
            </div>
            <div className="controls-grid">
              {controls.map(({ icon: Icon, title, text }) => (
                <div key={title}>
                  <Icon size={36} weight="light" aria-hidden />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="turnkey-row">
            <div>
              <h3>
                Practical capabilities.
                <br />A stronger starting point.
              </h3>
              <p>Focused solutions for common operational challenges.</p>
            </div>
            <SolutionsLinks />
          </div>
        </div>
      </section>
      <section className="section process-section" id="process">
        <div className="container">
          <div className="section-intro with-art">
            <Architecture name="process" />
            <div data-reveal>
              <h2>
                A practical path from
                <br className="desktop-break" /> strategy to working systems.
              </h2>
              <p>
                Clear priorities. Disciplined engineering. A team that works
                with yours, from the first conversation to continuous
                improvement.
              </p>
              <TextLink href="/process">Our process in detail</TextLink>
            </div>
          </div>
          <ProcessExplorer />
        </div>
      </section>
      <ContactCTA />
    </main>
  );
}
