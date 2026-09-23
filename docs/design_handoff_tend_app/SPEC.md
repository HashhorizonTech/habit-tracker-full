# Build "Tend" — Habit Tracker + Focus + Productivity app

You are building a production-quality app called **Tend** ("Build better days"). I'm attaching screenshots of the approved design. Match them closely: layout, spacing, type, colour, motion. Where a screenshot and this document disagree, the screenshot wins for visuals and this document wins for behaviour.

## 0. Stack (use this unless I say otherwise)
- **Expo (React Native) + TypeScript**, Expo Router, one codebase for iOS, Android and web.
- **react-native-reanimated 3** + **react-native-gesture-handler** for all motion and gestures.
- **react-native-svg** for rings, charts and icons.
- **Zustand** for state, persisted to **AsyncStorage** (MMKV later). Local-first; no backend in v1.
- **expo-haptics**, **expo-notifications**, **expo-font** (Bricolage Grotesque + Figtree from Google Fonts).
- Before you write code: propose the folder structure, then build it screen by screen. After each screen, run it and fix type errors.

## 1. Design tokens (build these first, as a `theme/` module)
**Fonts**
- Display / numbers: *Bricolage Grotesque* 600–800, letter-spacing -0.02 to -0.04em. Use tabular numbers.
- Body / UI: *Figtree* 400–700.
- Scale: Display 44 · H1 30 · H2 20 · Subhead 17/600 · Body 15 · Caption 11.5 uppercase +0.1em tracking/700 · Big numbers 46–66.

**Spacing:** 4, 8, 12, 16, 20, 24, 32, 40. Screen side padding is 20 on mobile and 44 on desktop.

**Radius:** sm 10 · md 16 · lg 24 · xl 34 (sheets and modals) · pill 999.

**Colour system.** Every theme is generated from a base hue plus two accent colours, all in OKLCH (convert to hex/rgba at build time with `culori`). Tokens:
`page, bg, bg2, surface (translucent), surface2, sheet, ink, ink2, ink3, line, track, a1 (primary), a2 (secondary), a1ink (text on a1), a1text (a1 used as text), a1soft (a1 at ~18% alpha), a2soft, glow (a1 at ~40% alpha)`.

Dark formula: `bg = L0.17 C(c·1.2) H`, `surface2 = L0.26`, `ink = L0.97`, `ink2 = L0.80`, `ink3 = L0.66`, `line = white 8%`.
Light formula: `bg = L0.975`, `surface = white 75%`, `ink = L0.22`, `ink2 = L0.42`, `ink3 = L0.52`, `line = ink 10%`.
`a1ink = L0.20 C0.05 (a1 hue)`.

**8 themes** (base hue / chroma · a1 · a2):
| Theme | base | a1 | a2 |
|---|---|---|---|
| Aurora (default, dark) | 275 / .035 | oklch(.70 .17 290) | oklch(.74 .13 230) |
| Mint | 165 / .025 | (.76 .12 168) | (.86 .10 115) |
| Sunset | 45 / .03 | (.74 .15 48) | (.72 .16 12) |
| Lavender | 300 / .03 | (.70 .15 300) | (.80 .10 330) |
| Ocean | 232 / .035 | (.70 .14 245) | (.80 .12 200) |
| Minimal | 260 / 0 | black / white (flips with mode) | gray |
| Forest | 150 / .025 | (.64 .11 152) | (.82 .08 110) |
| Candy | 345 / .03 | (.74 .15 350) | (.76 .12 265) |

Modes are **Light / Dark / System**. Switching theme or mode animates colours over about 400 ms, with no reload.

**Fixed colours**
- Streak flame: `oklch(.76 .16 52)`, the same in every theme.
- Habit colours: `oklch(.74 .13 hue)`. The icon tile is the same colour at 18% alpha, and the icon uses a darker or lighter text version. In the Minimal theme, habit chroma is multiplied by 0.3.
- Priority: high `oklch(.7 .17 25)`, medium `(.8 .14 80)`, low `(.72 .1 235)`.
- Positive delta: `oklch(.78 .14 150)`.

**Icons:** a 24px line icon set, stroke 1.9, round caps and joins (Lucide is fine). Use no emoji in the UI.

