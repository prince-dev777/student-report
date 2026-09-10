import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {
  BookOpen, ArrowRight, ArrowLeft, Download, AlertCircle,
  Clock, Star, Trophy, Target, Zap, ChevronUp, ChevronDown,
  Settings, X, Search, Check, RefreshCw, Layers, CheckCircle2,
  FileText, ShieldCheck, Sparkles, Filter, Edit3, HelpCircle, Eye
} from 'lucide-react';
import { QUESTION_BANK } from '../data/test-series/questions';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

// ============================================================
// Robust KaTeX HTML Renderer
// ============================================================
const renderLatexHtml = (text) => {
  if (!text) return '';
  let cleanText = String(text)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p>/gi, '')
    .replace(/(\d+)°C/g, '$1^{\\circ}C')
    .replace(/(\d+)°F/g, '$1^{\\circ}F')
    .replace(/(\d+)°/g, '$1^{\\circ}')
    .replace(/(\d+)\s*([a-zA-Z]{1,5})\^(-?\d+)/g, '$1 \\text{$2}^{$3}');

  const blockParts = cleanText.split('$$');
  let result = '';

  blockParts.forEach((blockPart, blockIndex) => {
    if (blockIndex % 2 === 1) {
      try {
        result += katex.renderToString(blockPart, { displayMode: true, throwOnError: false });
      } catch (_) {
        result += `<div class="katex-fallback my-2 text-center text-primary font-mono">${blockPart}</div>`;
      }
    } else {
      const inlineParts = blockPart.split('$');
      inlineParts.forEach((inlinePart, inlineIndex) => {
        if (inlineIndex % 2 === 1) {
          try {
            result += katex.renderToString(inlinePart, { displayMode: false, throwOnError: false });
          } catch (_) {
            result += `<span class="katex-fallback text-primary font-mono">${inlinePart}</span>`;
          }
        } else {
          // If plain text itself contains unwrapped LaTeX commands (e.g. \frac, \Omega, \sigma, etc.)
          if (/\\(frac|sqrt|Omega|sigma|alpha|beta|gamma|delta|theta|lambda|mu|pi|rho|tau|phi|psi|omega|Delta|Sigma|vec|bar|hat|times|pm|le|ge|neq|approx|infty|int|sum|cdot)\b|[\^_]\{|\{[a-zA-Z0-9_]+\}_\{/.test(inlinePart)) {
            try {
              result += katex.renderToString(inlinePart, { displayMode: false, throwOnError: false });
            } catch (_) {
              result += inlinePart;
            }
          } else {
            result += inlinePart
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/\n/g, '<br/>');
          }
        }
      });
    }
  });

  return result;
};

const LatexText = ({ text }) => {
  const html = useMemo(() => renderLatexHtml(text), [text]);
  return <span className="latex-rendered-content" dangerouslySetInnerHTML={{ __html: html }} />;
};

// ============================================================
// Presets & Constants
// ============================================================
const JEE_PRESETS = [
  { label: '25 Qs / Sub (20 MCQ + 5 Num)', totalPerSub: 25, mcq: 20, num: 5 },
  { label: '45 Qs / Sub (36 MCQ + 9 Num)', totalPerSub: 45, mcq: 36, num: 9 },
  { label: '90 Qs / Sub (72 MCQ + 18 Num)', totalPerSub: 90, mcq: 72, num: 18 },
];

const SIMPLE_PRESETS = [15, 25, 30, 45, 90, 180];

const EXAMS = [
  {
    id: 'jee-mains',
    name: 'JEE MAINS',
    subtitle: 'NTA Exam Pattern with MCQ + Numerical section split',
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.1)',
    border: 'rgba(59, 130, 246, 0.3)',
    icon: '🎯'
  },
  {
    id: 'jee-adv',
    name: 'JEE ADVANCED',
    subtitle: 'High-difficulty conceptual test series for IIT aspirants',
    color: '#8b5cf6',
    bg: 'rgba(139, 92, 246, 0.1)',
    border: 'rgba(139, 92, 246, 0.3)',
    icon: '⚡'
  },
  {
    id: 'neet',
    name: 'NEET',
    subtitle: 'NCERT aligned Physics, Chemistry & Biology test papers',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.1)',
    border: 'rgba(16, 185, 129, 0.3)',
    icon: '🩺'
  }
];

