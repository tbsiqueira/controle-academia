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
    { name: '?v=N asset URLs', pattern: /(\?v=)\d+/g, count: 7 },
    { name: 'footer', pattern: /(<span id="appVersion">v)\d+(?=<\/span>)/g, count: 1 }
  ],
  'sw.js': [
    { name: 'CACHE_NAME', pattern: /('meu-treino-v)\d+(?=')/g, count: 1 },
    { name: 'ASSETS ?v=N', pattern: /(\?v=)\d+/g, count: 7 }
  ]
};

function parseVersion(json) {
  const version = JSON.parse(json).version;
  if (!Number.isInteger(version) || version < 1) {
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

// Stamps the files under `root`. Returns the names of the files that changed.
function stampAll(root) {
  const version = parseVersion(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  const changed = [];
  const results = {};
  for (const file of Object.keys(SPOTS)) {
    const before = fs.readFileSync(path.join(root, file), 'utf8');
    const after = stampText(file, before, version);
    // Read-back guard: every spot must now carry exactly `version`.
    for (const spot of SPOTS[file]) {
      const numbers = [...after.matchAll(spot.pattern)].map((m) => m[0].match(/\d+$/)[0]);
      if (numbers.some((n) => Number(n) !== version)) throw new Error(file + ': ' + spot.name + ' not stamped');
    }
    results[file] = after;
    if (after !== before) changed.push(file);
  }
  // Write only after every file passed, so a failure never leaves the files half stamped.
  for (const file of changed) fs.writeFileSync(path.join(root, file), results[file]);
  return { version, changed };
}

module.exports = { parseVersion, stampText, stampAll, SPOTS };

if (require.main === module) {
  try {
    const { version, changed } = stampAll(ROOT);
    console.log(changed.length ? 'v' + version + ' stamped in ' + changed.join(', ') : 'v' + version + ': already stamped');
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
