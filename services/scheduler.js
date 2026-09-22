/**
 * Given a list of assignments and a list of free slots (sorted, non-overlapping,
 * chronological), greedily allocate study-block time to each assignment before
 * its due date, prioritizing by due date first (protects feasibility), with
 * urgency score and priority breaking ties for same-day deadlines.
 *
 * Urgency score = remainingHours / hoursUntilDue. A high score means a lot of
 * work crammed into a short runway - e.g. an assignment due in 2 days needing
 * 8 hours (score 4.0) is more urgent than one due in 1 day needing 1 hour
 * (score 1.0). This is only used as a tie-breaker: prioritizing by score alone
 * was tested and found to let a heavy, later-due task starve a lighter,
 * earlier-due task of the time it needed to avoid missing its own deadline -
 * so earliest-deadline-first remains the primary sort.
 *
 * "remaining hours" = hoursNeeded - hoursScheduled, so a second sync only
 * allocates the portion of work not already placed on the calendar in a
 * previous sync (avoids creating duplicate study blocks for the same hours).
 *
 * Each assignment: { title, dueDate: Date, hoursNeeded: number, hoursScheduled?: number, priority?: 'low'|'medium'|'high' }
 * Each slot: { start: Date, end: Date }
 *
 * Returns: {
 *   scheduled: [{ assignment, blocks: [{start, end}], urgencyScore, remainingHours }],
 *   warnings: [{ assignment, hoursShort }]
 * }
 */
const PRIORITY_WEIGHT = { low: 0.5, medium: 1, high: 1.5 };

function remainingHours(assignment) {
  return Math.max(assignment.hoursNeeded - (assignment.hoursScheduled || 0), 0);
}

function urgencyScore(assignment, now) {
  const hoursUntilDue = Math.max((assignment.dueDate - now) / (60 * 60 * 1000), 0.01); // avoid divide-by-zero for overdue items
  const weight = PRIORITY_WEIGHT[assignment.priority] || 1;
  return (remainingHours(assignment) / hoursUntilDue) * weight;
}

function scheduleAssignments(assignments, freeSlots, now = new Date()) {
  // Work on a mutable copy of slots so allocating time to one assignment
  // shrinks availability for the next.
  const slots = freeSlots.map((s) => ({ start: new Date(s.start), end: new Date(s.end) }));

  // Skip assignments that are already fully scheduled from a prior sync.
  const pending = assignments.filter((a) => remainingHours(a) > 0);

  // Earliest-deadline-first is the primary sort: it protects feasibility, since
  // giving a later-but-heavier task priority can starve an earlier deadline of
  // time it needed and cause it to be missed entirely (confirmed by testing -
  // pure urgency-score ordering did exactly this). Urgency score (which factors
  // in priority) breaks ties when two assignments are due on the same day.
  const sorted = [...pending].sort((a, b) => {
    const dueDiff = a.dueDate - b.dueDate;
    const sameDay = Math.abs(dueDiff) < 24 * 60 * 60 * 1000;
    if (sameDay) return urgencyScore(b, now) - urgencyScore(a, now);
    return dueDiff;
  });

  const scheduled = [];
  const warnings = [];

  for (const assignment of sorted) {
    let remainingMs = remainingHours(assignment) * 60 * 60 * 1000;
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

    scheduled.push({
      assignment,
      blocks,
      urgencyScore: Math.round(urgencyScore(assignment, now) * 100) / 100,
      remainingHours: remainingHours(assignment),
    });

    if (remainingMs > 0) {
      warnings.push({
        assignment,
        hoursShort: Math.round((remainingMs / (60 * 60 * 1000)) * 10) / 10,
      });
    }
  }

  return { scheduled, warnings };
}

module.exports = { scheduleAssignments, urgencyScore, remainingHours };
