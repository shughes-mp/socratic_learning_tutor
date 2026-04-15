# PHASE 3B: TEACHING RECOMMENDATIONS

**Status:** Codex instruction file for Phase 3B implementation  
**Depends on:** Phases 1, 2, and 3A (misconception aggregation and dashboard)  
**Scope:** AI-generated active learning activities to address misconceptions  

---

## Overview

Generate instructor-facing teaching recommendations based on aggregated misconceptions from Phase 3A. The system uses Claude Sonnet to synthesize student transcript analysis with pedagogical best practices, producing concrete, time-bound active learning moves.

---

## Database Schema Updates

Add to `socratic-tutor/prisma/schema.prisma`:

```prisma
model TeachingRecommendation {
  id                String   @id @default(cuid())
  sessionId         String
  session           Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  whatToAddress     String   // 1-sentence: what students misunderstand
  whyItMatters      String   // 1-sentence: connection to learning outcomes
  evidence          String   // JSON array of 3 evidence bullets
  moveFiveMin       String   // JSON: { description: string, script: string }
  moveFifteenMin    String   // JSON: { description: string, script: string }
  moveThirtyMin     String   // JSON: { description: string, script: string }
  sourceClusters    String   // JSON array of cluster labels this addresses
  confidence        String   @default("medium") // "low" | "medium" | "high"
  instructorAction  String?  // "used" | "dismissed" | "edited" | null
  instructorNote    String?  // Optional feedback from instructor
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([sessionId])
}
```

Add to the `Session` model:
```prisma
recommendations TeachingRecommendation[]
```

After editing `schema.prisma`, run:
```bash
cd socratic-tutor
npx prisma db push
```

---

## API Route: Generate Recommendations

**File:** `socratic-tutor/src/app/api/sessions/[sessionId]/recommendations/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Anthropic } from '@anthropic-ai/sdk';

interface ClusterSummary {
  label: string;
  misconceptionType: string;
  passageAnchor: string | null;
  checkpointId: string | null;
  count: number;
  totalStudents: number;
  prevalence: number;
  resolutionRate: number;
  severity: string;
  representativeExcerpt: string;
}

interface Recommendation {
  id: string;
  whatToAddress: string;
  whyItMatters: string;
  evidence: string[];
  moves: {
    fiveMin: { description: string; script: string };
    fifteenMin: { description: string; script: string };
    thirtyMin: { description: string; script: string };
  };
  sourceClusters: string[];
  confidence: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;

    // Fetch session with learning outcomes and context
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        studentSessions: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Fetch aggregated clusters (re-aggregate or fetch from cache if available)
    const aggregateResponse = await fetch(
      `${req.nextUrl.origin}/api/sessions/${sessionId}/misconceptions/aggregate`,
      {
        method: 'GET',
      }
    );

    if (!aggregateResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch misconception clusters' },
        { status: 500 }
      );
    }

    const aggregateData = await aggregateResponse.json();
    const clusters: ClusterSummary[] = aggregateData.clusters;

    // Fetch misconception overrides to exclude acceptable interpretations
    const overrides = await prisma.misconceptionOverride.findMany({
      where: { sessionId },
    });

    const acceptableLabels = new Set(
      overrides
        .filter(o => o.overrideType === 'acceptable_interpretation')
        .map(o => o.clusterLabel)
    );

    const needsDiscussionLabels = new Set(
      overrides
        .filter(o => o.overrideType === 'needs_discussion')
        .map(o => o.clusterLabel)
    );

    // Filter clusters: exclude acceptable interpretations, prioritize needs_discussion
    const relevantClusters = clusters.filter(
      c => !acceptableLabels.has(c.label)
    );

    // Sort by: needs_discussion, then severity (high/critical), then prevalence
    const severityRank: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    relevantClusters.sort((a, b) => {
      const aIsDiscussion = needsDiscussionLabels.has(a.label) ? 0 : 1;
      const bIsDiscussion = needsDiscussionLabels.has(b.label) ? 0 : 1;
      if (aIsDiscussion !== bIsDiscussion) return aIsDiscussion - bIsDiscussion;
      
      const aSeverity = severityRank[a.severity] ?? 4;
      const bSeverity = severityRank[b.severity] ?? 4;
      if (aSeverity !== bSeverity) return aSeverity - bSeverity;
      
      return b.prevalence - a.prevalence;
    });

    if (relevantClusters.length === 0) {
      return NextResponse.json({
        recommendations: [],
        message: 'No misconceptions to address or all marked as acceptable interpretations',
      });
    }

    // Fetch student transcripts (aggregate for prompt context)
    const studentSessions = session.studentSessions.slice(0, 5); // Limit to first 5 for context
    let transcriptContext = '';

    for (const ss of studentSessions) {
      const studentSession = await prisma.studentSession.findUnique({
        where: { id: ss.id },
      });
      if (studentSession) {
        transcriptContext += `\n\nStudent: ${studentSession.id}\n${studentSession.content?.substring(0, 500) || 'No content'}`;
      }
    }

    // Build prompt for Claude
    const clusterContext = relevantClusters
      .slice(0, 8) // Top 8 clusters
      .map((c, i) => {
        const priority = needsDiscussionLabels.has(c.label) ? '[PRIORITY] ' : '';
        return `
