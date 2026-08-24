import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import axios from 'axios';
import { logInfo, logError, logWarn } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// UNICODE TO LATEX MAPPING
// ============================================================
const UNICODE_MAP = {
  'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta', 'ε': '\\varepsilon',
  'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta', 'ι': '\\iota', 'κ': '\\kappa',
  'λ': '\\lambda', 'μ': '\\mu', 'ν': '\\nu', 'ξ': '\\xi', 'ο': 'o', 'π': '\\pi',
  'ρ': '\\rho', 'σ': '\\sigma', 'τ': '\\tau', 'υ': '\\upsilon', 'φ': '\\phi',
  'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega',
  'Α': 'A', 'Β': 'B', 'Γ': '\\Gamma', 'Δ': '\\Delta', 'Ε': 'E',
  'Ζ': 'Z', 'Η': 'H', 'Θ': '\\Theta', 'Ι': 'I', 'Κ': 'K',
  'Λ': '\\Lambda', 'Μ': 'M', 'Ν': 'N', 'Ξ': '\\Xi', 'Ο': 'O',
  'Π': '\\Pi', 'Ρ': 'P', 'Σ': '\\Sigma', 'Τ': 'T', 'Υ': '\\Upsilon',
  'Φ': '\\Phi', 'Χ': 'X', 'Ψ': '\\Psi', 'Ω': '\\Omega',
  '°': '^\\circ', 'º': '^\\circ', '℃': '^\\circ\\mathrm{C}', '℉': '^\\circ\\mathrm{F}', '∘': '\\circ',
  '±': '\\pm', '∓': '\\mp', '×': '\\times', '÷': '\\div',
  '≤': '\\le', '≥': '\\ge', '≠': '\\neq', '≈': '\\approx', '≡': '\\equiv', '≅': '\\cong', '∼': '\\sim',
  '∞': '\\infty', '∝': '\\propto',
  '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint',
  '∑': '\\sum', '∏': '\\prod',
  '∈': '\\in', '∉': '\\notin', '∋': '\\ni',
  '∩': '\\cap', '∪': '\\cup', '⊂': '\\subset', '⊃': '\\supset', '⊆': '\\subseteq', '⊇': '\\supseteq',
  '→': '\\rightarrow', '←': '\\leftarrow', '↔': '\\leftrightarrow',
  '⇒': '\\Rightarrow', '⇐': '\\Leftarrow', '⇔': '\\Leftrightarrow',
  '⇌': '\\rightleftharpoons', '↑': '\\uparrow', '↓': '\\downarrow',
  '∴': '\\therefore', '∵': '\\because',
  '∇': '\\nabla', '∂': '\\partial', 'ℏ': '\\hbar',
  '∠': '\\angle', '△': '\\triangle', '⊥': '\\perp', '∥': '\\parallel',
  '⋅': '\\cdot', '·': '\\cdot', '•': '\\bullet',
  '½': '\\frac{1}{2}', '¼': '\\frac{1}{4}', '¾': '\\frac{3}{4}',
  'Å': '\\text{\\AA}', 'Å': '\\text{\\AA}', '₹': '\\text{Rs.}',
  'µ': '\\mu', 'Ω': '\\Omega', '∆': '\\Delta',
  '−': '-', '–': '-', '—': '-',
  '‘': "'", '’': "'", '“': '"', '”': '"',
  '⁰': '^0', '¹': '^1', '²': '^2', '³': '^3', '⁴': '^4', '⁵': '^5', '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9',
  '⁺': '^+', '⁻': '^-', '⁼': '^=', '⁽': '^{(}', '⁾': '^{)}', 'ⁿ': '^n',
  '₀': '_0', '₁': '_1', '₂': '_2', '₃': '_3', '₄': '_4', '₅': '_5', '₆': '_6', '₇': '_7', '₈': '_8', '₉': '_9',
  '₊': '_+', '₋': '_-', '₌': '_=', '₍': '_{(', '₎': '_{)}',
  '≫': '\\gg', '≪': '\\ll', '¯': '\\bar{}'
};

