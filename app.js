// ==========================================
//  AGENTIC AI — MAIN APPLICATION
// ==========================================

// --- SETTINGS ---
let settings = {
  apiKey: localStorage.getItem('agentOS_apiKey') || '',
  model: localStorage.getItem('agentOS_model') || 'claude-sonnet-4-20250514',
  maxAgents: parseInt(localStorage.getItem('agentOS_maxAgents') || '4'),
};

function saveSettings() {
  settings.apiKey = document.getElementById('apiKeyInput').value.trim();
  settings.model = document.getElementById('modelSelect').value;
  settings.maxAgents = parseInt(document.getElementById('maxAgents').value);
  localStorage.setItem('agentOS_apiKey', settings.apiKey);
  localStorage.setItem('agentOS_model', settings.model);
  localStorage.setItem('agentOS_maxAgents', settings.maxAgents);
  toggleSettings();
  addLog('INFO', 'Settings saved');
}

function toggleSettings() {
  const modal = document.getElementById('settingsModal');
  const isOpen = modal.style.display !== 'none';
  modal.style.display = isOpen ? 'none' : 'flex';
  if (!isOpen) {
    document.getElementById('apiKeyInput').value = settings.apiKey;
    document.getElementById('modelSelect').value = settings.model;
    document.getElementById('maxAgents').value = settings.maxAgents;
  }
}

// Close modal on overlay click
document.getElementById('settingsModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) toggleSettings();
});

// --- SESSION METRICS ---
const metrics = {
  totalTasks: 0,
  totalTokens: 0,
  totalTime: 0,
  agentCalls: 0,
  taskLog: [],
};

// --- APP STATE ---
let activeTab = 'stream';
let currentMode = 'research';
let isRunning = false;
let streamLog = [];
let logs = [];
let finalResult = '';
let timerInterval = null;
let taskStartTime = null;
let elapsedSeconds = 0;
let totalTokensThisTask = 0;
let stepsCompleted = 0;

// --- EXAMPLE PROMPTS ---
const EXAMPLES = [
  'Research the top 5 AI coding assistants (GitHub Copilot, Cursor, Tabnine, Codeium, Amazon Q). Compare their features, pricing, IDE support, and user reviews. Write a structured comparison report with a recommendation.',
  'Write a Python data pipeline that reads a CSV file, cleans null values, computes summary statistics, and outputs a formatted report. Include error handling and docstrings.',
  'Analyze the current state of the electric vehicle market in 2024. Cover market share, top manufacturers, consumer adoption trends, infrastructure challenges, and a 2025 forecast.',
];

function fillExample(i) {
  document.getElementById('taskInput').value = EXAMPLES[i];
  document.getElementById('taskInput').focus();
}

function selectMode(el) {
  document.querySelectorAll('.mode-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  currentMode = el.dataset.mode;
}

// --- KEYBOARD SHORTCUT ---
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runTask();
});

// ============================================================
//  MAIN ORCHESTRATION
// ============================================================

async function runTask() {
  if (isRunning) return;

  const taskText = document.getElementById('taskInput').value.trim();
  if (!taskText) { document.getElementById('taskInput').focus(); return; }

  if (!settings.apiKey) {
    document.getElementById('apiWarning').style.display = 'flex';
    setTimeout(() => document.getElementById('apiWarning').style.display = 'none', 5000);
    return;
  }
  document.getElementById('apiWarning').style.display = 'none';

  // --- RESET ---
  isRunning = true;
  streamLog = [];
  logs = [];
  finalResult = '';
  totalTokensThisTask = 0;
  stepsCompleted = 0;
  pool.reset();

  // --- UI ---
  document.getElementById('workspace').style.display = 'block';
  document.getElementById('workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setRunBtn(true);
  setPipelineStatus('running', 'Planning...');
  updateTab('stream');
  renderAgents();
  renderOutputTab();

  // Timer
  taskStartTime = Date.now();
  elapsedSeconds = 0;
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    elapsedSeconds = Math.round((Date.now() - taskStartTime) / 1000);
    updateSummaryStats();
  }, 1000);

  // Show task summary
  document.getElementById('taskSummary').style.display = 'block';
  document.getElementById('summaryText').textContent = taskText.slice(0, 120) + (taskText.length > 120 ? '...' : '');
  updateSummaryStats();

  addLog('INFO', `Task received: "${taskText.slice(0, 80)}..."`);
  addStream('system', 'System', '🚀 Task received. Initializing agent pipeline...');

  try {
    // ── STEP 1: PLANNER ──
    await stepPlanner(taskText);

  } catch (err) {
    addStream('error', 'System', `❌ Fatal error: ${err.message}`);
    addLog('ERROR', err.message);
    setPipelineStatus('idle', 'Error — see logs');
    setRunBtn(false);
    isRunning = false;
    clearInterval(timerInterval);
  }
}

