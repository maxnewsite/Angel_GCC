# AI Analyst Component Mapping
## Complete Location Guide for Analyst Screening & YC-Style Flags

---

## 🎯 EXECUTIVE SUMMARY

The AI Analyst system is composed of **3 key frontend components** and **3 backend Supabase Edge Functions**, all working together to provide:
1. **7-Criteria Screening** with weighted scoring (1-5 scale)
2. **YC-Style Red/Green Flags** detection (positive indicators vs. warnings)
3. **AI Recommendations** (0-100 score with rationale)

---

## 📍 FRONTEND COMPONENTS

### 1. **Analyst Screening Editor (Main 7-Criteria Component)**
**File:** `C:\Users\spiri\angel_ai\components\AnalystScreeningEditor.tsx`

#### What it Does:
- Displays the **"Analyst Screening (7 criteria)"** header
- Score each criterion 1–5 with a slider
- Store analysis memo + recommendation
- Calls two AI functions: "AI Screen Pitch Deck" & "AI Recommender"

#### Key Functions:
```typescript
// Line 233: The header you see
<div className="text-sm font-semibold">Analyst Screening (7 criteria)</div>

// Line 239-248: "AI Screen Pitch Deck" button
// Calls: /functions/v1/ai-screen-deal

// Line 250-261: "AI Recommender" button (Primary)
// Calls: /functions/v1/ai-recommend-deal
// This generates the 65/100 score and recommendation text

// Line 267-337: AI RECOMMENDATION METER
// Shows: 65/100 score with color coding
// Displays: <40: Reject | 40-59: More Info | 60-79: Deep Dive | 80+: Recommend
```

#### Data Stored:
- **Database Tables:**
  - `analyst_screening_scores` - Each criterion's 1-5 score + note
  - `analyst_screening_reviews` - Overall score, decision (recommend/needs_info/not_recommend), memo
  - `ai_recommendations` - The AI-generated score (0-100) + recommendation text + rationale

#### The Score Computation (Line 71-82):
```typescript
function computeOverall() {
  // Weighted average of all 7 criteria scores
  let num = 0;
  let den = 0;
  for (const c of criteria) {
    const w = Number(c.weight ?? 1);  // Weight from screening_criteria table
    const v = Number(scores[c.id]?.score ?? 3);  // 1-5 score
    num += w * v;
    den += w;
  }
  return den ? Math.round((num / den) * 100) / 100 : null;
}
```

---

### 2. **YC-Style Flags Component (Red/Green Flags)**
**File:** `C:\Users\spiri\angel_ai\components\AnalystYCFlags.tsx`

#### What it Does:
- **Green Flags Section**: "Mark red flags (warnings) and green flags (strengths)"
- **Red Flags Section**: Lists warning indicators
- **"AI Detect Flags" Button**: Automatically detects flags using AI
- **Flags Catalog Modal**: Browse standard YC-style flags by category

#### Key Functions:
```typescript
// Line 174-177: Header
<div className="text-sm font-semibold">YC-Style Flags (Analyst)</div>
<div className="text-xs text-black/60">
  Mark red flags (warnings) and green flags (strengths) in your analysis
</div>

// Line 179-189: "AI Detect Flags" button
// Calls: /functions/v1/ai-detect-flags
// Returns: green_flags[] and red_flags[] arrays

// Green Flags (Line 195-256): Stores as JSONB array
// Red Flags (Line 259-321): Stores as JSONB array
// Each flag has: { flag: string, note: string }

// Line 325-377: Catalog Modal
// Loads from yc_flags_catalog table (30+ predefined flags)
```

#### Data Stored:
- **Database Table:**
  - `analyst_deal_flags` - Contains green_flags and red_flags as JSONB arrays
  - `yc_flags_catalog` - Reference table with 30+ standard flag templates

