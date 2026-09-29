# Chinese Chart Legend Design QA

## Evidence

- Source visual truth: `/var/folders/80/hf4z3y956zz71vczt_8x5yx80000gn/T/codex-clipboard-64a3fde8-28bd-454b-b581-ec7d2b046e09.png`
- Device-detail implementation screenshot: `/Users/potetou/Desktop/pi/chart-legends-device-detail.png`
- Baseline-learning implementation screenshot: `/Users/potetou/Desktop/pi/chart-legends-baseline-learning.png`
- Multi-device implementation screenshot: `/Users/potetou/Desktop/pi/chart-legends-device-comparison.png`
- Mobile implementation screenshot: `/Users/potetou/Desktop/pi/chart-legends-device-mobile.png`
- Desktop viewport: 1440 x 900 CSS px; mobile viewport: 375 x 812 CSS px
- Source pixels: 560 x 52; desktop implementation pixels: 1440 x 900; mobile implementation pixels: 375 x 2500
- Browser density: devicePixelRatio 2; Browser screenshots are output at CSS-pixel dimensions, so no manual density conversion was applied.
- State: dark theme, default 8-hour device trend, baseline-learning drawer open, three devices selected in comparison view.

## Full-view Comparison

- The source legend and the rendered device-detail and baseline-learning screenshots were opened in the same comparison input.
- All three source concepts are preserved as visible labels: `进口温度 Ts`, `出口温度 Tc`, and `进出口温差 ΔT`.
- The reference color mapping is preserved: orange for inlet temperature, cyan for outlet temperature, and green for inlet/outlet temperature difference.
- Existing page composition, chart scale, controls, and surrounding diagnostic content remain unchanged.

## Focused-region Comparison

- A focused legend pass was required because the source is a 560 x 52 crop and the labels are a small chart detail in the full implementation screenshots.
- Device detail and baseline learning show all three Chinese legends together without clipping at desktop width.
- At 375 px mobile width, all three labels remain visible in the chart header and the page has no horizontal overflow.
- The multi-device comparison legend now identifies each curve with both the device ID and its Chinese device name.
- Tooltip series names use the same Chinese labels as the visible legends.

## Required Fidelity Surfaces

- Fonts and typography: legend labels use the existing Fira Sans hierarchy at 10-11 px CSS size with readable light text on the dark chart surface.
- Spacing and layout rhythm: chart top grids were increased to 58 px where needed so the longer Chinese legends do not collide with plotted data.
- Colors and visual tokens: a shared temperature-series map keeps the orange/cyan/green mapping consistent across pages.
- Image quality and asset fidelity: no raster or vector assets were introduced; the source describes native chart UI rather than an image asset.
- Copy and content: raw abbreviations were replaced by explicit operational terms while retaining `Ts`, `Tc`, and `ΔT` for engineering familiarity.

## Responsive And Runtime Checks

- Device detail: 720 px chart at 1440 px viewport; 345 px chart at 375 px viewport.
- Baseline-learning drawer: 1204 px chart inside a 1240 px dialog.
- No horizontal overflow at 1440 px or 375 px.
- Browser console: no warnings or errors.
- Production build: passed.

## Comparison History

- Earlier P2: baseline-learning legends used only `Ts`, `Tc`, and `ΔT`, leaving non-specialist users without a plain-language explanation.
- Fix: introduced shared Chinese names and reference-aligned colors, then reused them in visible legends, series names, tooltips, accessibility labels, captions, and exported CSV headers.
- Post-fix evidence: desktop, drawer, comparison, and mobile screenshots show meaningful labels without overlap or clipping.

## Findings

- No actionable P0, P1, or P2 issues remain.

## Follow-up Polish

- None required for this change.

final result: passed
