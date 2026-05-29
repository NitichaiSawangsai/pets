const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createPetState, normalizeState } = require('./petEngine.cjs');

const STATE_FILE = 'pet-state.json';

function getICloudMirrorDir() {
  return path.join(os.homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'PocketPals');
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file) {
  const raw = await fs.readFile(file, 'utf8');
  if (raw.length > 256 * 1024) {
    throw new Error('State file is too large.');
  }
  return JSON.parse(raw);
}

async function writeJsonAtomic(file, value) {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(tmp, payload, { mode: 0o600 });
  await fs.rename(tmp, file);
}

async function loadState(userDataDir) {
  const localFile = path.join(userDataDir, STATE_FILE);
  const mirrorDir = getICloudMirrorDir();
  const mirrorFile = path.join(mirrorDir, STATE_FILE);
  const candidates = [];

  if (await pathExists(localFile)) candidates.push(localFile);
  if (await pathExists(mirrorFile)) candidates.push(mirrorFile);

  if (!candidates.length) {
    const state = createPetState();
    await saveState(userDataDir, state);
    return state;
  }

  const states = [];
  for (const file of candidates) {
    try {
      states.push(normalizeState(await readJson(file)));
    } catch {
      // Ignore corrupt mirrors and keep the healthiest available source.
    }
  }

  if (!states.length) {
    const state = createPetState();
    await saveState(userDataDir, state);
    return state;
  }

  states.sort((a, b) => Number(b.pet.lastTickAt || 0) - Number(a.pet.lastTickAt || 0));
  return states[0];
}

async function saveState(userDataDir, state) {
  const normalized = normalizeState(state);
  const localFile = path.join(userDataDir, STATE_FILE);
  await writeJsonAtomic(localFile, normalized);

  const mirrorDir = getICloudMirrorDir();
  if (await pathExists(path.dirname(mirrorDir))) {
    await writeJsonAtomic(path.join(mirrorDir, STATE_FILE), normalized);
  }
  return normalized;
}

module.exports = {
  STATE_FILE,
  getICloudMirrorDir,
  loadState,
  saveState,
  writeJsonAtomic
};
