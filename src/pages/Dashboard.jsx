import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  UserCheck,
  TrendingUp,
  MessageSquare,
  ArrowUpRight,
  LogIn,
  LogOut,
  FileText,
  Send,
  Trophy,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useApp } from '../context/AppContext';
import {
  getTodayAttendanceStats,
  getAttendanceTrend,
  getRelativeTime,
  getTodayStr,
  getRankBadgeClass,
} from '../utils/helpers';
import { getInitials, getAvatarClass } from '../data/sampleData';

// ── Animation variants ──────────────────────────
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' },
  }),
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

// ── Custom Recharts Tooltip ─────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card" style={{ padding: '10px 14px', minWidth: 120 }}>
      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>
        {label}
      </p>
      {payload.map((entry, idx) => (
        <p key={idx} style={{ fontSize: '0.78rem', color: entry.color }}>
          {entry.name}: {entry.value}%
        </p>
      ))}
    </div>
  );
}

// ── Pie chart label ─────────────────────────────
function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) {
  if (percent === 0) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#f1f5f9"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={700}
    >
      {Math.round(percent * 100)}%
    </text>
  );
}

// ── SMS type helpers ────────────────────────────
function getSMSIcon(type) {
  switch (type) {
    case 'attendance-entry':
      return <LogIn size={15} />;
    case 'attendance-exit':
      return <LogOut size={15} />;
    case 'test-result':
      return <FileText size={15} />;
    default:
      return <Send size={15} />;
  }
}

function getSMSColor(type) {
  switch (type) {
    case 'attendance-entry':
      return 'green';
    case 'attendance-exit':
      return 'orange';
    case 'test-result':
      return 'purple';
    default:
      return 'blue';
  }
}

function getSMSLabel(type) {
  switch (type) {
    case 'attendance-entry':
      return 'Entry SMS';
    case 'attendance-exit':
      return 'Exit SMS';
    case 'test-result':
      return 'Test Result';
    default:
      return 'Custom SMS';
  }
}

