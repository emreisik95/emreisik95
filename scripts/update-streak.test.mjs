import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateStreaks,
  parseContributionHtml,
  renderStreakSvg,
} from "./update-streak.mjs";

test("keeps the current streak when today has no contribution yet", () => {
  const days = [
    { date: "2026-07-14", contributionCount: 1 },
    { date: "2026-07-15", contributionCount: 2 },
    { date: "2026-07-16", contributionCount: 0 },
    { date: "2026-07-17", contributionCount: 1 },
    { date: "2026-07-18", contributionCount: 2 },
    { date: "2026-07-19", contributionCount: 1 },
    { date: "2026-07-20", contributionCount: 0 },
  ];

  assert.deepEqual(calculateStreaks(days, "2026-07-20"), {
    total: 7,
    current: 3,
    longest: 3,
  });
});

test("renders an accessible SVG with all contribution metrics", () => {
  const svg = renderStreakSvg({
    total: 2228,
    current: 42,
    longest: 108,
    generatedAt: "2026-07-20",
  });

  assert.match(svg, /<title[^>]*>GitHub contribution streak<\/title>/);
  assert.match(svg, />2,228</);
  assert.match(svg, />42</);
  assert.match(svg, />108</);
  assert.match(svg, /Current streak/);
  assert.match(svg, /Longest streak/);
  assert.match(svg, /Last 365 days/);
});

test("parses contribution counts from GitHub's public calendar HTML", () => {
  const html = `
    <td data-date="2026-07-19" id="day-1" class="ContributionCalendar-day"></td>
    <tool-tip for="day-1">3 contributions on July 19th.</tool-tip>
    <td data-date="2026-07-20" id="day-2" class="ContributionCalendar-day"></td>
    <tool-tip for="day-2">No contributions on July 20th.</tool-tip>
  `;

  assert.deepEqual(parseContributionHtml(html), [
    { date: "2026-07-19", contributionCount: 3 },
    { date: "2026-07-20", contributionCount: 0 },
  ]);
});