## 2. Mascot / illustration system
One mascot, a soft **blob sprout** built as a reusable `<Mascot size face accessory float />` component (SVG or RN views):
- Body: an egg-shaped blob with a radial gradient from a2 (highlight at top-left) to a1, plus a soft inner shadow. A small green leaf and stem sit on top.
- Faces: `happy` (oval eyes, small smile), `wow` (big eyes with highlight, O-mouth), `sleepy` (closed ∪ eyes), `focus` (flat-line eyes). Pink blush on the cheeks.
- Accessories: `star`, `moon` (with little "z"s), `sun`, `sparkle`, `coffee` (steaming cup), `none`.
- Idle float: translateY 0 → -6 → 0 over 4 s. Accessories twinkle.
- Used in: splash-adjacent onboarding, empty states, error state, the focus-complete modal, the achievement modal, mood saved, daily summary, level hero.

**Mood faces:** five SVG circle faces (40 viewBox): Great (hue 85), Good (150), Okay (235), Low (285), Exhausted (25, closed eyes and wavy mouth). The face fills with the pale hue colour; eyes and mouth use a dark version of the same hue.

## 3. Navigation
- **Mobile:** a floating bottom tab bar, inset 16 from the sides and 22 from the bottom, 68 high, radius 26, frosted `sheet` background at 82% with a blur. Tabs: **Today, Habits, Focus, Insights, You**. The active tab has an a1 pill indicator that *slides* between tabs on a spring (overshoot ~1.4), and the active icon scales to 1.08 with a bounce.
- Pushed screens (Tasks, Calendar, Habit detail, Achievements, Summary, Settings, Themes, Notifications) hide the tab bar and show a 44px round back button.
- **Desktop (≥1000px):** a 248px left sidebar (logo, nav: Today, Habits, Focus, Tasks, Calendar, Insights, Achievements, Profile; a level/XP card and a "New habit" button at the bottom). Content max-width is 1120, and sections flow into an auto-fit grid (`minmax(330px, 1fr)`). Don't just stretch the mobile layout.
- Page transitions: fade plus 12px slide-up, 350–450 ms, easing `cubic-bezier(.2,.8,.2,1)`.

## 4. Screens and behaviour

### 4.1 Splash
Four overlapping circles (a1/a2/a1 75%/a2 75%) "bloom" in with a staggered spring scale (0 → 1.1 → 1), then the wordmark "tend" and "Build better days" fade up. Three pulsing loader dots. Auto-advance after about 2 s.

### 4.2 Onboarding (7 steps, progress dots; the active dot stretches to 22px)
1. "Build better days." / "A calm place for the small things that make a big difference." — mascot with sun inside a dashed circle.
2. "Turn small actions into lasting habits." — mascot with 3 floating habit pills (two checked).
3. "Stay focused with Pomodoro." — mascot (focus face, coffee) inside a partial ring with a "25:00" chip.
4. "See your progress grow." — 5 bars grow up staggered and the mascot (wow) sits on top.
5. "Make today count." — mascot with star, slowly rotating rays behind. CTA "Get started".
6. **Goals:** "What do you want to grow?" A 2-column multi-select grid: Health, Fitness, Learning, Productivity, Mindfulness, Personal.
7. **First habit:** suggestions based on the chosen goals (radio list). CTA "Start with {name}", which creates the habit and goes to Home with a toast.
"Skip" jumps to step 6. Keep the whole flow under a minute.

