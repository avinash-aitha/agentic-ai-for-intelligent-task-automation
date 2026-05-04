# AgentOS — Agentic AI for Intelligent Task Automation

A fully functional multi-agent AI system powered by Anthropic's Claude API. Multiple specialized AI agents collaborate to plan, research, analyze, code, write, and deliver results autonomously.

---

## 🚀 Quick Start

### Option 1: Open Directly in Browser (Easiest)
```bash
# Just open index.html in your browser
open index.html
# or double-click index.html in your file manager
```
> **Note:** Due to browser CORS restrictions, you may need to serve it locally (see Option 2).

### Option 2: Local Server (Recommended)
```bash
# Using Python
python3 -m http.server 3000

# Using Node.js
npx serve .

# Then open: http://localhost:3000
```

### Option 3: VS Code Live Server
Install the "Live Server" extension in VS Code, right-click `index.html` → Open with Live Server.

---

## ⚙️ Configuration

1. Click the **⚙ Settings** button (top-right)
2. Enter your **Anthropic API Key** (`sk-ant-...`)
3. Choose your **model** (Sonnet 4 recommended)
4. Click **Save Settings**

Get an API key at: https://console.anthropic.com

---

## 🤖 Agent Architecture

| Agent | Role | Description |
|-------|------|-------------|
| 🧠 Planner | Orchestrator | Decomposes task into subtasks, assigns to agents |
| 🔍 Research | Information | Gathers facts, data, domain knowledge |
| 💻 Code | Engineering | Writes clean, documented, production-quality code |
| 📊 Analyst | Analysis | Compares, evaluates, extracts insights |
| ✍️ Writer | Content | Drafts polished reports and structured documents |
| ⚙️ Executor | Synthesis | Combines all outputs into a final deliverable |

---

## 🔄 How It Works

```
User Task
    │
    ▼
🧠 Planner Agent
 ├─ Analyzes task
 ├─ Creates execution plan
 └─ Assigns subtasks to specialized agents
    │
    ▼
Specialized Agents (parallel/sequential)
 ├─ 🔍 Research Agent
 ├─ 💻 Code Agent
 ├─ 📊 Analyst Agent
 └─ ✍️ Writer Agent
    │
    ▼
⚙️ Executor Agent
 ├─ Synthesizes all outputs
 └─ Delivers final result
```

---

## 🎯 Example Tasks

- **Research:** "Research top 5 AI startups, their funding, and technology stack"
- **Code:** "Write a Python REST API with FastAPI, SQLite, and JWT authentication"
- **Analysis:** "Compare React, Vue, and Svelte for a large-scale enterprise app"
- **Report:** "Write a market analysis report on the global EV battery market"
- **Automate:** "Design a complete CI/CD pipeline with GitHub Actions for a Node.js app"

---

## 📁 Project Structure

```
agentic-ai/
├── index.html          # Main HTML — layout & structure
├── README.md           # This file
└── src/
    ├── styles.css      # All styles — dark terminal aesthetic
    ├── agents.js       # Agent definitions + AgentPool class
    ├── api.js          # Anthropic API layer (streaming + JSON)
    └── app.js          # Orchestration, state, UI rendering
```

---

## ✨ Features

- **Real AI agents** powered by Claude Sonnet/Opus
- **Streaming output** — see agents think in real-time
- **4-tab output** — Live Stream, Final Result, System Logs, Metrics
- **Markdown rendering** — formatted final output with copy/download
- **Session metrics** — token counts, timing, agent performance
- **Persistent settings** — API key saved in localStorage
- **5 task modes** — Research, Code, Analyze, Write, Automate
- **Keyboard shortcut** — Cmd/Ctrl+Enter to run

---

## 🔐 Security

Your API key is stored in `localStorage` (browser only) and is sent **only** to `api.anthropic.com`. No backend server is involved — this is a pure client-side application.

---

## 📦 Dependencies

None! Pure HTML, CSS, and vanilla JavaScript. No npm, no build step, no framework.

Google Fonts (Syne, IBM Plex Mono, Manrope) are loaded from CDN for typography.

---

## 🛠 Extending the System

### Add a New Agent
In `src/agents.js`, add to `AGENT_DEFS`:
```js
{
  id: 'myagent',
  name: 'My Agent',
  icon: '🔧',
  color: '#ff6b6b',
  desc: 'What this agent does.',
  systemPrompt: `You are My Agent. Your role is to...`,
}
```

### Modify Planner Behavior
Edit the `systemPrompt` of the `planner` agent in `AGENT_DEFS` to change how tasks are decomposed.

### Add Tool Use / Web Search
In `src/api.js`, extend `callAgentAPI()` to include `tools` in the API payload and handle `tool_use` content blocks.

---

## 📄 License

MIT — free to use, modify, and distribute.
