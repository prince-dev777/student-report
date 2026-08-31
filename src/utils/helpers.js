// ============================================
// Career Xone Pro - Helper Utilities
// ============================================

// Format date to readable string
export function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Format date to DD/MM/YYYY
export function formatDateShort(dateStr) {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

// Format time to 12-hour format cleanly
export function formatTime(timeStr) {
  if (!timeStr || timeStr === '-' || timeStr === '--') return '-';
  const str = String(timeStr).trim();
  if (!str || str.toLowerCase().includes('undefined') || str.toLowerCase().includes('nan')) return '-';

  // If already matches "HH:MM AM/PM" or "H:MM AM/PM"
  const ampmMatch = str.match(/^(\d{1,2}):(\d{1,2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    const h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2].padStart(2, '0');
    const ampm = ampmMatch[3].toUpperCase();
    const hour12 = h % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  }

  // If Date / ISO format
  if (str.includes('T') || (str.includes('-') && str.length > 10)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${m} ${ampm}`;
    }
  }

  // If 24-hour "HH:MM" or "HH:MM:SS"
  const parts = str.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const mPart = parseInt(parts[1], 10);
    if (!isNaN(h)) {
      const m = (isNaN(mPart) ? 0 : mPart).toString().padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      return `${hour12}:${m} ${ampm}`;
    }
  }

  return str;
}

// Calculate duration between entry and exit cleanly (e.g. "1h 15m", "45m", "In Institute")
export function calcDuration(entry, exit) {
  if (!entry || entry === '-' || entry === '--') return '-';
  if (!exit || exit === '-' || exit === '--') return 'In Institute';
  
  const parseToMins = (tStr) => {
    if (!tStr) return null;
    const str = String(tStr).trim();
    if (str.toLowerCase().includes('undefined') || str.toLowerCase().includes('nan')) return null;

    const ampmMatch = str.match(/^(\d{1,2}):(\d{1,2})(?::\d{2})?\s*(AM|PM)?$/i);
    if (ampmMatch) {
      let h = parseInt(ampmMatch[1], 10);
      const m = parseInt(ampmMatch[2], 10) || 0;
      const mod = ampmMatch[3] ? ampmMatch[3].toUpperCase() : null;
      if (mod === 'PM' && h < 12) h += 12;
      if (mod === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    }
    const parts = str.split(':');
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) || 0;
      if (!isNaN(h)) return h * 60 + m;
    }
    return null;
  };

  const eMins = parseToMins(entry);
  const xMins = parseToMins(exit);
  if (eMins === null || xMins === null) return '-';

  const diffMins = xMins - eMins;
  if (diffMins < 0 || isNaN(diffMins)) return '-';
  const hrs = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

// Get relative time (e.g., "2 hours ago")
export function getRelativeTime(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  if (isNaN(then.getTime())) return timestamp; // Return raw string if invalid
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(timestamp);
}

// Get today's date string
export function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

// Get current time string HH:MM
export function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// Calculate attendance percentage for a student
export function calcAttendancePercent(attendance, studentId) {
  const studentAtt = attendance.filter((a) => a.studentId === studentId);
  if (studentAtt.length === 0) return 0;
  const present = studentAtt.filter((a) => a.status === 'present' || a.status === 'late').length;
  return Math.round((present / studentAtt.length) * 100);
}

// Get today's attendance stats
export function getTodayAttendanceStats(attendance, students) {
  const activeStudents = students.filter(s => s.status === 'active');
  const validIds = new Set(activeStudents.map(s => s.id));
  const totalStudents = activeStudents.length;

  const today = getTodayStr();
  const todayAtt = attendance.filter((a) => a.date === today && validIds.has(a.studentId));
  const present = todayAtt.filter((a) => a.status === 'present').length;
  const late = todayAtt.filter((a) => a.status === 'late').length;
  const absent = totalStudents - present - late;
  const percentage = totalStudents > 0 ? Math.round(((present + late) / totalStudents) * 100) : 0;
  return { present, late, absent, total: totalStudents, percentage };
}

// Calculate rank for an array of results
export function calculateRanks(results) {
  const sorted = [...results].sort((a, b) => b.marks - a.marks);
  return sorted.map((r, idx) => ({ ...r, rank: idx + 1 }));
}

// Get marks category
export function getMarksCategory(percentage) {
  if (percentage >= 85) return 'high';
  if (percentage >= 60) return 'medium';
  return 'low';
}

// Get rank badge class
export function getRankBadgeClass(rank) {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return 'regular';
}

// Calculate average marks for a test
export function calcTestAverage(results) {
  if (results.length === 0) return 0;
  const total = results.reduce((sum, r) => sum + r.percentage, 0);
  return Math.round((total / results.length) * 10) / 10;
}

// Get performance trend (improving/declining/stable)
export function getPerformanceTrend(testResults, studentId) {
  const studentResults = testResults
    .filter((r) => r.studentId === studentId)
    .sort((a, b) => a.testId.localeCompare(b.testId));

  if (studentResults.length < 2) return 'stable';

  const last = studentResults[studentResults.length - 1].percentage;
  const prev = studentResults[studentResults.length - 2].percentage;

  if (last - prev > 5) return 'improving';
  if (prev - last > 5) return 'declining';
  return 'stable';
}

// Generate AI Insights
export function generateAIInsights(students, attendance, testResults) {
  const insights = [];
  const activeStudents = students.filter((s) => s.status === 'active');

  // Attendance-based insights
  activeStudents.forEach((student) => {
    const attPercent = calcAttendancePercent(attendance, student.id);

    if (attPercent < 70) {
      insights.push({
        type: 'warning',
        category: 'attendance',
        title: `⚠️ Low Attendance Alert`,
        message: `${student.name} ki attendance sirf ${attPercent}% hai. Parent se baat karein aur regular aane ke liye motivate karein.`,
        studentId: student.id,
        priority: 'high',
      });
    }
  });

  // Performance-based insights
  activeStudents.forEach((student) => {
    const trend = getPerformanceTrend(testResults, student.id);
    const studentResults = testResults.filter((r) => r.studentId === student.id);

    if (trend === 'declining' && studentResults.length >= 2) {
      insights.push({
        type: 'danger',
        category: 'performance',
        title: `📉 Performance Declining`,
        message: `${student.name} ka performance gir raha hai. Extra classes ya doubt sessions recommend karein.`,
        studentId: student.id,
        priority: 'high',
      });
    }

    if (trend === 'improving' && studentResults.length >= 2) {
      insights.push({
        type: 'success',
        category: 'performance',
        title: `📈 Great Improvement`,
        message: `${student.name} ka performance improve ho raha hai! Motivate karte rahein.`,
        studentId: student.id,
        priority: 'low',
      });
    }
  });

  // Top performers
  const avgScores = activeStudents.map((student) => {
    const results = testResults.filter((r) => r.studentId === student.id);
    const avg = results.length > 0 ? results.reduce((s, r) => s + r.percentage, 0) / results.length : 0;
    return { student, avg: Math.round(avg * 10) / 10 };
  }).sort((a, b) => b.avg - a.avg);

  if (avgScores.length >= 3) {
    insights.push({
      type: 'info',
      category: 'ranking',
      title: `🏆 Top Performers`,
      message: `Top 3: 1. ${avgScores[0].student.name} (${avgScores[0].avg}%), 2. ${avgScores[1].student.name} (${avgScores[1].avg}%), 3. ${avgScores[2].student.name} (${avgScores[2].avg}%)`,
      priority: 'medium',
    });
  }

  // Overall class health
  const totalAttPercent = activeStudents.reduce((s, st) => s + calcAttendancePercent(attendance, st.id), 0) / (activeStudents.length || 1);

  insights.push({
    type: totalAttPercent > 80 ? 'success' : 'warning',
    category: 'overall',
    title: `📊 Overall Attendance Health`,
    message: `Institute ki overall attendance ${Math.round(totalAttPercent)}% hai. ${totalAttPercent > 80 ? 'Bahut accha!' : 'Improvement ki zaroorat hai.'}`,
    priority: 'medium',
  });

  return insights;
}

// Generate unique ID
export function generateId(prefix = 'ID') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

// Get days in month
export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// Get first day of month (0 = Sunday)
export function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

// Month names
export const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Day names
export const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Attendance trend data for charts (last N days)
export function getAttendanceTrend(attendance, students, days = 14) {
  const trend = [];
  const today = new Date();
  const activeStudents = students.filter((s) => s.status === 'active');
  const validIds = new Set(activeStudents.map(s => s.id));
  const activeCount = activeStudents.length;

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0) continue; // Skip Sundays

    const dateStr = date.toISOString().split('T')[0];
    const dayAtt = attendance.filter((a) => a.date === dateStr && validIds.has(a.studentId));
    const present = dayAtt.filter((a) => a.status === 'present' || a.status === 'late').length;
    const percentage = activeCount > 0 ? Math.round((present / activeCount) * 100) : 0;

    trend.push({
      date: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      fullDate: dateStr,
      present,
      absent: activeCount - present,
      percentage,
    });
  }

  return trend;
}

// Map batch ID or raw string to human-readable course name (e.g. batch-4 -> JEE Mains)
export const DEFAULT_BATCH_MAP = {
  'batch-4': 'JEE Mains',
  'batch-1': 'JEE Advanced',
  'batch-2': 'NEET',
  'batch-3': 'MHCET',
  'batch-5': 'Foundation',
};

export function formatBatchName(batchIdOrName, customBatches = []) {
  if (!batchIdOrName) return 'General';
  const val = String(batchIdOrName).trim();
  
  if (Array.isArray(customBatches) && customBatches.length > 0) {
    const found = customBatches.find(b => b.id === val || (b.name && b.name.toLowerCase() === val.toLowerCase()));
    if (found && found.name) return found.name;
  }

  const lower = val.toLowerCase();
  if (DEFAULT_BATCH_MAP[lower]) {
    return DEFAULT_BATCH_MAP[lower];
  }

  if (lower === 'batch 4' || lower === '4') return 'JEE Mains';
  if (lower === 'batch 1' || lower === '1') return 'JEE Advanced';
  if (lower === 'batch 2' || lower === '2') return 'NEET';
  if (lower === 'batch 3' || lower === '3') return 'MHCET';

  if (val.toLowerCase().startsWith('batch-')) {
    return val.replace(/^batch-?/i, 'Batch ').replace(/\b\w/g, l => l.toUpperCase());
  }

  return val;
}

export const getCourseName = formatBatchName;