### 4.3 Home / Today (most important)
- Header: caption "WEDNESDAY · SEPTEMBER 23", H1 "Good morning, Ravi" (greeting changes by time of day), sub "Let's make today count." On the right: a calendar button and an avatar with a conic XP ring.
- **Day dial** (signature element): a 172px ring split into one arc segment per habit, each in that habit's colour, filling in proportion to progress (arcs start at 0 and animate on mount). Centre: a big % plus "OF TODAY". % = (sum of habit progress + tasks done) / (habits + tasks). Tapping it opens Insights.
- Beside the dial, three stat rows: flame "12 days · current streak" (the flame flickers; tap opens the streak sheet), clock "1h 10m · focused today" (tap opens focus analytics), checklist "3 / 5 · tasks done" (tap opens Tasks).
- **Mood strip:** "How are you feeling?" with 5 faces; tapping one opens the mood sheet pre-selected. Once logged, it shows the face, "Feeling Good · Logged at 9:12 AM" and "Change".
- **Today's habits:** a minimal list with no cards, just rows with hairline dividers. Each row has a 46px icon tile, name, "6 of 8 glasses" on the right, and a 5px progress bar. On the far right is a **46px check button**: a progress ring around it and a "+" when incomplete. **One tap adds the habit's step** (for example +1 glass, +5 pages). On reaching the goal: a colour fill scales in (spring), the checkmark draws in (stroke-dashoffset), a 10-particle burst plays, you get a light haptic, and a toast reads "Drink water complete · +10 XP". Tapping a completed habit undoes one step. Tapping the row opens Habit detail. There's also a small "+" button to create a habit.
- **Focus card:** a gradient a1soft → a2soft pill card with a play button, "Start a focus session", "25 min · {linked task}" and session dots. Tap: go to Focus and auto-start.
- **Up next:** a timeline of the next 3 undone tasks (time column, vertical line, priority dot, round checkbox).
- **Evening recap** dashed row → Daily summary.
- Completing **all** habits unlocks the "Perfect Day" achievement modal.

### 4.4 Habits
- H1 "My habits", sub "6 habits · 4 done today", and an a1 "+ New" button.
- A horizontal chip row: All, Morning, Health, Fitness, Learning, Work, Personal, Evening. The filter matches on category *or* time of day.
- Each row: icon tile, name, flame and streak count, "91% rate", frequency, the same check button as Home, and a **mini week** row (M–S, 20px circles): done = filled with a check, missed = dashed outline, today = coloured ring, future = 40% opacity.
- An empty category shows the mascot and "Nothing in {category} yet" + "Create a habit".
- Long-press and drag to reorder; swipe right to complete (implement with gesture-handler).

### 4.5 Create habit (bottom sheet, 90% max height, top radius 34, grabber)
Live preview card at the top (icon tile floating, name, "Every day · 1 times · Health").
Fields, in order: **name** input, with quick-suggestion chips (Drink water, Read, Stretch, Walk outside, No phone in bed) that fill the name and icon · **Icon** grid of 12 · **Color** row of 8 swatches (the selected one gets an offset ring) · **Category** chips · **Frequency** segmented control (Daily / Specific days / Weekly / Monthly / Custom):
- Specific days → 7 round day toggles.
- Weekly/Monthly → a stepper: "Do this **5 times** per week".
- Custom → "Every **N** days".

Then **Daily goal and duration** (a −/+ stepper and unit chips: times, min, pages, glasses) · **Reminder** toggle, with time chips when on · **Notes** textarea · the CTA "Plant this habit" (disabled at 45% opacity until a name is entered). On save: close the sheet and show the toast "Planted · {name}".

### 4.6 Habit detail
Back button, icon tile, name, "Daily · Morning · 20 pages".
- **Streak hero:** a soft radial tint in the habit colour, a breathing flame, "21 DAY STREAK", "You're doing great." and "3 more days to beat your best." (or "This is your longest streak ever.").
- A 4-up stat strip: Current, Longest, Completion %, Total.
- **Heatmap:** 18 weeks × 7 days, rounded squares (30% radius), 5 levels of the habit colour (track, 30%, 52%, 76%, 100%), with a Less→More legend and month labels.
- **By weekday** bar chart (best day in full colour, the rest at 35%), plus "Best day Tuesday · Best time 7–8 AM".
- **Monthly completion:** a smooth area line chart over 6 months that reveals left to right (clip animation, 1.2 s).
- **Insights** rows: "You complete this habit most often in the morning." and "You're 18% more consistent this month."
- **History:** the last 6 days with status and time.
- A sticky CTA: "Check in · 50% today".

