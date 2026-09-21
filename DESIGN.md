---
name: FraterAI public website
description: Academic blue engraving on warm paper with editorial typography.
colors:
  paper: "#faf9f6"
  secondary-surface: "#f2f3f3"
  elevated-surface: "#fffefa"
  ink: "#17212b"
  muted-text: "#5f6874"
  academic-blue: "#244f7a"
  muted-blue: "#6583a0"
  divider: "#dce0e2"
typography:
  display:
    fontFamily: "Libre Caslon Display, Georgia, serif"
    fontSize: "clamp(48px, 5.2vw, 76px)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Libre Caslon Display, Georgia, serif"
    fontSize: "clamp(39px, 4vw, 58px)"
    fontWeight: 400
    lineHeight: 1.06
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Libre Caslon Display, Georgia, serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  editorial-label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.18em"
rounded:
  control: "2px"
spacing:
  compact: "8px"
  standard: "16px"
  spacious: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "12px 25px"
  button-primary-hover:
    backgroundColor: "{colors.academic-blue}"
  button-ghost:
    textColor: "{colors.academic-blue}"
    rounded: "{rounded.control}"
    padding: "12px 25px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
---

## Overview

**Creative North Star: "Knowledge in practice"**

The public website pairs original academic architecture engravings with warm paper, blue ink, and editorial serif typography. The user's supplied mockups establish this visual language, including small blue labels and square cards. This system applies to marketing routes; the portal retains its existing design.

**Key Characteristics:**
- Original university architecture with fine engraved detail.
- Large serif statements paired with quiet sans-serif explanations.
- Fine dividers, square controls, and deliberate whitespace.
- Motion explains state and hierarchy without persistent decorative loops.

## Colors

Academic blue identifies actions, icons, and selected states. Ink carries headings and primary buttons. Paper is the page ground; the elevated surface supports the operating model and contact form. Muted text remains darker than dividers and secondary blue.

**The One Ink Rule.** Illustrations use blue engraving on paper; avoid government symbols and unrelated colorful imagery.

## Typography

Libre Caslon Display provides the display, headline, and title hierarchy. DM Sans carries body text, navigation, controls, and labels. Both fonts are served through Next.js font optimization.

The landing headline uses its own observed scale: `clamp(46px, 4.75vw, 70px)` at desktop and `clamp(42px, 8.2vw, 62px)` on mobile. Supporting routes inherit the base hierarchy with responsive overrides. Preserve semantic headings and natural wrapping; do not flatten every role into the same size.

## Layout

The main container is capped at 1328px with 48px desktop side gutters. Below 1250px, gutters narrow; mobile uses 20px gutters and the smallest screens use an additional compact adjustment. Major sections have 80px vertical padding, reducing to 48px on mobile.

Navigation collapses below 1100px. Service and audience grids adapt through tablet layouts and stack below 768px. Mobile process stages remain a horizontally scrollable rail. Illustrations beside introductions move below their copy on mobile. Service cards reserve space for their action arrows.

## Elevation & Depth

Most surfaces use a fine divider or a subtle tonal difference. The operating model is deliberately lifted over the architectural illustration using `0 5px 35px rgb(29 56 79 / .13)`. Artwork fades into paper through CSS masks; decorative imagery does not receive pointer input.

## Shapes

Controls and cards have nearly square corners. Circles identify ordered process steps and selected markers. Preserve architectural silhouettes and engraved edges rather than framing illustrations as conventional photo cards.

## Components

Primary buttons use ink on paper; hover shifts their fill to academic blue. Secondary buttons use a fine blue outline. Focus-visible states have a 2px blue outline with a 4px offset. Press feedback scales to .98 over 120ms; precise-pointer arrow movement is 3px over 180ms.

Inputs use paper, a neutral border, visible labels, and blue focus treatment. Error text is red; pending actions are disabled. The existing contact integration and scheduling URL remain the behavioral source of truth.

Navigation uses explicit disclosure buttons, Escape dismissal, and mobile focus handling. Pointer menus enter from their top edge over 180ms; keyboard disclosure is immediate.

The operating model uses semantic tabs, arrow/Home/End keyboard navigation, a 180ms content crossfade, and a 280ms spring selection indicator with zero bounce. Keyboard and reduced-motion changes are immediate. The process explorer changes the outcome explanation over 220ms.

Hero copy enters over 650ms with a 50ms stagger; the model enters over 750ms after 100ms; the engraving enters over 1000ms. Section reveals run once per route over 550ms. Reduced-motion preferences remove translation and decorative animation. Content remains visible without JavaScript.

## Do's and Don'ts

- Do use the supplied academic engraving language and preserve product truth.
- Do retain visible focus states, semantic controls, and readable mobile spacing.
- Do use motion to explain a user action or the reading hierarchy.
- Don't turn illustrative people or workflow data into customer proof.
- Don't add permanent animated counters, floating buildings, or magnetic form controls.
- Don't apply this marketing stylesheet to the portal.