#### Standard Flag Categories (from DB):
- **Team**: Founder strength, co-founder dynamics, technical capability
- **Traction**: User growth, revenue, engagement metrics
- **Market**: TAM size, growth rate, market timing
- **Product**: Defensibility, moat, innovation
- **Business Model**: Unit economics, margins, burn rate
- **Deal Terms**: Valuation, cap table, investor terms

---

### 3. **Analyst Analyses View**
**File:** `C:\Users\spiri\angel_ai\components\AnalystAnalysesView.tsx`

#### What it Does:
- Display all analyst screening analyses
- Show aggregated analyst scores and flags
- View comparison across multiple analysts

---

## ⚙️ BACKEND SUPABASE EDGE FUNCTIONS

### 1. **AI Screen Deal (Pitch Deck Analysis)**
**File:** `C:\Users\spiri\angel_ai\supabase\functions\ai-screen-deal\index.ts`

#### What it Does:
- Downloads the pitch deck PDF from storage
- Sends PDF to Claude API with the 7 screening criteria
- AI analyzes the pitch deck and scores each criterion 1-5
- Returns structured JSON with scores and notes

#### API Call (Line 91):
```
POST /functions/v1/ai-screen-deal
```

#### Request:
```json
{
  "deal_id": "uuid-here"
}
```

#### Response:
```json
{
  "ok": true,
  "overall_score": 3.5,
  "criteria_scores": [
    {
      "criterion_id": "uuid",
      "criterion_name": "Market Opportunity",
      "score": 4,
      "note": "Large addressable market of $10B with 15% CAGR...",
      "weight": 1
    }
    // ... 7 criteria total
  ],
  "overall_assessment": "Brief summary of opportunity"
}
```

#### How It Works (Line 108-146):
```typescript
// Builds prompt with:
// 1. Deal details (company, sector, round type, target, valuation)
// 2. ALL 7 screening criteria definitions
// 3. Instructions to score EACH criterion 1-5
// 4. PDF attachment for analysis

// Uses Claude Haiku (Line 160)
// model: "claude-haiku-4-5-20251001"

// AI must return JSON with:
// - analyses[] array (one per criterion)
// - overall_assessment (summary)
```

---

### 2. **AI Recommend Deal (0-100 Score + Recommendation)**
**File:** `C:\Users\spiri\angel_ai\supabase\functions\ai-recommend-deal\index.ts`

#### What it Does:
- **This is the primary AI function that generates the 65/100 score you see**
- Synthesizes ALL data: deal info + manager screening + analyst analyses + flags
- Generates 0-100 recommendation score
- Creates recommendation sentence + detailed rationale
- Stores result in `ai_recommendations` table

#### API Call (Line 139):
```
POST /functions/v1/ai-recommend-deal
```

#### Request:
```json
{
  "deal_id": "uuid-here"
}
```

#### Response:
```json
{
  "success": true,
  "score": 65,
  "recommendation": "Proceed with deep dive requiring technical validation...",
  "rationale": "Detailed 200-300 word analysis..."
}
```

#### The Scoring Scale (Line 319-323):
```
- 0-39: Strong Reject (critical issues, not investment-ready)
- 40-59: Reject or Request More Information (significant concerns)
- 60-79: Deep Dive Required (promising but needs validation/SME advice)
- 80-100: Recommend to IC (strong opportunity, ready for investment committee)
```

#### Data Synthesis (Line 100-109):
The AI gets access to:
1. **Deal Data**: Startup profile, round type, valuation, highlights, risks
2. **Manager Screening**: 7 criteria scores (1-5 each), memo, flags
3. **Analyst Screenings**: ALL analyst analyses with scores and flags
4. **Manager Flags**: Green and red flags from dealflow manager

#### Claude Model Used (Line 125):
```typescript
model: "claude-sonnet-4-20250514"  // More capable model for synthesis
max_tokens: 2000
```