const decodeEntities = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&deg;/g, '°')
    .replace(/&rarr;/g, '→')
    .replace(/\f(?=rac)/g, '\\f')
    .replace(/\n(?=u\b)/g, '\\n')
    .replace(/\r(?=ightarrow)/g, '\\r')
    .replace(/\r(?=ho\b)/g, '\\r')
    .replace(/\t(?=ext)/g, '\\t')
    .replace(/\t(?=heta)/g, '\\t')
    .replace(/\t(?=imes)/g, '\\t')
    .replace(/\t(?=au\b)/g, '\\t')
    .replace(/[\b](?=eta\b)/g, '\\b')
    .replace(/\x0B(?=arepsilon)/g, '\\v')
    .replace(/\x0B(?=ec\b)/g, '\\v')
    .replace(/&alpha;/g, 'α')
    .replace(/&beta;/g, 'β')
    .replace(/&gamma;/g, 'γ')
    .replace(/&theta;/g, 'θ')
    .replace(/&mu;/g, 'μ')
    .replace(/&pi;/g, 'π')
    .replace(/&Omega;/g, 'Ω')
    .replace(/&Sigma;/g, 'Σ')
    .replace(/&Delta;/g, 'Δ')
    .replace(/&infin;/g, '∞')
    .replace(/&ge;/g, '≥')
    .replace(/&le;/g, '≤')
    .replace(/&times;/g, '×')
    .replace(/&divide;/g, '÷')
    .replace(/&pm;/g, '±')
    .replace(/&rarr;/g, '→')
    .replace(/&larr;/g, '←')
    .replace(/&harr;/g, '↔')
    .replace(/&rArr;/g, '⇒')
    .replace(/&lArr;/g, '⇐')
    .replace(/&hArr;/g, '⇔');
};

const escapeLatexText = (str) => {
  if (!str) return '';
  const s = decodeEntities(String(str));
  const parts = s.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g);

  return parts.map((part) => {
    let isMathMode = part.startsWith('$');
    let res = part;

    if (isMathMode) {
      res = res.replace(/(?<!\\)%/g, '\\%');
      res = res.replace(/√\s*([0-9a-zA-Z.]+)/g, '\\sqrt{$1}');
      res = res.replace(/∛\s*([0-9a-zA-Z.]+)/g, '\\sqrt[3]{$1}');
      res = res.replace(/√/g, '\\surd ');
      res = res.replace(/>>/g, '\\gg ');
      res = res.replace(/<</g, '\\ll ');

      for (const [char, latex] of Object.entries(UNICODE_MAP)) {
        res = res.split(char).join(latex + ' ');
      }
      return res;
    } else {
      res = res
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/\^/g, '\\^{}')
        .replace(/_/g, '\\_')
        .replace(/&/g, '\\&')
        .replace(/%/g, '\\%')
        .replace(/#/g, '\\#')
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/</g, '\\textless{}')
        .replace(/>/g, '\\textgreater{}')
        .replace(/\|/g, '\\textbar{}');

      res = res.replace(/√\s*([0-9a-zA-Z.]+)/g, '$\\sqrt{$1}$');
      res = res.replace(/∛\s*([0-9a-zA-Z.]+)/g, '$\\sqrt[3]{$1}$');
      res = res.replace(/√/g, '$\\surd$ ');
      res = res.replace(/>>/g, '$\\gg$ ');
      res = res.replace(/<</g, '$\\ll$ ');

      for (const [char, latex] of Object.entries(UNICODE_MAP)) {
        if (['-', "'", '"'].includes(latex)) {
          res = res.split(char).join(latex);
        } else {
          res = res.split(char).join('$' + latex + '$');
        }
      }
      return res;
    }
  }).join('');
};

const escapeTitle = (str) => {
  if (!str) return '';
  let res = decodeEntities(String(str))
    .replace(/\\/g, '')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/#/g, '\\#')
    .replace(/\$/g, '\\$')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '')
    .replace(/\^/g, '')
    .replace(/\|/g, '\\textbar{}');

  for (const [char, latex] of Object.entries(UNICODE_MAP)) {
    if (['-', "'", '"'].includes(latex)) {
      res = res.split(char).join(latex);
    } else {
      res = res.split(char).join('$' + latex + '$');
    }
  }
  return res;
};

const cleanQuestionText = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/^(\s*(?:Q\.?\s*)?\d+[\.\:\)])(?!\d)\s*/i, '')
    .trim();
};

