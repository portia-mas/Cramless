const fs = require('fs');
const path = require('path');
const os = require('os');

// assignmentStore reads its data path relative to its own file location, so
// we point it at an isolated temp file per test run by mocking the module's
// resolved path via a temp HOME-like override is overkill here - instead we
// just exercise it against the real data path but reset before/after so the
// developer's actual local data.json is untouched by CI runs elsewhere.
const DATA_PATH = path.join(__dirname, '..', 'data', 'assignments.json');
let backup = null;

beforeEach(() => {
  if (fs.existsSync(DATA_PATH)) {
    backup = fs.readFileSync(DATA_PATH, 'utf-8');
  } else {
    backup = null;
  }
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, '[]');
  jest.resetModules();
});

afterEach(() => {
  if (backup !== null) {
    fs.writeFileSync(DATA_PATH, backup);
  } else if (fs.existsSync(DATA_PATH)) {
    fs.unlinkSync(DATA_PATH);
  }
});

describe('assignmentStore', () => {
  test('add() creates an entry with sensible defaults', () => {
    const store = require('../services/assignmentStore');
    const entry = store.add({ title: 'Essay', dueDate: '2026-10-01T09:00:00', hoursNeeded: 3 });

    expect(entry.title).toBe('Essay');
    expect(entry.hoursNeeded).toBe(3);
    expect(entry.priority).toBe('medium');
    expect(entry.hoursScheduled).toBe(0);
    expect(entry.eventIds).toEqual([]);
    expect(entry.id).toBeTruthy();
  });

  test('getAll() returns dueDate as a real Date object', () => {
    const store = require('../services/assignmentStore');
    store.add({ title: 'Lab report', dueDate: '2026-10-05T09:00:00', hoursNeeded: 2 });

    const all = store.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].dueDate instanceof Date).toBe(true);
  });

  test('remove() deletes only the matching assignment', () => {
    const store = require('../services/assignmentStore');
    const a = store.add({ title: 'A', dueDate: '2026-10-01T09:00:00', hoursNeeded: 1 });
    const b = store.add({ title: 'B', dueDate: '2026-10-02T09:00:00', hoursNeeded: 1 });

    store.remove(a.id);
    const remaining = store.getAll();

    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(b.id);
  });

  test('addScheduledHours() accumulates hours and event IDs across multiple calls', () => {
    const store = require('../services/assignmentStore');
    const a = store.add({ title: 'Project', dueDate: '2026-10-10T09:00:00', hoursNeeded: 5 });

    store.addScheduledHours(a.id, 2, ['evt1']);
    store.addScheduledHours(a.id, 1.5, ['evt2', 'evt3']);

    const [updated] = store.getAll();
    expect(updated.hoursScheduled).toBe(3.5);
    expect(updated.eventIds).toEqual(['evt1', 'evt2', 'evt3']);
  });

  test('clearAllAndReturnEventIds() returns every event ID and empties the store', () => {
    const store = require('../services/assignmentStore');
    const a = store.add({ title: 'A', dueDate: '2026-10-01T09:00:00', hoursNeeded: 1 });
    const b = store.add({ title: 'B', dueDate: '2026-10-02T09:00:00', hoursNeeded: 1 });
    store.addScheduledHours(a.id, 1, ['evtA1']);
    store.addScheduledHours(b.id, 1, ['evtB1', 'evtB2']);

    const eventIds = store.clearAllAndReturnEventIds();

    expect(eventIds.sort()).toEqual(['evtA1', 'evtB1', 'evtB2'].sort());
    expect(store.getAll()).toHaveLength(0);
  });
});
