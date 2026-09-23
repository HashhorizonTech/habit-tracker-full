# Handoff: Tend — Habit Tracker + Focus + Productivity app

## Overview
Tend ("Build better days") is a mobile-first app that combines habit tracking, a Pomodoro focus timer, lightweight tasks, a productivity calendar, mood tracking, analytics and gentle gamification (XP, levels, badges, non-punitive streaks). It has 8 colour themes, each with light, dark and system modes. It is responsive and switches to a sidebar layout on desktop.

## About the design files
The files in `design/` are **design references built in HTML**. They are a working prototype of the intended look, flow and behaviour, **not production code to copy**. Your job is to **recreate them in the target stack** (recommended: Expo / React Native + TypeScript, Reanimated, react-native-svg, Zustand; see `SPEC.md` §0) using that stack's normal patterns.

**How to view the prototype:** open `design/Tend App.dc.html` in a browser, served from the folder (e.g. `npx serve design`). It needs `support.js` and `Mascot.dc.html` next to it.
- The **left panel** jumps to every screen and state, switches **Data state** (Live / Empty / Loading / Error), **Theme** (8) and **Mode** (Light / Dark / System), and can finish a focus session instantly.
- Tweakable props: `device` = `phone` | `desktop` (desktop shows the sidebar layout), `startAt` = `splash` | `home`, `fastTimer`.
- All logic lives in the `class Component` script at the bottom of `Tend App.dc.html`. That's the source of truth for data, formulas (theme generator, day %, streak and heatmap generation, chart data) and interaction rules.

## Fidelity
**High fidelity.** Colours, type, spacing, radii, copy, motion timings and interactions are final. Recreate them pixel-close with native components.

## Where everything is specified
`SPEC.md` is the full, self-sufficient implementation spec:
- §1 Design tokens: fonts, type scale, spacing, radius, and the OKLCH theme generator with all 8 themes.
- §2 Mascot and mood-face illustration system.
- §3 Navigation (floating tab bar with sliding indicator; desktop sidebar).
- §4 Every screen, with its layout, components, exact copy and behaviour (4.1 Splash … 4.19 System states).
- §5 Motion spec (durations, easings, springs, reduce-motion).
- §6 Data model and derived selectors.
- §7 Accessibility and performance bar.
- §8 Build order.

## Screen / flow map
```
Splash ─▶ Onboarding (5 slides) ─▶ Goals ─▶ First habit ─▶ Home
Home ── dial ─▶ Insights        ── streak ─▶ Streak sheet
     ── mood face ─▶ Mood sheet ── habit row ─▶ Habit detail
     ── check button ─▶ complete (burst, toast, XP) ─▶ all done ─▶ "Perfect Day" modal
     ── focus card ─▶ Focus (auto-start)   ── Up next ─▶ Tasks
     ── calendar icon ─▶ Calendar ─▶ Day sheet   ── Evening recap ─▶ Daily summary
     ── "+" ─▶ Create habit sheet
Habits ── category chips / rows / "+ New"
Focus  ── start ─▶ immersive running ─▶ Session complete modal ─▶ break
Tasks  ── ⋯ ─▶ Focus on this / Make it a habit / Delete
Insights ── Habits | Focus tabs × 7D / 30D / 3M / 1Y
You ─▶ Achievements (badge ─▶ unlock modal), Calendar, Summary, Themes, Notifications, Settings
```

## Key design tokens (quick reference; full list in SPEC §1)
- Fonts: **Bricolage Grotesque** (display/numbers) and **Figtree** (UI/body).
- Default theme: Aurora dark. `bg oklch(0.17 0.042 275)`, `a1 oklch(0.70 0.17 290)`, `a2 oklch(0.74 0.13 230)`, `ink oklch(0.97 0.01 275)`.
- Flame `oklch(0.76 0.16 52)`. Habit colour = `oklch(0.74 0.13 <hue>)`.
- Spacing 4/8/12/16/20/24/32/40 · Radius 10/16/24/34/pill.
- Main easing `cubic-bezier(.2,.8,.2,1)`; spring overshoot `cubic-bezier(.34,1.6,.5,1)`.

## Assets
- There are no raster images. All illustrations are built in code: the **Mascot** (`design/Mascot.dc.html`, drawn from CSS shapes with props `size`, `face`, `accessory`, `float`) and the mood faces (SVG, defined as `MOODS` in the logic).
- Icons are inline 24px line paths, listed in the `I` object in the logic class. Swap in Lucide equivalents.
- Fonts come from Google Fonts.

## Files
- `design/Tend App.dc.html`: the full prototype (all screens, states and logic).
- `design/Mascot.dc.html`: the illustration component.
- `design/support.js`: the runtime needed to open the prototype.
- `SPEC.md`: the complete build spec / prompt.
