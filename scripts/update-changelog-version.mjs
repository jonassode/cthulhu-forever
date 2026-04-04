#!/usr/bin/env node
/**
 * update-changelog-version.mjs
 *
 * When changes are merged into main:
 *  1. Reads the current MAJOR.MINOR.PATCH version from js/data.js.
 *  2. Collects all commits since the last bot changelog-update commit.
 *  3. Summarises them into a single statement using the GitHub Models AI API
 *     (falls back to joining commit subjects when the API is unavailable).
 *  4. Increments the PATCH number.
 *  5. Prepends a single new entry to CHANGELOG.md.
 *  6. Updates APP_VERSION in js/data.js.
 *
 * Expected changelog line format:
 *   MAJOR.MINOR.PATCH - Description  (trailing two spaces = markdown line-break)
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const CHANGELOG_PATH = 'CHANGELOG.md';
const DATA_JS_PATH = 'js/data.js';
/** Matches the start of a versioned changelog entry, e.g. "0.1.194 - " */
const VERSION_LINE_PATTERN = /^\d+\.\d+\.\d+\s+-\s+/m;

// ── Helpers ────────────────────────────────────────────────────

/** Read the current APP_VERSION string from data.js. */
function readCurrentVersion() {
  const dataJs = readFileSync(DATA_JS_PATH, 'utf8');
  const m = dataJs.match(/const APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!m) throw new Error('APP_VERSION not found in data.js');
  return m[1];
}

/** Increment the PATCH component of a MAJOR.MINOR.PATCH version string. */
function incrementPatch(version) {
  const parts = version.split('.');
  if (parts.length !== 3) throw new Error(`Expected MAJOR.MINOR.PATCH, got: ${version}`);
  const [major, minor, patch] = parts;
  return `${major}.${minor}.${parseInt(patch, 10) + 1}`;
}

/** Prefixes that mark standard GitHub merge commits — never interesting entries. */
const MERGE_PREFIXES = ['Merge pull request ', 'Merge branch '];

const BOT_PATTERNS = [
  'chore: update changelog',
  'update changelog',
  '[skip ci]',
  'skip ci',
  'initial plan',
];

/** True if this commit subject should be excluded from the changelog. */
function shouldSkip(subject) {
  if (MERGE_PREFIXES.some(p => subject.startsWith(p))) return true;
  const lower = subject.toLowerCase();
  return BOT_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}

/**
 * Collect all non-bot, non-merge commit subjects since the most recent
 * bot changelog-update commit.  Falls back to the last 30 commits when no
 * such anchor commit exists.
 */
function getNewCommits() {
  let anchor = '';
  try {
    anchor = execSync(
      `git log --format=%H --grep="chore: update changelog" -1`,
      { encoding: 'utf8' },
    ).trim();
  } catch {
    // no anchor — will fall back to HEAD~30
  }

  const cmd = anchor
    ? `git log --no-merges --format=%s ${anchor}..HEAD`
    : `git log --no-merges --format=%s -30`;

  const lines = execSync(cmd, { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);

  return lines.filter(s => !shouldSkip(s));
}

/**
 * Ask the GitHub Models AI API to summarise the commit list into one
 * concise sentence.  Returns null when the API is unavailable or errors.
 */
async function summariseWithAI(commits) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;

  try {
    const response = await fetch(
      'https://models.inference.ai.azure.com/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a changelog writer. Summarise the following git commit messages into a single concise sentence (under 120 characters) that describes what was added or changed. Return only the summary sentence with no extra punctuation or quotes. Do not include the phrase "Initial plan" in your response.',
            },
            { role: 'user', content: commits.join('\n') },
          ],
          max_tokens: 80,
        }),
      },
    );

    if (!response.ok) {
      console.warn(`GitHub Models API returned ${response.status} — using fallback.`);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.warn(`GitHub Models API error: ${err.message} — using fallback.`);
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────────

const currentVersion = readCurrentVersion();
const newVersion = incrementPatch(currentVersion);

const commits = getNewCommits();

if (commits.length === 0) {
  console.log('No new commits to document — skipping changelog update.');
} else {
  console.log(`Found ${commits.length} commit(s) since last changelog update:`);
  for (const c of commits) console.log(`  • ${c}`);

  let summary = await summariseWithAI(commits);
  if (summary) {
    console.log(`AI summary: ${summary}`);
  } else {
    // Fallback: use the single commit message, or join multiple with "; "
    summary = commits.length === 1 ? commits[0] : commits.join('; ');
    console.log(`Fallback summary: ${summary}`);
  }

  // Prepend new entry at the top of the version list
  let changelog = readFileSync(CHANGELOG_PATH, 'utf8');
  const newLine = `${newVersion} - ${summary}  `;
  const firstEntryMatch = changelog.match(VERSION_LINE_PATTERN);
  if (firstEntryMatch?.index !== undefined) {
    changelog =
      changelog.substring(0, firstEntryMatch.index) +
      newLine + '\n' +
      changelog.substring(firstEntryMatch.index);
  } else {
    changelog += '\n' + newLine + '\n';
  }

  writeFileSync(CHANGELOG_PATH, changelog, 'utf8');
  console.log(`Added changelog entry: ${newLine.trimEnd()}`);
}

// ── Sync APP_VERSION in data.js ────────────────────────────────

const dataJs = readFileSync(DATA_JS_PATH, 'utf8');
const updatedDataJs = dataJs.replace(
  /const APP_VERSION\s*=\s*['"][^'"]*['"];/,
  `const APP_VERSION = '${newVersion}';`,
);

if (updatedDataJs !== dataJs) {
  writeFileSync(DATA_JS_PATH, updatedDataJs, 'utf8');
  console.log(`Updated APP_VERSION → '${newVersion}' in ${DATA_JS_PATH}`);
} else {
  console.log(`APP_VERSION is already '${newVersion}' — no data.js change needed.`);
}
