const express = require('express');
const router = express.Router();

const assignmentStore = require('../services/assignmentStore');
const calendarService = require('../services/calendarService');
const { scheduleAssignments } = require('../services/scheduler');
const { hasStoredTokens } = require('../services/googleAuth');

// --- Assignments CRUD ---

router.get('/assignments', (req, res) => {
  res.json(assignmentStore.getAll());
});

router.post('/assignments', (req, res) => {
  const { title, dueDate, hoursNeeded } = req.body;
  if (!title || !dueDate || !hoursNeeded) {
    return res.status(400).json({ error: 'title, dueDate, and hoursNeeded are required.' });
  }
  const entry = assignmentStore.add({ title, dueDate, hoursNeeded });
  res.status(201).json(entry);
});

router.delete('/assignments/:id', (req, res) => {
  assignmentStore.remove(req.params.id);
  res.status(204).end();
});

// --- Core sync: read calendar, compute free time, schedule study blocks ---

router.post('/sync', async (req, res) => {
  if (!hasStoredTokens()) {
    return res.status(401).json({ error: 'Google Calendar not connected. Visit /auth/google first.' });
  }

  try {
    const assignments = assignmentStore.getAll();
    if (assignments.length === 0) {
      return res.json({ scheduled: [], warnings: [], message: 'No assignments to schedule.' });
    }

    const now = new Date();
    const latestDue = assignments.reduce((max, a) => (a.dueDate > max ? a.dueDate : max), now);

    const busyEvents = await calendarService.getBusyEvents(now, latestDue);
    const freeSlots = calendarService.computeFreeSlots(busyEvents, now, latestDue);

    const { scheduled, warnings } = scheduleAssignments(assignments, freeSlots);

    // Write study blocks to the actual calendar
    const createdBlocks = [];
    for (const item of scheduled) {
      for (const block of item.blocks) {
        const created = await calendarService.createEvent({
          summary: `Study: ${item.assignment.title}`,
          description: `Auto-scheduled by Cramless. Due ${item.assignment.dueDate.toDateString()}.`,
          start: block.start,
          end: block.end,
        });
        createdBlocks.push({ assignmentId: item.assignment.id, eventId: created.id, start: block.start, end: block.end });
      }
    }

    res.json({
      scheduled: scheduled.map((s) => ({
        assignment: s.assignment,
        blocks: s.blocks,
      })),
      warnings,
      createdBlocks,
    });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
