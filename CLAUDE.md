# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Response conventions (`.agents/rules/`)

- **Reply in Traditional Chinese** (Taiwan style). Keep code, filenames, and technical terms (JSON, API, BPM, CAGED…) in their original form. See `.agents/rules/responses_rules.md`.
- **Doc-update rule** (`.agents/rules/spec_rules.md`): after adding or changing a *feature / user-visible behaviour / data model*, update **both** `spec.md` and `README.md` to match the implementation. Do **not** touch them for pure bug fixes, internal refactors, perf-only changes, or test-only edits.

## Commands

```bash
npm run dev      # Vite dev server with HMR (--host: exposed on LAN)
npm run build    # Production build → dist/
npm run preview  # Preview the built dist/ locally
```

There is **no test runner, linter, or type checker** configured. Validation is manual in the browser. Deployment is automatic: pushing to `main` triggers `.github/workflows/deploy.yml` (GitHub Pages). `vite.config.js` sets `base: './'` (relative paths) — keep it relative so the Pages sub-path resolves.

**Do NOT run `npm run build`, `npm run dev`, `npm run preview`, or otherwise build/run the app.** The user builds and runs it themselves. Just make the code changes and describe what to verify.

## Architecture

Single-page Vue 3 app (Script Setup, no router, no store). All state lives in `src/App.vue`; three pure-logic engines under `src/utils/` do the music/audio work. Tailwind CSS v4 via the `@tailwindcss/vite` plugin (no `tailwind.config`; config lives in `src/style.css`).

### The unified chord data model — start here

`CHORD_MODES` in `src/utils/musicTheory.js` is the **single source of truth** that all three engines read. Each roman-numeral chord card is one entry:

```js
'V7': { offset: 7, mode: [0,2,4,5,7,9,10], family: 'dom', label: '7', modeName: 'Mixolydian' }
```

- `offset` — semitones of the chord root above the Key root
- `mode` — the 7-note scale relative to the *chord* root (drives which fret lights up, custom-sequencer mode mapping, and interval colouring)
- `family` — `'major' | 'minor' | 'dim' | 'dom'` (selects voicing/scale shape and step-mode note picking)
- `label` / `modeName` — display strings

**To add a chord**, add one entry to `CHORD_MODES` (and expose it in the `chordLibrary` array in `App.vue`, currently grouped into 7 categories: diatonic triads/7ths, modal-interchange triads/7ths, secondary dominants, related-II, and SubV7 tritone subs); the fretboard, audio, and scale-climbing engines pick it up automatically. No other code changes needed for the common case.

### The three engines (`src/utils/`)

- **`musicTheory.js`** — absolute-pitch math, `CAGED_CHORD_VOICINGS` (chord shapes), dynamic CAGED form selection (`getDynamicCagedForm`), diatonic mode mapping. `STRING_OPENS = [4,11,7,2,9,4]` is open-string pitches for strings 1→6 (note: string 1 = high E first).
- **`cagedScales.js`** — the large data file (`CAGED_SCALES`, 35 voicings) plus scale-note sequence generation (`generateCagedScaleSequence`, `resolveStageIntervals`) and fret-region bounds. `TRAINING_STAGE_MODES` defines two independent stage tracks — `chord` (5 stages: triad → 7th → 9th → 11th → 13th) and `scale` (3 stages: triad → pentatonic → full mode scale); `resolveStageIntervals` filters each stage's candidate intervals down to what the current mode actually contains. `validateCagedScales()` self-checks the data set.
- **`audioEngine.js`** — the `AudioEngine` class: a **Web Audio hardware-clock scheduler** (lookahead pattern, `scheduler()`/`scheduleNote()`), physically-synthesised plucked-string strum, single-note climbing, and metronome clicks. Voice countdown ("One, Two…") uses the Web Speech API.

### AudioEngine is the timing source of truth → drives Vue via a callback

The `App.vue` UI does **not** own the beat clock. `App.vue` sets `trainerAudio.onBeatTrigger = (tickData) => {...}` and the scheduler calls it on every scheduled beat with `{ phase, ... }`. That callback updates the reactive refs (`currentPhase`, `currentChord`, `activeNoteTarget`, form/region overrides) which flow down as props to `Fretboard.vue`. So the fretboard is a pure render of state pushed up from the audio clock — if you need beat-synced visual behaviour, hook it in the `onBeatTrigger` handler, not in a Vue timer.

### The 4/4 phase cycle (per chord)

Each chord spans `4 (Prep) + N (Train) + 4 (Predict)` beats, where `N` = length of the note sequence (`scheduleNote()` computes `phase` from `currentChordBeat`):

- **Prep** — metronome click + strum synth; fretboard shows only the grey Key-root locator squares.
- **Train** — one note per beat, lit with its interval number/colour.
- **Predict** — spoken English count; the "→ next chord" flashes in sync with BPM and the fretboard pre-shifts to the next chord's position.

An initial one-off **Intro Predict** (`introBeatsRemaining`, 4 beats) runs before the very first Prep — metronome + first chord flashing only, no strum, no "next chord". Two App-side flags (`isIntroPredict`, `isFirstChordStart`) prevent this intro from being mis-counted as a completed round (which would wrongly advance the CAGED position).

### Dynamic CAGED cycling

Chords resolve to a live CAGED form via `getDynamicCagedForm(chord, keyRoot, cycle)`. Each time a full progression round completes, the cycle increments and shapes slide up the neck along `C→A→G→E→D`. During playback the **scheduler advances the cycle itself** (not the lookahead callback) so the first beat's shape isn't late.

### Persistence

Settings persist to `localStorage` (key in `App.vue`, `SETTINGS_STORAGE_KEY`) as JSON — BPM, key, progression, stage, handedness, interval-display mode. `cagedCycle` is intentionally **not** persisted (it's a runtime playback position). Reads clamp/validate against defaults so old saved payloads degrade gracefully.

### Two progression input modes

`chordLibrary` (roman-numeral chord cards) and a custom **sequencer** of relative-degree tokens (`1-7`, `L1-L7` low octave, `H1-H7` high octave). Both use unified Pointer-Events drag-and-drop (works on mouse and touch); `HelloWorld.vue` is leftover Vite scaffolding and unused.
