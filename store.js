import fs from "node:fs";
import path from "node:path";

// Jednostavna JSON perzistencija za MVP. U produkciji: Postgres.
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "store.json");

let state = { scans: [], optouts: [], monitors: [], users: [] };

export function load() {
  try {
    state = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch { /* prvi start */ }
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}

export const store = {
  addScan(scan) { state.scans.unshift(scan); state.scans = state.scans.slice(0, 50); save(); },
  latestScan() { return state.scans[0] || null; },
  scans() { return state.scans; },

  addOptOut(o) { state.optouts.unshift(o); save(); },
  updateOptOut(id, patch) {
    const o = state.optouts.find(x => x.id === id);
    if (o) { Object.assign(o, patch, { updatedAt: new Date().toISOString() }); save(); }
    return o;
  },
  optouts() { return state.optouts; },

  setMonitor(m) {
    state.monitors = state.monitors.filter(x => x.subjectKey !== m.subjectKey);
    state.monitors.push(m); save();
  },
  monitors() { return state.monitors; },

  addUser(u) { state.users = state.users || []; state.users.push(u); save(); },
  userByEmail(email) { return (state.users || []).find(u => u.email === email.toLowerCase()); },
  userById(id) { return (state.users || []).find(u => u.id === id); },
  updateUser(id, patch) {
    const u = this.userById(id);
    if (u) { Object.assign(u, patch); save(); }
    return u;
  },
  deleteUser(id) {
    state.users = (state.users || []).filter(u => u.id !== id);
    state.scans = state.scans.filter(s => s.userId !== id);
    state.monitors = state.monitors.filter(m => m.userId !== id);
    save();
  }
};
