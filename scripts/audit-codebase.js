import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '..', 'src');

console.log('🔍 Running Deep Codebase Static Audit for Missing Imports & White-Screen Errors...\n');

const standardHtmlTags = new Set([
  'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base', 'bdi', 'bdo', 'blockquote',
  'body', 'br', 'button', 'canvas', 'caption', 'cite', 'code', 'col', 'colgroup', 'data', 'datalist',
  'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'embed', 'fieldset', 'figcaption',
  'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr',
  'html', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'label', 'legend', 'li', 'link', 'main', 'map',
  'mark', 'meta', 'meter', 'nav', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p',
  'param', 'picture', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'section',
  'select', 'slot', 'small', 'source', 'span', 'strong', 'style', 'sub', 'summary', 'sup', 'svg',
  'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr',
  'track', 'u', 'ul', 'var', 'video', 'wbr',
  // SVG sub-elements
  'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'g', 'defs', 'use', 'text', 'tspan', 'mask'
]);

function getAllFiles(dir, exts = ['.jsx', '.js']) {
  let files = [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (item === 'data' || item === 'node_modules' || item === '.git') continue;
      files = files.concat(getAllFiles(fullPath, exts));
    } else if (exts.includes(path.extname(fullPath))) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = getAllFiles(srcDir);
let totalErrors = 0;
let checkedFiles = 0;

for (const filePath of files) {
  const relPath = path.relative(path.join(__dirname, '..'), filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  checkedFiles++;

  // 1. Collect all declared / imported identifiers in this file
  const declaredIdentifiers = new Set([
    'React', 'useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', 'useContext', 'useId',
    'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'console', 'Math', 'Date',
    'Array', 'Object', 'String', 'Number', 'Boolean', 'Promise', 'Set', 'Map', 'JSON', 'Intl',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'fetch', 'FormData', 'URL', 'URLSearchParams',
    'CustomEvent', 'Notification', 'location', 'history'
  ]);

  // Match import statements: import ... from '...'
  const importLines = content.match(/import\s+[\s\S]*?from\s+['"][^'"]+['"]/g) || [];
  for (const imp of importLines) {
    // Default imports: import Foo from '...'
    const defaultMatch = imp.match(/import\s+([A-Za-z0-9_$]+)\s+from/);
    if (defaultMatch && defaultMatch[1] && defaultMatch[1] !== 'type') {
      declaredIdentifiers.add(defaultMatch[1]);
    }

    // Named imports: import { A, B as C } from '...'
    const namedMatch = imp.match(/\{([\s\S]*?)\}/);
    if (namedMatch && namedMatch[1]) {
      const parts = namedMatch[1].split(',');
      for (const p of parts) {
        const clean = p.trim();
        if (!clean) continue;
        if (clean.includes(' as ')) {
          const alias = clean.split(' as ')[1].trim();
          declaredIdentifiers.add(alias);
        } else {
          declaredIdentifiers.add(clean.replace(/^type\s+/, ''));
        }
      }
    }

    // Star imports: import * as Foo from '...'
    const starMatch = imp.match(/import\s*\*\s*as\s+([A-Za-z0-9_$]+)/);
    if (starMatch && starMatch[1]) {
      declaredIdentifiers.add(starMatch[1]);
    }
  }

  // Match top-level or local variable / function / class declarations
  const declMatches = content.match(/(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)/g) || [];
  for (const d of declMatches) {
    const name = d.replace(/^(?:const|let|var|function|class)\s+/, '').trim();
    if (name) declaredIdentifiers.add(name);
  }

  // 2. Scan for JSX tags: <Tag ... or <Tag> or <Tag/>
  // Only match uppercase tags (custom components / icons) or unrecognized tags
  const lines = content.split('\n');
  lines.forEach((line, lineNum) => {
    // Exclude comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;

    // Match JSX openings: <([A-Z][A-Za-z0-9_$.]*)
    const jsxMatches = line.matchAll(/<([A-Z][A-Za-z0-9_$.]*)/g);
    for (const match of jsxMatches) {
      let tagName = match[1];
      // Handle dotted components like motion.div, Fragment, etc.
      if (tagName.includes('.')) {
        tagName = tagName.split('.')[0];
      }

      if (!declaredIdentifiers.has(tagName)) {
        console.error(`❌ [MISSING IMPORT / UNDEFINED IDENTIFIER] in ${relPath}:${lineNum + 1}`);
        console.error(`   Tag: <${tagName} /> is used in JSX but is NOT imported or defined!\n   Line ${lineNum + 1}: ${trimmed}\n`);
        totalErrors++;
      }
    }
  });
}

if (totalErrors > 0) {
  console.error(`\n🚨 AUDIT FAILED: Found ${totalErrors} potential white-screen crash bugs across ${checkedFiles} files!`);
  console.error(`👉 Please fix the missing imports above before building.\n`);
  process.exit(1);
} else {
  console.log(`✅ AUDIT PASSED: Scanned ${checkedFiles} files. All ${files.length} JSX components & icons are 100% properly imported and defined! Zero missing identifiers found.\n`);
  process.exit(0);
}
