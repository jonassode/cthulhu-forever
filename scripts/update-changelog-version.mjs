#!/usr/bin/env node
/**
 * update-changelog-version.mjs
 *
 * Scans recent git commits (non-merge, non-bot) and adds any that are
 * missing from CHANGELOG.md as new versioned entries.
 * Then syncs the APP_VERSION constant in js/data.js to the latest
 * version found in the changelog.
 *
 * Expected changelog line format:
 *   0.NNN - Description  (trailing two spaces are a markdown line-break)
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const CHANGELOG_PATH = 'CHANGELOG.md';
const DATA_JS_PATH = 'js/data.js';
/** How far back in git history to look for undocumented commits. */
const MAX_COMMITS_TO_SCAN = 30;

// ── Helpers ────────────────────────────────────────────────────

/** Parse all versioned entries from the changelog. */
function parseEntries(content) {
  const entries = [];
  for (const line of content.split('\n')) {
    const m = line.match(/^0\.(\d+)\s+-\s+(.+)/);
    if (m) {
      entries.push({ minor: parseInt(m[1], 10), description: m[2].trimEnd() });
    }
  }
  return entries;
}

/** Normalise a string for fuzzy comparison. */
function normalise(s) {
  return s.toLowerCase().replace(/[`'"]/g, '').replace(/\s+/g, ' ').trim();
}

/** Return true if the commit subject is already captured in the changelog. */
function alreadyDocumented(subject, entries) {
  const ns = normalise(subject);
  return entries.some(e => normalise(e.description) === ns);
}

// ── Read changelog ─────────────────────────────────────────────

let changelog = readFileSync(CHANGELOG_PATH, 'utf8');
let entries = parseEntries(changelog);
let latestMinor = entries.length ? Math.max(...entries.map(e => e.minor)) : 0;

// ── Get recent commits ─────────────────────────────────────────
// --no-merges excludes "Merge pull request / Merge branch" commits.
// Limit to MAX_COMMITS_TO_SCAN so we catch any backlog without going too far.

const logLines = execSync(`git log --no-merges --format=%s -${MAX_COMMITS_TO_SCAN}`, { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

const BOT_PATTERNS = [
  'chore: update changelog',
  'update changelog',
  '[skip ci]',
  'skip ci',
];

/** Prefixes that mark standard GitHub merge commits — these are never interesting entries. */
const MERGE_PREFIXES = ['Merge pull request ', 'Merge branch '];

/** True if this commit should be excluded from the changelog. */
function shouldSkip(subject) {
  if (MERGE_PREFIXES.some(p => subject.startsWith(p))) return true;
  const lower = subject.toLowerCase();
  return BOT_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}

const newCommits = logLines
  .filter(s => !shouldSkip(s))
  .filter(s => !alreadyDocumented(s, entries))
  .reverse(); // oldest-first so version numbers increment chronologically

// ── Update changelog ───────────────────────────────────────────

if (newCommits.length === 0) {
  console.log('Changelog is already up to date — no missing entries.');
} else {
  console.log(`Adding ${newCommits.length} missing changelog entr${newCommits.length === 1 ? 'y' : 'ies'}:`);

  // Build new lines (oldest → newest as we increment)
  const newLines = [];
  for (const subject of newCommits) {
    latestMinor += 1;
    const line = `0.${latestMinor} - ${subject}  `;
    console.log(`  + ${line.trimEnd()}`);
    newLines.push(line);
  }

  // Newest entries go at the TOP of the version list.
  // Find the first existing version line and insert before it.
  const firstEntryMatch = changelog.match(/^0\.\d+\s+-\s+/m);
  if (firstEntryMatch && firstEntryMatch.index !== undefined) {
    const block = newLines.reverse().join('\n') + '\n';
    changelog =
      changelog.substring(0, firstEntryMatch.index) +
      block +
      changelog.substring(firstEntryMatch.index);
  } else {
    // No existing entries — append at the end
    changelog += newLines.reverse().join('\n') + '\n';
  }

  writeFileSync(CHANGELOG_PATH, changelog, 'utf8');
  entries = parseEntries(changelog);
}

// ── Sync APP_VERSION in data.js ────────────────────────────────

const maxMinor = entries.length ? Math.max(...entries.map(e => e.minor)) : latestMinor;
const versionStr = `0.${maxMinor}`;

const dataJs = readFileSync(DATA_JS_PATH, 'utf8');
const updatedDataJs = dataJs.replace(
  /const APP_VERSION\s*=\s*['"][^'"]*['"];/,
  `const APP_VERSION = '${versionStr}';`,
);

if (updatedDataJs !== dataJs) {
  writeFileSync(DATA_JS_PATH, updatedDataJs, 'utf8');
  console.log(`Updated APP_VERSION → '${versionStr}' in ${DATA_JS_PATH}`);
} else {
  console.log(`APP_VERSION is already '${versionStr}' — no data.js change needed.`);
}
