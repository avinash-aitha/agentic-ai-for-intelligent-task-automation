// ==========================================
//  AGENT DEFINITIONS
// ==========================================

const AGENT_DEFS = [
  {
    id: 'planner',
    name: 'Planner Agent',
    icon: '🧠',
    color: '#5b7fff',
    desc: 'Decomposes the task and builds an execution plan.',
    systemPrompt: `You are the Planner Agent in an agentic AI system. Your job is to:
1. Analyze the user's task carefully
2. Break it into 3-5 concrete subtasks
3. Assign each subtask to the best specialized agent:
   - Research Agent: for information gathering, web research, finding facts
   - Code Agent: for writing, reviewing, or explaining code
   - Analyst Agent: for data analysis, comparisons, evaluations
   - Writer Agent: for drafting content, reports, summaries
4. Return a JSON execution plan ONLY — no prose, no markdown fences.

Return this exact JSON structure:
{
  "summary": "one sentence task summary",
  "subtasks": [
    {
      "id": "step_1",
      "agent": "research|code|analyst|writer",
      "title": "short title",
      "prompt": "detailed instruction for this agent"
    }
  ]
}`,
  },
  {
    id: 'research',
    name: 'Research Agent',
    icon: '🔍',
    color: '#42b4e6',
    desc: 'Gathers information, facts, and domain knowledge.',
    systemPrompt: `You are the Research Agent. Your role is to gather, synthesize, and present information clearly.
- Be thorough but concise
- Cite key facts with confidence levels when uncertain
- Organize findings with clear structure
- Highlight the most important insights
- Use markdown formatting for readability`,
  },
  {
    id: 'code',
    name: 'Code Agent',
    icon: '💻',
    color: '#b06fff',
    desc: 'Writes, reviews, and explains code.',
    systemPrompt: `You are the Code Agent. Your role is to write clean, functional, well-commented code.
- Write production-quality code with proper error handling
- Include clear comments explaining logic
- Provide usage examples where helpful
- Suggest improvements and best practices
- Use markdown code blocks with language tags`,
  },
  {
    id: 'analyst',
    name: 'Analyst Agent',
    icon: '📊',
    color: '#1fd6a0',
    desc: 'Analyzes data, compares options, evaluates quality.',
    systemPrompt: `You are the Analyst Agent. Your role is to analyze information critically and extract insights.
- Compare and contrast options objectively
- Identify patterns, trends, and anomalies
- Provide data-driven recommendations
- Use tables, bullet points and structured formats
- Quantify findings where possible`,
  },
  {
    id: 'writer',
    name: 'Writer Agent',
    icon: '✍️',
    color: '#f4a828',
    desc: 'Drafts polished reports, summaries, and documents.',
    systemPrompt: `You are the Writer Agent. Your role is to produce well-structured, engaging written content.
- Write with clarity and precision
- Use professional but accessible language
- Structure content with clear headings and flow
- Tailor tone to the context
- Create polished final deliverables`,
  },
  {
    id: 'executor',
    name: 'Executor Agent',
    icon: '⚙️',
    color: '#f06060',
    desc: 'Synthesizes all outputs into a final deliverable.',
    systemPrompt: `You are the Executor Agent — the final synthesis step. You receive all previous agent outputs and:
1. Combine them into one cohesive, polished response
2. Remove redundancies and fill any gaps
3. Ensure the final output directly answers the original task
4. Format it beautifully with markdown
5. Add a brief executive summary at the top`,
  },
];

// ==========================================
//  AGENT STATE MANAGER
// ==========================================

class AgentPool {
  constructor() {
    this.agents = AGENT_DEFS.map(d => ({
      ...d,
      status: 'idle',
      progress: 0,
      output: '',
    }));
  }

  reset() {
    this.agents.forEach(a => {
      a.status = 'idle';
      a.progress = 0;
      a.output = '';
    });
  }

  getById(id) {
    return this.agents.find(a => a.id === id);
  }

  setStatus(id, status, progress = null, output = null) {
    const agent = this.getById(id);
    if (!agent) return;
    agent.status = status;
    if (progress !== null) agent.progress = progress;
    if (output !== null) agent.output = output;
    renderAgents();
  }

  animateProgress(id, target, duration = 800) {
    const agent = this.getById(id);
    if (!agent) return;
    const start = agent.progress;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(elapsed / duration, 1);
      agent.progress = start + (target - start) * easeOut(pct);
      renderAgents();
      if (pct < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Global pool instance
const pool = new AgentPool();
