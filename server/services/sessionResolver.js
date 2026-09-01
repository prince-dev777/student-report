/**
 * Session Resolution Service
 * Resolves active or target academic session for any given punch time, batch, and class.
 * Handles 12-hour (AM/PM) and 24-hour time strings robustly with case-insensitive class/batch matching.
 */

export function timeStringToMinutes(timeStr) {
  if (!timeStr) return null;
  const str = String(timeStr).trim();

  // Match "08:15 AM", "8:15:30 AM", "01:12 PM"
  const match12 = str.match(/^(\d{1,2}):(\d{1,2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10) || 0;
    const modifier = match12[3] ? match12[3].toUpperCase() : null;

    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  // Match 24h "13:00"
  const parts = str.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) || 0;
    if (!isNaN(h)) return h * 60 + m;
  }
  return null;
}

export function resolveSessionForStudent(punchTimeStr, student, sessions) {
  if (!sessions || !Array.isArray(sessions) || sessions.length === 0) return null;
  const punchMin = timeStringToMinutes(punchTimeStr);
  if (punchMin === null) return null;

  let bestMatch = null;
  let bestScore = -1;

  for (const sess of sessions) {
    if (!sess.startTime || !sess.endTime) continue;
    const startMin = timeStringToMinutes(sess.startTime);
    const endMin = timeStringToMinutes(sess.endTime);
    if (startMin === null || endMin === null) continue;

    // Check time window with 45-minute early check-in buffer and 30-minute late buffer
    if (punchMin >= startMin - 45 && punchMin <= endMin + 30) {
      let matchesBatch = true;
      if (Array.isArray(sess.batchIds) && sess.batchIds.length > 0) {
        matchesBatch = student && sess.batchIds.some(b => String(b).trim().toLowerCase() === String(student.batch).trim().toLowerCase());
      } else if (sess.batchId && sess.batchId !== 'all') {
        const bList = sess.batchId.split(',').map(b => b.trim().toLowerCase());
        matchesBatch = student && bList.includes(String(student.batch).trim().toLowerCase());
      }

      let matchesClass = true;
      if (Array.isArray(sess.targetClasses) && sess.targetClasses.length > 0) {
        matchesClass = student && sess.targetClasses.some(c => String(c).trim().toLowerCase() === String(student.class).trim().toLowerCase());
      } else if (sess.className && sess.className !== 'all') {
        const cList = sess.className.split(',').map(c => c.trim().toLowerCase());
        matchesClass = student && cList.includes(String(student.class).trim().toLowerCase());
      }

      if (matchesBatch && matchesClass) {
        let score = 0;
        if ((Array.isArray(sess.batchIds) && sess.batchIds.length > 0) || (sess.batchId && sess.batchId !== 'all')) score += 2;
        if ((Array.isArray(sess.targetClasses) && sess.targetClasses.length > 0) || (sess.className && sess.className !== 'all')) score += 2;

        if (score > bestScore) {
          bestScore = score;
          bestMatch = sess;
        }
      }
    }
  }

  // Fallback: If no batch/class specific session matched in time window, pick any session whose time window matches
  if (!bestMatch) {
    for (const sess of sessions) {
      const startMin = timeStringToMinutes(sess.startTime);
      const endMin = timeStringToMinutes(sess.endTime);
      if (startMin !== null && endMin !== null && punchMin >= startMin - 45 && punchMin <= endMin + 30) {
        bestMatch = sess;
        break;
      }
    }
  }

  return bestMatch;
}