#### Prompt Structure (Line 193-342):
The function builds a comprehensive prompt that includes:
```
**STARTUP INFORMATION:**
- Name, sector, location, team, traction

**DEAL TERMS:**
- Round type, target amount, valuation, instrument

**DEALFLOW MANAGER SCREENING ANALYSIS:**
- 7 criteria scores with notes
- Overall screening score and decision
- Green flags and red flags

**DEALFLOW ANALYST SCREENING ANALYSES:**
- For each analyst:
  - Overall score, decision, memo
  - Individual criteria scores
  - Their green and red flags

**YOUR TASK:**
Based on ALL information above, provide:
1. SCORE (0-100)
2. RECOMMENDATION (one sentence)
3. RATIONALE (200-300 words synthesizing all perspectives)
```

---

### 3. **AI Detect Flags (YC-Style Flag Detection)**
**File:** `C:\Users\spiri\angel_ai\supabase\functions\ai-detect-flags\index.ts`

#### What it Does:
- Analyzes startup data and optionally the pitch deck
- Identifies 3-5 green flags (strengths) and 3-5 red flags (warnings)
- Returns structured flag data that populates the flags component

#### API Call (Line 70):
```
POST /functions/v1/ai-detect-flags
```

#### Request:
```json
{
  "deal_id": "uuid-here"
}
```

#### Response:
```json
{
  "ok": true,
  "green_flags": [
    {
      "flag": "Exceptional founding team",
      "note": "Founders have 2 prior exits and 10+ years domain expertise..."
    }
  ],
  "red_flags": [
    {
      "flag": "Limited traction",
      "note": "Only 10 users after 6 months. No clear product-market fit indicators."
    }
  ]
}
```

#### Claude Model Used (Line 131):
```typescript
model: "claude-haiku-4-5-20251001"  // Fast model for flag detection
max_tokens: 2048
```

#### Prompt Instructions (Line 90-118):
```
# YC-Trained AI Analyst Perspective
Identify:
1. GREEN FLAGS (3-5): Positive indicators making this strong investment
   - Examples: Exceptional team, strong PMF, impressive growth, large market, defensibility

2. RED FLAGS (3-5): Warning signs needing attention
   - Examples: Weak team, no traction, small market, no moat, unfavorable terms

For each flag:
- Flag description (1 sentence)
- Supporting evidence/note (1-2 sentences)

Return: Valid JSON with green_flags[] and red_flags[] arrays
```

---

## 🗄️ DATABASE SCHEMA

### Analyst Screening Tables (Migration: 013_dealflow_analyst.sql)

#### 1. `analyst_screening_scores`
```sql
- id: UUID (primary key)
- deal_id: UUID (foreign key → deals)
- analyst_user_id: UUID (foreign key → profiles)
- criterion_id: UUID (foreign key → screening_criteria)
- score: INTEGER (1-5, required)
- note: TEXT (analysis explanation)
- created_at, updated_at: TIMESTAMPTZ
- UNIQUE(deal_id, analyst_user_id, criterion_id)
```

#### 2. `analyst_screening_reviews`
```sql
- id: UUID (primary key)
- deal_id: UUID (foreign key → deals)
- analyst_user_id: UUID (foreign key → profiles)
- overall_score: NUMERIC (weighted average)
- decision: TEXT ('recommend', 'needs_info', 'not_recommend')
- summary_memo: TEXT (executive summary)
- created_at, updated_at: TIMESTAMPTZ
- UNIQUE(deal_id, analyst_user_id)
```

#### 3. `analyst_deal_flags`
```sql
- id: UUID (primary key)
- deal_id: UUID (foreign key → deals)
- analyst_user_id: UUID (foreign key → profiles)
- green_flags: JSONB (array of {flag: string, note: string})
- red_flags: JSONB (array of {flag: string, note: string})
- ai_generated: BOOLEAN (true if AI-detected)
- created_at, updated_at: TIMESTAMPTZ
- UNIQUE(deal_id, analyst_user_id)
```

### YC Flags Reference Table (Migration: 002_yc_flags.sql)

