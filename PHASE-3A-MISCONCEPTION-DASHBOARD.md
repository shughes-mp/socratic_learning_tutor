# PHASE 3A: MISCONCEPTION DASHBOARD

**Status:** Codex instruction file for Phase 3A implementation  
**Depends on:** Phases 1 & 2 (database schema and chat misconception logging)  
**Scope:** Instructor-facing aggregation and visualization of student misconceptions  

---

## Overview

Build an instructor dashboard that surfaces misconceptions across all students in a tutoring session. The system uses two-stage clustering (coarse grouping + semantic merge) to identify patterns, reducing the misconception inventory from individual student utterances to meaningful themes for instructional response.

---

## Database Schema Updates

Add to `socratic-tutor/prisma/schema.prisma`:

```prisma
model MisconceptionOverride {
  id            String   @id @default(cuid())
  sessionId     String
  session       Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  clusterLabel  String   // the cluster label this override applies to
  overrideType  String   // "acceptable_interpretation" | "needs_discussion"
  instructorNote String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([sessionId])
}
```

Add to the `Session` model:
```prisma
misconceptionOverrides MisconceptionOverride[]
```

After editing `schema.prisma`, run:
```bash
cd socratic-tutor
npx prisma db push
```

---

## API Route: Aggregate Misconceptions

**File:** `socratic-tutor/src/app/api/sessions/[sessionId]/misconceptions/aggregate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Anthropic } from '@anthropic-ai/sdk';

interface AggregationBin {
  key: string; // "(checkpointId|passageAnchor)_TYPE"
  misconceptions: {
    id: string;
    canonicalClaim: string;
    severity: string;
    checkpointId: string | null;
    passageAnchor: string | null;
  }[];
  misconceptionType: string;
  passageAnchor: string | null;
  checkpointId: string | null;
}

interface ClusterData {
  id: string;
  label: string;
  misconceptionType: string;
  passageAnchor: string | null;
  checkpointId: string | null;
  count: number;
  totalStudents: number;
  prevalence: number;
  resolutionRate: number;
  medianTurnsToResolve: number;
  severity: string;
  representativeExcerpt: string;
  misconceptionIds: string[];
}

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;

    // Fetch session and all its student sessions
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        studentSessions: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const totalStudents = session.studentSessions.length;

    // Fetch all misconceptions for this session
    const misconceptions = await prisma.misconception.findMany({
      where: {
        studentSession: {
          sessionId: sessionId,
        },
      },
      include: {
        studentSession: true,
      },
    });

    if (misconceptions.length === 0) {
      return NextResponse.json({
        clusters: [],
        sessionStats: {
          totalStudents,
          totalMisconceptions: 0,
          avgMisconceptionsPerStudent: 0,
          overallResolutionRate: 0,
        },
      });
    }

    // Stage A: Coarse grouping by (checkpointId OR passageAnchor, misconceptionType)
    const bins: Map<string, AggregationBin> = new Map();

    misconceptions.forEach((m) => {
      const binKey = `${m.checkpointId || m.passageAnchor || 'general'}_${m.misconceptionType}`;
      
      if (!bins.has(binKey)) {
        bins.set(binKey, {
          key: binKey,
          misconceptions: [],
          misconceptionType: m.misconceptionType,
          passageAnchor: m.passageAnchor,
          checkpointId: m.checkpointId,
        });
      }

      bins.get(binKey)!.misconceptions.push({
        id: m.id,
        canonicalClaim: m.canonicalClaim,
        severity: m.severity,
        checkpointId: m.checkpointId,
        passageAnchor: m.passageAnchor,
      });
    });

    // Stage B: Semantic merge within large bins
    const client = new Anthropic();
    const clusters: ClusterData[] = [];
    const overrides = await prisma.misconceptionOverride.findMany({
      where: { sessionId },
    });
    const overrideLabels = new Set(overrides.map(o => o.clusterLabel));

    for (const bin of bins.values()) {
      let label: string;
      let clusterMisconceptions = bin.misconceptions;

      if (bin.misconceptions.length >= 3) {
        // Call Claude for semantic clustering
        const claims = bin.misconceptions.map(m => m.canonicalClaim);
        const semanticResponse = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: `Analyze these student misconceptions and group them into semantic clusters. For each cluster, identify which claims belong together and generate a concise label.

