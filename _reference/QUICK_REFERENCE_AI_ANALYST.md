# Quick Reference: AI Analyst Locations

## 🎯 Quick Find (Copy-Paste Paths)

### Frontend Components
```
C:\Users\spiri\angel_ai\components\AnalystScreeningEditor.tsx
C:\Users\spiri\angel_ai\components\AnalystYCFlags.tsx
C:\Users\spiri\angel_ai\components\AnalystAnalysesView.tsx
```

### Backend Functions
```
C:\Users\spiri\angel_ai\supabase\functions\ai-screen-deal\index.ts
C:\Users\spiri\angel_ai\supabase\functions\ai-recommend-deal\index.ts
C:\Users\spiri\angel_ai\supabase\functions\ai-detect-flags\index.ts
```

### Database Schema
```
C:\Users\spiri\angel_ai\supabase\migrations\013_dealflow_analyst.sql
C:\Users\spiri\angel_ai\supabase\migrations\002_yc_flags.sql
```

---

## 📍 FEATURE MAPPING

### "Analyst Screening (7 criteria)" Section
**Location:** `AnalystScreeningEditor.tsx:233`
- **Line 233-236**: Header text
- **Line 239-248**: "AI Screen Pitch Deck" button (calls ai-screen-deal)
- **Line 250-261**: "AI Recommender" button (calls ai-recommend-deal) ⭐ MAIN
- **Line 267-337**: AI Recommendation Meter (shows 65/100 score)
- **Line 344-390**: Criteria scoring sliders (1-5)
- **Line 392-425**: Overall score + decision + memo

### "AI Recommendation" Meter (The 65/100 Score)
**Location:** `AnalystScreeningEditor.tsx:267-337`
```
✓ Triggered by: "AI Recommender" button (line 250)
✓ Calls: /functions/v1/ai-recommend-deal (line 139)
✓ Shows: Score with color coding (line 273-281)
✓ Progress bar: Line 286-296
✓ Score bands: Line 299-312
  <40: Reject (RED)
  40-59: More Info (YELLOW)
  60-79: Deep Dive (ORANGE)
  80+: Recommend (GREEN)
✓ Recommendation text: Line 315-324
✓ Rationale: Line 327-334 (collapsible)
```

### "YC-Style Flags (Analyst)" Section
**Location:** `AnalystYCFlags.tsx:174-387`
- **Line 174-177**: Header text
- **Line 179-189**: "AI Detect Flags" button (calls ai-detect-flags)
- **Line 195-256**: Green Flags display
- **Line 259-321**: Red Flags display
- **Line 325-377**: Flags Catalog modal

### Green Flags (✓ Strengths)
**Location:** `AnalystYCFlags.tsx:195-256`
```
✓ User can add flags manually (line 215, 250)
✓ AI can populate via ai-detect-flags (line 93)
✓ Stored in analyst_deal_flags.green_flags (JSONB array)
```

### Red Flags (! Warnings)
**Location:** `AnalystYCFlags.tsx:259-321`
```
✓ User can add flags manually (line 281, 315)
✓ AI can populate via ai-detect-flags (line 94)
✓ Stored in analyst_deal_flags.red_flags (JSONB array)
```

---

## 🚀 THE THREE AI FUNCTIONS

### Function 1: AI Screen Pitch Deck
**File:** `ai-screen-deal/index.ts`
**Triggered by:** "AI Screen Pitch Deck" button
**Called from:** `AnalystScreeningEditor.tsx:241`
```
What it does:
1. Downloads pitch deck PDF
2. Sends to Claude Haiku with 7 criteria definitions
3. AI scores each criterion 1-5
4. Returns: criteria_scores[] + overall_assessment

Model: claude-haiku-4-5-20251001
Output: Populates the analysis notes textarea for each criterion
```

### Function 2: AI Recommend Deal ⭐ PRIMARY
**File:** `ai-recommend-deal/index.ts`
**Triggered by:** "AI Recommender" button
**Called from:** `AnalystScreeningEditor.tsx:252`
```
What it does:
1. Fetches: Deal + Manager screening + Analyst reviews + Flags
2. Builds comprehensive prompt with ALL data
3. Sends to Claude Sonnet for synthesis
4. AI generates: Score (0-100) + Recommendation + Rationale
5. Stores in: ai_recommendations table

Model: claude-sonnet-4-20250514
Output: Populates the AI Recommendation Meter
        Displays: 65/100 with color + recommendation text + rationale

THIS IS WHERE THE 65/100 SCORE COMES FROM
```

### Function 3: AI Detect Flags
**File:** `ai-detect-flags/index.ts`
**Triggered by:** "AI Detect Flags" button
**Called from:** `AnalystYCFlags.tsx:181`
```
What it does:
1. Fetches: Deal + Startup info + Pitch deck (if available)
2. Uses YC investment criteria prompt
3. AI identifies 3-5 green + 3-5 red flags
4. Returns: green_flags[] + red_flags[]

Model: claude-haiku-4-5-20251001
Output: Populates green_flags and red_flags in UI
```

---

## 📊 DATABASE TABLES

### Core Analyst Tables
```sql
analyst_screening_scores
├─ deal_id + analyst_user_id + criterion_id
├─ score: 1-5
└─ note: text analysis

analyst_screening_reviews
├─ deal_id + analyst_user_id (unique)
├─ overall_score: weighted average
├─ decision: recommend|needs_info|not_recommend
└─ summary_memo: executive summary

analyst_deal_flags
├─ deal_id + analyst_user_id (unique)
├─ green_flags: JSONB array
├─ red_flags: JSONB array
└─ ai_generated: boolean

ai_recommendations (stores the 0-100 score)
├─ deal_id
├─ score: 0-100
├─ recommendation_text: one sentence
├─ rationale: detailed explanation
└─ analysis_data: full JSON context
```

