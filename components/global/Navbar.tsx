"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CaretDown, List, X, ArrowRight } from "@phosphor-icons/react";

const serviceLinks = [
  ["AI Strategy & Roadmap", "ai-strategy"],
  ["AI Proof of Concept", "ai-poc"],
  ["Data Engineering & BI", "data-engineering"],
  ["AI Agents & Automation", "ai-agents"],
  ["LLM & Generative AI", "llm-generative-ai"],
  ["Chatbot & Conversational AI", "chatbot-conversational-ai"],
  ["AI-Native Product Engineering", "ai-native-product"],
  ["Machine Learning & CV", "machine-learning"],
  ["AI Integration Services", "ai-integration"],
  ["AI Training & Teams", "ai-enablement"],
];
const solutionLinks = [
  ["AI Document Processing", "document-processing"],
  ["AI-Powered Knowledge Base", "knowledge-base"],
  ["AI-Driven Customer Experience", "customer-experience"],
];

function Navigation() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [submenu, setSubmenu] = useState<string | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const close = () => {
    setMobileOpen(false);
    setSubmenu(null);
  };

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const media = matchMedia("(min-width: 1100px)");
    const onResize = () => {
      if (media.matches) setMobileOpen(false);
    };
    media.addEventListener("change", onResize);
    return () => {
      document.body.style.overflow = previous;
      media.removeEventListener("change", onResize);
    };
  }, [mobileOpen]);
  useEffect(() => {
    const clickOutside = (e: PointerEvent) => {
      if (!header.current?.contains(e.target as Node)) setSubmenu(null);
    };
    document.addEventListener("pointerdown", clickOutside);
    return () => document.removeEventListener("pointerdown", clickOutside);
  }, []);

  return (
    <header
      ref={header}
      className="site-header"
      data-keyboard={keyboard}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          if (submenu) {
            document.getElementById(`toggle-${submenu}`)?.focus();
            setSubmenu(null);
          } else {
            close();
            toggle.current?.focus();
          }
        }
        if (e.key === "Tab" && mobileOpen) {
          const focusable = Array.from(
            header.current?.querySelectorAll<HTMLElement>("a[href], button") ??
              [],
          ).filter((el) => el.getClientRects().length);
          const first = focusable[0],
            last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
    >
      <div className="container header-inner">
        <Link href="/" className="brand" onClick={close}>
          <Image
            src="/brand/fraterai-logo.svg"
            alt="FraterAI"
            width={200}
            height={42}
            className="brand-logo"
            loading="eager"
          />
        </Link>
        <button
          ref={toggle}
          className="mobile-toggle"
          onClick={(e) => {
            setKeyboard(e.detail === 0);
            setMobileOpen(!mobileOpen);
          }}
          aria-expanded={mobileOpen}
          aria-controls="primary-navigation"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X size={24} /> : <List size={24} />}
        </button>
        <nav
          className={`nav ${mobileOpen ? "nav-open" : ""}`}
          id="primary-navigation"
          aria-label="Main navigation"
        >
          <Link
            href="/"
            aria-current={pathname === "/" ? "page" : undefined}
            onClick={close}
          >
            Home
          </Link>
          {["Services", "Process", "Solutions", "Resources", "About"].map(
            (label) => {
              const key = label.toLowerCase();
              const links =
                key === "services"
                  ? serviceLinks
                  : key === "solutions"
                    ? solutionLinks
                    : null;
              return links ? (
                <div
                  className="nav-item"
                  key={key}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node))
                      setSubmenu(null);
                  }}
                >
                  <div className="nav-label">
                    <Link
                      href={`/${key}`}
                      aria-current={
                        pathname.startsWith(`/${key}`) ? "page" : undefined
                      }
                      onClick={close}
                    >
                      {label}
                    </Link>
                    <button
                      id={`toggle-${key}`}
                      aria-label={`Show ${key}`}
                      aria-expanded={submenu === key}
                      aria-controls={`menu-${key}`}
                      onClick={(e) => {
                        setKeyboard(e.detail === 0);
                        setSubmenu(submenu === key ? null : key);
                      }}
                    >
                      <CaretDown size={13} aria-hidden />
                    </button>
                  </div>
                  <div
                    className="mega-menu"
                    id={`menu-${key}`}
                    hidden={submenu !== key}
                  >
                    <div>
                      <span className="menu-heading">{label}</span>
                      <p>
                        {key === "services"
                          ? "From the first question to a working system."
                          : "Purpose-built for the work in front of you."}
                      </p>
                      <Link
                        href={`/${key}`}
                        className="text-link"
                        onClick={close}
                      >
                        Explore {key}
                        <ArrowRight size={18} />
                      </Link>
                    </div>
                    <ul>
                      {links.map(([title, slug]) => (
                        <li key={slug}>
                          <Link href={`/${key}/${slug}`} onClick={close}>
                            {title}
                            <ArrowRight size={15} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <Link
                  href={`/${key}`}
                  key={key}
                  aria-current={pathname === `/${key}` ? "page" : undefined}
                  onClick={close}
                >
                  {label}
                </Link>
              );
            },
          )}
          <Link
            href="/contact"
            className="btn btn-primary nav-cta"
            onClick={close}
          >
            Start a conversation
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  return <Navigation key={pathname} />;
}
