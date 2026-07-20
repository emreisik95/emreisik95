import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function calculateStreaks(days, todayIso) {
  const sortedDays = [...days].sort((left, right) => left.date.localeCompare(right.date));
  const total = sortedDays.reduce((sum, day) => sum + day.contributionCount, 0);

  let longest = 0;
  let running = 0;

  for (const day of sortedDays) {
    if (day.contributionCount > 0) {
      running += 1;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
  }

  let current = 0;
  let index = sortedDays.findIndex((day) => day.date === todayIso);

  if (index === -1) {
    index = sortedDays.length - 1;
  } else if (sortedDays[index].contributionCount === 0) {
    index -= 1;
  }

  for (; index >= 0 && sortedDays[index].contributionCount > 0; index -= 1) {
    current += 1;
  }

  return { total, current, longest };
}

export function parseContributionHtml(html) {
  const countsById = new Map();

  for (const match of html.matchAll(
    /<tool-tip\b[^>]*for="([^"]+)"[^>]*>([^<]+)<\/tool-tip>/g,
  )) {
    const [, id, label] = match;
    const countMatch = label.match(/^([\d,]+) contributions?\b/);
    countsById.set(id, countMatch ? Number(countMatch[1].replaceAll(",", "")) : 0);
  }

  const days = [];

  for (const match of html.matchAll(/<td\b[^>]*>/g)) {
    const tag = match[0];

    if (!tag.includes("ContributionCalendar-day")) {
      continue;
    }

    const date = tag.match(/\bdata-date="([^"]+)"/)?.[1];
    const id = tag.match(/\bid="([^"]+)"/)?.[1];

    if (!date || !id || !countsById.has(id)) {
      throw new Error("GitHub contribution calendar contains an incomplete day");
    }

    days.push({ date, contributionCount: countsById.get(id) });
  }

  return days.sort((left, right) => left.date.localeCompare(right.date));
}

export function renderStreakSvg({ total, current, longest, generatedAt }) {
  const totalLabel = total.toLocaleString("en-US");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="180" viewBox="0 0 880 180" role="img" aria-labelledby="title description">
  <title id="title">GitHub contribution streak</title>
  <desc id="description">${totalLabel} contributions in the last year, a ${current} day current streak, and a ${longest} day longest streak.</desc>
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#07100F"/>
      <stop offset="1" stop-color="#0D1518"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.45" r="0.5">
      <stop offset="0" stop-color="#4ADE80" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#4ADE80" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M24 0H0V24" fill="none" stroke="#8AA0A6" stroke-opacity="0.06"/>
    </pattern>
  </defs>
  <rect width="880" height="180" rx="18" fill="url(#background)"/>
  <rect width="880" height="180" rx="18" fill="url(#grid)"/>
  <rect x="292" width="296" height="180" fill="url(#glow)"/>
  <rect x="0.5" y="0.5" width="879" height="179" rx="17.5" fill="none" stroke="#8AA0A6" stroke-opacity="0.2"/>
  <path d="M293 30V150M587 30V150" stroke="#8AA0A6" stroke-opacity="0.18"/>

  <g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" text-anchor="middle">
    <text x="147" y="39" fill="#53666B" font-size="10" letter-spacing="2">Last 365 days</text>
    <text x="147" y="101" fill="#E6EDF0" font-size="39" font-weight="700">${totalLabel}</text>
    <text x="147" y="128" fill="#8AA0A6" font-size="12" letter-spacing="1.2">Total contributions</text>

    <text x="440" y="39" fill="#86EFAC" font-size="10" letter-spacing="2">ACTIVE RUN</text>
    <circle cx="440" cy="84" r="35" fill="none" stroke="#4ADE80" stroke-opacity="0.22"/>
    <circle cx="440" cy="84" r="28" fill="#4ADE80" fill-opacity="0.06"/>
    <text x="440" y="98" fill="#4ADE80" font-size="42" font-weight="750">${current}</text>
    <text x="440" y="139" fill="#86EFAC" font-size="12" font-weight="600" letter-spacing="1.2">Current streak</text>

    <text x="733" y="39" fill="#53666B" font-size="10" letter-spacing="2">PERSONAL BEST</text>
    <text x="733" y="101" fill="#E6EDF0" font-size="39" font-weight="700">${longest}</text>
    <text x="733" y="128" fill="#8AA0A6" font-size="12" letter-spacing="1.2">Longest streak</text>
  </g>

  <text x="24" y="164" fill="#53666B" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="8" letter-spacing="1.4">PUBLIC GITHUB ACTIVITY · UPDATED ${generatedAt}</text>
</svg>`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const username = process.env.GITHUB_USERNAME ?? "emreisik95";

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 364);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setUTCHours(23, 59, 59, 999);
  const years = [...new Set([from.getUTCFullYear(), to.getUTCFullYear()])];
  const calendars = await Promise.all(
    years.map(async (year) => {
      const calendarUrl = new URL(`https://github.com/users/${username}/contributions`);
      calendarUrl.searchParams.set("from", `${year}-01-01`);
      calendarUrl.searchParams.set("to", `${year}-12-31`);

      const response = await fetch(calendarUrl, {
        headers: {
          Accept: "text/html",
          "User-Agent": "emreisik95-profile-streak",
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub contribution calendar failed with ${response.status}`);
      }

      return parseContributionHtml(await response.text());
    }),
  );

  const fromIso = from.toISOString().slice(0, 10);
  const days = calendars
    .flat()
    .filter((day) => day.date >= fromIso && day.date <= todayIso);
  const metrics = calculateStreaks(days, todayIso);
  const svg = renderStreakSvg({ ...metrics, generatedAt: todayIso });
  const outputUrl = new URL("../assets/github-streak.svg", import.meta.url);

  await writeFile(outputUrl, `${svg}\n`, "utf8");
  console.log(
    `Updated ${outputUrl.pathname}: ${metrics.current} current, ${metrics.longest} longest, ${metrics.total} total`,
  );
}