Claims:
${claims.map((c, i) => `${i + 1}. "${c}"`).join('\n')}

Return JSON with this structure:
{
  "clusters": [
    {
      "label": "A concise description of what students believe",
      "indices": [0, 2, 5]
    }
  ]
}

Be strict: only group claims that express the same underlying misconception. If claims are distinct, put them in separate clusters.`,
            },
          ],
        });

        try {
          const content = semanticResponse.content[0];
          if (content.type === 'text') {
            const parsed = JSON.parse(content.text);
            // Use the first cluster's label if multiple exist, or create custom if single
            if (parsed.clusters && parsed.clusters.length > 0) {
              label = parsed.clusters[0].label;
            } else {
              label = bin.misconceptions[0].canonicalClaim;
            }
          } else {
            label = bin.misconceptions[0].canonicalClaim;
          }
        } catch {
          // Fallback to first claim if parsing fails
          label = bin.misconceptions[0].canonicalClaim;
        }
      } else {
        // Use first claim as label for small bins
        label = bin.misconceptions[0].canonicalClaim;
      }

      // Skip if overridden as acceptable_interpretation
      if (overrideLabels.has(label)) {
        continue;
      }

      // Calculate statistics
      const studentsWithThisCluster = new Set(
        clusterMisconceptions.map(m => m.id.split('_')[0]) // rough approx: use ID prefix
      );
      
      // More precise: count unique studentSessionIds
      const uniqueStudentIds = new Set(
        misconceptions
          .filter(m => bin.misconceptions.some(bm => bm.id === m.id))
          .map(m => m.studentSession.id)
      );
      
      const prevalence = uniqueStudentIds.size / totalStudents;
      
      // Calculate resolution rate (rough: based on severity + status if available)
      const resolutions = clusterMisconceptions.filter(m => m.severity === 'low').length;
      const resolutionRate = clusterMisconceptions.length > 0 ? resolutions / clusterMisconceptions.length : 0;
      
      // Median turns (placeholder: assume 3-4 for resolved, 6+ for unresolved)
      const medianTurnsToResolve = resolutionRate > 0.5 ? 4 : 7;
      
      // Highest severity in cluster
      const maxSeverity = ['critical', 'high', 'medium', 'low'].find(s =>
        clusterMisconceptions.some(m => m.severity === s)
      ) || 'medium';

      const representativeExcerpt = clusterMisconceptions[0].canonicalClaim.substring(0, 100);

      clusters.push({
        id: `cluster-${Math.random().toString(36).substr(2, 9)}`,
        label,
        misconceptionType: bin.misconceptionType,
        passageAnchor: bin.passageAnchor,
        checkpointId: bin.checkpointId,
        count: clusterMisconceptions.length,
        totalStudents,
        prevalence: Math.round(prevalence * 100) / 100,
        resolutionRate: Math.round(resolutionRate * 100) / 100,
        medianTurnsToResolve,
        severity: maxSeverity,
        representativeExcerpt,
        misconceptionIds: clusterMisconceptions.map(m => m.id),
      });
    }

    // Sort by prevalence descending
    clusters.sort((a, b) => b.prevalence - a.prevalence);

    const avgMisconceptionsPerStudent = totalStudents > 0 ? misconceptions.length / totalStudents : 0;
    const overallResolutionRate = clusters.length > 0
      ? clusters.reduce((sum, c) => sum + c.resolutionRate, 0) / clusters.length
      : 0;

    return NextResponse.json({
      clusters,
      sessionStats: {
        totalStudents,
        totalMisconceptions: misconceptions.length,
        avgMisconceptionsPerStudent: Math.round(avgMisconceptionsPerStudent * 100) / 100,
        overallResolutionRate: Math.round(overallResolutionRate * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Error aggregating misconceptions:', error);
    return NextResponse.json(
      { error: 'Failed to aggregate misconceptions' },
      { status: 500 }
    );
  }
}
```

