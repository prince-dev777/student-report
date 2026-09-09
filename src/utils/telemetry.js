// Real-time Client Telemetry & Error Logging Engine
// Captures user click breadcrumbs, unhandled errors, API failures, and React crashes

const MAX_BREADCRUMBS = 12;
const breadcrumbs = [];
let lastReportedErrorKey = '';
let lastReportedTime = 0;

// Helper to format clean time
function getNowString() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

// Add a user action breadcrumb
export function addBreadcrumb(actionText) {
  if (!actionText || typeof actionText !== 'string') return;
  const entry = `[${getNowString()}] ${actionText.slice(0, 100)}`;
  breadcrumbs.push(entry);
  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }
}

// Get recent breadcrumbs
export function getBreadcrumbs() {
  return [...breadcrumbs];
}

// Extract human-readable label from clicked element
function getElementDescriptor(el) {
  if (!el) return 'Unknown element';
  
  // Find closest interactive element
  const target = el.closest('button, a, input, select, textarea, [role="button"], tr, .card') || el;
  const tag = target.tagName.toLowerCase();
  
  let label = target.getAttribute('aria-label') || target.getAttribute('title') || '';
  if (!label && target.innerText) {
    label = target.innerText.trim().replace(/\s+/g, ' ').slice(0, 40);
  }
  if (!label && target.value) {
    label = String(target.value).trim().slice(0, 30);
  }
  if (!label && target.id) {
    label = `#${target.id}`;
  }
  if (!label && target.className && typeof target.className === 'string') {
    label = `.${target.className.split(' ')[0]}`;
  }

  // Mask sensitive labels
  if (target.type === 'password' || /password|pin|secret/i.test(label)) {
    label = '***';
  }

  return `${tag.toUpperCase()} "${label || 'Unlabeled'}"`;
}

// Helper to get system context
function getSystemInfo() {
  const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes(' electron/');
  return {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    platform: typeof navigator !== 'undefined' ? (navigator.userAgentData?.platform || navigator.platform || 'Unknown') : '',
    isElectron,
    screenResolution: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight} (Screen: ${window.screen?.width}x${window.screen?.height})` : '',
    online: typeof navigator !== 'undefined' ? navigator.onLine : true
  };
}

// Helper to get current user info
function getUserInfo() {
  try {
    const rawUser = localStorage.getItem('user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      return {
        userId: u.id || u._id || null,
        username: u.username || u.name || 'Admin',
        role: u.role || 'Admin',
        instituteId: u.instituteId || null
      };
    }
  } catch (e) {}
  return {
    userId: null,
    username: 'Anonymous',
    role: 'User',
    instituteId: null
  };
}

// Send error report to server
export async function reportClientError({
  errorType = 'UNHANDLED_ERROR',
  message,
  stack = '',
  componentStack = '',
  url = (typeof window !== 'undefined' ? window.location.href : '')
}) {
  if (!message) return;

  const errorKey = `${errorType}:${message}:${url}`;
  const now = Date.now();

  // Deduplicate rapid repeat errors within 4 seconds
  if (errorKey === lastReportedErrorKey && (now - lastReportedTime) < 4000) {
    return;
  }
  lastReportedErrorKey = errorKey;
  lastReportedTime = now;

  const payload = {
    errorType,
    message: String(message).slice(0, 1000),
    stack: String(stack || '').slice(0, 4000),
    componentStack: String(componentStack || '').slice(0, 2000),
    url: String(url || '').slice(0, 500),
    lastActions: getBreadcrumbs(),
    userInfo: getUserInfo(),
    systemInfo: getSystemInfo()
  };

  // Determine backend URL
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes(' electron/');
  const backendBase = (isLocal || isElectron) ? 'http://localhost:5000/api' : 'https://student-report-rsad.onrender.com/api';

  try {
    const token = localStorage.getItem('token') || localStorage.getItem('teacherToken') || localStorage.getItem('staffToken');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${backendBase}/logs/client-error`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    // Save to offline queue in localStorage if request fails
    try {
      const queue = JSON.parse(localStorage.getItem('offline_telemetry_queue') || '[]');
      queue.push({ ...payload, queuedAt: new Date().toISOString() });
      if (queue.length > 30) queue.shift();
      localStorage.setItem('offline_telemetry_queue', JSON.stringify(queue));
    } catch (e) {}
  }
}

// Flush offline queued logs when back online
export async function flushOfflineTelemetryQueue() {
  try {
    const raw = localStorage.getItem('offline_telemetry_queue');
    if (!raw) return;
    const queue = JSON.parse(raw);
    if (!Array.isArray(queue) || queue.length === 0) return;

    localStorage.removeItem('offline_telemetry_queue');

    for (const item of queue) {
      await reportClientError(item);
    }
  } catch (e) {}
}

// Global initialization
let isInitialized = false;

export function initTelemetry() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  // 1. Track Clicks (Breadcrumbs)
  window.addEventListener('click', (e) => {
    try {
      const desc = getElementDescriptor(e.target);
      addBreadcrumb(`Clicked ${desc}`);
    } catch (err) {}
  }, { capture: true, passive: true });

  // 2. Track Route Changes
  window.addEventListener('hashchange', () => {
    addBreadcrumb(`Navigated to hash "${window.location.hash}"`);
  });
  window.addEventListener('popstate', () => {
    addBreadcrumb(`Navigated to "${window.location.pathname}"`);
  });

  // 3. Unhandled Global Errors
  window.addEventListener('error', (event) => {
    reportClientError({
      errorType: 'UNHANDLED_ERROR',
      message: event.message || 'Script Error',
      stack: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
      url: window.location.href
    });
  });

  // 4. Unhandled Promise Rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason || 'Unhandled Promise Rejection');
    const stack = reason instanceof Error ? reason.stack : '';
    reportClientError({
      errorType: 'PROMISE_REJECTION',
      message: msg,
      stack,
      url: window.location.href
    });
  });

  // 5. Offline Queue Flush on reconnect
  window.addEventListener('online', () => {
    flushOfflineTelemetryQueue();
  });

  // Initial flush
  setTimeout(flushOfflineTelemetryQueue, 3000);
}
