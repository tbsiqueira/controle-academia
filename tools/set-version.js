'use strict';

/* Stamps the app version from app.json into every place that carries it.
   app.json is the only file a developer edits to bump the version; run `node tools/set-version.js` after.
   The stamped files keep real numbers (no build step), so serve.ps1 still works by edit-and-reload.
   Idempotent: running it again with the same version changes nothing.
   No dependencies (plain Node). */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

// Exactly the version spots, nothing broader: other numbers (Bootstrap internals, DB_VERSION, catalog ids)
// must never match. `count` is how many matches each file must have; any other number is an error.
const SPOTS = {
  'index.html': [
    { name: '?v=N asset URLs', pattern: /(\.(?:css|js)\?v=)\d+(?=["'])/g, count: 7 },
    { name: 'footer', pattern: /(<span id="appVersion">v)\d+(?=<\/span>)/g, count: 1 }
  ],
  'sw.js': [
    { name: 'CACHE_NAME', pattern: /('meu-treino-v)\d+(?=')/g, count: 1 },
    { name: 'ASSETS ?v=N', pattern: /(\.(?:css|js)\?v=)\d+(?=["'])/g, count: 7 }
  ]
};

function parseVersion(json) {
  const version = JSON.parse(json).version;
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error('app.json: "version" must be a positive integer, got ' + JSON.stringify(version));
  }
  return version;
}

// Returns the text of one file stamped with `version`. Throws if a spot has the wrong number of matches.
function stampText(file, text, version) {
  let out = text;
  for (const spot of SPOTS[file]) {
    const found = (out.match(spot.pattern) || []).length;
    if (found !== spot.count) {
      throw new Error(file + ': expected ' + spot.count + ' ' + spot.name + ', found ' + found
        + '. Update SPOTS in tools/set-version.js if the layout changed on purpose.');
    }
    out = out.replace(spot.pattern, '$1' + version);
  }
  return out;
}

// Read-back guard: every spot of `file` in `text` must carry exactly `version`.
function verifyStamped(file, text, version) {
  for (const spot of SPOTS[file]) {
    const numbers = [...text.matchAll(spot.pattern)].map((m) => m[0].match(/\d+$/)[0]);
    if (numbers.some((n) => Number(n) !== version)) throw new Error(file + ': ' + spot.name + ' not stamped');
  }
}

// Stamps the files under `root`. Returns the names of the files that changed.
function stampAll(root) {
  const version = parseVersion(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  const changed = [];
  const results = {};
  for (const file of Object.keys(SPOTS)) {
    const before = fs.readFileSync(path.join(root, file), 'utf8');
    const after = stampText(file, before, version);
    verifyStamped(file, after, version);
    results[file] = after;
    if (after !== before) changed.push(file);
  }
  // Write only after every file passed, so a failure never leaves the files half stamped.
  for (const file of changed) fs.writeFileSync(path.join(root, file), results[file]);
  return { version, changed };
}

module.exports = { parseVersion, stampText, verifyStamped, stampAll, SPOTS };

if (require.main === module) {
  try {
    if (process.argv[2] === '--print') {
      // `--print <file|->`: prints the version of an app.json (or of stdin with "-"). CI reads it this way,
      // so the workflows validate it exactly like this script does.
      const source = process.argv[3] === '-' ? 0 : path.resolve(process.argv[3] || path.join(ROOT, 'app.json'));
      console.log(parseVersion(fs.readFileSync(source, 'utf8')));
    } else {
      // Optional folder argument (used by the tests); defaults to the repo root.
      const { version, changed } = stampAll(process.argv[2] ? path.resolve(process.argv[2]) : ROOT);
      console.log(changed.length ? 'v' + version + ' stamped in ' + changed.join(', ') : 'v' + version + ': already stamped');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;   // exitCode, never process.exit(): lets piped stdout flush (Windows)
  }
}