// ── PLANNER STEP ──
async function stepPlanner(taskText) {
  pool.setStatus('planner', 'running', 5);
  addLog('INFO', 'Planner Agent: analyzing task...');
  addStream('agent', '🧠 Planner', 'Analyzing task and building execution plan...');
  pool.animateProgress('planner', 60, 1200);

  const modeHint = `The user's preferred mode is: ${currentMode}. Lean towards agents suited for this mode.`;

  let plan;
  try {
    const { text, usage } = await callAgentAPIJSON({
      apiKey: settings.apiKey,
      model: settings.model,
      systemPrompt: AGENT_DEFS[0].systemPrompt,
      userMessage: `${modeHint}\n\nUser Task: ${taskText}`,
      maxTokens: 800,
    });

    totalTokensThisTask += (usage.input_tokens || 0) + (usage.output_tokens || 0);
    updateSessionMetrics();

    plan = JSON.parse(text);
    if (!plan.subtasks || !Array.isArray(plan.subtasks)) throw new Error('Invalid plan format');

  } catch (e) {
    // Fallback plan if JSON parsing fails
    addLog('WARN', `Planner JSON parse failed, using fallback plan. Error: ${e.message}`);
    plan = buildFallbackPlan(taskText);
  }

  pool.setStatus('planner', 'done', 100, JSON.stringify(plan, null, 2));
  addLog('SUCCESS', `Planner: ${plan.subtasks.length} subtasks generated`);
  addStream('result', '🧠 Planner', `✓ Plan ready: ${plan.subtasks.length} steps — ${plan.summary}`);
  stepsCompleted++;
  updateSummaryStats();

  await sleep(400);

  // ── EXECUTE SUBTASKS ──
  const subtaskOutputs = [];

  for (let i = 0; i < plan.subtasks.length; i++) {
    const subtask = plan.subtasks[i];
    const agentDef = AGENT_DEFS.find(a => a.id === subtask.agent) || AGENT_DEFS[4];

    setPipelineStatus('running', `${agentDef.name} (${i+1}/${plan.subtasks.length})`);

    const output = await executeSubtask(subtask, agentDef, taskText, i);
    subtaskOutputs.push({ agent: agentDef.name, title: subtask.title, output });

    stepsCompleted++;
    updateSummaryStats();
    await sleep(300);
  }

  // ── FINAL SYNTHESIS ──
  await stepSynthesis(taskText, plan, subtaskOutputs);
}

// ── EXECUTE A SINGLE SUBTASK ──
async function executeSubtask(subtask, agentDef, originalTask, idx) {
  pool.setStatus(agentDef.id, 'running', 5);
  addLog('INFO', `${agentDef.name}: starting "${subtask.title}"`);
  addStream('agent', `${agentDef.icon} ${agentDef.name}`, `Starting: ${subtask.title}...`);
  pool.animateProgress(agentDef.id, 30, 800);

  let fullOutput = '';
  let tokenCount = { input: 0, output: 0 };

  pool.animateProgress(agentDef.id, 55, 600);

  await callAgentAPI({
    apiKey: settings.apiKey,
    model: settings.model,
    systemPrompt: agentDef.systemPrompt,
    userMessage: `Original Task: ${originalTask}\n\nYour Specific Assignment: ${subtask.prompt}`,
    maxTokens: 1000,
    onToken: (token, full) => {
      fullOutput = full;
      // Update agent card with streaming preview
      pool.getById(agentDef.id).output = full;
      renderAgents();
    },
    onDone: (text, usage) => {
      fullOutput = text;
      tokenCount = { input: usage.inputTokens || 0, output: usage.outputTokens || 0 };
      totalTokensThisTask += tokenCount.input + tokenCount.output;
      updateSessionMetrics();
    },
    onError: (err) => {
      addLog('ERROR', `${agentDef.name}: ${err.message}`);
      fullOutput = `Error: ${err.message}`;
    },
  });

  pool.setStatus(agentDef.id, 'done', 100, fullOutput);
  addLog('SUCCESS', `${agentDef.name}: completed "${subtask.title}" (${tokenCount.input + tokenCount.output} tokens)`);
  addStream('result', `${agentDef.icon} ${agentDef.name}`, `✓ Done: ${subtask.title}`);

  metrics.agentCalls++;
  return fullOutput;
}