// ══════════════════════════════════════════════════
//  DASHBOARD COMPONENT
// ══════════════════════════════════════════════════
export default function Dashboard() {
  const { students, attendance, testResults, smsHistory } = useApp();

  // ── Derived data ──────────────────────────────
  const activeStudents = useMemo(
    () => students.filter((s) => s.status === 'active'),
    [students]
  );

  const todayStats = useMemo(
    () => getTodayAttendanceStats(attendance, students),
    [attendance, students]
  );

  const trendData = useMemo(
    () => getAttendanceTrend(attendance, students, 14),
    [attendance, students]
  );

  // Average score across latest test results
  const avgScore = useMemo(() => {
    if (testResults.length === 0) return 0;
    const total = testResults.reduce((sum, r) => sum + r.percentage, 0);
    return Math.round((total / testResults.length) * 10) / 10;
  }, [testResults]);

  // SMS sent today
  const smsTodayCount = useMemo(() => {
    const today = getTodayStr();
    return smsHistory.filter((s) => s.timestamp?.startsWith(today)).length;
  }, [smsHistory]);

  // Today's attendance pie data
  const pieData = useMemo(
    () => [
      { name: 'Present', value: todayStats.present, color: '#10b981' },
      { name: 'Late', value: todayStats.late, color: '#f59e0b' },
      { name: 'Absent', value: todayStats.absent, color: '#ef4444' },
    ],
    [todayStats]
  );

  // Top 5 performers
  const topPerformers = useMemo(() => {
    const scoreMap = {};
    testResults.forEach((r) => {
      if (!scoreMap[r.studentId]) {
        scoreMap[r.studentId] = { total: 0, count: 0 };
      }
      scoreMap[r.studentId].total += r.percentage;
      scoreMap[r.studentId].count += 1;
    });

    return Object.entries(scoreMap)
      .map(([studentId, data]) => {
        const student = students.find((s) => s.id === studentId);
        return {
          studentId,
          name: student?.name ?? 'Unknown',
          photo: student?.photo ?? null,
          avg: Math.round((data.total / data.count) * 10) / 10,
        };
      })
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5)
      .map((p, idx) => ({ ...p, rank: idx + 1 }));
  }, [testResults, students]);

  // Recent 8 SMS
  const recentSMS = useMemo(() => smsHistory.slice(0, 8), [smsHistory]);

  // Average raw marks computation
  const avgMarksData = useMemo(() => {
    if (testResults.length === 0) return { obtained: 0, possible: 0 };
    const totalObtained = testResults.reduce((sum, r) => sum + r.marks, 0);
    const totalPossible = testResults.reduce((sum, r) => sum + r.totalMarks, 0);
    return {
      obtained: Math.round(totalObtained / testResults.length),
      possible: Math.round(totalPossible / testResults.length)
    };
  }, [testResults]);

  // ── Stat cards config ─────────────────────────
  const statCards = [
    {
      label: 'Total Students',
      value: activeStudents.length,
      subValue: '',
      trend: '+12%',
      theme: 'blue',
      icon: <Users size={20} />,
    },
    {
      label: "Today's Attendance",
      value: `${todayStats.percentage}%`,
      subValue: `(${todayStats.present + todayStats.late}/${todayStats.total} present)`,
      trend: '+5%',
      theme: 'green',
      icon: <UserCheck size={20} />,
    },
    {
      label: 'Average Score',
      value: `${avgScore}%`,
      subValue: testResults.length > 0 ? `(${avgMarksData.obtained}/${avgMarksData.possible} marks)` : '(No tests)',
      trend: '+8%',
      theme: 'purple',
      icon: <TrendingUp size={20} />,
    },
    {
      label: 'SMS Sent Today',
      value: smsTodayCount,
      subValue: '',
      trend: '+24%',
      theme: 'orange',
      icon: <MessageSquare size={20} />,
    },
  ];

  // ── Render ────────────────────────────────────
  return (
    <div className="page-container">
      {/* Page Header */}
      <motion.div
        className="page-header"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        custom={0}
      >
        <h1>Dashboard</h1>
        <p>Welcome back! Here's what's happening at your institute today.</p>
      </motion.div>

      {/* ─── 1. Stat Cards ─────────────────────── */}
      <motion.div
        className="stat-cards-grid"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            className={`stat-card ${card.theme}`}
            variants={staggerItem}
          >
            <div className="stat-card-top">
              <div className={`stat-card-icon ${card.theme}`}>{card.icon}</div>
              <div className="stat-card-trend up">
                <ArrowUpRight size={14} />
                {card.trend}
              </div>
            </div>
            <div className="stat-card-value">
              {card.value}
              {card.subValue && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginLeft: '8px', fontWeight: '500' }}>
                  {card.subValue}
                </span>
              )}
            </div>
            <div className="stat-card-label">{card.label}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* ─── 2. Charts Section ─────────────────── */}
      <motion.div
        className="grid-dashboard mb-24"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        {/* Attendance Trend (Left – bigger) */}
        <motion.div className="card" variants={staggerItem}>
          <div className="card-header">
            <div>
              <div className="card-title">Attendance Trend</div>
              <div className="card-subtitle">Last 14 days</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
              <defs>
                <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.08)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="percentage"
                name="Attendance"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#attendanceGradient)"
                dot={false}
                activeDot={{ r: 5, stroke: '#3b82f6', strokeWidth: 2, fill: '#0c1029' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Attendance Today – Donut (Right) */}
        <motion.div className="card" variants={staggerItem}>
          <div className="card-header">
            <div>
              <div className="card-title">Attendance Today</div>
              <div className="card-subtitle">{activeStudents.length} students</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                labelLine={false}
                label={renderPieLabel}
                stroke="none"
              >
                {pieData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${value} students`, name]}
                contentStyle={{
                  background: '#0c1029',
                  border: '1px solid rgba(59,130,246,0.15)',
                  borderRadius: 12,
                  fontSize: '0.8rem',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex items-center justify-center gap-16" style={{ marginTop: 4 }}>
            {pieData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-8">
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: entry.color,
                    display: 'inline-block',
                  }}
                />
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  {entry.name} ({entry.value})
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* ─── 3. Bottom Section ─────────────────── */}
      <motion.div
        className="grid-dashboard"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        {/* Recent Activity Feed */}
        <motion.div className="card" variants={staggerItem}>
          <div className="card-header">
            <div className="card-title">Recent Activity</div>
          </div>
          <div className="activity-feed">
            {recentSMS.length === 0 && (
              <div className="empty-state">
                <p>No recent activity</p>
              </div>
            )}
            {recentSMS.map((sms) => {
              const student = students.find((s) => s.id === sms.studentId);
              return (
                <motion.div
                  key={sms.id}
                  className="activity-item"
                  variants={staggerItem}
                >
                  <div className={`activity-icon ${getSMSColor(sms.type)}`}>
                    {getSMSIcon(sms.type)}
                  </div>
                  <div className="flex-1">
                    <div className="activity-text">
                      <strong>{student?.name ?? 'Unknown'}</strong> — {getSMSLabel(sms.type)} sent
                      to {student?.parentName ?? 'parent'}
                    </div>
                    <div className="activity-time">{getRelativeTime(sms.timestamp)}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Top Performers */}
        <motion.div className="card" variants={staggerItem}>
          <div className="card-header">
            <div className="card-title">Top Performers 🏆</div>
          </div>
          <div className="activity-feed">
            {topPerformers.length === 0 && (
              <div className="empty-state">
                <p>No test results yet</p>
              </div>
            )}
            {topPerformers.map((performer, idx) => (
              <motion.div
                key={performer.studentId}
                className="activity-item"
                variants={staggerItem}
              >
                <div className={`rank-badge ${getRankBadgeClass(performer.rank)}`}>
                  {performer.rank}
                </div>
                <div className="flex items-center gap-12 flex-1">
                  {performer.photo ? (
                    <img 
                      src={performer.photo} 
                      alt={performer.name} 
                      className="student-avatar" 
                      style={{ objectFit: 'cover', border: '1px solid var(--border-color)' }} 
                    />
                  ) : (
                    <div
                      className={`student-avatar ${getAvatarClass(idx)}`}
                    >
                      {getInitials(performer.name)}
                    </div>
                  )}
                  <div className="flex-1">
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-color)' }}>
                      {performer.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Avg: {performer.avg}%
                    </div>
                  </div>
                  <div
                    className={`marks-pill ${
                      performer.avg >= 85 ? 'high' : performer.avg >= 60 ? 'medium' : 'low'
                    }`}
                  >
                    {performer.avg >= 85 ? '🔥' : performer.avg >= 60 ? '👍' : '📈'}{' '}
                    {performer.avg}%
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