#### 4. `yc_flags_catalog`
```sql
- id: UUID (primary key)
- flag_type: TEXT ('green' or 'red')
- category: TEXT (Team, Traction, Market, Product, Business Model, Deal Terms)
- flag_text: TEXT (the flag description)
- description: TEXT (detailed explanation)
- is_active: BOOLEAN
- created_at: TIMESTAMPTZ

30+ pre-populated standard flags organized by category
```

### AI Recommendations Storage

#### 5. `ai_recommendations`
```sql
- id: UUID (primary key)
- deal_id: UUID (foreign key → deals)
- score: INTEGER (0-100)
- recommendation_text: TEXT (one-sentence recommendation)
- rationale: TEXT (detailed 200-300 word explanation)
- analysis_data: JSONB (full context used for the recommendation)
  {
    "manager_screening_scores": [...],
    "manager_flags": {...},
    "manager_review": {...},
    "analyst_reviews": [...],
    "analyst_scores": [...],
    "analyst_flags": [...],
    "ai_full_response": "..."
  }
- generated_by_user_id: UUID
- created_at: TIMESTAMPTZ
```

---

## 🔄 DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────┐
│  AnalystScreeningEditor.tsx                 │
│  - Display 7 criteria with sliders          │
│  - Show score for each criterion (1-5)      │
│  - Executive summary memo input             │
└────────────────┬──────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
   "AI Screen"      "AI Recommender"
   Pitch Deck       (Primary)
        │                 │
        │                 ▼
        │         POST /functions/v1/ai-recommend-deal
        │                 │
        │                 ├─→ Fetch: deal data
        │                 ├─→ Fetch: manager screening
        │                 ├─→ Fetch: analyst reviews
        │                 ├─→ Fetch: analyst scores
        │                 ├─→ Fetch: analyst flags
        │                 │
        │                 ├─→ Call Claude Sonnet
        │                 │   (synthesize all data)
        │                 │
        │                 ├─→ Parse response:
        │                 │   - SCORE: 0-100
        │                 │   - RECOMMENDATION: sentence
        │                 │   - RATIONALE: 200-300 words
        │                 │
        │                 ├─→ Store in: ai_recommendations table
        │                 │
        │                 └─→ Return to UI
        │                     (display in meter)
        │
        └─→ Updates: analyst_screening_scores
            Updates: analyst_screening_reviews

┌─────────────────────────────────────────────┐
│  AnalystYCFlags.tsx                         │
│  - Display green and red flags              │
│  - "AI Detect Flags" button                 │
└────────────────┬──────────────────────────┘
                 │
                 ▼
        POST /functions/v1/ai-detect-flags
                 │
                 ├─→ Fetch: deal + startup info
                 ├─→ Download: pitch deck (optional)
                 ├─→ Call Claude Haiku
                 ├─→ Parse: green_flags[] & red_flags[]
                 └─→ Return to UI

        Updates: analyst_deal_flags table
