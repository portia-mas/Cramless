/**
 * Given a list of assignments and a list of free slots (sorted, non-overlapping,
 * chronological), greedily allocate study-block time to each assignment before
 * its due date, prioritizing the earliest deadlines first.
 *
 * Each assignment: { title, dueDate: Date, hoursNeeded: number }
 * Each slot: { start: Date, end: Date }
 *
 * Returns: {
 *   scheduled: [{ assignment, blocks: [{start, end}] }],
 *   warnings: [{ assignment, hoursShort }]
 * }
 */
function scheduleAssignments(assignments, freeSlots) {
  // Work on a mutable copy of slots so allocating time to one assignment
  // shrinks availability for the next.
  const slots = freeSlots.map((s) => ({ start: new Date(s.start), end: new Date(s.end) }));

  const sorted = [...assignments].sort((a, b) => a.dueDate - b.dueDate);

  const scheduled = [];
  const warnings = [];

  for (const assignment of sorted) {
    let remainingMs = assignment.hoursNeeded * 60 * 60 * 1000;
    const blocks = [];

    for (const slot of slots) {
      if (remainingMs <= 0) break;
      if (slot.start >= assignment.dueDate) continue; // slot is after the deadline, useless
      if (slot.end <= slot.start) continue;

      const usableEnd = slot.end > assignment.dueDate ? assignment.dueDate : slot.end;
      const available = usableEnd - slot.start;
      if (available <= 0) continue;

      const take = Math.min(available, remainingMs);
      const blockStart = new Date(slot.start);
      const blockEnd = new Date(slot.start.getTime() + take);

      blocks.push({ start: blockStart, end: blockEnd });

      // Shrink the slot so later assignments don't reuse this time
      slot.start = new Date(blockEnd);
      remainingMs -= take;
    }

    scheduled.push({ assignment, blocks });

    if (remainingMs > 0) {
      warnings.push({
        assignment,
        hoursShort: Math.round((remainingMs / (60 * 60 * 1000)) * 10) / 10,
      });
    }
  }

  return { scheduled, warnings };
}

module.exports = { scheduleAssignments };