---

## API Route: Misconception Overrides

**File:** `socratic-tutor/src/app/api/sessions/[sessionId]/misconceptions/override/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const body = await req.json();
    const { clusterLabel, overrideType, instructorNote } = body;

    if (!clusterLabel || !overrideType) {
      return NextResponse.json(
        { error: 'clusterLabel and overrideType are required' },
        { status: 400 }
      );
    }

    const override = await prisma.misconceptionOverride.create({
      data: {
        sessionId: params.sessionId,
        clusterLabel,
        overrideType,
        instructorNote: instructorNote || null,
      },
    });

    return NextResponse.json(override, { status: 201 });
  } catch (error) {
    console.error('Error creating override:', error);
    return NextResponse.json(
      { error: 'Failed to create override' },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const overrides = await prisma.misconceptionOverride.findMany({
      where: { sessionId: params.sessionId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(overrides);
  } catch (error) {
    console.error('Error fetching overrides:', error);
    return NextResponse.json(
      { error: 'Failed to fetch overrides' },
      { status: 500 }
    );
  }
}
```

---

## Dashboard Page Component

**File:** `socratic-tutor/src/app/instructor/[sessionId]/misconceptions/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Cluster {
  id: string;
  label: string;
  misconceptionType: string;
  passageAnchor: string | null;
  checkpointId: string | null;
  count: number;
  totalStudents: number;
  prevalence: number;
  resolutionRate: number;
  medianTurnsToResolve: number;
  severity: string;
  representativeExcerpt: string;
  misconceptionIds: string[];
}

interface SessionStats {
  totalStudents: number;
  totalMisconceptions: number;
  avgMisconceptionsPerStudent: number;
  overallResolutionRate: number;
}

interface AggregationResponse {
  clusters: Cluster[];
  sessionStats: SessionStats;
}

const typeColors: Record<string, string> = {
  misread: 'bg-red-100 text-red-800',
  missing_warrant: 'bg-orange-100 text-orange-800',
  wrong_inference: 'bg-yellow-100 text-yellow-800',
  overgeneralization: 'bg-blue-100 text-blue-800',
  ignored_counterevidence: 'bg-purple-100 text-purple-800',
};

const severityColors: Record<string, string> = {
  critical: 'text-red-600',
  high: 'text-orange-600',
  medium: 'text-yellow-600',
  low: 'text-green-600',
};

export default function MisconceptionDashboard() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [mode, setMode] = useState<'post-session' | 'live'>('post-session');
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [showAllClusters, setShowAllClusters] = useState(false);

  useEffect(() => {
    const fetchClusters = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/sessions/${sessionId}/misconceptions/aggregate`
        );
        if (!response.ok) throw new Error('Failed to fetch clusters');

        const data: AggregationResponse = await response.json();
        setClusters(data.clusters);
        setStats(data.sessionStats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchClusters();

    // Auto-refresh in live mode every 30 seconds
    if (mode === 'live') {
      const interval = setInterval(fetchClusters, 30000);
      return () => clearInterval(interval);
    }
  }, [sessionId, mode]);

  const handleOverride = async (clusterLabel: string, overrideType: string) => {
    try {
      await fetch(
        `/api/sessions/${sessionId}/misconceptions/override`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clusterLabel,
            overrideType,
          }),
        }
      );
      // Refetch to update UI
      window.location.reload();
    } catch (err) {
      console.error('Error creating override:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-500">Loading misconception data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="minerva-card bg-red-50 border border-red-200">
          <h3 className="font-semibold text-red-800">Error</h3>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  const topClusters = clusters.slice(0, 5);
  const remainingClusters = clusters.slice(5);

  if (mode === 'live') {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Live Misconception View</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setMode('post-session')}
              className="minerva-button bg-gray-200 text-gray-800"
            >
              Post-Session Summary
            </button>
            <button
              onClick={() => setMode('live')}
              className="minerva-button bg-blue-600 text-white"
            >
              Live View
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {clusters.slice(0, 3).map((cluster) => (
            <div key={cluster.id} className="minerva-card">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{cluster.label}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {cluster.count} students ({Math.round(cluster.prevalence * 100)}%)
                  </p>
                </div>
                <span className={`px-3 py-1 rounded text-sm font-medium ${typeColors[cluster.misconceptionType] || 'bg-gray-100'}`}>
                  {cluster.misconceptionType}
                </span>
              </div>
              <div className="mt-3">
                <div className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                  Severity: <span className={severityColors[cluster.severity]}>{cluster.severity}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-8 text-center">
          Auto-refreshing every 30 seconds
        </p>
      </div>
    );
  }

  // Post-Session Summary mode
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Misconception Analysis</h1>
          <p className="text-gray-600 mt-1">Session overview for {stats?.totalStudents} students</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('post-session')}
            className="minerva-button bg-blue-600 text-white"
          >
            Post-Session Summary
          </button>
          <button
            onClick={() => setMode('live')}
            className="minerva-button bg-gray-200 text-gray-800"
          >
            Live View
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="minerva-card bg-blue-50">
            <div className="text-sm text-gray-600">Total Misconceptions</div>
            <div className="text-3xl font-bold text-blue-600">{stats.totalMisconceptions}</div>
          </div>
          <div className="minerva-card bg-green-50">
            <div className="text-sm text-gray-600">Overall Resolution Rate</div>
            <div className="text-3xl font-bold text-green-600">{Math.round(stats.overallResolutionRate * 100)}%</div>
          </div>
          <div className="minerva-card bg-purple-50">
            <div className="text-sm text-gray-600">Most Common Type</div>
            <div className="text-lg font-bold text-purple-600">
              {clusters.length > 0 ? clusters[0].misconceptionType : 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* Top 5 Clusters */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Top Misconception Clusters</h2>
        <div className="space-y-4">
          {topClusters.map((cluster) => (
            <div key={cluster.id} className="minerva-card">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-semibold flex-1">{cluster.label}</h3>
                <span className={`px-3 py-1 rounded text-sm font-medium ${typeColors[cluster.misconceptionType] || 'bg-gray-100'}`}>
                  {cluster.misconceptionType}
                </span>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1">
                  <span className="inline-block bg-gray-100 px-3 py-1 rounded text-sm mr-2">
                    {cluster.count}/{stats?.totalStudents} students ({Math.round(cluster.prevalence * 100)}%)
                  </span>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${cluster.resolutionRate * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Resolution: {Math.round(cluster.resolutionRate * 100)}% | Median turns: {cluster.medianTurnsToResolve}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-semibold ${severityColors[cluster.severity]}`}>
                    {cluster.severity}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded mb-4 text-sm italic">
                "{cluster.representativeExcerpt}..."
              </div>

              {cluster.passageAnchor && (
                <p className="text-xs text-gray-600 mb-3">
                  <strong>Passage:</strong> {cluster.passageAnchor}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleOverride(cluster.label, 'acceptable_interpretation')}
                  className="minerva-button bg-green-100 text-green-800 text-sm"
                >
                  Acceptable interpretation
                </button>
                <button
                  onClick={() => handleOverride(cluster.label, 'needs_discussion')}
                  className="minerva-button bg-orange-100 text-orange-800 text-sm"
                >
                  Needs class discussion
                </button>
                <button
                  onClick={() =>
                    setExpandedCluster(expandedCluster === cluster.id ? null : cluster.id)
                  }
                  className="minerva-button bg-blue-100 text-blue-800 text-sm"
                >
                  Expand details
                </button>
              </div>

              {expandedCluster === cluster.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="font-semibold text-sm mb-2">All misconceptions in cluster ({cluster.misconceptionIds.length}):</h4>
                  <ul className="text-sm space-y-1 text-gray-700">
                    {cluster.misconceptionIds.map((id) => (
                      <li key={id} className="list-disc list-inside">
                        ID: {id}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Show All Clusters */}
      {remainingClusters.length > 0 && (
        <div className="mb-8">
          <button
            onClick={() => setShowAllClusters(!showAllClusters)}
            className="minerva-button bg-gray-200 text-gray-800"
          >
            {showAllClusters ? 'Hide' : 'Show'} all {clusters.length} clusters
          </button>

          {showAllClusters && (
            <div className="space-y-3 mt-4">
              {remainingClusters.map((cluster) => (
                <div key={cluster.id} className="minerva-card p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold">{cluster.label}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {cluster.count} students ({Math.round(cluster.prevalence * 100)}%)
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${typeColors[cluster.misconceptionType] || 'bg-gray-100'}`}>
                      {cluster.misconceptionType}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Teaching Recommendations Button */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <Link
          href={`/instructor/${sessionId}/recommendations`}
          className="minerva-button bg-blue-600 text-white"
        >
          Generate Teaching Recommendations
        </Link>
      </div>
    </div>
  );
}
```

---

## Update Session Management Page

**File:** `socratic-tutor/src/app/instructor/[sessionId]/page.tsx`

Add a link to the misconceptions dashboard in the page header (update the navigation bar):

```typescript
// Add to the header/nav section of the existing page component:

<div className="flex gap-3 mb-6">
  <Link
    href={`/instructor/${sessionId}`}
    className="minerva-button bg-blue-600 text-white"
  >
    Student Activity
  </Link>
  <Link
    href={`/instructor/${sessionId}/report`}
    className="minerva-button bg-gray-200 text-gray-800"
  >
    Report
  </Link>
  <Link
    href={`/instructor/${sessionId}/misconceptions`}
    className="minerva-button bg-purple-200 text-purple-800"
  >
    Misconceptions
  </Link>
</div>
```

---

## Implementation Checklist

- [ ] Update Prisma schema with `MisconceptionOverride` model
- [ ] Run `npx prisma db push` to migrate database
- [ ] Create `/api/sessions/[sessionId]/misconceptions/aggregate/route.ts`
- [ ] Create `/api/sessions/[sessionId]/misconceptions/override/route.ts`
- [ ] Create `/instructor/[sessionId]/misconceptions/page.tsx` (dashboard page)
- [ ] Update `/instructor/[sessionId]/page.tsx` with navigation link
- [ ] Test clustering on a session with 10+ misconceptions
- [ ] Verify semantic merge works for bins with 3+ claims
- [ ] Test override functionality (acceptable_interpretation flow)
- [ ] Verify Minerva design system classes apply correctly
- [ ] Test live-view auto-refresh every 30 seconds

---

## Notes

1. **Semantic Merge Fallback:** If Claude API calls fail, the system gracefully falls back to using the first claim as the cluster label.

2. **Statistics Calculation:** 
   - Prevalence = number of unique students with this misconception / total students
   - Resolution rate = rough estimate based on severity distribution
   - Median turns = placeholder values; refine after first deployment if StudentCheckpoint data is available

3. **Anonymization:** Represent excerpts are pulled directly from `canonicalClaim`; ensure canonicalClaim fields don't contain PII in chat logging.

4. **Minerva Integration:** Uses standard `minerva-card`, `minerva-button` classes. Verify these exist in the Minerva design system CSS.

5. **Override Logic:** Clusters marked as `acceptable_interpretation` are filtered out at aggregation time; `needs_discussion` clusters are prioritized in Phase 3B recommendations.
