# Starred Arsenal — 紅隊/AI GitHub Star 覆蓋盤點

**Date:** 2026-07-07
**Status:** Approved (design)
**Repo:** `red-team-ai-agent-summary`

---

## 目標

把使用者 GitHub stars(共 413 顆)中紅隊滲透 / AI / agent / agent-tool 相關的
repo,依 MITRE ATT&CK Enterprise 的 **tactic × technique 覆蓋程度**盤點,並以與現有
`red-team-ai-agent-summary` 一致的網頁形式呈現。每個 item 著重 **coverage 程度**與
**功能**,作為日後與 APT-GPT 等自研 agent 的**比較基準參考資料**。

覆蓋判斷一律遵循 vault 中的 coverage rubric:
`wiki/Red-Team/ATT&CK-Coverage-Rubric.md`(等同本 repo
`docs/superpowers/specs/2026-05-18-technique-coverage-rubric.md`)。

---

## 範疇

**In scope**
- 抓取全部 413 顆 star,自動分類。
- 對通過 triage 的紅隊/AI 相關 repo,逐個跑**完整 rubric** coverage 分析。
- 新增獨立「Starred Arsenal」分區到現有 app(同 repo、同視覺、同部署)。

**Out of scope**
- 不改動現有 22 個研究 agent 的 `papers.json` 內容。
- 不做防禦/藍隊工具的攻擊面分析(歸類為 `excluded` 或 `lab-dataset`)。
- 不重建 ATT&CK 資料或 coverage 元件——全部重用。

---

## 決策紀錄(brainstorming)

| # | 決策 | 選擇 |
|---|------|------|
| 1 | Triage 範圍 | 全抓 413 + 自動分類,相關子集深入分析 |
| 2 | 與 22 研究 agent 共存 | 同 repo、獨立分區(新 `/arsenal`) |
| 3 | Coverage 粒度 | 對相關子集跑**完整 rubric**(逐 technique) |
| 4 | 執行管線 | 兩階段 + 檢查點(Phase A 分類 → 使用者確認 → Phase B 深入) |

**誠實前提:** 多數 star 無 benchmark,因此依 rubric 合理落在 T2(README/架構)撐起的
`covered`/`partial`,或 `tool-dep`/`not-covered`。不假造 benchmark 撐出的 `covered`。
"everything" = 通過 triage 的紅隊/AI 相關 repo。

---

## 架構

- **落點:** 沿用 `red-team-ai-agent-summary` repo。
- **新資料檔:** `app/public/arsenal.json`(獨立於 `papers.json`,保持 22 研究 agent 乾淨)。
- **重用資產:**
  - `app/src/data/attack-enterprise.json`(ATT&CK v16.1)
  - coverage 元件:`TechniqueRow` / `TacticSection` / `OverviewMatrix` / `CoverageDepth`
  - CF Pages 部署管線(root `app`, build `npm install && npm run build`, output `dist`)
- **新路由:** `/arsenal` + `ArsenalPage.tsx`,加入導覽。
- **種子重用:** `papers.json` 現有 19 個手工 tools(nmap/sqlmap/…,已含 technique map,
  UI 目前未渲染)直接轉為 arsenal 種子 item,不重做。

---

## 資料模型 `arsenal.json`

頂層:`{ version, lastUpdated, items: ArsenalItem[] }`

`ArsenalItem`(agent schema 與 tool schema 的超集,單一渲染路徑):

```json
{
  "id": "caldera",
  "repo": "mitre/caldera",
  "name": "CALDERA",
  "url": "https://github.com/mitre/caldera",
  "stars": 5600,
  "language": "Python",
  "kind": "agent-framework",
  "category": "adversary-emulation",
  "description": "功能摘要(『功能』重點)",
  "topics": ["att&ck", "c2"],
  "autonomy": "L2",
  "has_paper": false,
  "techniques": [
    {
      "id": "T1059",
      "coverage": "covered",
      "notes": "...",
      "source": { "tier": "T2", "ref": "README: Ability plugins ..." }
    }
  ],
  "benchmark": null
}
```