```

---

## 🎨 UI COMPONENTS DETAILS

### Analyst Screening Editor UI (Lines 228-432)

#### The AI Recommendation Meter (Lines 267-337)
When `recommendation` state is populated:
```
┌─────────────────────────────────────────────────────┐
│ AI Recommendation                              65/100│
├─────────────────────────────────────────────────────┤
│ [████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] │ Progress bar
│                                                     │
│ <40: Reject | 40-59: More Info | 60-79: Deep Dive | 80+: Recommend
│ (the category where score lands is highlighted)    │
│                                                     │
│ ┌─────────────────────────────────────────────┐    │
│ │ Proceed with deep dive requiring technical  │    │
│ │ validation, pilot data verification, and    │    │
│ │ capital efficiency analysis before advancing│    │
│ │ to investment committee.                    │    │
│ └─────────────────────────────────────────────┘    │
│                                                     │
│ View detailed rationale (collapsible)              │
│ [Full rationale text shows here when expanded]    │
└─────────────────────────────────────────────────────┘
```

#### Criteria Scoring Section (Lines 344-390)
For each of the 7 screening criteria:
```
┌─────────────────────────────────────────────┐
│ Market Opportunity          Weight: 1      │
│ Description: Size and growth potential     │
├─────────────────────────────────────────────┤
│ Slider: [1] ————●———— [5]    Score: 3     │
│                                             │
│ Analysis notes textarea                     │
│ (AI fills this in when "AI Screen" runs)   │
└─────────────────────────────────────────────┘
```

### YC Flags UI (Lines 170-387)

#### Green Flags Section
```
✓ Green Flags (2)
────────────────────────────────
┌─────────────────────────────┐
│ Exceptional founding team   │
│ Evidence: Prior exits...    │
└─────────────────────────────┘
┌─────────────────────────────┐
│ Strong product-market fit   │
│ Evidence: 50% MoM growth... │
└─────────────────────────────┘
+ Add custom flag
```

#### Red Flags Section
```
! Red Flags (1)
────────────────────────────────
┌─────────────────────────────┐
│ Limited traction           │
│ Evidence: 10 users only... │
└─────────────────────────────┘
+ Add custom flag
```

#### Flag Catalog Modal (Lines 325-377)
When clicking "+ Add from catalog", a modal shows:
```
Standard Green Flags
[all] [team] [traction] [market] [product] [business model]

☐ Exceptional founder(s)
  Prior exits, deep domain expertise, technical excellence

☐ Strong technical team
  Engineers from top companies, proven track record

☐ Strong product-market fit
  High engagement, low churn, organic growth
... (30+ total flags)
```

---

## 🔐 DATABASE SECURITY & ROLE-BASED ACCESS

### Analyst Permissions (from Migration 013)

**dealflow_analyst role can:**
- ✅ Score deals against 7 criteria
- ✅ Write analysis memo
- ✅ Select recommendation (recommend/needs_info/not_recommend)
- ✅ Detect and tag red/green flags
- ✅ View pitch decks
- ✅ Upload documents
- ✅ View AI recommendations
- ❌ Cannot submit to IC (only dealflow_manager can)

**Data isolation:**
- Each analyst's scores are separate (UNIQUE constraint on deal_id + analyst_user_id + criterion_id)
- Can only modify their own analyses (RLS policies)
- Manager can view all analyst analyses
- IC can view all analyst analyses

---

## 🚀 HOW TO USE THE ANALYST FEATURES

### Step 1: Score the 7 Criteria
1. Go to deal detail page
2. Find "Analyst Screening (7 criteria)" section
3. For each criterion, adjust slider to 1-5
4. Add analysis notes explaining your reasoning
5. Click "Save Analysis"

### Step 2: Detect Red/Green Flags (Optional)
1. Go to "YC-Style Flags (Analyst)" section
2. Click "AI Detect Flags" button
3. AI analyzes pitch deck and suggests flags
4. Review, add custom flags as needed
5. Click "Save Flags"

### Step 3: Run AI Analysis (AI Recommender)
1. After saving criteria scores, click "AI Recommender" button
2. AI synthesizes:
   - Your 7 criterion scores
   - Your memo
   - Manager's screening (if any)
   - Other analysts' analyses
   - Red/green flags (from you and manager)
3. AI outputs:
   - **Score**: 0-100
   - **Recommendation**: 1 sentence action
   - **Rationale**: 200-300 word explanation
4. Review the meter and rationale
5. Decision goes to dealflow manager for IC submission

---

## 📊 EXAMPLE: HOW THE AI GENERATES 65/100 SCORE

**Input Data Synthesized:**
```
Deal: TechStartup Inc
├─ Manager's Analysis
│  ├─ Market Opportunity: 4/5
│  ├─ Team Quality: 4/5
│  ├─ Traction: 2/5
│  ├─ Business Model: 3/5
│  ├─ Defensibility: 3/5
│  ├─ Execution Risk: 2/5
│  └─ Valuation Fairness: 3/5
├─ Manager's Flags
│  ├─ 🟢 Strong technical team
│  ├─ 🟢 Growing market
│  ├─ 🔴 Limited traction
│  └─ 🔴 Weak unit economics
├─ Analyst 1's Analysis
│  ├─ Overall: 3/5 (Needs Info)
│  ├─ Red flag: Solo founder
│  └─ Green flag: 30% MoM growth
└─ Analyst 2's Analysis
   ├─ Overall: 3.5/5 (Needs Info)
   └─ Green flag: $1B TAM potential
