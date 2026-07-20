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

export function extractContributionDays(payload) {
  const weeks =
    payload?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;

  if (!Array.isArray(weeks)) {
    throw new Error("GitHub contribution calendar is missing from the response");
  }

  return weeks.flatMap((week) => week.contributionDays);
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
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const username = process.env.GITHUB_USERNAME ?? "emreisik95";

  if (!token) {
    throw new Error("GITHUB_TOKEN or GH_TOKEN is required");
  }

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 364);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setUTCHours(23, 59, 59, 999);

  const query = `
    query ContributionCalendar($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "emreisik95-profile-streak",
    },
    body: JSON.stringify({
      query,
      variables: {
        login: username,
        from: from.toISOString(),
        to: to.toISOString(),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed with ${response.status}`);
  }

  const payload = await response.json();

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  const days = extractContributionDays(payload).filter((day) => day.date <= todayIso);
  const metrics = calculateStreaks(days, todayIso);
  const svg = renderStreakSvg({ ...metrics, generatedAt: todayIso });
  const outputUrl = new URL("../assets/github-streak.svg", import.meta.url);

  await writeFile(outputUrl, `${svg}\n`, "utf8");
  console.log(
    `Updated ${outputUrl.pathname}: ${metrics.current} current, ${metrics.longest} longest, ${metrics.total} total`,
  );
}