**欄位規則**
- `kind` ∈ `ai-agent | agent-framework | tool | lab-dataset`。
- `autonomy` ∈ `L1 | L2 | L3 | null`(純工具為 `null`)。
- `techniques[].coverage` ∈ `covered | partial | tool-dep | not-covered`(rubric 標籤)。
- `techniques[].source` **必填**;無來源者標 `not-covered` 或刪除(rubric 硬規則)。
- `benchmark` 僅在有 T1 量化證據時填,否則 `null`。

TypeScript 型別加到 `app/src/types/index.ts`,重用既有 `CoverageLevel` /
`TechniqueSource`。

---

## 分類 Taxonomy(Phase A)

輸入:`gh api user/starred --paginate`(name / description / topics / language /
stargazers_count)。README 延後抓,只對相關候選抓。

| kind | 定義 |
|------|------|
| `ai-agent` | 自主 LLM 驅動攻擊 agent(PentestGPT 類、agent app) |
| `agent-framework` | orchestration / adversary-emulation 平台(CALDERA、LangGraph 類) |
| `tool` | 經典攻擊工具(recon / exploit / C2 / cred) |
| `lab-dataset` | 靶場 / benchmark / dataset / ATT&CK 資料 / 訓練標的 |
| `excluded` | 非紅隊/AI(CTF writeup、修課、web dev、personal) |

**相關性啟發式:** name/desc/topics 對紅隊+AI 詞庫比對(offensive, pentest,
red-team, C2, recon, exploit, adversary, att&ck, agent, LLM, …)。模稜兩可者
`relevant: null` 標記,留給檢查點人工裁決。

---

## Coverage 管線(Phase B)

對每個確認相關的 item:

1. 抓 README + topics + 主要語言。
2. 映射到 ATT&CK techniques(sub-technique 優先,若證據足夠)。
3. 依 rubric 判斷流程給 coverage 標籤 + evidence tier + notes + source ref。
   - 純工具 → `tool-dep`。
   - README 記錄自主多步行為 → T2 `covered`/`partial`。
   - 無相關證據 → `not-covered`。
4. 分批(每批 ~10–15 item)寫入 `arsenal.json`。

**護欄:** 每個 technique 條目必有 `source`;違反即修正為 `not-covered`。

---

## UI「Starred Arsenal」分區

沿用現有視覺風格,三視圖:

1. **Inventory 表(預設):** 可排序/篩選列——name、kind、category、stars、
   跨 tactic 數、covered/partial/tool-dep 計數、autonomy、language。
   篩選 by kind / category / tactic。**這是核心「比較基準」表。**
2. **Coverage 矩陣:** item × tactic 熱圖,重用 `OverviewMatrix`,顯示 arsenal 中
   哪些 tactic 擁擠 / 稀疏。
3. **Item 詳情頁:** 重用 `AgentPage` 版型——功能摘要 + 按 tactic 分組的 technique
   覆蓋(含 source)+ benchmark(若有)+ repo 連結。

**比較鉤子:** 同一 ATT&CK 骨架,矩陣可選擇疊加對比「arsenal vs 22 研究 agent」,
即「比較對象」的最終價值。

---

## 流程(兩階段)

**Phase A — 抓取 + 分類**
1. `gh api user/starred --paginate` 抓 413 顆 metadata。
2. 自動分類 → 產出 `arsenal.triage.json` + 人類可讀 triage 表(markdown)。
3. **檢查點:** 使用者確認相關集、修正誤分類。

**Phase B — 深入 + 呈現**
4. 對確認集分批跑完整 rubric → 寫 `arsenal.json`。
5. 加型別、`ArsenalPage.tsx`、三視圖元件、路由與導覽。
6. `cd app && npm run build` 驗證,push → CF Pages 自動部署。

---

## Vault 同步(依 vault CLAUDE.md)

app 在 code repo,但依 vault 憲法:
- 完成後在 notes `log.md` 補一筆:`## [2026-07-07] ingest | Starred Arsenal coverage`。
- 開 `wiki/Red-Team/Starred-Arsenal.md` 摘要盤點結果 + 回連 `[[ATT&CK-Coverage-Rubric]]`。

---

## 成功標準

- 413 顆 star 全部有分類結果(relevant/excluded + kind)。
- 相關子集每個 item 有 rubric-compliant technique 覆蓋(每條有 source)。
- 新 `/arsenal` 分區在 build 後可用,三視圖可運作。
- 使用者能用 Inventory 表把任一 star 工具與自研 agent 做 tactic/technique 對比。