const cleanOptionText = (opt) => {
  if (opt === null || opt === undefined) return '';
  let text = String(opt)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
  const match = text.match(/^(\s*\(?[A-Da-d1-4][\.\)\:])(?!\d)\s*/i);
  if (match) {
    const remainder = text.substring(match[0].length).trim();
    if (remainder === '') return text;
    const remLower = remainder.toLowerCase();
    if (remLower.startsWith(',') ||
      remLower.startsWith('and ') ||
      remLower.startsWith('&') ||
      remLower.startsWith('(') ||
      remLower.startsWith('is ') ||
      remLower.startsWith('are ') ||
      remLower.startsWith('both ') ||
      remLower.startsWith('only') ||
      remLower.startsWith('statement')) {
      return text;
    }
    return remainder;
  }
  return text;
};

const cleanSolutionText = (sol) => {
  if (!sol) return '';
  return String(sol)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p>/gi, '')
    .replace(/<strong>/gi, '\\textbf{')
    .replace(/<\/strong>/gi, '}')
    .replace(/<b>/gi, '\\textbf{')
    .replace(/<\/b>/gi, '}')
    .replace(/<em>/gi, '\\textit{')
    .replace(/<\/em>/gi, '}')
    .replace(/<i>/gi, '\\textit{')
    .replace(/<\/i>/gi, '}')
    .replace(/<[^>]+>/g, '')
    .trim();
};

const estimateMathWidth = (s) => {
  if (!s) return 0;
  return s
    .replace(/\\frac\{[^}]*\}\{[^}]*\}/g, '____')
    .replace(/\\sqrt\{[^}]*\}/g, '___')
    .replace(/\\[a-zA-Z]+/g, '_')
    .replace(/[\$\{\}\^\_]/g, '')
    .trim().length;
};

const getOptionsLayout = (textOpts) => {
  const widths = textOpts.map(o => {
    if (!o) return 0;
    if (!o.includes('$')) return o.length;
    const parts = o.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g);
    return parts.reduce((sum, p) => sum + (p.startsWith('$') ? estimateMathWidth(p) : p.length), 0);
  });
  return Math.max(...widths) > 38 ? 'single' : 'double';
};

const downloadImageToFile = async (url) => {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const buffer = Buffer.from(response.data);
    if (!buffer || buffer.length < 100) return null;

    const fpath = path.join(os.tmpdir(), `cx_${Date.now()}_${Math.floor(Math.random() * 99999)}.png`);
    fs.writeFileSync(fpath, buffer);
    if (!fs.existsSync(fpath) || fs.statSync(fpath).size < 100) return null;
    return fpath;
  } catch (e) {
    logWarn('TEST_SERIES', `Image download error (${url}): ${e.message}`);
    return null;
  }
};

export const downloadCloudinaryImages = async (subjects) => {
  const urlToLocal = {};
  const tempFiles = [];
  for (const sub of (subjects || [])) {
    if (!sub || !sub.questions) continue;
    for (const q of sub.questions) {
      if (!q.images || !Array.isArray(q.images)) continue;
      for (const img of q.images) {
        if (!img || !img.startsWith('http') || urlToLocal[img]) continue;
        const localPath = await downloadImageToFile(img);
        if (localPath) {
          urlToLocal[img] = localPath;
          tempFiles.push(localPath);
        }
      }
    }
  }
  return { urlToLocal, tempFiles };
};

