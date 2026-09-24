const { google } = require('googleapis');
const { getAuthorizedClient } = require('./googleAuth');

const WORK_DAY_START = parseInt(process.env.WORK_DAY_START || '9', 10);
const WORK_DAY_END = parseInt(process.env.WORK_DAY_END || '22', 10);

/**
 * Fetch busy events between now and a given end date from the user's primary calendar.
 */
async function getBusyEvents(timeMin, timeMax) {
  const auth = await getAuthorizedClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (res.data.items || [])
    .filter((e) => e.start?.dateTime && e.end?.dateTime) // skip all-day events for slot-finding
    .map((e) => ({
      summary: e.summary || '(no title)',
      start: new Date(e.start.dateTime),
      end: new Date(e.end.dateTime),
    }));
}

/**
 * Given busy events within a window, compute free slots per day, clipped to
 * WORK_DAY_START - WORK_DAY_END, and skipping the past.
 */
function computeFreeSlots(busyEvents, windowStart, windowEnd) {
  const freeSlots = [];
  const dayCursor = new Date(windowStart);
  dayCursor.setHours(0, 0, 0, 0);

  while (dayCursor < windowEnd) {
    const dayStart = new Date(dayCursor);
    dayStart.setHours(WORK_DAY_START, 0, 0, 0);
    const dayEnd = new Date(dayCursor);
    dayEnd.setHours(WORK_DAY_END, 0, 0, 0);

    const effectiveStart = dayStart < windowStart ? windowStart : dayStart;
    const effectiveEnd = dayEnd > windowEnd ? windowEnd : dayEnd;

    if (effectiveStart < effectiveEnd) {
      const dayBusy = busyEvents
        .filter((e) => e.start < effectiveEnd && e.end > effectiveStart)
        .sort((a, b) => a.start - b.start);

      let cursor = effectiveStart;
      for (const busy of dayBusy) {
        if (busy.start > cursor) {
          freeSlots.push({ start: new Date(cursor), end: new Date(busy.start) });
        }
        if (busy.end > cursor) cursor = busy.end;
      }
      if (cursor < effectiveEnd) {
        freeSlots.push({ start: new Date(cursor), end: new Date(effectiveEnd) });
      }
    }

    dayCursor.setDate(dayCursor.getDate() + 1);
  }

  // Drop slots shorter than 30 minutes - not useful for study blocks
  return freeSlots.filter((s) => (s.end - s.start) >= 30 * 60 * 1000);
}

/**
 * Create a calendar event (used for study blocks).
 */
async function createEvent({ summary, description, start, end }) {
  const auth = await getAuthorizedClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary,
      description,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      colorId: '5', // banana yellow - visually distinct as a generated study block
    },
  });

  return res.data;
}

/**
 * Delete a calendar event by ID. Used for demo reset - swallows "not found"
 * errors since the event may have already been deleted manually by the user.
 */
async function deleteEvent(eventId) {
  const auth = await getAuthorizedClient();
  const calendar = google.calendar({ version: 'v3', auth });
  try {
    await calendar.events.delete({ calendarId: 'primary', eventId });
  } catch (err) {
    if (err.code !== 404 && err.code !== 410) throw err; // ignore "already gone"
  }
}

module.exports = {
  getBusyEvents,
  computeFreeSlots,
  createEvent,
  deleteEvent,
};