// ── FINAL SYNTHESIS ──
async function stepSynthesis(originalTask, plan, subtaskOutputs) {
  const execDef = AGENT_DEFS.find(a => a.id === 'executor');
  pool.setStatus('executor', 'running', 5);
  setPipelineStatus('running', 'Synthesizing final output...');
  addLog('INFO', 'Executor Agent: synthesizing final deliverable...');
  addStream('agent', '⚙️ Executor', 'Synthesizing all agent outputs into final deliverable...');
  pool.animateProgress('executor', 40, 1000);

  const context = subtaskOutputs.map((s, i) =>
    `--- OUTPUT FROM ${s.agent.toUpperCase()} (${s.title}) ---\n${s.output}`
  ).join('\n\n');

  const synthPrompt = `Original Task: ${originalTask}\n\nAgent Outputs to Synthesize:\n\n${context}`;

  finalResult = '';
  let prevLen = 0;

  await callAgentAPI({
    apiKey: settings.apiKey,
    model: settings.model,
    systemPrompt: execDef.systemPrompt,
    userMessage: synthPrompt,
    maxTokens: 2000,
    onToken: (token, full) => {
      finalResult = full;
      pool.getById('executor').output = full;
      renderAgents();
      // Stream the result incrementally
      if (full.length - prevLen > 80) {
        prevLen = full.length;
        addStream('result', '⚙️ Executor', `Writing... (${full.length} chars)`);
      }
    },
    onDone: (text, usage) => {
      finalResult = text;
      totalTokensThisTask += (usage.inputTokens || 0) + (usage.outputTokens || 0);
      updateSessionMetrics();
    },
    onError: (err) => {
      addLog('ERROR', `Executor: ${err.message}`);
    },
  });

  pool.setStatus('executor', 'done', 100, finalResult);
  stepsCompleted++;
  updateSummaryStats();

  // ── WRAP UP ──
  clearInterval(timerInterval);
  const elapsed = ((Date.now() - taskStartTime) / 1000).toFixed(1);
  metrics.totalTasks++;
  metrics.totalTime += parseFloat(elapsed);
  metrics.taskLog.push({ task: document.getElementById('taskInput').value.slice(0,60), tokens: totalTokensThisTask, time: elapsed });

  addLog('SUCCESS', `Pipeline complete — ${elapsed}s, ${totalTokensThisTask.toLocaleString()} tokens`);
  addStream('result', '⚙️ Executor', `✅ All done! Task completed in ${elapsed}s. Click "Final Result" to view.`);
  setPipelineStatus('done', `Done in ${elapsed}s`);
  setRunBtn(false);
  isRunning = false;

  // Auto-switch to result tab
  await sleep(800);
  const resultTab = document.querySelector('.otab[data-tab="result"]');
  if (resultTab) switchTab(resultTab);

  updateSessionMetrics();
}

// ── FALLBACK PLAN ──
function buildFallbackPlan(task) {
  return {
    summary: task.slice(0, 80),
    subtasks: [
      { id: 'step_1', agent: 'research', title: 'Research & Gather Information', prompt: `Research and gather all relevant information for: ${task}` },
      { id: 'step_2', agent: 'analyst', title: 'Analyze & Process', prompt: `Analyze the research findings and extract key insights for: ${task}` },
      { id: 'step_3', agent: 'writer', title: 'Draft Final Output', prompt: `Write a comprehensive, well-structured response for: ${task}` },
    ],
  };
}

// ============================================================
//  RENDER FUNCTIONS
// ============================================================

