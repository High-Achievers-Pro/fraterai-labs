"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ScrollRevealProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
    let observer: IntersectionObserver | undefined;
    const apply = () => {
      observer?.disconnect();
      if (preference.matches) {
        elements.forEach((el) =>
          el.getAnimations().forEach((animation) => animation.cancel()),
        );
        return;
      }
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.animate(
              [
                { opacity: 0.35, transform: "translateY(14px)" },
                { opacity: 1, transform: "translateY(0)" },
              ],
              { duration: 550, easing: "cubic-bezier(.23,1,.32,1)" },
            );
            observer?.unobserve(entry.target);
          });
        },
        { threshold: 0.12 },
      );
      elements.forEach((el) => observer?.observe(el));
    };
    apply();
    preference.addEventListener("change", apply);
    return () => {
      observer?.disconnect();
      preference.removeEventListener("change", apply);
      elements.forEach((el) =>
        el.getAnimations().forEach((animation) => animation.cancel()),
      );
    };
  }, [pathname]);
  return <>{children}</>;
}