### 4.7 Focus / Pomodoro (immersive)
- H1 "Focus" and an "Insights" pill. A segmented control: Focus / Short break / Long break.
- **Timer:** 290px. 60 tick marks around it (every 5th is longer); elapsed ticks turn a1. The progress ring (r 124, stroke 9) uses an a2→a1 gradient and *shrinks* as time passes (1 s linear transitions). A glowing knob dot rides the end of the arc. Centre: label (FOCUS), **"25:00"** at 66px tabular, and a status line (25 min session / In session / Paused).
- A "Working on {task}" dashed chip; tapping cycles through undone tasks.
- Controls: Reset (54px, rotates slightly on press), Play/Pause (82px a1, the icon morphs with a pop), Skip (54px).
- Presets (4-grid, focus/break): Classic 25/5, Deep 50/10, Flow 90/20, Custom (reveals −/+ steppers for focus minutes in 5s and break minutes). The long break comes after every 4 sessions.
- Footer: "Today · 3 sessions" dots, "1h 10m", "focus streak · 4 days".
- **While running:** the header, mode switch, presets, footer and tab bar all fade out (600 ms) and the background glows fade. A large breathing radial glow appears behind the ring (4.5 s loop), and 16 ambient particles drift slowly upward. Tapping the ring toggles the same immersive mode while paused.
- The timer must survive backgrounding: store the end timestamp and compute the remaining time from it, and schedule a local notification for completion.
- **Completion modal:** backdrop blur, a card that pops in (scale .7 → 1.04 → 1), the mascot (wow + sparkle) with a 20-particle confetti burst, "Focus session complete!", **"+25 min"** in a1, chips "Focus streak · 4" and "Today · 1h 35m", CTA "Start a break" (auto-picks short or long) and a secondary "Done for now". +25 XP.

### 4.8 Tasks
- Back button, "Tasks", "3 of 5 done today". A quick-add input with an a1 "+" button (Enter adds to Today).
- A segmented control: Today / Upcoming / Completed, with counts.
- **Timeline list:** a time column (48px) and a vertical hairline with a priority dot. Each row has a round checkbox with a priority-coloured border that fills a1 when done, plus a strike-through. The row stays about 650 ms and then animates out, with a burst and "+5 XP". Meta chips: priority, linked habit, linked focus ("2 × 25m").
- The "⋯" menu expands inline: **Focus on this** (goes to Focus with the task linked and auto-starts), **Make it a habit** (opens Create habit prefilled), **Delete**.
- Swipe right to complete, swipe left to delete.
- Empty state: "Your day is clear" plus the mascot (sleepy + coffee).

### 4.9 Calendar
- Month switcher, and a summary strip: Avg day %, Focused hours, Days logged.
- A 7-column grid of square cells (30% radius). Past days are filled with `mix(a1, surface2, 18% + pct·0.72)`; text switches to a1ink above a 62% mix. Up to 3 tiny focus dots per day. Today gets a 2px ink ring with an offset. Future days are outlined only.
- Legend: Lighter → Fuller day, and a "focus session" dot.
- Tapping a day opens a sheet: a conic % ring, "September 18 · 85% completed", the mood face, "5 of 6 habits" with icon tiles, "3 tasks done", and "2 focus sessions · 50m".

### 4.10 Insights (analytics)
- Tabs: **Habits / Focus**; range segmented control: **7D / 30D / 3M / 1Y**. Every chart animates from zero whenever the screen, tab or range changes (bars are staggered 12–40 ms each).
- *Habits tab:* "Habit consistency · This week" with a big **84%** and a green delta chip "+6% vs last week" · a completion bar chart (the latest bar in solid a1, the others in an a1/a2 mix) · a 2×2 stat grid (current streak, longest, focus time, tasks) · **Productivity trend** smooth area line · **By category** horizontal bars in habit colours · **Streak history** runs (the current one in flame colour, the longest in a1) with "Every reset is a fresh start…" · a **Mood × habits** card: "You tend to feel better on days you complete your workout.", comparing 82% vs 54% on bars with faces.
- *Focus tab:* big "3h 25m · +18%" · minutes-by-day bars · Today / Sessions / Avg session · a **Most productive time** hour histogram (6a–10p) with the 9–11 AM peak highlighted · insight "Your sessions before 11 AM run 9 minutes longer…".

