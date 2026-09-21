import Link from "next/link";
import {
  ArrowRight,
  Compass,
  Flask,
  Database,
  TreeStructure,
  Sparkle,
  ChatCircle,
  Cube,
  Graph,
  GraduationCap,
  Brain,
  BookOpen,
  Headset,
  FileText,
} from "@phosphor-icons/react/dist/ssr";
import { Architecture } from "./Architecture";

export const serviceGroups = [
  {
    title: "Discover",
    description: "Find the opportunity. Define the value.",
    items: [
      {
        slug: "ai-strategy",
        title: "AI Strategy & Roadmap",
        description: "A clear path from ambition to a practical plan.",
        icon: Compass,
      },
      {
        slug: "ai-poc",
        title: "AI Proof of Concept",
        description: "Test your assumptions with real data and users.",
        icon: Flask,
      },
    ],
  },
  {
    title: "Organize",
    description: "Build on stronger data foundations.",
    items: [
      {
        slug: "data-engineering",
        title: "Data Engineering & BI",
        description: "Connect your data, infrastructure, and analytics.",
        icon: Database,
      },
      {
        slug: "ai-agents",
        title: "AI Agents & Automation",
        description: "Turn complex workflows into connected systems.",
        icon: TreeStructure,
      },
    ],
  },
  {
    title: "Develop",
    description: "Put the right intelligence to work.",
    items: [
      {
        slug: "llm-generative-ai",
        title: "LLM & Generative AI",
        description: "Apply language models to real business problems.",
        icon: Sparkle,
      },
      {
        slug: "chatbot-conversational-ai",
        title: "Conversational AI",
        description: "Helpful conversations grounded in your context.",
        icon: ChatCircle,
      },
      {
        slug: "machine-learning",
        title: "Machine Learning & CV",
        description: "Predict, recognize, and understand your data.",
        icon: Brain,
      },
    ],
  },
  {
    title: "Deploy & Enable",
    description: "Make it work. Make it yours.",
    items: [
      {
        slug: "ai-native-product",
        title: "AI-Native Product Engineering",
        description: "Production-ready products built around your team.",
        icon: Cube,
      },
      {
        slug: "ai-integration",
        title: "AI Integration Services",
        description: "Connect AI to your existing tools and systems.",
        icon: Graph,
      },
      {
        slug: "ai-enablement",
        title: "AI Training & Teams",
        description: "The skills and ownership to keep moving forward.",
        icon: GraduationCap,
      },
    ],
  },
];

export function TextLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link className="text-link" href={href}>
      {children}
      <ArrowRight size={19} aria-hidden />
    </Link>
  );
}

export function ServicesGrid() {
  return (
    <div className="services-grid">
      {serviceGroups.map((group, i) => (
        <div className="service-group" key={group.title}>
          <span className="sequence">0{i + 1}</span>
          <h3>{group.title}</h3>
          <p className="group-intro">{group.description}</p>
          <div className="service-links">
            {group.items.map(({ slug, title, description, icon: Icon }) => (
              <Link
                className="service-link"
                key={slug}
                href={`/services/${slug}`}
              >
                <Icon size={30} weight="light" aria-hidden />
                <span>
                  <strong>{title}</strong>
                  <span>{description}</span>
                </span>
                <ArrowRight className="service-arrow" size={17} aria-hidden />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageHero({
  label,
  title,
  description,
  image = "arcade",
}: {
  label: string;
  title: string;
  description: string;
  image?: string;
}) {
  return (
    <section className="page-hero">
      <Architecture name={image} />
      <div className="container">
        <div className="page-hero-copy">
          <p className="eyebrow">{label}</p>
          <h1>{title}</h1>
          <p className="lead">{description}</p>
        </div>
      </div>
    </section>
  );
}

export function ContactCTA() {
  return (
    <section className="closing-section" id="contact">
      <Architecture name="conversation" />
      <div className="container">
        <div className="closing-copy">
          <p className="eyebrow">From ideas to impact</p>
          <h2>
            Tell us what you’re
            <br className="desktop-break" /> trying to improve.
          </h2>
          <p>
            Share a little about your team, your context, and your goals. We’ll
            work out a practical next step together.
          </p>
          <Link href="/contact" className="btn btn-primary">
            Start a conversation <ArrowRight size={19} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

export const solutionItems = [
  {
    slug: "document-processing",
    title: "AI Document Processing",
    description: "Turn documents into structured, useful data.",
    icon: FileText,
  },
  {
    slug: "knowledge-base",
    title: "AI-Powered Knowledge Base",
    description: "Your institutional knowledge, ready with an answer.",
    icon: BookOpen,
  },
  {
    slug: "customer-experience",
    title: "AI-Driven Customer Experience",
    description: "Faster answers. Thoughtful human handoffs.",
    icon: Headset,
  },
];

export function SolutionsLinks() {
  return (
    <div className="solution-links">
      {solutionItems.map(({ slug, title, description, icon: Icon }) => (
        <Link key={slug} href={`/solutions/${slug}`}>
          <Icon size={33} weight="light" aria-hidden />
          <h3>{title}</h3>
          <p>{description}</p>
          <ArrowRight size={22} aria-hidden />
        </Link>
      ))}
    </div>
  );
}