${priority}Cluster: "${c.label}"
- Type: ${c.misconceptionType}
- Prevalence: ${c.count}/${c.totalStudents} students (${Math.round(c.prevalence * 100)}%)
- Resolution rate: ${Math.round(c.resolutionRate * 100)}%
- Severity: ${c.severity}
- Passage anchor: ${c.passageAnchor || 'general'}
- Representative student response: "${c.representativeExcerpt}"
`;
      })
      .join('\n');

    const prompt = `You are an instructional design consultant for an active learning classroom. Based on the following student misconception data from an AI tutoring session, generate specific teaching recommendations.

CONTEXT:
- Session: "${session.name}"
- Description: ${session.description || 'No description'}
- Learning outcomes: ${session.learningOutcomes || 'Not specified'}
- Course context: ${session.courseContext || 'General reading comprehension'}
- Total students in session: ${session.studentSessions.length}
- Teaching approach: Active learning methodology — structured small-group activities, not lecture.

STUDENT MISCONCEPTION DATA:
${clusterContext}

MISCONCEPTION OVERRIDES:
Instructor has flagged these clusters as needing discussion:
${Array.from(needsDiscussionLabels).join(', ') || 'None flagged'}

SAMPLE STUDENT TRANSCRIPT:
${transcriptContext}

YOUR TASK:
For the top 2-3 most impactful misconception clusters (prioritize by: flagged as "needs_discussion", then high severity + high prevalence + low resolution rate), generate an "activity card" with concrete, time-bound active learning moves.

For each recommendation, generate:

1. WHAT TO ADDRESS (1 sentence, max 20 words): What students misunderstand
2. WHY IT MATTERS (1 sentence, max 20 words): Connection to learning outcomes or upcoming class objectives
3. EVIDENCE (3 bullets max): Prevalence data, most common phrasing, passage anchors
4. ACTIVE LEARNING MOVES at three time scales:
   - 5-MINUTE MOVE: A quick activity (text evidence audit in pairs, targeted poll, passage re-read with specific lens, annotation hunt)
   - 15-MINUTE MOVE: A structured small-group activity (debate with roles, claim-evidence-reasoning exercise, compare interpretations, ranking task)
   - 30-MINUTE MOVE: A deeper application (case application, structured discussion with predict-apply-challenge sequence, peer teaching with evidence)
5. FACILITATION SCRIPT (for each move): Exact prompts the instructor can use, expected student responses, timing, and how to handle if the misconception resurfaces