### 4.11 Achievements and gamification
- Level hero: mascot (wow + star), "LEVEL 12", "Consistency Master", an XP bar (a2→a1, animates), "2,380 / 3,000 XP · 620 to Level 13".
- A milestone track: levels 10–14 on a line; past ones filled a1, the current one larger in ink.
- Badges: an auto-fill grid of coins (78px). A conic progress ring surrounds each coin. Unlocked coins use an a2→a1 gradient with an a1ink icon; locked ones use surface2 with a lock pip and "14 / 20".
- Badges: First Spark (7-day), Momentum (30-day), Deep Diver (10 sessions), Page Turner (100 pages), Early Bird, Iron Will (20 workouts), Perfect Day, Night Owl, Centurion (100-day).
- **Unlock modal:** slowly rotating ray pattern (masked), the coin pops in, a small mascot peeks from the bottom-right, a confetti burst, "ACHIEVEMENT UNLOCKED", name and description, "Nice!". Locked badges open the same modal as "Almost there · 6 to go".
- XP rules: habit complete +10, task +5, focus session +25, mood log +5.

### 4.12 Streaks (sheet from any streak tap)
Big flame and "12 DAY STREAK", trophy "37 LONGEST". A 5-week grid where streak days are flame-filled and a protected rest day has a dashed outline. **Streak protection** row (shield, "2 rest days left this month", toggle). Copy: "Every reset is a fresh start. Missing a day never erases the work you've already done." Never use guilt language anywhere.

### 4.13 Mood check-in (sheet)
"How are you feeling today?" with 5 large faces; the selected one scales to 1.18 with a spring and the others dim to 55%. Tag chips: Energized, Calm, Focused, Grateful, Stressed, Tired, Social, Anxious. CTA "Log "Good"". The saved state shows the mascot, "Noted. Thanks for checking in.", a correlation insight card, and "Done · +5 XP".

### 4.14 Daily summary (journal page)
Caption date and time, "Your day" at 44px, sleepy mascot with moon. Between dashed dividers: a conic % ring, a streak row, "4 / 6 habits", "3 sessions · 1h 10m focused", mood. A row of today's habit tiles (incomplete ones at 35%). **Highlights** as a sentence in 16.5px prose. **Tomorrow** card: 3 habits, 2 tasks, 1 focus session. CTA "Close the day" → toast "Day saved. Sleep well."

### 4.15 Profile (You)
Avatar (gradient initial and conic XP ring, "Lv 12" badge), "Ravi", "Consistency Master", "Tending since March 2026". A 3-stat strip: 12d streak, 1,284 habits done, 86h focused. A badge preview stack linking to Achievements. Grouped lists: [Calendar, Daily summary, Achievements] · [Theme (current name), Notifications, Settings] · [Export data (CSV · JSON), Privacy]. Footer "Tend 1.0 · Made for better days".

### 4.16 Settings
Appearance (Light/Dark/System segmented control plus a Color theme row) · Focus (Auto-start breaks, Completion sounds, Ambient sound chips: Off/Rain/Café/Forest/Brown noise) · Habits (Streak protection, Haptic feedback, Week starts Mon/Sun) · Privacy & data (Lock with Face ID, Export all data, Notifications, Replay onboarding).
Toggles: 52×32, a white knob with a spring translate, and the track turns a1 when on.

### 4.17 Theme selector
Mode segmented control plus a 2-column grid of theme tiles. Each tile is a mini preview of the theme in the current mode: its bg, a conic ring of a1/a2, text bars, an a1 pill, the name, and an animated check. Tapping applies it instantly with a colour transition.

### 4.18 Notifications
A **live preview bubble** at the top that changes with the **Tone** control: *Gentle nudges* ("Your water habit is waiting whenever you are — 6 of 8 glasses so far.") vs *Just the facts* ("Drink water · 2 glasses left today."). A master toggle with quiet hours 10 PM–7 AM. Per-type rows with toggles: Habit reminders, Focus reminder (9:00 AM), Daily summary (9:00 PM), Streak reminder (8:00 PM, only if a streak is still open), Morning motivation (7:30 AM), Evening reflection (10:00 PM). Schedule these with expo-notifications.

### 4.19 System states (every data screen)
- **Loading:** shimmer skeletons shaped like the real layout (title bars, dial circle, 5 list rows), with the caption "Syncing your day…". Use a skeleton, never a spinner.
- **Empty:** the mascot inside a dashed halo, a title, one line and a CTA:
  - Home/Habits: "Ready to build your first habit?"
  - Tasks: "Your day is clear"
  - Insights: "Complete a few habits and your story will appear here."
  - Calendar: "A blank month"
  - Achievements: "Your first badge is one habit away"
  - Focus footer: "Your first focus session is waiting."
