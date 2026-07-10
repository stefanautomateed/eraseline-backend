import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "store.json");

let state = emptyState();
let pool = null;
let persistQueue = Promise.resolve();

function emptyState() {
  return { scans: [], optouts: [], monitors: [], users: [] };
}

function normalizeState(value) {
  return {
    scans: Array.isArray(value?.scans) ? value.scans : [],
    optouts: Array.isArray(value?.optouts) ? value.optouts : [],
    monitors: Array.isArray(value?.monitors) ? value.monitors : [],
    users: Array.isArray(value?.users) ? value.users : []
  };
}

function postgresSsl(connectionString) {
  const host = new URL(connectionString).hostname;
  return host.endsWith(".internal") ? false : { rejectUnauthorized: false };
}

export async function load() {
  if (process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: postgresSsl(process.env.DATABASE_URL),
      max: 5
    });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS eraseline_state (
        id SMALLINT PRIMARY KEY CHECK (id = 1),
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const result = await pool.query("SELECT data FROM eraseline_state WHERE id = 1");
    state = result.rows[0] ? normalizeState(result.rows[0].data) : emptyState();
    if (!result.rows[0]) {
      save();
      await store.flush();
    }
    return;
  }

  try {
    state = normalizeState(JSON.parse(fs.readFileSync(FILE, "utf8")));
  } catch {
    state = emptyState();
  }
}

function save() {
  if (pool) {
    const snapshot = JSON.stringify(state);
    persistQueue = persistQueue.then(() => pool.query(`
      INSERT INTO eraseline_state (id, data, updated_at)
      VALUES (1, $1::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = NOW()
    `, [snapshot]));
    return;
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}

export const store = {
  mode() { return pool ? "postgres" : "file"; },
  flush() { return persistQueue; },

  addScan(scan) {
    state.scans.unshift(scan);
    state.scans = state.scans.slice(0, 200);
    save();
  },
  latestScan(userId) { return state.scans.find(scan => scan.userId === userId) || null; },
  scans(userId) { return userId ? state.scans.filter(scan => scan.userId === userId) : state.scans; },

  addOptOut(optout) { state.optouts.unshift(optout); save(); },
  updateOptOut(id, userId, patch) {
    const optout = state.optouts.find(item => item.id === id && item.userId === userId);
    if (optout) {
      Object.assign(optout, patch, { updatedAt: new Date().toISOString() });
      save();
    }
    return optout;
  },
  optouts(userId) {
    return userId ? state.optouts.filter(optout => optout.userId === userId) : state.optouts;
  },

  setMonitor(monitor) {
    state.monitors = state.monitors.filter(item =>
      !(item.userId === monitor.userId && item.subjectKey === monitor.subjectKey));
    state.monitors.push(monitor);
    save();
  },
  monitors(userId) {
    return userId ? state.monitors.filter(monitor => monitor.userId === userId) : state.monitors;
  },

  addUser(user) { state.users.push(user); save(); },
  userByEmail(email) {
    return state.users.find(user => user.email === String(email).toLowerCase());
  },
  userById(id) { return state.users.find(user => user.id === id); },
  updateUser(id, patch) {
    const user = this.userById(id);
    if (user) { Object.assign(user, patch); save(); }
    return user;
  },
  deleteUser(id) {
    state.users = state.users.filter(user => user.id !== id);
    state.scans = state.scans.filter(scan => scan.userId !== id);
    state.optouts = state.optouts.filter(optout => optout.userId !== id);
    state.monitors = state.monitors.filter(monitor => monitor.userId !== id);
    save();
  }
};