function renderAgents() {
  const list = document.getElementById('agentsList');
  if (!list) return;

  list.innerHTML = pool.agents.map(agent => {
    const hasProgress = agent.status !== 'idle';
    const preview = agent.output ? agent.output.slice(0, 120).replace(/</g, '&lt;') : '';

    return `
      <div class="agent-card is-${agent.status}" style="--agent-clr:${agent.color}">
        <div class="ac-top">
          <div class="ac-icon">${agent.icon}</div>
          <div class="ac-name">${agent.name}</div>
          <div class="ac-status s-${agent.status}">${agent.status}</div>
        </div>
        <div class="ac-desc">${agent.desc}</div>
        ${hasProgress ? `<div class="ac-progress"><div class="ac-progress-fill" style="width:${agent.progress}%"></div></div>` : ''}
        ${preview ? `<div class="ac-output">${preview}${agent.output.length > 120 ? '...' : ''}</div>` : ''}
      </div>
    `;
  }).join('');

  // Update pool badge
  const running = pool.agents.filter(a => a.status === 'running').length;
  const done = pool.agents.filter(a => a.status === 'done').length;
  const badge = document.getElementById('poolBadge');
  if (running > 0) {
    badge.textContent = `${running} Running`;
    badge.style.background = 'rgba(244,168,40,0.1)';
    badge.style.color = 'var(--amber)';
    badge.style.borderColor = 'rgba(244,168,40,0.25)';
  } else if (done > 0) {
    badge.textContent = `${done} Done`;
    badge.style.background = 'rgba(31,214,160,0.1)';
    badge.style.color = 'var(--green)';
    badge.style.borderColor = 'rgba(31,214,160,0.2)';
  } else {
    badge.textContent = `${pool.agents.length} Agents`;
    badge.style.background = '';
    badge.style.color = '';
    badge.style.borderColor = '';
  }
}

function updateTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.otab').forEach(t => t.classList.remove('active'));
  const el = document.querySelector(`.otab[data-tab="${tab}"]`);
  if (el) el.classList.add('active');
  renderOutputTab();
}

function switchTab(el) {
  activeTab = el.dataset.tab;
  document.querySelectorAll('.otab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderOutputTab();
}

function renderOutputTab() {
  const body = document.getElementById('outputBody');
  if (!body) return;

  if (activeTab === 'stream') {
    renderStream(body);
  } else if (activeTab === 'result') {
    renderResult(body);
  } else if (activeTab === 'logs') {
    renderLogs(body);
  } else if (activeTab === 'metrics') {
    renderMetrics(body);
  }
}

// ── STREAM TAB ──
function renderStream(body) {
  if (streamLog.length === 0) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">⚡</div><div class="empty-text">// awaiting task input...</div></div>`;
    return;
  }
  body.innerHTML = `<div class="stream-container">${streamLog.map(m => `
    <div class="stream-msg ${m.type}">
      <div class="sm-agent">${m.agent}</div>
      <div class="sm-content">${escapeHtml(m.content)}</div>
    </div>
  `).join('')}</div>`;
  body.scrollTop = body.scrollHeight;
}

// ── RESULT TAB ──
function renderResult(body) {
  if (!finalResult) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">📄</div><div class="empty-text">// result will appear here...</div></div>`;
    return;
  }
  body.innerHTML = `
    <div class="result-card">
      <div class="md-output">${markdownToHtml(finalResult)}</div>
      <div class="result-actions">
        <button class="ract-btn primary" onclick="copyResult()">📋 Copy Result</button>
        <button class="ract-btn" onclick="downloadResult()">⬇ Download .md</button>
        <button class="ract-btn" onclick="runAgain()">↺ Run Again</button>
      </div>
    </div>
  `;
}

// ── LOGS TAB ──
function renderLogs(body) {
  if (logs.length === 0) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">// no logs yet...</div></div>`;
    return;
  }
  body.innerHTML = `<div class="log-console">${logs.map(l => `
    <div class="log-line">
      <span class="ll-time">${l.time}</span>
      <span class="ll-level ${l.level}">${l.level}</span>
      <span class="ll-msg">${escapeHtml(l.msg)}</span>
    </div>
  `).join('')}</div>`;
  body.scrollTop = body.scrollHeight;
}

