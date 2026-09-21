"use client";

import React, { useState } from "react";
import { useCalendly, CalendlyPrefill } from "./CalendlyContext";

interface CalendlyInlineProps {
  url?: string;
  height?: string;
  prefillOverride?: CalendlyPrefill;
}

export default function CalendlyInline({
  url,
  height = "750px",
  prefillOverride,
}: CalendlyInlineProps) {
  const { calendlyUrl, prefill: contextPrefill } = useCalendly();
  const [isLoading, setIsLoading] = useState(true);

  const activeUrl = url || calendlyUrl;
  const activePrefill = { ...contextPrefill, ...prefillOverride };

  const buildEmbedUrl = () => {
    try {
      const urlObj = new URL(activeUrl);
      urlObj.searchParams.set("hide_landing_page_details", "1");
      urlObj.searchParams.set("hide_gdpr_banner", "1");
      urlObj.searchParams.set("primary_color", "244f7a");

      if (activePrefill.name)
        urlObj.searchParams.set("name", activePrefill.name);
      if (activePrefill.email)
        urlObj.searchParams.set("email", activePrefill.email);
      if (activePrefill.subject || activePrefill.company) {
        const customText = [activePrefill.subject, activePrefill.company]
          .filter(Boolean)
          .join(" - ");
        urlObj.searchParams.set("a1", customText);
      }

      return urlObj.toString();
    } catch {
      return activeUrl;
    }
  };

  const embedUrl = buildEmbedUrl();

  return (
    <div
      className="calendly-inline-wrapper"
      style={{
        position: "relative",
        width: "100%",
        height: height,
        borderRadius: "2px",
        overflow: "hidden",
        border: "1px solid #dce0e2",
        background: "#faf9f6",
      }}
    >
      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#faf9f6",
            color: "#5f6874",
            zIndex: 1,
            gap: "1rem",
          }}
        >
          <div
            role="status"
            aria-label="Loading calendar"
            style={{
              width: "40px",
              height: "40px",
              border: "2px solid #dce0e2",
              borderTopColor: "#244f7a",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          ></div>
          <span style={{ fontSize: "0.9rem", letterSpacing: "0.05em" }}>
            Loading your booking calendar…
          </span>
        </div>
      )}

      <a
        href={activeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="calendar-fallback"
      >
        Open scheduling in a new tab ↗
      </a>
      <iframe
        src={embedUrl}
        width="100%"
        height="100%"
        frameBorder="0"
        title="Schedule a Call - Calendly"
        onLoad={() => setIsLoading(false)}
        style={{ border: "none", width: "100%", height: "100%", minWidth: "0" }}
      ></iframe>

      <style jsx global>{`
        @media (prefers-reduced-motion: reduce) {
          .calendly-inline-wrapper [role="status"] {
            animation: none !important;
          }
        }
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
