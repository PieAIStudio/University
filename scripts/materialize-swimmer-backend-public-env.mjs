#!/usr/bin/env node

import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const args = parseArgs(process.argv.slice(2));
const secretsRoot = resolveSecretsRoot(args.secretsRoot);
const sourcePath = join(secretsRoot, 'swimmer-backend', 'local.server.env');
const outputPath = join(secretsRoot, 'university', 'local.public.env');
const analyticsPath = join(secretsRoot, 'university', 'analytics.env');
/*
 * Optional local override, so a developer's browser can talk to a staging
 * project while every other consumer keeps the shared one. Absent by default:
 * without this file the projection is exactly the central source, which is
 * what CI and a fresh clone must see.
 */
const overridePath = join(secretsRoot, 'university', 'backend-override.env');
const appEnvPath = join(PROJECT_ROOT, 'apps', 'university', '.env.local');
const ANALYTICS_VARIABLES = [
  'VITE_POSTHOG_KEY',
  'VITE_POSTHOG_HOST',
  'VITE_ENABLE_POSTHOG',
];

const source = readEnvFile(sourcePath);
const override = readOptionalEnvFile(overridePath);
const publicConfig = readPublicConfig(applyOverride(source, override));
const analytics = readOptionalEnvFile(analyticsPath);
const expectedBody = [
  `VITE_SWIMMER_BACKEND_SUPABASE_URL=${publicConfig.url}`,
  `VITE_SWIMMER_BACKEND_PUBLISHABLE_KEY=${publicConfig.publishableKey}`,
  ...analyticsLines(analytics),
  '',
].join('\n');

if (args.check) {
  assertProjection(outputPath, expectedBody);
  assertProjectSymlink(appEnvPath, outputPath);
  console.log('University SwimmerBackend public projection: synchronized');
} else {
  writeProjection(outputPath, expectedBody);
  ensureProjectSymlink(appEnvPath, outputPath);
  console.log(`University SwimmerBackend public projection: wrote ${outputPath}`);
}

function parseArgs(argv) {
  const parsed = { check: false, secretsRoot: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') {
      parsed.check = true;
      continue;
    }
    if (arg === '--secrets-root') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--secrets-root needs a value');
      }
      parsed.secretsRoot = value;
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: PIEAI_SECRETS_ROOT=<root> pnpm secrets:materialize:university [--check]\n' +
          '       pnpm secrets:materialize:university -- --secrets-root <root> [--check]',
      );
      process.exit(0);
    }
    throw new Error(`unknown option ${arg}`);
  }
  return parsed;
}

function resolveSecretsRoot(explicitRoot) {
  const value = explicitRoot ?? process.env.PIEAI_SECRETS_ROOT;
  if (!value) {
    throw new Error(
      'PIEAI_SECRETS_ROOT is required; point it at the central .secrets directory without printing values.',
    );
  }
  const root = resolve(value);
  if (!isAbsolute(root)) throw new Error('PIEAI_SECRETS_ROOT must resolve to an absolute path');
  return root;
}

function readEnvFile(path) {
  if (!existsSync(path)) throw new Error(`Central source file is missing: ${path}`);
  const values = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    values[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
  return values;
}

/*
 * An override replaces a whole alias pair, never half of one. Setting only the
 * canonical name would leave the legacy alias pointing at the shared project,
 * and `readAlias` rightly refuses a config that names two different backends.
 */
function applyOverride(source, override) {
  if (Object.keys(override).length === 0) return source;
  const merged = { ...source };
  for (const [canonical, legacy] of [
    ['SWIMMER_BACKEND_SUPABASE_URL', 'SWIMMER_CORE_SUPABASE_URL'],
    ['SWIMMER_BACKEND_PUBLISHABLE_KEY', 'SWIMMER_CORE_PUBLISHABLE_KEY'],
  ]) {
    const value = override[canonical] ?? override[legacy];
    if (value === undefined) continue;
    merged[canonical] = value;
    merged[legacy] = value;
  }
  return merged;
}

function readOptionalEnvFile(path) {
  return existsSync(path) ? readEnvFile(path) : {};
}

function analyticsLines(source) {
  return ANALYTICS_VARIABLES.flatMap((key) =>
    Object.hasOwn(source, key) ? [`${key}=${source[key]}`] : [],
  );
}

function readPublicConfig(source) {
  const url = readAlias(source, 'SWIMMER_BACKEND_SUPABASE_URL', 'SWIMMER_CORE_SUPABASE_URL');
  const publishableKey = readAlias(
    source,
    'SWIMMER_BACKEND_PUBLISHABLE_KEY',
    'SWIMMER_CORE_PUBLISHABLE_KEY',
  );
  if (!url || !publishableKey) {
    throw new Error(
      'Central source must provide SWIMMER_BACKEND_* or legacy SWIMMER_CORE_* URL and publishable key.',
    );
  }
  if (/^sb_secret_/i.test(publishableKey) || /service_role/i.test(publishableKey)) {
    throw new Error('Central publishable key is a server secret; refuse to project it to Vite.');
  }
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('Central Supabase URL must be an http(s) URL.');
  }
  return { url, publishableKey };
}

function readAlias(source, canonicalName, legacyName) {
  const canonical = source[canonicalName]?.trim() ?? '';
  const legacy = source[legacyName]?.trim() ?? '';
  if (canonical && legacy && canonical !== legacy) {
    throw new Error(`Central aliases disagree: ${canonicalName} and ${legacyName}.`);
  }
  return canonical || legacy;
}

function writeProjection(path, body) {
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
    throw new Error(`Refuse to overwrite symlinked central projection: ${path}`);
  }
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  chmodSync(dirname(path), 0o700);
  writeFileSync(path, body, { encoding: 'utf8', mode: 0o600 });
  chmodSync(path, 0o600);
}

function assertProjection(path, expectedBody) {
  if (!existsSync(path)) throw new Error(`University public projection is missing: ${path}`);
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`University public projection must be a regular file: ${path}`);
  }
  if (readFileSync(path, 'utf8') !== expectedBody) {
    throw new Error(`University public projection is out of sync: ${path}`);
  }
  if ((info.mode & 0o777) !== 0o600) {
    throw new Error(`University public projection must have mode 600: ${path}`);
  }
}

function ensureProjectSymlink(linkPath, targetPath) {
  if (existsSync(linkPath)) {
    assertProjectSymlink(linkPath, targetPath);
    return;
  }
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(relative(dirname(linkPath), targetPath), linkPath);
}

function assertProjectSymlink(linkPath, targetPath) {
  if (!existsSync(linkPath)) throw new Error(`University .env.local symlink is missing: ${linkPath}`);
  const info = lstatSync(linkPath);
  if (!info.isSymbolicLink()) {
    throw new Error(`Refuse to replace a regular University .env.local file: ${linkPath}`);
  }
  const resolvedTarget = resolve(dirname(linkPath), readlinkSync(linkPath));
  if (resolvedTarget !== resolve(targetPath)) {
    throw new Error(`University .env.local points elsewhere: ${linkPath}`);
  }
}