export default function TestSeries() {
  const { institute = {}, addTest, batches = [] } = useApp();

  // Navigation Steps: 1: Exam | 2: Subject & Chapters | 3: Config & Questions | 4: Preview & Download
  const [step, setStep] = useState(1);
  const [selectedExam, setSelectedExam] = useState('jee-mains');
  const [selectedSubjects, setSelectedSubjects] = useState(['phy', 'chem', 'math']);
  const [activeSubjectTab, setActiveSubjectTab] = useState('phy');
  const [selectedChapters, setSelectedChapters] = useState({});
  const [selectedTopics, setSelectedTopics] = useState({});
  const [expandedChapter, setExpandedChapter] = useState(null);

  // OMR & Live Schedule Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleBatch, setScheduleBatch] = useState('All Batches');
  const [scheduleDate, setScheduleDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isScheduling, setIsScheduling] = useState(false);

  // Question Count & Presets
  const [questionCountOption, setQuestionCountOption] = useState({ type: 'preset', preset: JEE_PRESETS[0] });
  const [customQuestionCount, setCustomQuestionCount] = useState('25');
  const [testTitle, setTestTitle] = useState('Weekly Mock Test');
  const [academyName, setAcademyName] = useState(institute?.name || 'CAREER XONE');
  const [watermarkText, setWatermarkText] = useState('CAREER XONE');

  // Manual Question Selector Modal State
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualSelectedQs, setManualSelectedQs] = useState({}); // { subjectId: [questionIds] }
  const [manualSearchTerm, setManualSearchTerm] = useState('');
  const [manualActiveSubject, setManualActiveSubject] = useState('phy');
  const [manualPage, setManualPage] = useState(1);
  const MANUAL_PAGE_SIZE = 30;

  // Generated Paper State
  const [generatedPaper, setGeneratedPaper] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingMode, setDownloadingMode] = useState(null); // 'without-solution' | 'with-anskey' | 'with-solution'
  const counterRef = useRef(0);

  // Available subjects for the selected exam
  const currentExamSubjects = useMemo(() => {
    const common = [
      { id: 'phy', name: 'Physics', color: '#eab308' },
      { id: 'chem', name: 'Chemistry', color: '#ec4899' },
    ];
    if (selectedExam === 'neet') {
      return [...common, { id: 'bio', name: 'Biology', color: '#10b981' }];
    }
    return [...common, { id: 'math', name: 'Mathematics', color: '#3b82f6' }];
  }, [selectedExam]);

  // Adjust default subjects & active tab on exam change
  useEffect(() => {
    if (selectedExam === 'neet') {
      setSelectedSubjects(['phy', 'chem', 'bio']);
      setActiveSubjectTab('phy');
      setQuestionCountOption({ type: 'simple', value: 45 });
    } else {
      setSelectedSubjects(['phy', 'chem', 'math']);
      setActiveSubjectTab('phy');
      if (selectedExam === 'jee-mains') {
        setQuestionCountOption({ type: 'preset', preset: JEE_PRESETS[0] });
      } else {
        setQuestionCountOption({ type: 'simple', value: 30 });
      }
    }
    setSelectedChapters({});
    setSelectedTopics({});
    setManualSelectedQs({});
  }, [selectedExam]);

  // Toggle subject inclusion in the test paper
  const handleSubjectInclusionToggle = (subjectId) => {
    if (selectedSubjects.includes(subjectId)) {
      if (selectedSubjects.length === 1) {
        toast.error('At least one subject must be selected.');
        return;
      }
      const updated = selectedSubjects.filter(id => id !== subjectId);
      setSelectedSubjects(updated);
      if (activeSubjectTab === subjectId) {
        setActiveSubjectTab(updated[0]);
      }
    } else {
      const updated = [...selectedSubjects, subjectId];
      setSelectedSubjects(updated);
      setActiveSubjectTab(subjectId);
    }
  };

  // Get dynamic chapters for a subject from QUESTION_BANK
  const getChaptersFromDB = (examId, subjectId) => {
    const db = QUESTION_BANK[examId]?.[subjectId];
    if (!db || !Array.isArray(db)) return [];
    const chapters = [...new Set(db.map(q => q.chapter).filter(Boolean))];
    return chapters.sort();
  };

  // Get topics for a specific chapter
  const getTopicsForChapter = (subjectId, chapterName) => {
    const db = QUESTION_BANK[selectedExam]?.[subjectId] || [];
    const qs = db.filter(q => q.chapter?.toLowerCase().trim() === chapterName?.toLowerCase().trim());
    return [...new Set(qs.map(q => q.topic).filter(Boolean))].sort();
  };

  // Toggle chapter selection
  const handleChapterToggle = (subjectId, chapterName) => {
    const current = selectedChapters[subjectId] || [];
    const updated = current.includes(chapterName)
      ? current.filter(c => c !== chapterName)
      : [...current, chapterName];
    setSelectedChapters({ ...selectedChapters, [subjectId]: updated });
  };

  // Select all / Deselect all chapters for active subject
  const handleSelectAllChapters = (subjectId) => {
    const all = getChaptersFromDB(selectedExam, subjectId);
    const current = selectedChapters[subjectId] || [];
    if (current.length === all.length) {
      setSelectedChapters({ ...selectedChapters, [subjectId]: [] });
    } else {
      setSelectedChapters({ ...selectedChapters, [subjectId]: all });
    }
  };

  // Toggle topic selection
  const handleTopicToggle = (subjectId, chapter, topic) => {
    const cur = selectedTopics[subjectId]?.[chapter] || [];
    const updated = cur.includes(topic) ? cur.filter(t => t !== topic) : [...cur, topic];
    setSelectedTopics({
      ...selectedTopics,
      [subjectId]: { ...(selectedTopics[subjectId] || {}), [chapter]: updated }
    });
  };

  // Filter questions for a chapter
  const getFilteredQs = (subjectId, chapterName, examId) => {
    const db = QUESTION_BANK[examId]?.[subjectId];
    if (!db || !Array.isArray(db)) return { mcq: [], numerical: [] };
    const chapterLower = chapterName?.toLowerCase().trim();
    let qs = db.filter(q => q.chapter?.toLowerCase().trim() === chapterLower);
    const topicsFilter = selectedTopics[subjectId]?.[chapterName];
    if (topicsFilter && topicsFilter.length > 0) {
      qs = qs.filter(q => topicsFilter.includes(q.topic));
    }
    return {
      mcq: qs.filter(q => q.type !== 'numerical'),
      numerical: qs.filter(q => q.type === 'numerical')
    };
  };

  // Random picker helper
  const pickQuestions = (pool, count) => {
    if (!pool || pool.length === 0) return [];
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(shuffled[i % shuffled.length]);
    }
    return result;
  };

  // Generate Paper strictly using selectedSubjects
  const handleCreatePaper = () => {
    if (selectedSubjects.length === 0) {
      toast.error('Please select at least one subject.');
      return;
    }

    const isJEEMains = selectedExam === 'jee-mains';
    let totalQs = 0;

    // Collect all valid chapters strictly for selectedSubjects
    const allChapters = [];
    selectedSubjects.forEach(sid => {
      const chs = (selectedChapters[sid] && selectedChapters[sid].length > 0)
        ? selectedChapters[sid]
        : getChaptersFromDB(selectedExam, sid);
      chs.forEach(ch => allChapters.push({ sid, ch }));
    });

    if (allChapters.length === 0) {
      toast.error('Please select at least one chapter.');
      return;
    }

    counterRef.current = 0;
    let paperData = {};
    selectedSubjects.forEach(sid => { paperData[sid] = []; });

    if (isJEEMains && questionCountOption?.type === 'preset') {
      const preset = questionCountOption.preset;

      selectedSubjects.forEach(sid => {
        // If manual questions selected for this subject, use them
        if (manualSelectedQs[sid] && manualSelectedQs[sid].length > 0) {
          const db = QUESTION_BANK[selectedExam]?.[sid] || [];
          const customQs = db.filter(q => manualSelectedQs[sid].includes(q.id));
          paperData[sid] = customQs.map(q => {
            counterRef.current++;
            return { ...q, id: `q-${counterRef.current}-${q.id}`, subjectId: sid };
          });
          return;
        }

        const chapters = (selectedChapters[sid] && selectedChapters[sid].length > 0)
          ? selectedChapters[sid]
          : getChaptersFromDB(selectedExam, sid);
        if (chapters.length === 0) return;

        let subMCQPool = [], subNumPool = [];
        chapters.forEach(ch => {
          const { mcq, numerical } = getFilteredQs(sid, ch, selectedExam);
          subMCQPool = [...subMCQPool, ...mcq];
          subNumPool = [...subNumPool, ...numerical];
        });

        const chosenMCQ = pickQuestions(subMCQPool, preset.mcq);
        const chosenNum = pickQuestions(subNumPool, preset.num);

        const subQsMCQ = chosenMCQ.map(q => {
          counterRef.current++;
          return { ...q, id: `q-${counterRef.current}-${q.id}`, subjectId: sid };
        });
        const subQsNum = chosenNum.map(q => {
          counterRef.current++;
          return { ...q, id: `q-${counterRef.current}-${q.id}`, subjectId: sid };
        });

        paperData[sid] = [...subQsMCQ, ...subQsNum];
      });
    } else {
      totalQs = questionCountOption?.type === 'custom'
        ? parseInt(customQuestionCount) || 30
        : (questionCountOption?.value || 30);

      // Distribute evenly across chosen subjects
      const qsPerSubject = Math.floor(totalQs / selectedSubjects.length);
      let remainderQs = totalQs % selectedSubjects.length;

      selectedSubjects.forEach(sid => {
        if (manualSelectedQs[sid] && manualSelectedQs[sid].length > 0) {
          const db = QUESTION_BANK[selectedExam]?.[sid] || [];
          const customQs = db.filter(q => manualSelectedQs[sid].includes(q.id));
          paperData[sid] = customQs.map(q => {
            counterRef.current++;
            return { ...q, id: `q-${counterRef.current}-${q.id}`, subjectId: sid };
          });
          return;
        }

        const subTargetCount = qsPerSubject + (remainderQs > 0 ? 1 : 0);
        if (remainderQs > 0) remainderQs--;

        const chapters = (selectedChapters[sid] && selectedChapters[sid].length > 0)
          ? selectedChapters[sid]
          : getChaptersFromDB(selectedExam, sid);
        if (chapters.length === 0) return;

        let subMCQPool = [], subNumPool = [];
        chapters.forEach(ch => {
          const { mcq, numerical } = getFilteredQs(sid, ch, selectedExam);
          subMCQPool = [...subMCQPool, ...mcq];
          subNumPool = [...subNumPool, ...numerical];
        });

        const mcqTarget = Math.round(subTargetCount * 0.8);
        const numTarget = subTargetCount - mcqTarget;

        const chosenMCQ = pickQuestions(subMCQPool, mcqTarget);
        const chosenNum = pickQuestions(subNumPool, numTarget);

        const subQsMCQ = chosenMCQ.map(q => {
          counterRef.current++;
          return { ...q, id: `q-${counterRef.current}-${q.id}`, subjectId: sid };
        });
        const subQsNum = chosenNum.map(q => {
          counterRef.current++;
          return { ...q, id: `q-${counterRef.current}-${q.id}`, subjectId: sid };
        });

        paperData[sid] = [...subQsMCQ, ...subQsNum];
      });
    }

    // Renumber questions continuously
    const flatList = [];
    selectedSubjects.forEach(sid => {
      const subMCQ = (paperData[sid] || []).filter(q => q.type !== 'numerical');
      const subNum = (paperData[sid] || []).filter(q => q.type === 'numerical');
      paperData[sid] = [...subMCQ, ...subNum];
      flatList.push(...paperData[sid]);
    });

    flatList.forEach((q, i) => { q.number = i + 1; });

    if (flatList.length === 0) {
      toast.error('No questions found for the selected chapters.');
      return;
    }

    setGeneratedPaper({
      examName: EXAMS.find(e => e.id === selectedExam)?.name || 'TEST',
      totalQuestions: flatList.length,
      data: paperData,
      flatData: flatList
    });

    setStep(4);
    toast.success(`🎉 Generated test paper with ${flatList.length} questions across ${selectedSubjects.length} subject(s)!`);
  };

  // Helper: Auto-detect matching pre-calibrated OMR master template (T1-T7)
  const getMatchingOmrTemplate = () => {
    if (!generatedPaper) return { templateId: 'T1', name: 'JEE Mains 75 MCQ (T1)', file: 'T1_JEE_75_MCQ.png' };
    const totalQ = generatedPaper.totalQuestions;
    const exam = selectedExam;

    if (totalQ === 180 || exam === 'neet') {
      return { templateId: 'T3', name: 'NEET 180 Questions (T3)', file: 'T3_NEET_180.png' };
    }
    if (totalQ === 90) {
      return { templateId: 'T4', name: 'NEET 90 Questions (T4)', file: 'T4_NEET_90.png' };
    }
    if (totalQ === 200) {
      return { templateId: 'T5', name: 'MHCET 200 Questions (T5)', file: 'T5_MHCET_200.png' };
    }
    if (totalQ <= 50) {
      return { templateId: 'T7', name: 'Weekly Test 50 Questions (T7)', file: 'T7_OMR_50.png' };
    }
    const hasNumerical = selectedSubjects.some(sid => (generatedPaper.data[sid] || []).some(q => q.type === 'numerical'));
    if (hasNumerical) {
      return { templateId: 'T2', name: 'JEE Mains 75 Mixed (MCQ + Numerical) (T2)', file: 'T2_JEE_75_NUM.png' };
    }
    return { templateId: 'T1', name: 'JEE Mains 75 MCQ (T1)', file: 'T1_JEE_75_MCQ.png' };
  };

  // Client-side high-resolution browser print / PDF fallback (Zero failure guarantee)
  const triggerClientSidePrint = (mode = 'without-solution') => {
    if (!generatedPaper) return;
    const safeTitle = testTitle || generatedPaper.examName || 'Career Xone Test Paper';
    const subNames = selectedSubjects.map(s => currentExamSubjects.find(x => x.id === s)?.name || s.toUpperCase()).join(' • ');
    const totalQ = generatedPaper.totalQuestions;
    const maxMarks = totalQ * 4;
    const totalTime = totalQ * 3;

    const printWin = window.open('', '_blank');
    if (!printWin) {
      toast.error('Pop-up blocked! Please allow pop-ups for Career Xone to print.');
      return;
    }

    let questionsHtml = '';
    let globalNum = 1;

    selectedSubjects.forEach((sid, subIdx) => {
      const subConfig = currentExamSubjects.find(s => s.id === sid);
      const qs = generatedPaper.data[sid] || [];
      if (qs.length === 0) return;

      questionsHtml += `
        <div style="page-break-before: ${subIdx > 0 ? 'always' : 'auto'}; margin-bottom: 24px;">
          <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 16px;">
            <h2 style="font-size: 16px; font-weight: 800; text-transform: uppercase; margin: 0;">
              PART ${subIdx + 1}: ${subConfig?.name || sid.toUpperCase()} (${qs.length} Questions)
            </h2>
          </div>
      `;

      qs.forEach(q => {
        const qNum = globalNum++;
        const renderedText = renderLatexHtml(q.text || '');
        let optsHtml = '';
        if (q.type !== 'numerical' && q.options && q.options.length > 0) {
          const labels = ['A', 'B', 'C', 'D'];
          const renderedOpts = q.options.map((opt, idx) => {
            const val = opt && opt.trim().length > 0 ? renderLatexHtml(opt) : `Option (${labels[idx]})`;
            return `
              <div style="display: flex; gap: 6px; align-items: flex-start; margin-bottom: 4px;">
                <span style="font-weight: 700; min-width: 22px;">(${labels[idx]})</span>
                <div>${val}</div>
              </div>
            `;
          });
          optsHtml = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; padding-left: 20px;">
              ${renderedOpts.join('')}
            </div>
          `;
        }

        let imagesHtml = '';
        if (q.images && q.images.length > 0) {
          imagesHtml = `
            <div style="text-align: center; margin: 8px 0;">
              ${q.images.map(img => `<img src="${img}" style="max-height: 180px; max-width: 90%; object-fit: contain;" />`).join('')}
            </div>
          `;
        }

        questionsHtml += `
          <div style="margin-bottom: 16px; page-break-inside: avoid; font-size: 13px; line-height: 1.5;">
            <div style="display: flex; gap: 8px; align-items: flex-start;">
              <span style="font-weight: 800; min-width: 28px;">Q.${qNum}.</span>
              <div style="flex: 1;">${renderedText}</div>
            </div>
            ${imagesHtml}
            ${optsHtml}
          </div>
        `;
      });

      questionsHtml += `</div>`;
    });

    let ansKeyHtml = '';
    if (mode === 'with-anskey' || mode === 'with-solution') {
      let keyCells = '';
      let kNum = 1;
      selectedSubjects.forEach(sid => {
        const qs = generatedPaper.data[sid] || [];
        qs.forEach(q => {
          keyCells += `
            <div style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; font-size: 11px;">
              <span style="color: #64748b; font-weight: 600;">Q${kNum}</span>: <strong>${String(q.correct || '-').toUpperCase()}</strong>
            </div>
          `;
          kNum++;
        });
      });

      ansKeyHtml = `
        <div style="page-break-before: always; margin-top: 30px;">
          <h2 style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 6px;">OFFICIAL ANSWER KEY</h2>
          <div style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; margin-top: 14px;">
            ${keyCells}
          </div>
        </div>
      `;
    }

    let solHtml = '';
    if (mode === 'with-solution') {
      let solItems = '';
      let sNum = 1;
      selectedSubjects.forEach(sid => {
        const qs = generatedPaper.data[sid] || [];
        qs.forEach(q => {
          const rawSol = q.solution ? renderLatexHtml(q.solution) : 'Detailed step-by-step solution.';
          solItems += `
            <div style="margin-bottom: 14px; page-break-inside: avoid; font-size: 12px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px;">
              <div style="font-weight: 800; color: #0284c7;">Q.${sNum} [Correct: ${String(q.correct || '-').toUpperCase()}]</div>
              <div style="margin-top: 4px; line-height: 1.45;">${rawSol}</div>
            </div>
          `;
          sNum++;
        });
      });

      solHtml = `
        <div style="page-break-before: always; margin-top: 30px;">
          <h2 style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 6px;">STEP-BY-STEP DETAILED SOLUTIONS</h2>
          <div style="margin-top: 14px;">${solItems}</div>
        </div>
      `;
    }

    const htmlDoc = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${safeTitle}</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" />
          <style>
            @page { size: A4 portrait; margin: 15mm 15mm 15mm 15mm; }
            body { font-family: 'Times New Roman', Times, serif; color: #000; margin: 0; padding: 10px; }
            .header-box { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
            .inst-name { font-size: 22px; font-weight: 900; letter-spacing: 1px; margin: 0; text-transform: uppercase; }
            .test-name { font-size: 15px; font-weight: 800; margin: 4px 0; color: #1e293b; }
            .sub-info { font-size: 11px; font-weight: 700; display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 4px; margin-top: 6px; }
            .instructions { font-size: 10.5px; border-bottom: 1px solid #000; padding-bottom: 6px; margin-bottom: 14px; line-height: 1.35; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="header-box">
            <h1 class="inst-name">${academyName || 'CAREER XONE'}</h1>
            <div class="test-name">${safeTitle}</div>
            <div class="sub-info">
              <span><strong>Subjects:</strong> ${subNames}</span>
              <span><strong>Time:</strong> ${totalTime} Mins</span>
              <span><strong>Max Marks:</strong> ${maxMarks}</span>
            </div>
          </div>
          <div class="instructions">
            <strong>General Instructions:</strong>
            1. All questions are compulsory. Correct answer carries +4 marks, wrong answer -1 mark (for MCQs).
            2. Mark your answers on the matching OMR sheet using a black/blue ballpoint pen only.
          </div>
          ${questionsHtml}
          ${ansKeyHtml}
          ${solHtml}
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlDoc);
    printWin.document.close();
  };

  // Trigger PDF Generation & Download
  const handleDownloadPDF = async (mode = 'without-solution') => {
    if (!generatedPaper) return;

    try {
      setIsDownloading(true);
      setDownloadingMode(mode);

      const includeAnswerKey = mode === 'with-anskey' || mode === 'with-solution';
      const includeSolutions = mode === 'with-solution';

      // Strictly pass ONLY the selectedSubjects to the PDF generator
      const subjectsPayload = selectedSubjects.map(sid => {
        const subConfig = currentExamSubjects.find(s => s.id === sid);
        const qs = generatedPaper.data[sid] || [];
        return {
          id: sid,
          name: subConfig?.name || sid.toUpperCase(),
          questions: qs.map(q => ({
            id: q.id,
            number: q.number,
            text: q.text || '',
            type: q.type || 'mcq',
            options: q.options || [],
            correct: q.correct || '',
            solution: q.solution || '',
            images: q.images || [],
            chapter: q.chapter || '',
            topic: q.topic || '',
          })),
        };
      });

      const blob = await api.generateTestSeriesPdf({
        examName: testTitle || generatedPaper.examName,
        examId: selectedExam,
        totalQuestions: generatedPaper.totalQuestions,
        subjects: subjectsPayload,
        includeAnswerKey,
        includeSolutions,
        branding: {
          academyName: academyName || 'CAREER XONE',
          watermarkText: watermarkText || 'Career Xone'
        }
      });

      if (!blob || blob.size < 100) {
        throw new Error('Downloaded PDF is empty.');
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (testTitle || generatedPaper.examName || 'Test').replace(/\s+/g, '_');
      const modeSuffix = mode === 'with-solution' ? '_WithSolutions' : mode === 'with-anskey' ? '_WithAnswerKey' : '_QuestionPaper';
      a.download = `CareerXone_${safeName}${modeSuffix}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success(`📄 Downloaded ${modeSuffix.replace('_', '')} PDF successfully!`);
    } catch (err) {
      console.warn('Backend LaTeX generation failed or timed out. Triggering Print fallback...', err.message);
      toast('📄 LaTeX compiler fallback: Opening High-Res Print / Save as PDF...', { icon: '🖨️', duration: 4000 });
      triggerClientSidePrint(mode);
    } finally {
      setIsDownloading(false);
      setDownloadingMode(null);
    }
  };

  // 🚀 1-Click Schedule Test for OMR Scanning
  const handleScheduleTest = async () => {
    if (!generatedPaper) return;
    setIsScheduling(true);

    try {
      const matchingTemplate = getMatchingOmrTemplate();
      const flatAnswers = [];
      const orderedSubjects = [];

      selectedSubjects.forEach(sid => {
        const subConfig = currentExamSubjects.find(s => s.id === sid);
        orderedSubjects.push(subConfig?.name || sid.toUpperCase());
        const qs = generatedPaper.data[sid] || [];
        qs.forEach(q => {
          flatAnswers.push(String(q.correct || 'A').toUpperCase());
        });
      });

      const payload = {
        name: testTitle || generatedPaper.examName || 'Test Series Paper',
        subject: orderedSubjects.join(', '),
        date: scheduleDate,
        totalMarks: flatAnswers.length * 4,
        batch: scheduleBatch,
        templateId: matchingTemplate.templateId,
        questionsToDetect: flatAnswers.length,
        marksPerQuestion: 4,
        negativeMarking: 1,
        optionsPerQuestion: 4,
        answerKey: flatAnswers,
        isPublished: false,
        status: 'Draft'
      };

      if (addTest) {
        await addTest(payload);
      } else {
        await api.createTest(payload);
      }

      toast.success(`🎉 Test scheduled for OMR! Pre-filled ${flatAnswers.length} answer keys in ${matchingTemplate.templateId} template.`);
      setShowScheduleModal(false);
    } catch (err) {
      console.error('Failed to schedule test:', err);
      toast.error(`Scheduling failed: ${err.message}`);
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="page-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Top Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
        padding: '24px',
        borderRadius: '16px',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px',
        boxShadow: '0 10px 25px rgba(67, 56, 202, 0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.8rem'
          }}>
            📚
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                Test Series & Question Paper Generator
              </h1>
              <span style={{ background: '#22c55e', color: '#ffffff', fontSize: '0.72rem', fontWeight: 800, padding: '3px 10px', borderRadius: '12px' }}>
                JEE / NEET LATEX ENGINE
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: 'rgba(255, 255, 255, 0.92)' }}>
              Create, customize, and generate professional PDF question papers with answer keys and step-by-step solutions.
            </p>
          </div>
        </div>

        {/* Step Progression Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.25)', padding: '6px 12px', borderRadius: '12px' }}>
          {[
            { num: 1, label: '1. Exam' },
            { num: 2, label: '2. Syllabus' },
            { num: 3, label: '3. Pattern' },
            { num: 4, label: '4. Download' }
          ].map(s => (
            <button
              key={s.num}
              type="button"
              onClick={() => { if (s.num < step || generatedPaper) setStep(s.num); }}
              style={{
                background: step === s.num ? 'var(--accent-blue, #3b82f6)' : 'transparent',
                color: step === s.num ? '#ffffff' : 'rgba(255,255,255,0.6)',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: s.num <= step || generatedPaper ? 'pointer' : 'default'
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ============================================================ */}
      {/* STEP 1: EXAM SELECTION                                       */}
      {/* ============================================================ */}
      {step === 1 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 6px 0' }}>
              Step 1: Choose Target Competitive Exam
            </h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Select the exam category to load the calibrated question database.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {EXAMS.map(ex => {
              const isSelected = selectedExam === ex.id;
              return (
                <motion.div
                  key={ex.id}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedExam(ex.id)}
                  style={{
                    background: isSelected ? ex.bg : 'var(--bg-secondary)',
                    border: isSelected ? `2px solid ${ex.color}` : '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '24px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '180px',
                    boxShadow: isSelected ? `0 8px 24px ${ex.border}` : 'var(--shadow-sm)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <span style={{ fontSize: '2rem' }}>{ex.icon}</span>
                      {isSelected ? (
                        <CheckCircle2 size={24} style={{ color: ex.color }} />
                      ) : (
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--border-color)' }}></div>
                      )}
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 6px 0', color: isSelected ? ex.color : 'var(--text-primary)' }}>
                      {ex.name}
                    </h3>
                    <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                      {ex.subtitle}
                    </p>
                  </div>

                  <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      Subjects: {ex.id === 'neet' ? 'Physics, Chemistry, Biology' : 'Physics, Chemistry, Maths'}
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: ex.color }}>
                      Select & Proceed →
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setStep(2)}
              style={{ padding: '12px 28px', fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <span>Next: Select Syllabus & Chapters</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </motion.div>
      )}

      {/* ============================================================ */}
      {/* STEP 2: SYLLABUS & CHAPTER SELECTION                          */}
      {/* ============================================================ */}
      {step === 2 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 4px 0' }}>
                Step 2: Select Subjects & Chapters ({EXAMS.find(e => e.id === selectedExam)?.name})
              </h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                Toggle which subjects to include in the test, then choose specific chapters (or leave empty for all chapters).
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setStep(1)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep(3)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>Next: Paper Configuration</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* 1. Subject Inclusion Toggle Bar */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            padding: '16px 20px',
            borderRadius: '16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px'
          }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)', marginBottom: '2px' }}>
                📌 Select Subjects Included in Test Paper:
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Unchecked subjects will NOT have any questions generated in the test paper.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {currentExamSubjects.map(sub => {
                const isIncluded = selectedSubjects.includes(sub.id);
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => handleSubjectInclusionToggle(sub.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      border: isIncluded ? `2px solid ${sub.color}` : '1px solid var(--border-color)',
                      background: isIncluded ? 'var(--bg-card)' : 'var(--bg-primary)',
                      color: isIncluded ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontWeight: 700,
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      boxShadow: isIncluded ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      background: isIncluded ? sub.color : 'transparent',
                      border: isIncluded ? 'none' : '2px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '12px'
                    }}>
                      {isIncluded && <Check size={14} />}
                    </div>
                    <span>{sub.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Subject Chapters View Tabs (Only for included subjects) */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            {selectedSubjects.map(sid => {
              const sub = currentExamSubjects.find(s => s.id === sid);
              if (!sub) return null;
              const count = selectedChapters[sub.id]?.length || 0;
              const totalCh = getChaptersFromDB(selectedExam, sub.id).length;
              const isActive = activeSubjectTab === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setActiveSubjectTab(sub.id)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: isActive ? 'var(--accent-blue, #3b82f6)' : 'var(--bg-secondary)',
                    color: isActive ? '#ffffff' : 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: isActive ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
                  }}
                >
                  <span>{sub.name}</span>
                  <span style={{
                    background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--bg-card)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '0.75rem'
                  }}>
                    {count > 0 ? `${count}/${totalCh}` : `All (${totalCh})`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Chapters List for Active Subject */}
          <div className="card" style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                Available Chapters ({currentExamSubjects.find(s => s.id === activeSubjectTab)?.name}):
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => handleSelectAllChapters(activeSubjectTab)}
                style={{ fontSize: '0.8rem' }}
              >
                {selectedChapters[activeSubjectTab]?.length === getChaptersFromDB(selectedExam, activeSubjectTab).length ? 'Deselect All' : 'Select All Chapters'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
              {getChaptersFromDB(selectedExam, activeSubjectTab).map(chapter => {
                const isSelected = selectedChapters[activeSubjectTab]?.includes(chapter);
                const topics = getTopicsForChapter(activeSubjectTab, chapter);
                const isExpanded = expandedChapter === chapter;

                return (
                  <div
                    key={chapter}
                    style={{
                      background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
                      border: isSelected ? '2px solid var(--accent-blue, #3b82f6)' : '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1, margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={isSelected || false}
                          onChange={() => handleChapterToggle(activeSubjectTab, chapter)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {chapter}
                        </span>
                      </label>

                      {topics.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedChapter(isExpanded ? null : chapter)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                          title="View Topics"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      )}
                    </div>

                    {/* Expandable Topic Checkboxes */}
                    {isExpanded && topics.length > 0 && (
                      <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '8px', paddingLeft: '28px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Topics:
                        </div>
                        {topics.map(topic => {
                          const isTopicSelected = selectedTopics[activeSubjectTab]?.[chapter]?.includes(topic);
                          return (
                            <label key={topic} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer', margin: 0 }}>
                              <input
                                type="checkbox"
                                checked={isTopicSelected || false}
                                onChange={() => handleTopicToggle(activeSubjectTab, chapter, topic)}
                              />
                              <span>{topic}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* ============================================================ */}
      {/* STEP 3: PATTERN CONFIGURATION & QUESTION POOL                 */}
      {/* ============================================================ */}
      {step === 3 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 4px 0' }}>
                Step 3: Question Paper Settings & Pattern
              </h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                Selected Subjects: <strong>{selectedSubjects.map(s => currentExamSubjects.find(x => x.id === s)?.name).join(', ')}</strong> ({selectedSubjects.length})
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setStep(2)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreatePaper}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              >
                <Sparkles size={16} />
                <span>Generate Test Paper</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(320px, 1fr)', gap: '20px' }}>
            
            {/* Left Box: Question Count Presets */}
            <div className="card" style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} style={{ color: 'var(--accent-blue, #3b82f6)' }} />
                <span>Question Volume & Distribution</span>
              </div>

              {selectedExam === 'jee-mains' ? (
                <div>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                    Standard JEE Mains Presets (MCQ + Numerical Split):
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {JEE_PRESETS.map((p, idx) => {
                      const isSelected = questionCountOption?.type === 'preset' && questionCountOption?.preset?.totalPerSub === p.totalPerSub;
                      const totalPaperQs = p.totalPerSub * selectedSubjects.length;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setQuestionCountOption({ type: 'preset', preset: p })}
                          style={{
                            padding: '12px 16px',
                            borderRadius: '12px',
                            border: isSelected ? '2px solid var(--accent-blue, #3b82f6)' : '1px solid var(--border-color)',
                            background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: isSelected ? 'var(--accent-blue, #3b82f6)' : 'var(--text-primary)' }}>
                              {p.label}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Total across {selectedSubjects.length} selected subject(s): {totalPaperQs} Questions ({totalPaperQs * 4} Marks)
                            </div>
                          </div>
                          {isSelected && <Check size={18} style={{ color: 'var(--accent-blue, #3b82f6)' }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                    Standard Question Count Presets:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '8px' }}>
                    {SIMPLE_PRESETS.map(count => {
                      const isSelected = questionCountOption?.type === 'simple' && questionCountOption?.value === count;
                      return (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setQuestionCountOption({ type: 'simple', value: count })}
                          style={{
                            padding: '10px',
                            borderRadius: '10px',
                            border: isSelected ? '2px solid #10b981' : '1px solid var(--border-color)',
                            background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                            color: isSelected ? '#10b981' : 'var(--text-primary)',
                            fontWeight: 800,
                            fontSize: '0.9rem',
                            cursor: 'pointer'
                          }}
                        >
                          {count} Qs
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Custom Count Option */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Or Custom Total Questions (Distributed across {selectedSubjects.length} subject(s)):
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    min="1"
                    max="300"
                    className="form-input flex-1"
                    placeholder="e.g. 25"
                    value={customQuestionCount}
                    onChange={e => {
                      setCustomQuestionCount(e.target.value);
                      setQuestionCountOption({ type: 'custom' });
                    }}
                    style={{ height: '38px', borderRadius: '8px' }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setQuestionCountOption({ type: 'custom' })}
                    style={{ fontWeight: 700 }}
                  >
                    Set Custom
                  </button>
                </div>
              </div>
            </div>

            {/* Right Box: Test Paper Branding & Custom Picker Trigger */}
            <div className="card" style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={18} style={{ color: 'var(--accent-blue, #3b82f6)' }} />
                <span>Paper Details & Branding</span>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Test / Examination Title:
                </label>
                <input
                  type="text"
                  className="form-input w-full"
                  value={testTitle}
                  onChange={e => setTestTitle(e.target.value)}
                  placeholder="e.g. Phase Test 1 / Physics Special Test"
                  style={{ height: '36px', borderRadius: '8px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Academy / Header Name:
                  </label>
                  <input
                    type="text"
                    className="form-input w-full"
                    value={academyName}
                    onChange={e => setAcademyName(e.target.value)}
                    style={{ height: '36px', borderRadius: '8px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    PDF Watermark Text:
                  </label>
                  <input
                    type="text"
                    className="form-input w-full"
                    value={watermarkText}
                    onChange={e => setWatermarkText(e.target.value)}
                    style={{ height: '36px', borderRadius: '8px' }}
                  />
                </div>
              </div>

              {/* Manual Question Selector CTA */}
              <div style={{ marginTop: 'auto', background: 'var(--bg-card)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>🎯 Manual Question Picker</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      Search and hand-pick specific questions from database.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => setShowManualModal(true)}
                    style={{ fontWeight: 700 }}
                  >
                    Open Picker
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ============================================================ */}
      {/* STEP 4: INTERACTIVE PREVIEW & 3 PDF DOWNLOAD MODES           */}
      {/* ============================================================ */}
      {step === 4 && generatedPaper && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          
          {/* Download Action Bar */}
          <div className="card" style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            padding: '18px 24px',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  {testTitle || generatedPaper.examName}
                </h2>
                <span style={{ background: 'var(--accent-blue, #3b82f6)', color: '#fff', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '10px' }}>
                  {generatedPaper.totalQuestions} QUESTIONS • {selectedSubjects.length} SUBJECT(S)
                </span>
              </div>
              <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                Subjects: {selectedSubjects.map(s => currentExamSubjects.find(x => x.id === s)?.name).join(', ')} • Max Marks: {generatedPaper.totalQuestions * 4} • Time: {generatedPaper.totalQuestions * 3} Mins
              </p>
            </div>

            {/* PDF, OMR & Schedule Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setStep(3)}
                style={{ fontWeight: 700 }}
              >
                <ArrowLeft size={16} /> Back
              </button>

              {/* 1. Without Solution */}
              <button
                type="button"
                className="btn"
                onClick={() => handleDownloadPDF('without-solution')}
                disabled={isDownloading}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isDownloading && downloadingMode === 'without-solution' ? (
                  <RefreshCw size={15} className="spin" />
                ) : (
                  <Download size={15} />
                )}
                <span>📄 Question Paper</span>
              </button>

              {/* 2. With Answer Key */}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleDownloadPDF('with-anskey')}
                disabled={isDownloading}
                style={{
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isDownloading && downloadingMode === 'with-anskey' ? (
                  <RefreshCw size={15} className="spin" />
                ) : (
                  <Download size={15} />
                )}
                <span>📝 With Answer Key</span>
              </button>

              {/* 3. With Solutions */}
              <button
                type="button"
                className="btn"
                onClick={() => handleDownloadPDF('with-solution')}
                disabled={isDownloading}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.84rem',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                }}
              >
                {isDownloading && downloadingMode === 'with-solution' ? (
                  <RefreshCw size={15} className="spin" />
                ) : (
                  <Sparkles size={15} />
                )}
                <span>💡 With Solutions</span>
              </button>

              {/* 4. Matching Calibrated OMR Sheet Download */}
              <a
                href={`/templates/${getMatchingOmrTemplate().file}`}
                download={getMatchingOmrTemplate().file}
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.84rem',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                  textDecoration: 'none'
                }}
                title={`Download official calibrated ${getMatchingOmrTemplate().name} Sheet`}
              >
                <FileText size={15} />
                <span>📄 Matching OMR ({getMatchingOmrTemplate().templateId})</span>
              </a>

              {/* 5. 1-Click Schedule Test for OMR Scanning */}
              <button
                type="button"
                className="btn"
                onClick={() => setShowScheduleModal(true)}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.84rem',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)'
                }}
                title="Schedule this test directly in OMR Scanner with pre-filled Answer Key"
              >
                <Target size={15} />
                <span>🚀 Schedule for OMR</span>
              </button>

              {/* 6. Instant High-Res Print Preview */}
              <button
                type="button"
                className="btn"
                onClick={() => triggerClientSidePrint('without-solution')}
                style={{
                  background: 'var(--bg-card)',
                  border: '1.5px dashed var(--border-color)',
                  color: 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
                title="Instant Browser Print / Save as PDF (Zero compilation wait)"
              >
                <Eye size={14} />
                <span>Print Preview</span>
              </button>
            </div>
          </div>

          {/* Live Interactive Paper Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {selectedSubjects.map((sid, subIdx) => {
              const subConfig = currentExamSubjects.find(s => s.id === sid);
              const qs = generatedPaper.data[sid] || [];
              if (qs.length === 0) return null;

              return (
                <div key={sid} className="card" style={{ padding: '24px', borderRadius: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '2px solid var(--border-color)',
                    paddingBottom: '10px',
                    marginBottom: '18px'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: subConfig?.color || 'var(--accent-blue, #3b82f6)' }}>
                      PART {subIdx + 1}: {subConfig?.name?.toUpperCase() || sid.toUpperCase()} ({qs.length} Questions)
                    </h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    {qs.map((q) => (
                      <div
                        key={q.id}
                        style={{
                          background: 'var(--bg-card)',
                          padding: '16px',
                          borderRadius: '12px',
                          border: '1px solid var(--border-color)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <span style={{ fontWeight: 800, color: 'var(--accent-blue, #3b82f6)', whiteSpace: 'nowrap', fontSize: '0.95rem' }}>
                            Q.{q.number}.
                          </span>
                          <div style={{ flex: 1, fontSize: '0.95rem' }}>
                            <LatexText text={q.text} />
                          </div>
                        </div>

                        {/* Question Images */}
                        {q.images && q.images.length > 0 && (
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', margin: '8px 0' }}>
                            {q.images.map((img, idx) => (
                              <img
                                key={idx}
                                src={img}
                                alt={`Question ${q.number} Diagram`}
                                style={{ maxHeight: '200px', maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                              />
                            ))}
                          </div>
                        )}

                        {/* MCQ Options */}
                        {q.type !== 'numerical' && q.options && q.options.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', marginTop: '6px' }}>
                            {q.options.map((opt, optIdx) => {
                              const label = ['(a)', '(b)', '(c)', '(d)'][optIdx] || `(${optIdx + 1})`;
                              const isCorrect = String(q.correct || '').toLowerCase() === ['a', 'b', 'c', 'd'][optIdx];
                              return (
                                <div
                                  key={optIdx}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    background: isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)',
                                    border: isCorrect ? '1px solid #10b981' : '1px solid var(--border-color)',
                                    fontSize: '0.88rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}
                                >
                                  <span style={{ fontWeight: 800, color: isCorrect ? '#10b981' : 'var(--text-muted)' }}>
                                    {label}
                                  </span>
                                  <LatexText text={opt} />
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Numerical Badge */}
                        {q.type === 'numerical' && (
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Type: Numerical Value (Correct: <strong>{q.correct || 'N/A'}</strong>)
                          </div>
                        )}

                        {/* Solution Snippet Preview */}
                        {q.solution && (
                          <div style={{
                            marginTop: '6px',
                            background: 'rgba(59, 130, 246, 0.06)',
                            border: '1px dashed rgba(59, 130, 246, 0.3)',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            fontSize: '0.82rem'
                          }}>
                            <span style={{ fontWeight: 800, color: 'var(--accent-blue, #3b82f6)', display: 'block', marginBottom: '4px' }}>
                              💡 Solution & Explanation:
                            </span>
                            <LatexText text={q.solution} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ============================================================ */}
      {/* MANUAL QUESTION PICKER MODAL                                 */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showManualModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(6px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="card"
              style={{
                width: '1000px',
                maxWidth: '96vw',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '16px',
                background: 'var(--bg-card)',
                padding: '20px',
                overflow: 'hidden'
              }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Search size={20} style={{ color: 'var(--accent-blue, #3b82f6)' }} />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                    Manual Question Database Picker ({EXAMS.find(e => e.id === selectedExam)?.name})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Filter / Search Bar */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {selectedSubjects.map(sid => {
                    const sub = currentExamSubjects.find(s => s.id === sid);
                    if (!sub) return null;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => { setManualActiveSubject(sub.id); setManualPage(1); }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: manualActiveSubject === sub.id ? 'var(--accent-blue, #3b82f6)' : 'var(--bg-secondary)',
                          color: manualActiveSubject === sub.id ? '#ffffff' : 'var(--text-primary)',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer'
                        }}
                      >
                        {sub.name}
                      </button>
                    );
                  })}
                </div>

                <input
                  type="text"
                  className="form-input flex-1"
                  placeholder="Search question text or chapter..."
                  value={manualSearchTerm}
                  onChange={e => { setManualSearchTerm(e.target.value); setManualPage(1); }}
                  style={{ height: '36px', borderRadius: '8px', fontSize: '0.84rem' }}
                />
              </div>

              {/* Questions List */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                {(() => {
                  const db = QUESTION_BANK[selectedExam]?.[manualActiveSubject] || [];
                  const filtered = db.filter(q => {
                    if (!manualSearchTerm) return true;
                    const search = manualSearchTerm.toLowerCase();
                    return (q.text || '').toLowerCase().includes(search) || (q.chapter || '').toLowerCase().includes(search);
                  });

                  const pageItems = filtered.slice((manualPage - 1) * MANUAL_PAGE_SIZE, manualPage * MANUAL_PAGE_SIZE);

                  if (pageItems.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        No questions matched your search query.
                      </div>
                    );
                  }

                  return pageItems.map(q => {
                    const currentSelected = manualSelectedQs[manualActiveSubject] || [];
                    const isSelected = currentSelected.includes(q.id);

                    return (
                      <div
                        key={q.id}
                        style={{
                          background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-secondary)',
                          border: isSelected ? '2px solid var(--accent-blue, #3b82f6)' : '1px solid var(--border-color)',
                          padding: '12px 16px',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            const updated = isSelected
                              ? currentSelected.filter(id => id !== q.id)
                              : [...currentSelected, q.id];
                            setManualSelectedQs({ ...manualSelectedQs, [manualActiveSubject]: updated });
                          }}
                          style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--accent-blue, #3b82f6)', marginBottom: '2px' }}>
                            {q.chapter} {q.topic ? `• ${q.topic}` : ''} ({q.type?.toUpperCase() || 'MCQ'})
                          </div>
                          <div style={{ fontSize: '0.88rem' }}>
                            <LatexText text={q.text} />
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Modal Footer */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Total Selected: {Object.values(manualSelectedQs).reduce((a, b) => a + b.length, 0)} Questions
                </span>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowManualModal(false)}
                  style={{ padding: '8px 20px', fontWeight: 700 }}
                >
                  Done & Apply
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ============================================================ */}
        {/* SCHEDULE TEST FOR OMR SCANNING MODAL                         */}
        {/* ============================================================ */}
        {showScheduleModal && generatedPaper && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(5px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="card"
              style={{
                width: '100%',
                maxWidth: '520px',
                background: 'var(--bg-card, #ffffff)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.25)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    🚀 Schedule for OMR Scanning
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Test will be created in OMR Scanner with all Answer Keys pre-filled.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Template Info Card */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(79, 70, 229, 0.12) 100%)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: '12px',
                padding: '12px 14px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <ShieldCheck size={16} color="#6366f1" />
                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#4f46e5' }}>
                    Calibrated OMR Template: {getMatchingOmrTemplate().name}
                  </span>
                </div>
                <div style={{ fontSize: '0.76rem', color: '#475569' }}>
                  Target Questions: <strong>{generatedPaper.totalQuestions}</strong> • Pre-filled Answer Keys: <strong>{generatedPaper.totalQuestions}</strong> • Max Marks: <strong>{generatedPaper.totalQuestions * 4}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    Test Name
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={testTitle}
                    onChange={(e) => setTestTitle(e.target.value)}
                    placeholder="e.g. JEE Mains Weekly Mock #01"
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                      Target Batch
                    </label>
                    <select
                      className="select"
                      value={scheduleBatch}
                      onChange={(e) => setScheduleBatch(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <option value="All Batches">All Batches</option>
                      {((batches && batches.length > 0) ? batches : [
                        { id: 'batch-4', name: 'JEE Mains' },
                        { id: 'batch-1', name: 'JEE Advanced' },
                        { id: 'batch-2', name: 'NEET' },
                        { id: 'batch-3', name: 'MHCET' },
                        { id: 'batch-5', name: 'Foundation' }
                      ]).map((b) => (
                        <option key={b.id || b._id} value={b.name || b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                      Exam Date
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowScheduleModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleScheduleTest}
                  disabled={isScheduling}
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: 'none',
                    fontWeight: 800
                  }}
                >
                  {isScheduling ? <RefreshCw size={15} className="spin" /> : <CheckCircle2 size={15} />}
                  <span>Confirm & Save Test</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