// ── METRICS TAB ──
function renderMetrics(body) {
  const avgTime = metrics.totalTasks > 0 ? (metrics.totalTime / metrics.totalTasks).toFixed(1) : '—';
  const agentBars = pool.agents.map(a => {
    const pct = a.status === 'done' ? 100 : a.status === 'running' ? a.progress : 0;
    return `
      <div class="met-bar-label"><span>${a.icon} ${a.name}</span><span>${Math.round(pct)}%</span></div>
      <div class="met-bar"><div class="met-bar-fill" style="width:${pct}%"></div></div>
    `;
  }).join('');

  body.innerHTML = `
    <div class="metrics-grid">
      <div class="met-card">
        <div class="met-label">Tasks Completed</div>
        <div class="met-value cv-green">${metrics.totalTasks}</div>
        <div class="met-sub">this session</div>
      </div>
      <div class="met-card">
        <div class="met-label">Tokens Used</div>
        <div class="met-value cv-blue">${metrics.totalTokens.toLocaleString()}</div>
        <div class="met-sub">input + output</div>
      </div>
      <div class="met-card">
        <div class="met-label">Agent Calls</div>
        <div class="met-value cv-purple">${metrics.agentCalls}</div>
        <div class="met-sub">total API calls</div>
      </div>
      <div class="met-card">
        <div class="met-label">Avg Time</div>
        <div class="met-value cv-amber">${avgTime}s</div>
        <div class="met-sub">per task</div>
      </div>
    </div>
    <div class="met-card" style="margin-bottom:0">
      <div class="met-label" style="margin-bottom:16px">Agent Performance This Run</div>
      ${agentBars}
    </div>
  `;
}

// ============================================================
//  HELPER FUNCTIONS
// ============================================================

function addStream(type, agent, content) {
  streamLog.push({ type, agent, content });
  if (activeTab === 'stream') renderOutputTab();
}

function addLog(level, msg) {
  const now = new Date().toTimeString().slice(0, 8);
  logs.push({ time: now, level, msg });
  if (activeTab === 'logs') renderOutputTab();
}

function setPipelineStatus(state, text) {
  const dot = document.querySelector('.pi-dot');
  const label = document.querySelector('.pi-text');
  if (label) label.textContent = text;
  if (dot) {
    dot.style.background = state === 'running' ? 'var(--amber)' : state === 'done' ? 'var(--green)' : 'var(--green)';
  }
}

function setRunBtn(loading) {
  const btn = document.getElementById('runBtn');
  if (!btn) return;
  btn.classList.toggle('loading', loading);
  btn.querySelector('.run-text').textContent = loading ? 'Running...' : 'Run Agents';
  btn.querySelector('.run-icon').textContent = loading ? '⟳' : '▶';
}

function updateSummaryStats() {
  const timeEl = document.getElementById('ssTime');
  const tokEl = document.getElementById('ssTokens');
  const stepsEl = document.getElementById('ssSteps');
  if (timeEl) timeEl.textContent = elapsedSeconds + 's';
  if (tokEl) tokEl.textContent = totalTokensThisTask.toLocaleString();
  if (stepsEl) stepsEl.textContent = stepsCompleted;
}

function updateSessionMetrics() {
  metrics.totalTokens = Object.values(metrics.taskLog).reduce((s, t) => s + (t.tokens || 0), 0) + totalTokensThisTask;
  const hdrTasks = document.getElementById('hdrTasks');
  const hdrTokens = document.getElementById('hdrTokens');
  if (hdrTasks) hdrTasks.textContent = metrics.totalTasks;
  if (hdrTokens) hdrTokens.textContent = (metrics.totalTokens).toLocaleString();
  if (activeTab === 'metrics') renderOutputTab();
}

function copyResult() {
  navigator.clipboard.writeText(finalResult).then(() => {
    const btn = event.target;
    btn.textContent = '✓ Copied!';
    setTimeout(() => btn.textContent = '📋 Copy Result', 2000);
  });
}

function downloadResult() {
  const task = document.getElementById('taskInput').value.slice(0, 40).replace(/[^a-z0-9]/gi, '_');
  const blob = new Blob([finalResult], { type: 'text/markdown' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `agentOS_${task}_${Date.now()}.md`;
  a.click();
}

function runAgain() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.getElementById('taskInput').focus();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── MARKDOWN RENDERER ──
function markdownToHtml(md) {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/```(\w+)?\n([\s\S]+?)```/g, '<pre><code>$2</code></pre>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hupol])/gm, '<p>')
    .replace(/(?<![>])$/gm, '</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<[hupol])/g, '$1')
    .replace(/(<\/[hupol][^>]*>)<\/p>/g, '$1');
}

// ── INIT ──
renderAgents();
renderOutputTab();
addLog('INFO', 'AgentOS initialized');
addLog('INFO', `Model: ${settings.model}`);
addLog('INFO', settings.apiKey ? 'API key loaded from storage' : 'No API key — open settings to configure');
if (!settings.apiKey) document.getElementById('apiWarning').style.display = 'flex';
