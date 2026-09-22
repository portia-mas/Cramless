const { scheduleAssignments, urgencyScore, remainingHours } = require('../services/scheduler');

const NOW = new Date('2026-09-22T09:00:00');

function assignment(overrides) {
  return {
    id: 'a1',
    title: 'Test assignment',
    dueDate: new Date('2026-09-25T09:00:00'),
    hoursNeeded: 2,
    hoursScheduled: 0,
    priority: 'medium',
    ...overrides,
  };
}

describe('remainingHours', () => {
  test('equals hoursNeeded when nothing has been scheduled yet', () => {
    expect(remainingHours(assignment({ hoursNeeded: 3, hoursScheduled: 0 }))).toBe(3);
  });

  test('subtracts hoursScheduled from hoursNeeded', () => {
    expect(remainingHours(assignment({ hoursNeeded: 5, hoursScheduled: 2 }))).toBe(3);
  });

  test('never goes negative if hoursScheduled exceeds hoursNeeded', () => {
    expect(remainingHours(assignment({ hoursNeeded: 2, hoursScheduled: 5 }))).toBe(0);
  });
});

describe('scheduleAssignments - basic allocation', () => {
  test('schedules a single assignment fully when enough free time exists', () => {
    const a = assignment({ dueDate: new Date('2026-09-23T09:00:00'), hoursNeeded: 2 });
    const freeSlots = [{ start: new Date('2026-09-22T10:00:00'), end: new Date('2026-09-22T18:00:00') }];

    const { scheduled, warnings } = scheduleAssignments([a], freeSlots, NOW);

    expect(warnings).toHaveLength(0);
    expect(scheduled[0].blocks).toHaveLength(1);
    const totalMs = scheduled[0].blocks.reduce((sum, b) => sum + (b.end - b.start), 0);
    expect(totalMs / (60 * 60 * 1000)).toBe(2);
  });

  test('produces a warning when there is not enough free time before the deadline', () => {
    const a = assignment({ dueDate: new Date('2026-09-22T11:00:00'), hoursNeeded: 5 });
    const freeSlots = [{ start: new Date('2026-09-22T10:00:00'), end: new Date('2026-09-22T11:00:00') }]; // only 1 hour available

    const { warnings } = scheduleAssignments([a], freeSlots, NOW);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].hoursShort).toBe(4);
  });

  test('does not allocate time in a slot that starts after the assignment is due', () => {
    const a = assignment({ dueDate: new Date('2026-09-22T12:00:00'), hoursNeeded: 1 });
    const freeSlots = [{ start: new Date('2026-09-22T13:00:00'), end: new Date('2026-09-22T18:00:00') }]; // entirely after due date

    const { scheduled, warnings } = scheduleAssignments([a], freeSlots, NOW);

    expect(scheduled[0].blocks).toHaveLength(0);
    expect(warnings[0].hoursShort).toBe(1);
  });
});

describe('scheduleAssignments - regression: deadline starvation', () => {
  // This reproduces a real bug found during manual testing: prioritizing
  // purely by urgency score (hoursNeeded / hoursUntilDue) let a heavier,
  // later-due assignment consume all of today's free time, causing a
  // lighter, earlier-due assignment to miss its own deadline entirely -
  // even though there was clearly enough total free time for both.
  test('never lets a later, heavier assignment cause an earlier one to miss its deadline when both are feasible', () => {
    const small = assignment({
      id: 'small',
      title: 'Small task due tomorrow',
      dueDate: new Date('2026-09-23T09:00:00'),
      hoursNeeded: 1,
    });
    const big = assignment({
      id: 'big',
      title: 'Big task due in 2 days',
      dueDate: new Date('2026-09-24T09:00:00'),
      hoursNeeded: 8,
    });

    const freeSlots = [
      { start: new Date('2026-09-22T10:00:00'), end: new Date('2026-09-22T18:00:00') }, // 8h today
      { start: new Date('2026-09-23T10:00:00'), end: new Date('2026-09-23T18:00:00') }, // 8h tomorrow
    ];

    const { warnings } = scheduleAssignments([small, big], freeSlots, NOW);

    expect(warnings).toHaveLength(0); // both should be fully schedulable - neither should be short
  });
});

describe('scheduleAssignments - same-day tie-breaking', () => {
  test('prioritizes the heavier assignment when two are due on the same day', () => {
    const light = assignment({
      id: 'light',
      dueDate: new Date('2026-09-23T20:00:00'),
      hoursNeeded: 1,
    });
    const heavy = assignment({
      id: 'heavy',
      dueDate: new Date('2026-09-23T20:00:00'),
      hoursNeeded: 6,
    });

    const freeSlots = [
      { start: new Date('2026-09-22T10:00:00'), end: new Date('2026-09-22T18:00:00') },
      { start: new Date('2026-09-23T10:00:00'), end: new Date('2026-09-23T18:00:00') },
    ];

    const { scheduled } = scheduleAssignments([light, heavy], freeSlots, NOW);

    expect(scheduled[0].assignment.id).toBe('heavy');
  });

  test('higher priority breaks a tie between two same-day, same-workload assignments', () => {
    const lowPriority = assignment({ id: 'low', priority: 'low', dueDate: new Date('2026-09-23T20:00:00'), hoursNeeded: 2 });
    const highPriority = assignment({ id: 'high', priority: 'high', dueDate: new Date('2026-09-23T20:00:00'), hoursNeeded: 2 });

    const freeSlots = [{ start: new Date('2026-09-22T10:00:00'), end: new Date('2026-09-22T18:00:00') }];

    const { scheduled } = scheduleAssignments([lowPriority, highPriority], freeSlots, NOW);

    expect(scheduled[0].assignment.id).toBe('high');
  });
});

describe('scheduleAssignments - resuming a partially scheduled assignment', () => {
  test('only allocates the remaining hours, not the full original amount', () => {
    const a = assignment({ hoursNeeded: 5, hoursScheduled: 3, dueDate: new Date('2026-09-23T09:00:00') });
    const freeSlots = [{ start: new Date('2026-09-22T10:00:00'), end: new Date('2026-09-22T18:00:00') }];

    const { scheduled } = scheduleAssignments([a], freeSlots, NOW);

    const totalMs = scheduled[0].blocks.reduce((sum, b) => sum + (b.end - b.start), 0);
    expect(totalMs / (60 * 60 * 1000)).toBe(2); // 5 needed - 3 already scheduled = 2 remaining
  });

  test('skips an assignment entirely if it is already fully scheduled', () => {
    const a = assignment({ hoursNeeded: 3, hoursScheduled: 3 });
    const freeSlots = [{ start: new Date('2026-09-22T10:00:00'), end: new Date('2026-09-22T18:00:00') }];

    const { scheduled, warnings } = scheduleAssignments([a], freeSlots, NOW);

    expect(scheduled).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });
});

describe('urgencyScore', () => {
  test('increases with more remaining hours relative to time left', () => {
    const soon = assignment({ dueDate: new Date('2026-09-23T09:00:00'), hoursNeeded: 4 }); // 24h window
    const later = assignment({ dueDate: new Date('2026-09-29T09:00:00'), hoursNeeded: 4 }); // 168h window

    expect(urgencyScore(soon, NOW)).toBeGreaterThan(urgencyScore(later, NOW));
  });

  test('a high priority assignment scores higher than an otherwise identical low priority one', () => {
    const low = assignment({ priority: 'low' });
    const high = assignment({ priority: 'high' });

    expect(urgencyScore(high, NOW)).toBeGreaterThan(urgencyScore(low, NOW));
  });
});