### Reference Table
```sql
yc_flags_catalog
├─ flag_type: 'green' | 'red'
├─ category: Team|Traction|Market|Product|Business Model|Deal Terms
├─ flag_text: the flag description
├─ description: detailed explanation
└─ 30+ pre-populated flags
```

---

## 🔑 KEY CODE SNIPPETS

### Where 65/100 Score is Generated
**File:** `ai-recommend-deal/index.ts:343-357`
```typescript
function parseRecommendation(aiResponse: string): { score: number; recommendation: string; rationale: string } {
  // Extract score from "SCORE: 65" in AI response
  const scoreMatch = aiResponse.match(/SCORE:\s*(\d+)/i);
  const score = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1]))) : 50;

  // Extract recommendation sentence
  const recMatch = aiResponse.match(/RECOMMENDATION:\s*(.+?)(?=\n\n|RATIONALE:|$)/is);
  const recommendation = recMatch ? recMatch[1].trim() : getDefaultRecommendation(score);

  // Extract rationale
  const ratMatch = aiResponse.match(/RATIONALE:\s*(.+)/is);
  const rationale = ratMatch ? ratMatch[1].trim() : aiResponse;

  return { score, recommendation, rationale };
}
```

### Score Scale Definition
**File:** `ai-recommend-deal/index.ts:314-323`
```typescript
// 0-39: Strong Reject
// 40-59: Reject or Request More Information
// 60-79: Deep Dive Required
// 80-100: Recommend to IC
```

### Frontend Weighted Score Calculation
**File:** `AnalystScreeningEditor.tsx:71-82`
```typescript
function computeOverall() {
  let num = 0;
  let den = 0;
  for (const c of criteria) {
    const w = Number(c.weight ?? 1);    // Weight from DB
    const v = Number(scores[c.id]?.score ?? 3);  // 1-5 score
    num += w * v;
    den += w;
  }
  return den ? Math.round((num / den) * 100) / 100 : null;
}
```

### Frontend Color Coding for Score
**File:** `AnalystScreeningEditor.tsx:273-277`
```typescript
{
  recommendation.score >= 80 ? "text-green-600" :
  recommendation.score >= 60 ? "text-orange-600" :
  recommendation.score >= 40 ? "text-yellow-600" :
  "text-red-600"
}
```

---

## 🎨 UI Color LEGEND

| Score Range | Color | Meaning | Display |
|-------------|-------|---------|---------|
| 80-100 | 🟢 Green | Recommend to IC | "80+: Recommend" |
| 60-79 | 🟠 Orange | Deep Dive Required | "60-79: Deep Dive" |
| 40-59 | 🟡 Yellow | More Info Needed | "40-59: More Info" |
| 0-39 | 🔴 Red | Reject | "<40: Reject" |

---

## 🔍 WHERE TO FIND SPECIFIC THINGS

### Where is the 7-criteria list?
**Database:** `screening_criteria` table (seeded in migrations)
**Fetch:** `ai-screen-deal/index.ts:88-92`
**Display:** `AnalystScreeningEditor.tsx:345-390`

### Where are the predefined YC flags?
**Database:** `yc_flags_catalog` table
**Seeded:** `migrations/002_yc_flags.sql:102-160` (30+ flags)
**UI Catalog:** `AnalystYCFlags.tsx:325-377`

### Where is the AI recommendation stored?
**Database:** `ai_recommendations` table
**Stored by:** `ai-recommend-deal/index.ts:147-167`
**Display:** `AnalystScreeningEditor.tsx:267-337`

### Where are analyst scores stored?
**Database:** `analyst_screening_scores` table
**Updated by:** `AnalystScreeningEditor.tsx:193-196`
**View:** `AnalystAnalysesView.tsx`

### Where are analyst flags stored?
**Database:** `analyst_deal_flags` table
**Updated by:** `AnalystYCFlags.tsx:112-121`
**Can be AI-generated:** `ai-detect-flags/index.ts`

---

## 🧪 TESTING THE SYSTEM

### Test Score Generation
```bash
curl -X POST http://localhost:3000/functions/v1/ai-recommend-deal \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"deal_id": "YOUR_DEAL_ID"}'
```

### View Generated Score
```sql
SELECT score, recommendation_text, rationale
FROM ai_recommendations
WHERE deal_id = 'YOUR_DEAL_ID'
LIMIT 1;
```

### View Analyst Scores
```sql
SELECT
  c.name,
  ass.score,
  ass.note
FROM analyst_screening_scores ass
JOIN screening_criteria c ON c.id = ass.criterion_id
WHERE ass.deal_id = 'YOUR_DEAL_ID'
ORDER BY c.created_at;
```

---

## ⚡ PERFORMANCE NOTES

- **AI Screen Deal:** ~5-10 seconds (Claude Haiku + PDF analysis)
- **AI Recommend Deal:** ~10-15 seconds (Claude Sonnet + synthesis)
- **AI Detect Flags:** ~3-5 seconds (Claude Haiku + flag detection)

All functions are called asynchronously from frontend → user sees loading state.

---

## 🔐 PERMISSIONS

**Analyst role can:**
- ✅ Score criteria
- ✅ Add/edit flags
- ✅ Trigger AI analysis
- ✅ Save memo
- ❌ Submit to IC

**Manager role can:**
- ✅ View all analyst analyses
- ✅ Submit to IC (separate flow)