- **Error:** sleepy mascot with moon, "We couldn't sync just now", "Nothing is lost — your check-ins are saved on this device…", "Try again" and a small error code.
- **Toasts:** an ink pill at the top with an a1 icon disc. It springs in and auto-dismisses after 2.4 s.
- Pull-to-refresh on Home uses a custom animation (the mascot leaf bobbing) instead of the OS spinner.

## 5. Motion spec (centralise in `motion.ts`)
| Interaction | Spec |
|---|---|
| Page enter | opacity 0→1, y 12→0, 400 ms, `(.2,.8,.2,1)` |
| Sheet | slide from 100% in 420 ms `(.2,.9,.25,1)`; exit 240 ms; backdrop fades |
| Modal | scale .7→1.04→1, 500 ms spring |
| Tab indicator | spring, damping ~14, overshoot |
| Button press | scale .96 (icon buttons .9), 150 ms |
| Habit complete | fill scale 0→1 spring (overshoot 1.7) → check draws in 350 ms (150 ms delay) → 10-particle burst 650 ms → light haptic |
| Progress bars and rings | animate from the previous value to the new one, 600–900 ms |
| Charts | grow from 0 on enter or range change, staggered |
| Flame | scale 1↔1.1, rotate ±3°, 1.6 s loop |
| Timer ring | 1 s linear per tick |
| Theme switch | colour interpolation ~400–500 ms |

Respect **Reduce Motion**: if it's on, turn off particles, loops and parallax and keep only fades.

## 6. Data model (TypeScript)
```ts
Habit { id, name, icon, hue, category, frequency: {type:'daily'|'days'|'weekly'|'monthly'|'custom', days?:boolean[7], times?:number, every?:number},
        goal:number, unit:'times'|'min'|'pages'|'glasses'|string, step:number, timeOfDay, reminder?:{on:boolean,time:string}, notes?, createdAt, order }
HabitLog { habitId, date:'YYYY-MM-DD', count, completedAt? }
Task { id, title, due?:string, priority:'high'|'med'|'low', done, doneAt?, habitId?, focusSessions?:number, list:'today'|'upcoming' }
FocusSession { id, start, end, mode:'focus'|'short'|'long', minutes, taskId?, completed }
MoodLog { date, mood:'great'|'good'|'okay'|'low'|'tired', tags:string[], note? }
Profile { name, xp, level, themeId, mode, prefs, notificationPrefs, streakProtection:{enabled, restDaysLeft} }
```
Derived selectors: streaks (current and longest; protected rest days don't break them), completion rate, heatmap levels, best day and time, focus totals by range, mood × habit correlation, the calendar day score.

## 7. Accessibility and quality bar
- Touch targets ≥ 44px. Text contrast ≥ 4.5:1 against its background, including ink3 captions.
- Every icon button needs an accessibilityLabel. The dial and charts need text summaries.
- Support Dynamic Type up to 130% without clipping.
- 60 fps: run animations on the UI thread (Reanimated worklets) and avoid re-rendering lists on each timer tick.
- Seed the app with the demo data from the screenshots (Ravi, the 6 habits: Drink water 6/8, Read 10/20 pages, Workout ✓, Coding 15/60 min, Meditate ✓, Journal 0/1; 5 tasks today; 12-day streak; Level 12) behind a "Load demo data" dev toggle.

## 8. Deliver in this order
1. Theme tokens, fonts, icons, Mascot and mood faces.
2. Navigation shell (tabs plus desktop sidebar), toasts, sheets, modals.
3. Home → Habits → Create habit → Habit detail.
4. Focus (plus background-safe timer, notifications, completion).
5. Tasks → Calendar → Insights.
6. Achievements/XP → Streak sheet → Mood → Daily summary.
7. Profile → Settings → Themes → Notifications.
8. Onboarding and splash; loading, empty and error states for every screen.
9. Polish pass: motion, haptics, accessibility, reduce-motion, dark/light QA across all 8 themes.

Ask me before adding any feature, screen or copy not described here.