```

**Claude Sonnet Synthesis:**
```
SCORE: 65
RECOMMENDATION: Proceed with deep dive requiring technical validation,
                pilot data verification, and capital efficiency analysis
                before advancing to investment committee.
RATIONALE: The company shows promising signs with strong market
opportunity and technical team, supported by emerging traction.
However, multiple analyses flag concerns about limited customer
validation and unit economics. The 30% MoM growth is encouraging,
but analyst consensus suggests needing more data on retention and
retention curves before IC presentation. Recommend technical due
diligence on the product roadmap and a deeper dive into CAC/LTV
metrics. If these validate, the large TAM and strong team could
make this a compelling investment at the right valuation.
```

---

## 🔍 DEBUGGING & LOGS

### Check API Logs
```typescript
// All three functions log to Supabase Edge Function logs
// Line 140 (ai-recommend-deal): console.log("Calling AI Recommender:", url)
// Line 155 (ai-recommend-deal): console.log("AI Recommender response status:", res.status)
```

### Frontend Console Logs
```typescript
// When "AI Recommender" is clicked (AnalystScreeningEditor.tsx):
console.log("Calling AI Recommender:", url);              // Line 140
console.log("AI Recommender response status:", res.status); // Line 151
console.log("AI Recommender success:", data);            // Line 160
```

### Database Queries
```sql
-- View all analyst scores for a deal
SELECT * FROM analyst_screening_scores
WHERE deal_id = 'your-deal-id';

-- View analyst's overall review
SELECT * FROM analyst_screening_reviews
WHERE deal_id = 'your-deal-id';

-- View analyst's flags
SELECT * FROM analyst_deal_flags
WHERE deal_id = 'your-deal-id';

-- View AI recommendation
SELECT score, recommendation_text, rationale
FROM ai_recommendations
WHERE deal_id = 'your-deal-id';
```

---

## ✅ SUMMARY: EXACT LOCATIONS

| Component | File | Line(s) | Purpose |
|-----------|------|---------|---------|
| **Analyst Screening Editor** | `components/AnalystScreeningEditor.tsx` | 1-432 | 7-criteria scoring + AI Recommender |
| **YC Flags Component** | `components/AnalystYCFlags.tsx` | 1-387 | Red/green flag detection |
| **AI Screen Deal Function** | `supabase/functions/ai-screen-deal/index.ts` | 1-310 | Score each criterion 1-5 |
| **AI Recommend Deal Function** | `supabase/functions/ai-recommend-deal/index.ts` | 1-365 | Generate 0-100 score + recommendation |
| **AI Detect Flags Function** | `supabase/functions/ai-detect-flags/index.ts` | 1-211 | Detect red/green flags |
| **Analyst Screening Schema** | `supabase/migrations/013_dealflow_analyst.sql` | 49-330 | Database tables + RLS policies |
| **YC Flags Schema** | `supabase/migrations/002_yc_flags.sql` | 1-164 | Flags tables + 30+ reference flags |

---

## 🎯 KEY TAKEAWAYS

✅ **7-Criteria Screening** = 1-5 score per criterion (weighted average calculated)
✅ **AI Recommender** = Claude Sonnet synthesizes ALL data → 0-100 score
✅ **Red/Green Flags** = Claude Haiku detects YC-style investment signals
✅ **Analyst Role** = Can score and flag, cannot submit to IC
✅ **Data Flow** = Frontend calls Edge Functions → Claude API → Database storage
✅ **Audit Trail** = All analyses stored with timestamps and analyst user ID

