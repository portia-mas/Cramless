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
  return loadRaw().map((a) => ({
    ...a,
    dueDate: new Date(a.dueDate),
    priority: a.priority || 'medium',
    hoursScheduled: a.hoursScheduled || 0,
    eventIds: a.eventIds || [],
  }));
}

function add({ title, dueDate, hoursNeeded, priority }) {
  const list = loadRaw();
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title,
    dueDate: new Date(dueDate).toISOString(),
    hoursNeeded: Number(hoursNeeded),
    priority: priority || 'medium', // 'low' | 'medium' | 'high'
    hoursScheduled: 0, // hours already placed on the calendar in a previous sync
    eventIds: [], // Google Calendar event IDs created for this assignment, so they can be cleaned up later
  };
  list.push(entry);
  saveRaw(list);
  return entry;
}

function remove(id) {
  const list = loadRaw().filter((a) => a.id !== id);
  saveRaw(list);
}

/**
 * Record additional hours scheduled and the calendar event IDs created for
 * this assignment, so a repeated sync only allocates the remaining portion
 * of the work, and so the events can be deleted later on a demo reset.
 */
function addScheduledHours(id, hours, eventIds = []) {
  const list = loadRaw();
  const entry = list.find((a) => a.id === id);
  if (entry) {
    entry.hoursScheduled = (entry.hoursScheduled || 0) + hours;
    entry.eventIds = [...(entry.eventIds || []), ...eventIds];
    saveRaw(list);
  }
}

/**
 * Return every calendar event ID created across all assignments, then wipe
 * the assignment list entirely. Used for a full "reset demo" action.
 */
function clearAllAndReturnEventIds() {
  const list = loadRaw();
  const allEventIds = list.flatMap((a) => a.eventIds || []);
  saveRaw([]);
  return allEventIds;
}

module.exports = { getAll, add, remove, addScheduledHours, clearAllAndReturnEventIds };