// ============================================================
// MAIN: LaTeX Document Generator
// ============================================================
export const generateTex = ({
  examName = 'Mock Test',
  subjects = [],
  includeAnswerKey = false,
  includeSolutions = false,
  examId = '',
  totalQuestions = 0,
  branding = null
}) => {
  if (!subjects || !Array.isArray(subjects)) return '';

  const totalQs = totalQuestions || subjects.reduce((s, sub) => s + (sub.questions || []).length, 0);
  const maxMarks = totalQs * 4;
  const examIdStr = (examId || '').toLowerCase();

  let examTimeStr, examMarksStr;
  if (examIdStr.includes('jee-adv') || examIdStr.includes('jee_adv')) {
    const mins = Math.round(totalQs * 3);
    examTimeStr = `${mins} Minutes`;
    examMarksStr = `${maxMarks} Marks`;
  } else if (examIdStr.includes('neet')) {
    examTimeStr = '200 Minutes (3 Hours 20 Minutes)';
    examMarksStr = `${maxMarks} Marks`;
  } else {
    const mins = totalQs * 3;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    examTimeStr = hrs > 0 ? `${mins} Minutes (${hrs} Hr${rem > 0 ? ` ${rem} Min` : ''})` : `${mins} Minutes`;
    examMarksStr = `${maxMarks} Marks`;
  }

  const safeExamName = escapeTitle(examName || 'Mock Test');
  const safeAcademy = escapeTitle(branding?.academyName || 'CAREER XONE');
  const safeWatermark = escapeTitle(branding?.watermarkText || 'Career Xone');

  let allSectionsContent = '';
  let globalQNum = 1;

  subjects.forEach((sub, subIndex) => {
    if (!sub || !sub.questions || !Array.isArray(sub.questions)) return;

    const subjectName = escapeTitle(sub.name || `Subject ${subIndex + 1}`);
    let sectionContent = '';

    const mcqQuestions = sub.questions.filter(q => q && q.type !== 'numerical');
    const numericalQuestions = sub.questions.filter(q => q && q.type === 'numerical');

    const renderQuestion = (q, qNum) => {
      if (!q) return '';
      const qText = cleanQuestionText(q.text || '');
      const isNumerical = q.type === 'numerical';

      const validImages = [];
      if (q.images && Array.isArray(q.images)) {
        q.images.forEach(imgPath => {
          if (imgPath && typeof imgPath === 'string' && fs.existsSync(imgPath)) {
            validImages.push(imgPath.replace(/\\/g, '/'));
          }
        });
      }

      let out = '';
      out += `\\noindent\\textbf{Q.${qNum}.}\\enspace ${escapeLatexText(qText)}\\par\n`;
      out += `\\vspace{2pt}\n`;

      if (validImages.length > 0) {
        out += `\\begin{center}\n`;
        validImages.forEach((img, idx) => {
          out += `  \\includegraphics[max width=0.55\\linewidth,max height=0.32\\textheight,keepaspectratio]{${img}}\n`;
          if (idx < validImages.length - 1) out += `  \\\\[6pt]\n`;
        });
        out += `\\end{center}\n`;
        out += `\\vspace{2pt}\n`;
      }

      if (!isNumerical && q.options && Array.isArray(q.options) && q.options.length > 0) {
        const labels = ['a', 'b', 'c', 'd'];
        const rawOpts = q.options.map(o => cleanOptionText(o));
        const hasContent = rawOpts.some(o => o.length > 0);

        if (hasContent) {
          const layout = getOptionsLayout(rawOpts);

          if (layout === 'double') {
            const opts = [...rawOpts];
            while (opts.length % 2 !== 0) opts.push('');
            out += `\\vspace{2pt}\n`;
            out += `\\begin{tabular}{@{}p{0.46\\linewidth}@{\\hskip0.04\\linewidth}p{0.46\\linewidth}@{}}\n`;
            for (let i = 0; i < opts.length; i += 2) {
              const lbl1 = labels[i] || String.fromCharCode(97 + i);
              const lbl2 = labels[i + 1] || String.fromCharCode(97 + i + 1);
              const c1 = `\\textbf{(${lbl1})}~${escapeLatexText(opts[i] || '\\phantom{x}')}`;
              const c2 = (i + 1 < opts.length)
                ? `\\textbf{(${lbl2})}~${escapeLatexText(opts[i + 1] || '\\phantom{x}')}`
                : '';
              out += `  ${c1} & ${c2} \\\\[3pt]\n`;
            }
            out += `\\end{tabular}\n`;
          } else {
            out += `\\vspace{2pt}\n`;
            out += `\\begin{enumerate}[label=\\textbf{(\\alph*)},leftmargin=22pt,itemsep=1pt,topsep=2pt]\n`;
            rawOpts.forEach(opt => {
              out += `  \\item ${opt.length > 0 ? escapeLatexText(opt) : '\\phantom{X}'}\n`;
            });
            out += `\\end{enumerate}\n`;
          }
        }
      }

      return `\\vspace{6pt}\n${out}\n`;
    };

    if (mcqQuestions.length > 0) {
      mcqQuestions.forEach((q) => {
        sectionContent += renderQuestion(q, globalQNum++);
      });
    }

    if (numericalQuestions.length > 0) {
      sectionContent += `\\vspace{12pt}\n`;
      sectionContent += `\\noindent{\\bfseries\\large Section B -- Numerical Type Questions}\\\\[4pt]\n`;
      sectionContent += `\\noindent{\\small\\itshape (Write the correct numerical value. Each question carries +4 marks. No negative marking.)}\\par\n`;
      sectionContent += `\\vspace{6pt}\n\n`;
      numericalQuestions.forEach((q) => {
        sectionContent += renderQuestion(q, globalQNum++);
      });
    }

    allSectionsContent += `\\begin{center}{\\large\\bfseries\\underline{PART ~--~ ${subjectName}}}\\end{center}\n`;
    allSectionsContent += `\\vspace{6pt}\n\n`;
    allSectionsContent += sectionContent;
    if (subIndex < subjects.length - 1) allSectionsContent += `\n\\newpage\n\n`;
  });

  // 1. Answer Key Grid
  let answerKeyContent = '';
  if (includeAnswerKey || includeSolutions) {
    let answerKeySections = '';
    const COLS = 12;
    let runningNum = 1;

    subjects.forEach((sub, index) => {
      if (!sub || !sub.questions) return;

      const mcqs = sub.questions.filter(q => q && q.type !== 'numerical');
      const nums = sub.questions.filter(q => q && q.type === 'numerical');
      const subQs = [...mcqs, ...nums].map((q) => ({ num: runningNum++, q }));

      if (subQs.length === 0) return;

      const subjectName = escapeTitle(sub.name || `Subject ${index + 1}`);
      let tables = [];
      let tableRows = '';
      let chunkCount = 0;

      for (let i = 0; i < subQs.length; i += COLS) {
        const chunk = subQs.slice(i, i + COLS);
        const pad = COLS - chunk.length;
        const qRow = chunk.map(r => `\\textbf{Q.${r.num}}`).join(' & ') + ' &'.repeat(pad);
        const aRow = chunk.map(r => `\\textbf{${escapeTitle(String(r.q.correct || '?').toUpperCase())}}`).join(' & ') + ' &'.repeat(pad);
        tableRows += `${qRow} \\\\ \\hline\n${aRow} \\\\ \\hline\n`;
        chunkCount++;

        if (chunkCount === 9 || i + COLS >= subQs.length) {
          tables.push(`\\noindent{\\small\\begin{tabular}{|${'c|'.repeat(COLS)}}\n\\hline\n${tableRows}\\end{tabular}}`);
          tableRows = '';
          chunkCount = 0;
        }
      }

      answerKeySections += `\\vspace{10pt}\n\\noindent{\\large\\bfseries\\underline{${subjectName}}}\\par\\vspace{8pt}\n`;
      answerKeySections += `${tables.join('\\par\\vspace{15pt}\\noindent\n')}\\par\\vspace{15pt}\n`;
    });

    answerKeyContent = `
\\newpage
\\thispagestyle{fancy}
\\begin{center}
  {\\LARGE\\bfseries ANSWER KEY}\\\\[8pt]
  \\rule{\\linewidth}{1pt}
\\end{center}
\\vspace{10pt}
${answerKeySections}
\\noindent{\\small\\itshape Note: For MCQ, answer is the correct option (a/b/c/d). For Numerical, answer is the numerical value.}
`;
  }

  // 2. Detailed Step-by-Step Solutions
  let solutionsContent = '';
  if (includeSolutions) {
    let solSections = '';
    let solRunningNum = 1;

    subjects.forEach((sub, sIdx) => {
      if (!sub || !sub.questions || sub.questions.length === 0) return;
      const subjectName = escapeTitle(sub.name || `Subject ${sIdx + 1}`);
      let subSolContent = '';

      const allSubQs = [
        ...sub.questions.filter(q => q && q.type !== 'numerical'),
        ...sub.questions.filter(q => q && q.type === 'numerical')
      ];

      allSubQs.forEach(q => {
        const qNum = solRunningNum++;
        const correctVal = String(q.correct || '').toUpperCase();
        const rawSol = cleanSolutionText(q.solution || '');

        subSolContent += `\\noindent\\textbf{Q.${qNum}.}\\quad `;
        if (q.type === 'numerical') {
          subSolContent += `\\textbf{Correct Answer: ${escapeTitle(correctVal || 'Numerical Value')}}\\par\n`;
        } else {
          subSolContent += `\\textbf{Correct Option: (${escapeTitle(correctVal || '?')})}\\par\n`;
        }
        subSolContent += `\\vspace{3pt}\n`;

        if (rawSol && rawSol.length > 0) {
          subSolContent += `\\noindent{\\color{blue!70!black}\\textbf{Solution/Explanation:}}\\\\[2pt]\n`;
          subSolContent += `${escapeLatexText(rawSol)}\\par\n`;
        } else {
          subSolContent += `\\noindent{\\small\\itshape (Detailed step-by-step conceptual solution for chapter ${escapeTitle(q.chapter || '')}.)}\\par\n`;
        }
        subSolContent += `\\vspace{10pt}\\hrule\\vspace{10pt}\n\n`;
      });

      solSections += `\\begin{center}{\\large\\bfseries\\underline{SOLUTIONS ~--~ ${subjectName}}}\\end{center}\n\\vspace{8pt}\n\n${subSolContent}`;
      if (sIdx < subjects.length - 1) solSections += `\n\\newpage\n\n`;
    });

    solutionsContent = `
\\newpage
\\thispagestyle{fancy}
\\begin{center}
  {\\LARGE\\bfseries DETAILED STEP-BY-STEP SOLUTIONS}\\\\[8pt]
  \\rule{\\linewidth}{1.2pt}
\\end{center}
\\vspace{12pt}
${solSections}
`;
  }

  const logoLine = branding?.logoPath
    ? `\\includegraphics[height=1.1cm,keepaspectratio]{${branding.logoPath}}\\quad `
    : '';

  return `\\documentclass[11pt,a4paper]{article}

%% Encoding and Font
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{mathptmx}

%% Math packages
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{amsfonts}
\\usepackage[version=4]{mhchem}
\\usepackage{siunitx}

%% Layout packages
\\usepackage{graphicx}
\\usepackage[export]{adjustbox}
\\usepackage{needspace}
\\usepackage[margin=0.65in,top=0.9in,bottom=0.85in]{geometry}
\\usepackage{enumitem}
\\usepackage{xcolor}
\\usepackage{fancyhdr}
\\usepackage{lastpage}
\\usepackage[hidelinks]{hyperref}
\\usepackage[pages=all]{background}

%% Watermark
\\backgroundsetup{
  scale=8,color=black!5,opacity=0.08,angle=45,
  contents={${safeWatermark}}
}

%% Global settings
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0pt}

%% Header / Footer
\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[L]{${logoLine}\\textbf{\\textsc{${safeAcademy}}}}
\\fancyhead[C]{\\textbf{${safeExamName} -- Test Series}}
\\fancyhead[R]{\\textbf{Page \\thepage\\ / \\pageref{LastPage}}}
\\fancyfoot[L]{\\small\\itshape Generated by ${safeAcademy}}
\\fancyfoot[R]{\\small\\itshape Career Xone Test Platform}
\\renewcommand{\\headrulewidth}{0.6pt}
\\renewcommand{\\footrulewidth}{0.3pt}

\\begin{document}

%% Title block
\\begin{center}
  {\\LARGE\\bfseries ${safeExamName.toUpperCase()} -- TEST SERIES}\\\\[6pt]
  {\\normalsize\\textbf{Time: ${escapeTitle(examTimeStr)} \\hfill Maximum Marks: ${escapeTitle(examMarksStr)}}}\\\\[4pt]
  \\rule{\\linewidth}{1.2pt}
\\end{center}
\\vspace{6pt}

%% Instructions
\\noindent{\\bfseries General Instructions:}
\\begin{enumerate}[leftmargin=18pt,itemsep=1pt,topsep=3pt,label=\\arabic*.]
  \\item This paper contains MCQ (Multiple Choice Questions) and Numerical type questions.
  \\item For MCQ: Correct answer \\textbf{+4} marks, Wrong answer \\textbf{\$-\$1} mark, Unattempted \\textbf{0} marks.
  \\item For Numerical: Correct answer \\textbf{+4} marks. No negative marking.
  \\item Use blue/black ballpoint pen only. Do not use pencil for MCQ.
  \\item Do not write anything on the question paper except your name and roll number.
\\end{enumerate}
\\vspace{8pt}
\\rule{\\linewidth}{0.8pt}
\\vspace{6pt}

${allSectionsContent}

\\vspace{16pt}
\\begin{center}
  \\rule{5cm}{0.5pt}\\\\[4pt]
  {\\small\\itshape --- End of Question Paper ---}
\\end{center}

${answerKeyContent}

${solutionsContent}

\\end{document}
`;
};

