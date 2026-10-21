#!/usr/bin/env node
// Refreshes data/github.json, the offline fallback for the repository list.
// The site loads the same data from the GitHub API at runtime; this snapshot is
// only used when the API is unreachable or rate limited.
//
// Usage: node scripts/snapshot-github.mjs

import { writeFile } from "node:fs/promises";

const USER = "GrimNej";
const res = await fetch(`https://api.github.com/users/${USER}/repos?per_page=100&sort=pushed`, {
  headers: { Accept: "application/vnd.github+json", "User-Agent": "grimnej-portfolio-snapshot" },
});
if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
const repos = await res.json();

const snapshot = {
  generatedAt: new Date().toISOString(),
  repos: repos.map((r) => ({
    name: r.name,
    description: r.description,
    url: r.html_url,
    language: r.language,
    fork: r.fork,
    pushedAt: r.pushed_at,
    topics: r.topics ?? [],
  })),
};

await writeFile(new URL("../data/github.json", import.meta.url), JSON.stringify(snapshot, null, 2) + "\n");
console.log(`Saved ${snapshot.repos.length} repositories.`);
