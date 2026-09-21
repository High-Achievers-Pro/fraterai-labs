"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Database,
  TreeStructure,
  Cube,
  ChartBar,
  ArrowRight,
  Check,
  FileText,
  ShieldCheck,
} from "@phosphor-icons/react";

const stages = [
  {
    title: "Data foundations",
    caption: "Unify & prepare",
    icon: Database,
    heading: "Good intelligence starts with good context.",
    text: "Connect documents, tools, and institutional knowledge into a foundation your team can trust.",
    steps: ["Connect sources", "Structure knowledge", "Set permissions"],
  },
  {
    title: "AI agents",
    caption: "Build & automate",
    icon: TreeStructure,
    heading: "Move the work forward, with people in control.",
    text: "Give agents a clear task, the right context, and a defined point to ask for human judgment.",
    steps: ["Understand request", "Route the task", "Human review"],
  },
  {
    title: "Integration",
    caption: "Deploy & connect",
    icon: Cube,
    heading: "Intelligence belongs where the work happens.",
    text: "Bring AI into the tools your team already uses, with access controls and observable workflows.",
    steps: ["Connect systems", "Validate controls", "Deploy workflow"],
  },
  {
    title: "Measurement",
    caption: "Learn & improve",
    icon: ChartBar,
    heading: "Make progress visible.",
    text: "Evaluate quality, follow operational outcomes, and use what you learn to improve the system.",
    steps: ["Evaluate quality", "Review outcomes", "Refine the system"],
  },
];

export default function OperatingModel() {
  const [selected, setSelected] = useState(0);
  const [keyboard, setKeyboard] = useState(false);
  const reduce = useReducedMotion();
  const stage = stages[selected];
  return (
    <div className="operating-model">
      <div className="model-header">
        <div>
          <h2>Your AI operating system</h2>
          <p>
            Strategy <ArrowRight aria-hidden /> Build <ArrowRight aria-hidden />{" "}
            Deploy <ArrowRight aria-hidden /> Scale
          </p>
        </div>
        <span className="model-label">Explore the model</span>
      </div>
      <div
        className="model-stages"
        role="tablist"
        aria-label="AI operating system stages"
      >
        {stages.map(({ title, caption, icon: Icon }, i) => (
          <button
            key={title}
            type="button"
            role="tab"
            id={`model-tab-${i}`}
            aria-selected={selected === i}
            aria-controls="model-panel"
            tabIndex={selected === i ? 0 : -1}
            onClick={(e) => {
              setKeyboard(e.detail === 0);
              setSelected(i);
            }}
            onKeyDown={(e) => {
              let next = i;
              if (e.key === "ArrowRight") next = (i + 1) % stages.length;
              else if (e.key === "ArrowLeft")
                next = (i + stages.length - 1) % stages.length;
              else if (e.key === "Home") next = 0;
              else if (e.key === "End") next = stages.length - 1;
              else return;
              e.preventDefault();
              setKeyboard(true);
              setSelected(next);
              document.getElementById(`model-tab-${next}`)?.focus();
            }}
          >
            <Icon size={29} weight="light" aria-hidden />
            <strong>{title}</strong>
            <span>{caption}</span>
            {selected === i && (
              <motion.span
                className="stage-underline"
                layoutId="stage-underline"
                transition={{
                  type: "spring",
                  bounce: 0,
                  duration: reduce || keyboard ? 0 : 0.28,
                }}
              />
            )}
          </button>
        ))}
      </div>
      <div
        id="model-panel"
        role="tabpanel"
        aria-labelledby={`model-tab-${selected}`}
        tabIndex={0}
        className="model-panel"
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={selected}
            initial={{ opacity: reduce || keyboard ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce || keyboard ? 0 : 0.18 }}
          >
            <h3>{stage.heading}</h3>
            <p>{stage.text}</p>
            <div className="workflow-example">
              <span>Illustrative workflow</span>
              <div>
                {stage.steps.map((step, i) => (
                  <span key={step}>
                    {i === 2 ? <Check size={15} /> : <FileText size={15} />}
                    {step}
                    {i < 2 && <ArrowRight size={14} className="flow-arrow" />}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="model-footer">
        <ShieldCheck size={16} aria-hidden /> Grounded in your knowledge. Built
        around your people.
      </div>
    </div>
  );
}
