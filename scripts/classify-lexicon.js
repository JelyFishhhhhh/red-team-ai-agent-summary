// Heuristic classifier for GitHub stars → arsenal kind + relevance.
// Imperfect by design — output feeds a human triage checkpoint.
const AGENT = ['llm', 'gpt', ' agent', 'agent ', 'agentic', 'autonomous', 'copilot',
  'langchain', 'langgraph', 'autogpt', 'multi-agent', 'ai-powered', 'genai'];
const REDTEAM = ['pentest', 'penetration', 'red-team', 'redteam', 'red team', 'offensive',
  'exploit', 'recon', ' c2', 'c2 ', 'command-and-control', 'command and control', 'adversary',
  'att&ck', 'attack', 'mitre', 'malware', 'payload', 'post-exploit', 'post exploit',
  'privilege escalation', 'privesc', 'lateral movement', 'credential', 'bloodhound',
  'cobalt', 'metasploit', 'osint', 'fuzzing', 'fuzzer', 'vulnerability scanner', 'vuln',
  'shellcode', 'rootkit', 'kerbero', 'active directory', 'phishing', 'implant', 'backdoor',
  'security testing', 'ctf', 'hacking', 'hack', 'sqli', 'xss', 'rce'];
const FRAMEWORK = ['emulation', 'orchestration', 'framework', 'platform',
  'breach-and-attack', 'breach and attack', 'purple team', 'purple-team'];
const LAB = ['benchmark', 'dataset', 'vulnerable', 'training', 'range', 'testbed',
  'writeup', 'writeups', 'lab', 'playground', 'challenge'];

function hay(item) {
  return [item.name, item.description, ...(item.topics || [])].join(' ').toLowerCase();
}
function any(h, words) { return words.some((w) => h.includes(w)); }

function classify(item) {
  const h = hay(item);
  const isAgent = any(h, AGENT);
  const isRed = any(h, REDTEAM);
  const isFramework = any(h, FRAMEWORK);
  const isLab = any(h, LAB);

  if (isRed && isAgent) return { kind: 'ai-agent', relevant: true, reason: 'LLM/agent + offensive keywords' };
  if (isRed && isFramework) return { kind: 'agent-framework', relevant: true, reason: 'offensive + framework/emulation' };
  if (isRed && isLab) return { kind: 'lab-dataset', relevant: true, reason: 'lab/benchmark + offensive' };
  if (isRed) return { kind: 'tool', relevant: true, reason: 'offensive tooling keywords' };
  if (isAgent && isFramework) return { kind: 'agent-framework', relevant: null, reason: 'agent framework, offensive use unclear' };
  if (isAgent || isLab) return { kind: 'excluded', relevant: null, reason: 'AI/lab but no offensive signal — confirm' };
  return { kind: 'excluded', relevant: false, reason: 'no red-team/AI signal' };
}
module.exports = { classify, AGENT, REDTEAM, FRAMEWORK, LAB };
