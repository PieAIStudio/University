/**
 * Bring the art kit in from the WOC donor, and refuse anything this product
 * cannot legally sell.
 *
 * The donor's CREDITS.md is explicit that its MIT licence covers source code
 * and not media, and that the media splits three ways:
 *
 *   - CC0 1.0 packs (KayKit, Quaternius, Kenney, ambientCG, Poly Haven). Public
 *     domain. A paid product may ship these with no attribution and no fee.
 *     This is most of the models, and it is all this script will take.
 *   - CC BY-NC 4.0 (@jamiecypher's sound effects). Commercial use is *not*
 *     granted. The donor has its own commercial licence from the author, and
 *     CREDITS.md says in as many words that the grant does not transfer with a
 *     fork. University charges money, so these are unusable here.
 *   - "With the project only" (the streamed soundtrack, project-generated SFX).
 *     Shippable inside WOC or a fork of it, not extractable into another
 *     product.
 *
 * So this file is a whitelist, not a copier. Every entry names the pack it came
 * from and the licence that lets it be here, and the manifest it writes carries
 * that record into the app so provenance survives the copy. Adding an asset
 * means adding a row with a licence, which is the point: a glob would quietly
 * pull in the two categories above the first time the donor reorganises a
 * directory.
 *
 * Audio is deliberately absent. See the NC and project-only notes above — the
 * donor row in donors.md says University may take WOC's *audio unlock* (the
 * code pattern), and it does, in src/world/audio.ts. It never said the sounds.
 *
 *   pnpm kit
 */
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..");
const donor = resolve(repo, "../_donors/world-of-claudecraft/public");
const outDir = join(repo, "public/kit");
const manifestPath = join(repo, "src/world/kit.json");

/** The packs, with the licence that makes each one shippable in a paid product. */
const PACKS = {
  nature: {
    pack: "Stylized Nature MegaKit",
    author: "Quaternius",
    source: "https://quaternius.itch.io/stylized-nature-megakit",
    license: "CC0 1.0",
  },
  village: {
    pack: "Medieval Village Pack / Fantasy Props MegaKit",
    author: "Quaternius",
    source: "https://quaternius.com/packs/medievalvillage.html",
    license: "CC0 1.0",
  },
  pirate: {
    pack: "Pirate Kit",
    author: "Quaternius",
    source: "https://quaternius.com/packs/piratekit.html",
    license: "CC0 1.0",
  },
  chars: {
    pack: "KayKit Character Pack: Adventurers",
    author: "Kay Lousberg (KayKit)",
    source: "https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0",
    license: "CC0 1.0",
  },
};

/**
 * role → what the world uses it for. The role is the contract; the file behind
 * it can be swapped without touching scene code.
 */
