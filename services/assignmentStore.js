const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'assignments.json');

function loadRaw() {
  if (!fs.existsSync(DATA_PATH)) return [];
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
}

function saveRaw(list) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(list, null, 2));
}

function getAll() {
  return loadRaw().map((a) => ({ ...a, dueDate: new Date(a.dueDate) }));
}

function add({ title, dueDate, hoursNeeded }) {
  const list = loadRaw();
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title,
    dueDate: new Date(dueDate).toISOString(),
    hoursNeeded: Number(hoursNeeded),
  };
  list.push(entry);
  saveRaw(list);
  return entry;
}

function remove(id) {
  const list = loadRaw().filter((a) => a.id !== id);
  saveRaw(list);
}

module.exports = { getAll, add, remove };