// ============================================================
// PDF Compiler using local pdflatex
// ============================================================
export const compilePdf = async ({
  examName,
  examId,
  totalQuestions,
  subjects,
  includeAnswerKey = false,
  includeSolutions = false,
  branding = null
}) => {
  const docId = `${Date.now()}_${Math.floor(Math.random() * 99999)}`;
  const workDir = os.tmpdir();
  const texFile = path.join(workDir, `paper_${docId}.tex`);
  const pdfFile = path.join(workDir, `paper_${docId}.pdf`);
  const logFile = path.join(workDir, `paper_${docId}.log`);

  const cleanup = (extra = []) => {
    [
      texFile, pdfFile, logFile,
      path.join(workDir, `paper_${docId}.aux`),
      path.join(workDir, `paper_${docId}.out`),
      ...extra
    ].forEach(f => {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) { }
    });
  };

  const { urlToLocal, tempFiles } = await downloadCloudinaryImages(subjects);

  let localLogoPath = null;
  if (branding?.brandingLogo && branding.brandingLogo.startsWith('data:image')) {
    try {
      const b64 = branding.brandingLogo.split(',')[1];
      localLogoPath = path.join(workDir, `logo_${docId}.png`);
      fs.writeFileSync(localLogoPath, b64, { encoding: 'base64' });
    } catch (e) {
      logWarn('TEST_SERIES', `Logo save error: ${e.message}`);
    }
  }

  const subjectsWithLocalImgs = subjects.map(sub => ({
    ...sub,
    questions: (sub.questions || []).map(q => ({
      ...q,
      images: (q.images || []).map(img => (img && urlToLocal[img]) ? urlToLocal[img] : img)
    }))
  }));

  const texContent = generateTex({
    examName,
    subjects: subjectsWithLocalImgs,
    includeAnswerKey,
    includeSolutions,
    examId,
    totalQuestions,
    branding: { ...branding, logoPath: localLogoPath ? localLogoPath.replace(/\\/g, '/') : null }
  });

  if (!texContent.trim()) {
    cleanup([...tempFiles, localLogoPath]);
    throw new Error('No TeX content generated.');
  }

  fs.writeFileSync(texFile, texContent, 'utf8');
  logInfo('TEST_SERIES', `TeX file generated: ${texFile}`);

  const cleanAll = () => cleanup([...tempFiles, localLogoPath].filter(Boolean));
  const cmd = `pdflatex -interaction=nonstopmode -output-directory="${workDir}" "${texFile}"`;

  return new Promise((resolve, reject) => {
    logInfo('TEST_SERIES', 'Running pdflatex compilation pass 1...');
    exec(cmd, { timeout: 90000 }, (err1) => {
      logInfo('TEST_SERIES', 'Running pdflatex compilation pass 2...');
      exec(cmd, { timeout: 90000 }, (err2) => {
        if (!fs.existsSync(pdfFile)) {
          let errMsg = 'LaTeX compilation error.';
          if (fs.existsSync(logFile)) {
            const log = fs.readFileSync(logFile, 'utf8');
            errMsg = log.split('\n').filter(l => l.startsWith('!') || l.includes('Error')).join('\n') || log.slice(-2000);
            logError('TEST_SERIES', `LaTeX Error: ${errMsg}`);
          }
          cleanAll();
          return reject(new Error(`PDF compilation failed: ${errMsg}`));
        }

        const stats = fs.statSync(pdfFile);
        if (stats.size === 0) {
          cleanAll();
          return reject(new Error('Generated PDF is empty (0 bytes).'));
        }

        logInfo('TEST_SERIES', `PDF ready: ${(stats.size / 1024).toFixed(1)} KB`);
        const pdfBuffer = fs.readFileSync(pdfFile);
        setTimeout(() => cleanAll(), 5000);
        resolve(pdfBuffer);
      });
    });
  });
};