const KIT = [
  // Growth. An island gains these as its lessons are finished, so the order
  // here is the order a learner sees the place fill in.
  ["tree-broad-a", "models/foliage/oak_1.glb", "nature"],
  ["tree-broad-b", "models/foliage/oak_3.glb", "nature"],
  ["tree-tall-a", "models/foliage/pine_1.glb", "nature"],
  ["tree-tall-b", "models/foliage/pine_3.glb", "nature"],
  ["bush", "models/foliage/bush.glb", "nature"],
  ["bush-flowering", "models/foliage/bush_flowers.glb", "nature"],
  ["fern", "models/foliage/fern.glb", "nature"],
  ["mushroom", "models/foliage/mushroom.glb", "nature"],

  // Rock. The bones of an island that has had nothing built on it yet.
  ["rock-a", "models/foliage/rock_1.glb", "nature"],
  ["rock-b", "models/foliage/rock_2.glb", "nature"],
  ["rock-c", "models/foliage/rock_3.glb", "nature"],

  // Settlement. Proof that someone lived here — which is what finishing a unit
  // is meant to feel like.
  ["house-small", "models/props/house_3.glb", "village"],
  ["house-mid", "models/props/house_1.glb", "village"],
  ["house-large", "models/props/house_2.glb", "village"],
  ["hall", "models/props/inn.glb", "village"],
  ["well", "models/props/well.glb", "village"],

  // The single lit thing. Only ever on the one island a learner should open
  // next, which is the whole reason the map has one accent instead of many.
  ["beacon", "models/props/bonfire.glb", "village"],

  // Shore. Where a road from another island lands.
  ["dock", "models/biome/beach_dock.glb", "pirate"],
  ["palm", "models/biome/beach_palm_1.glb", "pirate"],

  // The learner.
  ["learner", "models/chars/players/rogue_hooded.glb", "chars"],
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * The donor's CREDITS.md, compiled once into something a script can enforce.
 *
 * 2,593 files, 648 rules, every file under exactly one of them. 859 are CC0 and
 * sellable; the other 1,734 are not, and a third of those are simply not
 * recorded anywhere in the register — which CREDITS.md is explicit means "we
 * have not written the terms down", not "help yourself".
 */
const licenses = JSON.parse(readFileSync(join(here, "woc-licenses.json"), "utf8"));

/** Segment-wise glob. `*` must not cross a directory boundary; `fnmatch` lets it. */
function matches(pattern, path) {
  const glob = pattern.split("/");
  const parts = path.split("/");
  const walk = (g, p) => {
    if (g === glob.length) return p === parts.length;
    if (glob[g] === "**") {
      for (let skip = p; skip <= parts.length; skip += 1) if (walk(g + 1, skip)) return true;
      return false;
    }
    if (p === parts.length) return false;
    const literal = glob[g]
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, "[^/]");
    return new RegExp(`^${literal}$`).test(parts[p]) && walk(g + 1, p + 1);
  };
  return walk(0, 0);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const assets = {};
let total = 0;
const missing = [];

for (const [role, rel, packKey] of KIT) {
  const from = join(donor, rel);
  let bytes;
  try {
    bytes = readFileSync(from);
  } catch {
    missing.push(rel);
    continue;
  }
  const pack = PACKS[packKey];
  // Two independent checks, because one of them is my own bookkeeping.
  //
  // The first says the pack this file was filed under is CC0. The second asks
  // the donor's own register, compiled into `woc-licenses.json`, what it says
  // about this exact path — which is the check that catches the case where a
  // file was filed under the wrong pack, or the donor reorganised a directory
  // and a path now lands in a pack that is not sellable. Review is a person
  // and this is not.
  if (pack.license !== "CC0 1.0") {
    throw new Error(`refusing ${rel}: ${pack.license} is not sellable in this product`);
  }
  const rule = licenses.rules.find((entry) => matches(entry.match, rel));
  if (!rule) {
    throw new Error(`refusing ${rel}: the donor's licence register says nothing about it`);
  }
  if (rule.commercialUse !== true) {
    throw new Error(`refusing ${rel}: register says ${rule.license} — not sellable`);
  }
  const file = `${role}.glb`;
  cpSync(from, join(outDir, file));
  total += bytes.length;
  assets[role] = {
    src: `/kit/${file}`,
    bytes: bytes.length,
    sha256: sha256(bytes).slice(0, 16),
    from: rel,
    ...pack,
  };
}

if (missing.length) {
  throw new Error(`donor is missing ${missing.length} file(s):\n  ${missing.join("\n  ")}`);
}

writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      note: "Generated by scripts/import-kit.mjs. Every entry is CC0 1.0 and sellable.",
      donor: "world-of-claudecraft",
      assets,
    },
    null,
    2,
  )}\n`,
);

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
console.log(
  `import-kit: ${Object.keys(assets).length} assets, ${mb(total)}, all CC0 1.0.\n` +
    `  → public/kit/ (untracked bytes), src/world/kit.json (tracked provenance)`,
);

// Fourteen of these models carry KTX2/Basis textures, so the transcoder that
// reads them has to be served by this product too.
//
// It comes out of three's own distribution rather than a CDN: the Web3D
// baseline forbids a runtime CDN fetch, and a world that silently fails to
// paint on a bad network is worse than one that is a little larger. The
// alternative — unpacking KTX2 at build time — needs the KTX-Software `ktx`
// binary on the machine running the import, which would make a fresh clone
// depend on a Homebrew formula. It is also the worse trade: Basis stays
// compressed in GPU memory, where a PNG or WebP is expanded to raw RGBA the
// moment it is uploaded.
const basisFrom = resolve(repo, "node_modules/three/examples/jsm/libs/basis");
const basisTo = join(repo, "public/basis");
mkdirSync(basisTo, { recursive: true });
let basisBytes = 0;
for (const file of ["basis_transcoder.js", "basis_transcoder.wasm"]) {
  cpSync(join(basisFrom, file), join(basisTo, file));
  basisBytes += statSync(join(basisTo, file)).size;
}
console.log(`  + Basis transcoder ${mb(basisBytes)} → public/basis/ (from three, not a CDN)`);