CONSTRAINTS:
- Maximum 3 recommendations total. Quality over quantity.
- Never suggest "review the material" or "explain the concept again" — these are NOT active learning moves.
- Every activity must require students to engage with the actual text, not just discuss abstractly.
- Frame activities as student-doing, not teacher-telling.
- For each move, specify exact timing (e.g., "2 minutes of prep, 2 minutes of discussion").
- Scripts should be direct quotes the instructor can read aloud or adapt.
- Anticipate common follow-up questions or pushback and include responses.

OUTPUT FORMAT:
For each recommendation, output in this exact format, with no additional text:

[RECOMMENDATION_START]
[WHAT: One sentence describing the misconception]
[WHY: One sentence about importance]
[EVIDENCE: Bullet 1. Bullet 2. Bullet 3.]
[MOVE_5MIN: Activity name and description]
[MOVE_15MIN: Activity name and description]
[MOVE_30MIN: Activity name and description]
[SCRIPT_5MIN: Exact script, expected responses, timing]
[SCRIPT_15MIN: Exact script, expected responses, timing]
[SCRIPT_30MIN: Exact script, expected responses, timing]
[RECOMMENDATION_END]

Generate all recommendations now.`;

    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6-20251120',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Parse response
    const responseText =
      response.content[0].type === 'text' ? response.content[0].text : '';
    const recommendations = parseRecommendations(
      responseText,
      relevantClusters.map(c => c.label)
    );

    // Save to database
    const savedRecs = [];
    for (const rec of recommendations) {
      const saved = await prisma.teachingRecommendation.create({
        data: {
          sessionId,
          whatToAddress: rec.whatToAddress,
          whyItMatters: rec.whyItMatters,
          evidence: JSON.stringify(rec.evidence),
          moveFiveMin: JSON.stringify(rec.moves.fiveMin),
          moveFifteenMin: JSON.stringify(rec.moves.fifteenMin),
          moveThirtyMin: JSON.stringify(rec.moves.thirtyMin),
          sourceClusters: JSON.stringify(rec.sourceClusters),
          confidence: rec.confidence,
        },
      });

      savedRecs.push({
        ...saved,
        evidence: rec.evidence,
        moves: rec.moves,
        sourceClusters: rec.sourceClusters,
      });
    }

    return NextResponse.json({
      recommendations: savedRecs,
      clusterCount: relevantClusters.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}

function parseRecommendations(text: string, clusterLabels: string[]): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const blocks = text.split('[RECOMMENDATION_START]');

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('[RECOMMENDATION_END]')[0];
    const lines = block.split('\n').filter(l => l.trim());

    const extract = (prefix: string): string => {
      const line = lines.find(l => l.startsWith(`[${prefix}:`));
      if (!line) return '';
      return line.substring(prefix.length + 2).replace(/\]$/, '').trim();
    };

    const whatLine = extract('WHAT');
    const whyLine = extract('WHY');
    const evidenceLine = extract('EVIDENCE');
    const move5Line = extract('MOVE_5MIN');
    const move15Line = extract('MOVE_15MIN');
    const move30Line = extract('MOVE_30MIN');
    const script5Line = extract('SCRIPT_5MIN');
    const script15Line = extract('SCRIPT_15MIN');
    const script30Line = extract('SCRIPT_30MIN');

    if (whatLine && whyLine) {
      const evidence = evidenceLine
        .split('. ')
        .filter(e => e.trim().length > 0)
        .slice(0, 3);

      recommendations.push({
        id: `rec-${Math.random().toString(36).substr(2, 9)}`,
        whatToAddress: whatLine,
        whyItMatters: whyLine,
        evidence,
        moves: {
          fiveMin: {
            description: move5Line,
            script: script5Line,
          },
          fifteenMin: {
            description: move15Line,
            script: script15Line,
          },
          thirtyMin: {
            description: move30Line,
            script: script30Line,
          },
        },
        sourceClusters: clusterLabels.slice(0, 2), // Attribution to top clusters
        confidence: 'medium',
      });
    }
  }

  return recommendations;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const recommendations = await prisma.teachingRecommendation.findMany({
      where: { sessionId: params.sessionId },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = recommendations.map(r => ({
      ...r,
      evidence: JSON.parse(r.evidence),
      moveFiveMin: JSON.parse(r.moveFiveMin),
      moveFifteenMin: JSON.parse(r.moveFifteenMin),
      moveThirtyMin: JSON.parse(r.moveThirtyMin),
      sourceClusters: JSON.parse(r.sourceClusters),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}
```

---

## UI: Teaching Recommendations Section

**File:** `socratic-tutor/src/app/instructor/[sessionId]/misconceptions/page.tsx` (Update)

Add this section to the existing misconception dashboard page after the "Show all clusters" section:

```typescript
// Add these state hooks at the top of the component:
const [recommendations, setRecommendations] = useState<any[]>([]);
const [loadingRecs, setLoadingRecs] = useState(false);
const [detailedView, setDetailedView] = useState(true);
const [expandedRec, setExpandedRec] = useState<string | null>(null);

// Add this function to handle recommendation generation:
const handleGenerateRecommendations = async () => {
  try {
    setLoadingRecs(true);
    const response = await fetch(
      `/api/sessions/${sessionId}/recommendations`,
      {
        method: 'POST',
      }
    );

    if (!response.ok) throw new Error('Failed to generate recommendations');

    const data = await response.json();
    setRecommendations(data.recommendations);
  } catch (err) {
    console.error('Error generating recommendations:', err);
    alert('Failed to generate recommendations');
  } finally {
    setLoadingRecs(false);
  }
};

// Add this function to handle instructor actions:
const handleRecAction = async (recId: string, action: string, note?: string) => {
  try {
    await fetch(
      `/api/sessions/${sessionId}/recommendations/${recId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorAction: action,
          instructorNote: note,
        }),
      }
    );
    // Refetch recommendations
    const response = await fetch(`/api/sessions/${sessionId}/recommendations`);
    const data = await response.json();
    setRecommendations(data);
  } catch (err) {
    console.error('Error updating recommendation:', err);
  }
};

