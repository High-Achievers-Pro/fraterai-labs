"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Compass,
  Database,
  Cube,
  PlugsConnected,
  UsersThree,
  ChartBar,
  ArrowRight,
} from "@phosphor-icons/react";

export const processSteps = [
  {
    title: "Discover",
    icon: Compass,
    description:
      "Understand your goals, current workflows, and highest-value opportunities.",
    deliverable:
      "A shared understanding of the problem, success criteria, and a clear starting point.",
  },
  {
    title: "Organize",
    icon: Database,
    description:
      "Bring structure to your data, priorities, and implementation roadmap.",
    deliverable:
      "A practical roadmap, connected data foundations, and an agreed project timeline.",
  },
  {
    title: "Develop",
    icon: Cube,
    description: "Build the models, agents, and experiences with your team.",
    deliverable:
      "A working solution tested against real tasks, real data, and the people who use it.",
  },
  {
    title: "Deploy",
    icon: PlugsConnected,
    description:
      "Connect safely to your systems, identity, and operating environment.",
    deliverable:
      "An integrated production system with access controls, monitoring, and a release plan.",
  },
  {
    title: "Enable",
    icon: UsersThree,
    description:
      "Equip your people with the skills and ownership to move forward.",
    deliverable:
      "Training, documentation, and clear ownership so your team can operate with confidence.",
  },
  {
    title: "Measure",
    icon: ChartBar,
    description: "Track impact, improve quality, and identify what comes next.",
    deliverable:
      "A shared view of outcomes and an evidence-led plan for continuous improvement.",
  },
];

export default function ProcessExplorer() {
  const [active, setActive] = useState(0);
  const [keyboard, setKeyboard] = useState(false);
  const reduce = useReducedMotion();
  return (
    <div className="process-explorer">
      <div className="process-rail" aria-label="Explore our process">
        {processSteps.map(({ title, icon: Icon, description }, i) => (
          <button
            key={title}
            type="button"
            aria-pressed={active === i}
            aria-controls="process-deliverable"
            onClick={(e) => {
              setKeyboard(e.detail === 0);
              setActive(i);
            }}
          >
            <span className="process-number">{i + 1}</span>
            <Icon size={34} weight="light" aria-hidden />
            <h3>{title}</h3>
            <p>{description}</p>
            <ArrowRight className="process-arrow" size={18} aria-hidden />
          </button>
        ))}
      </div>
      <div
        className="process-deliverable"
        id="process-deliverable"
        aria-live="polite"
      >
        <span>What you leave with</span>
        <motion.p
          key={active}
          initial={{ opacity: keyboard || reduce ? 1 : 0.2 }}
          animate={{ opacity: 1 }}
          transition={{ duration: keyboard || reduce ? 0 : 0.22 }}
        >
          {processSteps[active].deliverable}
        </motion.p>
      </div>
    </div>
  );
}
