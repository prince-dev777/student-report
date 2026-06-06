import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, AlertTriangle, TrendingDown, TrendingUp, Info, 
  Sparkles, Send, HelpCircle, ArrowRight, Activity 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { 
  generateAIInsights, getPerformanceTrend, calcAttendancePercent,
  calcTestAverage 
} from '../utils/helpers';
import toast from 'react-hot-toast';

export default function AIInsights() {
  const { students, attendance, testResults } = useApp();
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Namaste! Main aapka EduTrack AI Assistant hoon. Main aapke coaching institute ke attendance, test scores, aur student progress ko analyze kar sakta hoon. Aap mujhse koi bhi sawal pooch sakte hain! \n\nJaise ki: \n- "Attendance stats kya hai?"\n- "Top students kaun hai?"\n- "Weak students details"\n- "Total kitne students hai?"'
    }
  ]);

  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const insights = generateAIInsights(students, attendance, testResults);

  // Handle chat submission
  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput.trim();
    const newUserMessage = {
      id: Date.now(),
      sender: 'user',
      text: userMsg
    };

    setChatMessages(prev => [...prev, newUserMessage]);
    setChatInput('');

    // AI logic response simulation
    setTimeout(() => {
      let botResponse = '';
      const lowerMsg = userMsg.toLowerCase();
      const activeStudents = students.filter(s => s.status === 'active');

      if (lowerMsg.includes('attendance')) {
        const totalPercent = activeStudents.reduce((sum, s) => sum + calcAttendancePercent(attendance, s.id), 0) / (activeStudents.length || 1);
        const lowAtt = activeStudents.filter(s => calcAttendancePercent(attendance, s.id) < 75);
        botResponse = `Institute ki average student attendance abhi **${Math.round(totalPercent)}%** hai. \n\n⚠️ **${lowAtt.length} students** ki attendance 75% se kam hai: \n` + 
          lowAtt.map(s => `- ${s.name} (${calcAttendancePercent(attendance, s.id)}%)`).join('\n') + 
          `\n\nHumne unke parents ko alert bhej diye hain.`;
      } 
      
      else if (lowerMsg.includes('top') || lowerMsg.includes('best') || lowerMsg.includes('rank')) {
        const avgScores = activeStudents.map(student => {
          const results = testResults.filter(r => r.studentId === student.id);
          const avg = results.length > 0 ? results.reduce((s, r) => s + r.percentage, 0) / results.length : 0;
          return { student, avg: Math.round(avg * 10) / 10 };
        }).sort((a, b) => b.avg - a.avg);

        botResponse = `🏆 **Top 3 Performers (Average score bases par):** \n\n` + 
          `1. **${avgScores[0]?.student.name}** - Avg: **${avgScores[0]?.avg}%**\n` +
          `2. **${avgScores[1]?.student.name}** - Avg: **${avgScores[1]?.avg}%**\n` +
          `3. **${avgScores[2]?.student.name}** - Avg: **${avgScores[2]?.avg}%**\n\n` +
          `Sare top students ko results release hone par automatic congratulatory message gaya hai.`;
      } 
      
      else if (lowerMsg.includes('weak') || lowerMsg.includes('poor') || lowerMsg.includes('low') || lowerMsg.includes('attention') || lowerMsg.includes('risk')) {
        const lowScores = activeStudents.map(student => {
          const results = testResults.filter(r => r.studentId === student.id);
          const avg = results.length > 0 ? results.reduce((s, r) => s + r.percentage, 0) / results.length : 0;
          return { student, avg: Math.round(avg * 10) / 10 };
        }).filter(item => item.avg < 60 && item.avg > 0).sort((a, b) => a.avg - b.avg);

        botResponse = `📉 **Low Performance Students (Average score < 60%):** \n\n` + 
          (lowScores.length > 0 
            ? lowScores.map(item => `- **${item.student.name}** (Average: **${item.avg}%**)`).join('\n') + `\n\nIn students ko doubt classes and special session recommend kiya jata hai.`
            : `Sabhi active students ka average score 60% ke upar hai. Great work!`);
      } 
      
      else if (lowerMsg.includes('total') || lowerMsg.includes('count') || lowerMsg.includes('student')) {
        const total = students.length;
        const active = activeStudents.length;
        botResponse = `Aapke coaching institute me total **${total} students** enrolled hain. \n- Active: **${active}**\n- Inactive: **${total - active}**`;
      } 
      
      else {
        botResponse = `Main aapka sawal puri tarah nahi samajh paya. Kripya attendance, test performance, weak students ya top rankers ke baare me poochein. \n\nExample: \n- *"Attendance report dikhao"* \n- *"Kaun se students weak hai?"*`;
      }

      setChatMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'bot',
        text: botResponse
      }]);
    }, 1000);
  };

  const getInsightIcon = (type) => {
    switch (type) {
      case 'warning': return <AlertTriangle size={20} className="text-warning" />;
      case 'danger': return <TrendingDown size={20} className="text-danger" />;
      case 'success': return <TrendingUp size={20} className="text-success" />;
      default: return <Info size={20} className="text-accent" />;
    }
  };

  const getInsightColorClass = (type) => {
    switch (type) {
      case 'warning': return 'orange';
      case 'danger': return 'red';
      case 'success': return 'green';
      default: return 'blue';
    }
  };

  return (
    <motion.div 
      className="page-container animate-fade"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="page-header flex justify-between items-center flex-wrap gap-16">
        <div>
          <div className="flex items-center gap-8">
            <h1>AI Smart Insights</h1>
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: 'var(--accent-purple)',
                boxShadow: 'var(--shadow-glow-purple)'
              }}
            />
          </div>
          <p>Real-time machine learning predictions, class diagnostics, and alert system.</p>
        </div>
        <div className="btn btn-secondary btn-sm">
          <Sparkles size={14} className="text-gradient-purple" />
          Model: EduTrack-V1 (Active)
        </div>
      </div>

      {/* AI Insights Cards Grid */}
      <div className="mb-24">
        <h2 className="mb-16 flex items-center gap-8" style={{ fontSize: '1.25rem' }}>
          <Activity size={18} className="text-gradient" />
          Critical Student Alerts
        </h2>
        <div className="grid-3">
          {insights.map((insight, idx) => (
            <div key={idx} className={`ai-card stat-card ${getInsightColorClass(insight.type)}`}>
              <div className="ai-glow" />
              <div className="stat-card-top">
                <div className="stat-card-icon">
                  {getInsightIcon(insight.type)}
                </div>
                <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{insight.category}</span>
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '8px' }}>
                {insight.title}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {insight.message}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-dashboard">
        {/* Performance Prediction Card */}
        <div className="card flex flex-col justify-between">
          <div>
            <h2 className="mb-16 flex items-center gap-8" style={{ fontSize: '1.1rem' }}>
              <TrendingUp size={18} className="text-gradient" />
              Performance & Trend Analytics
            </h2>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Average Score</th>
                    <th>Current Trend</th>
                    <th>AI Prediction</th>
                  </tr>
                </thead>
                <tbody>
                  {students.filter(s => s.status === 'active').map((student) => {
                    const results = testResults.filter(r => r.studentId === student.id);
                    const avg = results.length > 0 ? Math.round((results.reduce((s, r) => s + r.percentage, 0) / results.length) * 10) / 10 : 0;
                    const trend = getPerformanceTrend(testResults, student.id);

                    let trendBadge = <span className="badge badge-info">➡️ Stable</span>;
                    let predictionText = 'Consistent performer';
                    let predictionClass = 'text-primary';

                    if (trend === 'improving') {
                      trendBadge = <span className="badge badge-success">📈 Improving</span>;
                      predictionText = 'Expected to score higher';
                      predictionClass = 'text-success';
                    } else if (trend === 'declining') {
                      trendBadge = <span className="badge badge-danger">📉 Declining</span>;
                      predictionText = 'At academic risk';
                      predictionClass = 'text-danger';
                    }

                    return (
                      <tr key={student.id}>
                        <td>
                          <strong>{student.name}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Roll No: {student.rollNo}</div>
                        </td>
                        <td>
                          <strong>{avg > 0 ? `${avg}%` : 'No tests'}</strong>
                        </td>
                        <td>{trendBadge}</td>
                        <td>
                          <span className={predictionClass} style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                            {predictionText}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* AI Assistant Chat Card */}
        <div className="ai-card" style={{ padding: 0 }}>
          <div className="ai-glow" />
          <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color-light)' }}>
            <h3 className="flex items-center gap-8">
              <Brain size={20} className="text-gradient-purple" />
              Ask AI Assistant
            </h3>
          </div>

          <div className="ai-chat-container">
            <div className="ai-chat-messages">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`ai-message ${msg.sender}`}>
                  <div style={{ whiteSpace: 'pre-line' }}>{msg.text}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendChat} className="ai-chat-input">
              <input
                type="text"
                placeholder="Ask about student performance, attendance..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-icon">
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