// Add this JSX section after the "Show all clusters" section:

<div className="mt-12 pt-8 border-t border-gray-300">
  <div className="flex items-center justify-between mb-6">
    <h2 className="text-2xl font-bold">Teaching Recommendations</h2>
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-600">
        <input
          type="checkbox"
          checked={detailedView}
          onChange={(e) => setDetailedView(e.target.checked)}
          className="mr-2"
        />
        Detailed view
      </label>
    </div>
  </div>

  {recommendations.length === 0 ? (
    <div className="minerva-card bg-blue-50">
      <p className="text-gray-700 mb-4">
        {loadingRecs
          ? 'Analyzing transcripts and generating activity recommendations...'
          : 'No recommendations generated yet. Click the button below to create recommendations based on identified misconceptions.'}
      </p>
      {!loadingRecs && (
        <button
          onClick={handleGenerateRecommendations}
          disabled={loadingRecs}
          className="minerva-button bg-blue-600 text-white"
        >
          Generate Recommendations
        </button>
      )}
    </div>
  ) : (
    <div className="space-y-6">
      {recommendations.map((rec) => (
        <div
          key={rec.id}
          className="minerva-card"
        >
          {/* Header */}
          <div className="mb-4">
            <h3 className="text-xl font-bold">{rec.whatToAddress}</h3>
            <p className="text-sm text-gray-600 mt-1 italic">
              Why it matters: {rec.whyItMatters}
            </p>
          </div>

          {/* Evidence */}
          {detailedView && (
            <div className="bg-gray-50 p-4 rounded mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Evidence
              </h4>
              <ul className="text-sm space-y-1 text-gray-700">
                {rec.evidence &&
                  Array.isArray(rec.evidence) &&
                  rec.evidence.map((e: string, idx: number) => (
                    <li key={idx} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{e}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Activities Tabs */}
          {detailedView && (
            <div className="mb-4">
              <div className="flex gap-2 mb-3 border-b border-gray-200">
                {[
                  {
                    label: '5 min',
                    key: 'fiveMin' as const,
                    move: rec.moves?.fiveMin,
                  },
                  {
                    label: '15 min',
                    key: 'fifteenMin' as const,
                    move: rec.moves?.fifteenMin,
                  },
                  {
                    label: '30 min',
                    key: 'thirtyMin' as const,
                    move: rec.moves?.thirtyMin,
                  },
                ].map(({ label, key, move }) => (
                  <div key={key}>
                    <button
                      onClick={() =>
                        setExpandedRec(expandedRec === `${rec.id}-${key}` ? null : `${rec.id}-${key}`)
                      }
                      className={`px-4 py-2 text-sm font-medium border-b-2 ${
                        expandedRec === `${rec.id}-${key}`
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {label}
                    </button>
                  </div>
                ))}
              </div>

              {/* Activity Content */}
              {expandedRec?.startsWith(rec.id) && (
                <div className="bg-white p-4 rounded border border-gray-200">
                  {expandedRec === `${rec.id}-fiveMin` && (
                    <div>
                      <h5 className="font-semibold mb-2">Activity</h5>
                      <p className="text-sm mb-3">{rec.moves?.fiveMin?.description}</p>
                      <h5 className="font-semibold mb-2">Facilitation Script</h5>
                      <p className="text-sm whitespace-pre-wrap text-gray-700">
                        {rec.moves?.fiveMin?.script}
                      </p>
                    </div>
                  )}
                  {expandedRec === `${rec.id}-fifteenMin` && (
                    <div>
                      <h5 className="font-semibold mb-2">Activity</h5>
                      <p className="text-sm mb-3">{rec.moves?.fifteenMin?.description}</p>
                      <h5 className="font-semibold mb-2">Facilitation Script</h5>
                      <p className="text-sm whitespace-pre-wrap text-gray-700">
                        {rec.moves?.fifteenMin?.script}
                      </p>
                    </div>
                  )}
                  {expandedRec === `${rec.id}-thirtyMin` && (
                    <div>
                      <h5 className="font-semibold mb-2">Activity</h5>
                      <p className="text-sm mb-3">{rec.moves?.thirtyMin?.description}</p>
                      <h5 className="font-semibold mb-2">Facilitation Script</h5>
                      <p className="text-sm whitespace-pre-wrap text-gray-700">
                        {rec.moves?.thirtyMin?.script}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              Confidence:{' '}
              <span className="font-semibold text-gray-700">{rec.confidence}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {!rec.instructorAction && (
                <>
                  <button
                    onClick={() => handleRecAction(rec.id, 'used')}
                    className="minerva-button bg-green-100 text-green-800 text-sm"
                  >
                    Use this
                  </button>
                  <button
                    onClick={() => {
                      const note = prompt('Optional note:');
                      handleRecAction(rec.id, 'dismissed', note || undefined);
                    }}
                    className="minerva-button bg-gray-200 text-gray-800 text-sm"
                  >
                    Dismiss
                  </button>
                </>
              )}
              {rec.instructorAction && (
                <div className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded">
                  {rec.instructorAction === 'used' && '✓ Used'}
                  {rec.instructorAction === 'dismissed' && '⊘ Dismissed'}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

---

## API Route: Update Recommendation Status

**File:** `socratic-tutor/src/app/api/sessions/[sessionId]/recommendations/[recId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { sessionId: string; recId: string } }
) {
  try {
    const body = await req.json();
    const { instructorAction, instructorNote } = body;

    const updated = await prisma.teachingRecommendation.update({
      where: { id: params.recId },
      data: {
        instructorAction,
        instructorNote: instructorNote || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating recommendation:', error);
    return NextResponse.json(
      { error: 'Failed to update recommendation' },
      { status: 500 }
    );
  }
}
```

---

## Integration Checklist

- [ ] Update Prisma schema with `TeachingRecommendation` model
- [ ] Add `recommendations` relation to `Session` model
- [ ] Run `npx prisma db push` to migrate database
- [ ] Create `/api/sessions/[sessionId]/recommendations/route.ts`
- [ ] Create `/api/sessions/[sessionId]/recommendations/[recId]/route.ts`
- [ ] Update `/instructor/[sessionId]/misconceptions/page.tsx` with recommendations section
- [ ] Test recommendation generation on a session with 5+ clusters
- [ ] Verify Claude Sonnet prompt produces structured output
- [ ] Test parsing of [RECOMMENDATION_START]/[RECOMMENDATION_END] blocks
- [ ] Test detailed view toggle
- [ ] Test instructor actions (use, dismiss)
- [ ] Verify Minerva design system classes apply to recommendation cards
- [ ] Test on sessions with override clusters (acceptable_interpretation)
- [ ] Verify priority ranking (needs_discussion → severity → prevalence)

---

## Prompt Engineering Notes

1. **Cluster Context:** The prompt includes up to 8 top clusters, prioritizing by "needs_discussion" override, then severity, then prevalence. This ensures high-impact misconceptions get addressed.

2. **Transcript Context:** The system fetches and includes abbreviated transcripts from the first 5 students to ground recommendations in actual student language and reasoning patterns.

3. **Active Learning Constraint:** The prompt explicitly forbids "explain the concept again" and "review the material" — these are common but passive recommendations. It forces Claude to generate interactive, text-based activities.

4. **Time Bounds:** Each move specifies exact timing (5 min, 15 min, 30 min) to help instructors integrate into lesson plans.

5. **Facilitation Scripts:** The prompt requests exact scripts the instructor can read aloud, plus expected student responses and recovery strategies if misconceptions resurface.

6. **Fallback Parsing:** If Claude's response doesn't perfectly match the expected format, the parser gracefully degrades to extracting what it can and omitting unparseable sections.

---

## Data Flow

1. Instructor clicks "Generate Recommendations" on misconception dashboard
2. Frontend calls POST `/api/sessions/[sessionId]/recommendations`
3. API fetches aggregated clusters from Phase 3A
4. API filters out "acceptable_interpretation" overrides
5. API fetches student session context (transcripts)
6. API calls Claude Sonnet with structured prompt
7. Claude returns recommendations in [RECOMMENDATION_START]/[RECOMMENDATION_END] blocks
8. API parses and saves to database
9. Frontend receives data and renders activity cards
10. Instructor can mark recommendations as "used", "dismissed", or "edited"

---

## Misconception Overrides Integration

- Clusters marked as `acceptable_interpretation` are excluded from recommendations
- Clusters marked as `needs_discussion` are prioritized (moved to top of sort order)
- Overrides are fetched fresh at generation time to ensure recommendations reflect latest instructor feedback

---

## Two-Layer UI Rendering

**Summary View (checked off):**
- Shows only "What to Address" + evidence bullets
- Activities collapsed to hide implementation details
- For experienced instructors who just need the diagnostic summary

**Detailed View (default on):**
- Full activity cards with description and facilitation scripts
- Expandable move tabs (5 min / 15 min / 30 min)
- Confidence badge and action buttons
- For instructors who need step-by-step guidance

---

## Confidence Metric

Currently set to "medium" for all recommendations. Refinement opportunities:

- "High": Clusters with high prevalence (>50%), high severity, and explicit student misconceptions
- "Medium": Medium prevalence or severity, clear misconception
- "Low": Low prevalence or low severity, speculative recommendations

Update the parsing logic in `parseRecommendations()` to extract confidence if Claude includes it in response.

---

## Error Handling

- If Claude API fails, return HTTP 500 with error message
- If parsing fails, save partial recommendations with available fields
- If misconception aggregation fails, return early with helpful error
- If no relevant clusters (all marked acceptable_interpretation), return empty array with message

---

## Performance Considerations

- POST `/recommendations` is synchronous and can take 10-15 seconds (Claude Sonnet call)
- Consider adding a background job queue (e.g., Bull, RQ) for production to avoid timeout
- Recommendation generation is per-session; cache results in database to avoid regeneration
- GET `/recommendations` returns historical recommendations; no expiration
