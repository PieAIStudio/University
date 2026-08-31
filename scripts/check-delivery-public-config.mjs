/**
 * A delivery bundle that cannot sign anyone in cannot take anyone's money.
 *
 * Production shipped for four days with no sign-in. The variable was set on
 * the Vercel project the whole time — `vercel env ls` said so. But
 * `vercel build` reads `.vercel/.env.production.local`, a snapshot pulled at
 * some earlier moment, and that file predated the variable. Vite inlined
 * nothing, the identity port reported `unconfigured`, and the account page
 * said 云端账号还未配置 to every visitor. Every check was green, because every
 * check was looking for things that must be *absent*.
 *
 * So this is the companion to check-authoring-excluded: that one proves the
 * bundle does not carry what it must not, this one proves it carries what it
 * cannot work without. Two failure modes, both silent, opposite directions.
 *
 * It answers the question about the artifact, not about the dashboard: is the
 * value actually inside the built JavaScript. A variable present in the
 * environment but not inlined — wrong prefix, wrong envDir, wrong mode — fails
 * here too, and that is the point.
 *
 * Values are never printed. Key names are.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DELIVERY_DIST = join(ROOT, "apps", "university", "dist", "delivery");

/**
 * Each of these is a capability the learner can see missing.
 *
 * The reason is written here rather than in a commit message because the next
 * person to consider deleting one of these lines needs to know what breaks.
 */
const REQUIRED = [
  {
    key: "VITE_SWIMMER_BACKEND_SUPABASE_URL",
    breaks: "no account: /me shows 云端账号还未配置 and the login form never renders",
  },
  {
    key: "VITE_SWIMMER_BACKEND_PUBLISHABLE_KEY",
    breaks: "no account: the client has an address but no way to authenticate against it",
  },
  {
    key: "VITE_UNIVERSITY_GRADING_URL",
    breaks: "no AI grading: every structured answer falls back to deterministic matching",
  },
];

/** Anything still holding the shape of .env.example is not a real value. */
const PLACEHOLDER = /<[^>]*>|your-|placeholder|changeme|example\.com/iu;

/** The bundle is the answer; a lockfile or a sourcemap is not. */
function bundleFiles(root) {
  if (!existsSync(root)) return [];
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (/\.(?:js|mjs|css|html)$/u.test(entry)) out.push(full);
    }
  };
  walk(root);
  return out;
}

if (!existsSync(DELIVERY_DIST)) {
  console.error(
    `delivery public config: no delivery bundle at ${relative(ROOT, DELIVERY_DIST)}; build before checking.`,
  );
  process.exit(1);
}

const sources = bundleFiles(DELIVERY_DIST).map((file) => readFileSync(file, "utf8"));

const failures = [];
for (const { key, breaks } of REQUIRED) {
  const value = (process.env[key] ?? "").trim();
  if (value === "") {
    failures.push(`${key} is unset in the build environment — ${breaks}`);
    continue;
  }
  if (PLACEHOLDER.test(value)) {
    failures.push(`${key} still holds a .env.example placeholder — ${breaks}`);
    continue;
  }
  /*
   * Match on a slice, not the whole value: a bundler may split a long string
   * across concatenation. The tail is the distinctive half of both a project
   * ref and a publishable key, and 16 characters is far past coincidence.
   */
  const fragment = value.length >= 24 ? value.slice(-16) : value;
  if (!sources.some((code) => code.includes(fragment))) {
    failures.push(
      `${key} is set but its value is not in the built bundle — the build did not inline it — ${breaks}`,
    );
  }
}

if (failures.length > 0) {
  console.error(
    "delivery public config: the bundle is missing configuration the learner can feel.\n" +
      "Run `vercel env pull` before `vercel build`: the build reads the pulled snapshot on disk,\n" +
      "not the project's live environment, so a stale pull ships a bundle that looks fine.\n",
  );
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(`delivery public config: ok (${REQUIRED.length} public keys present in the bundle)`);
