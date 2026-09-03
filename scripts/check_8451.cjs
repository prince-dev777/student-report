const fs = require('fs');
const snap = JSON.parse(fs.readFileSync('server/backup/database_snapshot.json', 'utf-8'));
const notifs = snap.data.notifications;
const gauravId = '6a83356e97e210e8bc14622a';

const gauravNotifs = notifs.filter(n => n.studentId === gauravId || n.studentId?.toString() === gauravId);

console.log('=== TIMELINE for studentId 6a83356e97e210e8bc14622a (Roll 8451) ===\n');
gauravNotifs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

gauravNotifs.forEach(n => {
  const d = new Date(n.createdAt);
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  const dateStr = ist.toISOString().slice(0, 10);
  const timeStr = ist.toISOString().slice(11, 19);
  const nameInMsg = n.message.match(/^([A-Za-z\s]+?) (has|did|scored)/)?.[1] || '—';
  console.log(`${dateStr} ${timeStr} IST | ${n.title.padEnd(22)} | Name in msg: "${nameInMsg}" | ${n.message.slice(0, 70)}`);
});

// Check student record timeline
const student = snap.data.students.find(s => s._id === gauravId);
console.log('\n=== Student Record ===');
console.log(`Created:  ${student.createdAt}`);
console.log(`Updated:  ${student.updatedAt}`);
console.log(`Current Name: ${student.name}`);
console.log(`Roll: ${student.rollNo}`);

// Compare: Was name always the same?
const namesInNotifs = [...new Set(gauravNotifs.map(n => n.message.match(/^([A-Za-z\s]+?) (has|did|scored)/)?.[1]).filter(Boolean))];
console.log(`\nNames found in notifications: ${JSON.stringify(namesInNotifs)}`);
console.log(`Current DB name: ${student.name}`);

if (namesInNotifs.length > 0 && !namesInNotifs.includes(student.name)) {
  console.log(`\n🚨 MISMATCH DETECTED!`);
  console.log(`   Notifications say: "${namesInNotifs.join(', ')}"`);
  console.log(`   DB currently says: "${student.name}"`);
  console.log(`   CONCLUSION: Someone EDITED the student record between ${gauravNotifs[gauravNotifs.length-1]?.createdAt} and ${student.updatedAt}`);
}
