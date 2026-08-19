import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
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
  const navigate = useNavigate();
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
      theme: 'blue',
      icon: <Users size={20} />,
      link: '/students',
      hint: 'Students'
    },
    {
      label: "Today's Attendance",
      value: `${todayStats.percentage}%`,
      subValue: `(${todayStats.present + todayStats.late}/${todayStats.total} present)`,
      theme: 'green',
      icon: <UserCheck size={20} />,
      link: '/attendance',
      hint: 'Attendance'
    },
    {
      label: 'Average Score',
      value: `${avgScore}%`,
      subValue: testResults.length > 0 ? `(${avgMarksData.obtained}/${avgMarksData.possible} marks)` : '(No tests)',
      theme: 'purple',
      icon: <TrendingUp size={20} />,
      link: '/tests',
      hint: 'Tests & Marks'
    },
    {
      label: 'SMS Sent Today',
      value: smsTodayCount,
      subValue: '',
      theme: 'orange',
      icon: <MessageSquare size={20} />,
      link: '/sms',
      hint: 'SMS Center'
    },
  ];

  const exportTopPerformers = () => {
    if (topPerformers.length === 0) {
      toast.error('No top performers to export');
      return;
    }
    const headers = ['Rank,Name,Average Score'];
    const rows = topPerformers.map(p => `${p.rank},"${p.name}",${p.avg}%`);
    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "top_performers.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported to Excel (CSV)');
  };

  const exportAttendanceTrend = () => {
    if (trendData.length === 0) {
      toast.error('No trend data to export');
      return;
    }
    const headers = ['Date,Present,Absent,Percentage'];
    const rows = trendData.map(t => `"${t.fullDate}",${t.present},${t.absent},${t.percentage}%`);
    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "attendance_trend.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported to Excel (CSV)');
  };


  // ── Render ────────────────────────────────────
  return (
    <div className="page-container" style={{ paddingTop: '8px' }}>
      {/* Page Header */}
      <motion.div
        className="page-header"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        custom={0}
        style={{ marginTop: '-15px' }}
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
            className={`stat-card ${card.theme} clickable`}
            variants={staggerItem}
            onClick={() => card.link && navigate(card.link)}
            whileHover={{ y: -4, transition: { duration: 0.15 } }}
            whileTap={{ scale: 0.98 }}
            role="button"
            tabIndex={0}
            title={`Click to open ${card.hint || card.label}`}
          >
            <div className="stat-card-top">
              <div className={`stat-card-icon ${card.theme}`}>{card.icon}</div>
              <div className="stat-card-arrow">
                <ArrowUpRight size={15} />
              </div>
            </div>
            <div className="stat-card-value">
              <span>{card.value}</span>
              {card.subValue && (
                <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', fontWeight: '500', marginLeft: '4px' }}>
                  {card.subValue}
                </span>
              )}
            </div>
            <div className="stat-card-label">
              <span>{card.label}</span>
              <span style={{ fontSize: '0.72rem', opacity: 0.8, fontWeight: 600 }}>
                {card.hint} →
              </span>
            </div>
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
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Attendance Trend</div>
              <div className="card-subtitle">Last 14 days</div>
            </div>
            <button 
              onClick={exportAttendanceTrend}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px', background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}
            >
              <Download size={14} /> Download Excel
            </button>
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

        {/* Top Performers (Replaced Attendance Today) */}
        <motion.div className="card" variants={staggerItem}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-title">Top Performers 🏆</div>
            <button 
              onClick={exportTopPerformers}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}
            >
              <Download size={14} /> Export Excel
            </button>
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
                onClick={() => navigate('/students')}
                style={{ cursor: 'pointer' }}
                title={`Click to view ${performer.name} in Students directory`}
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

      {/* ─── 3. Bottom Section ─────────────────── */}
      <motion.div
        className="grid-dashboard"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        {/* Recent Activity Feed */}
        <motion.div className="card" variants={staggerItem} style={{ gridColumn: '1 / -1' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-title">Recent Activity</div>
            <button
              onClick={() => navigate('/sms')}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              View all SMS logs →
            </button>
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
                  onClick={() => navigate('/sms')}
                  style={{ cursor: 'pointer' }}
                  title="Click to open in SMS Center"
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


      </motion.div>
    </div>
  );
}
