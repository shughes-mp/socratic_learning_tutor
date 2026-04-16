"use client";

import React from "react";
import { getHeatmapTitle } from "@/lib/session-purpose";

interface HeatmapItem {
  topic: string;
  status: "green" | "yellow" | "red";
  explanation: string;
}

interface HeatmapProps {
  reportContent: string;
  sessionPurpose?: string | null;
}

// Matches lines like: - **Topic name**: [GREEN] explanation
// or: - Topic name: [YELLOW] explanation
const STRUCTURED_REGEX = /[-*]\s*\*{0,2}([^*\n:]+?)\*{0,2}\s*:\s*\[(GREEN|YELLOW|RED)\]\s*(.+)/gi;

// Fallback: find any line containing GREEN/YELLOW/RED (handles freeform prose)
const FALLBACK_REGEX = /^[-*•]?\s*(.+?)\s*[:\-–]\s*\[(GREEN|YELLOW|RED)\]\s*(.+)/gim;

function parseHeatmapItems(content: string, heatmapTitle: string): HeatmapItem[] {
  // Extract just the heatmap section
  // Match the section title (e.g. READINESS HEATMAP, ACTIVATION HEATMAP, etc.)
  const escapedTitle = heatmapTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionRegex = new RegExp(
    `${escapedTitle}\\s*([\\s\\S]*?)(?=\\n##?\\s+[A-Z]|\\nWHAT YOUR|\\nWHERE YOUR|\\nWHAT TO DO|\\nPER-STUDENT|\\nLEARNING OUTCOME|$)`,
    "i"
  );
  const sectionMatch = content.match(sectionRegex);
  const sectionContent = sectionMatch?.[1] ?? content;

  // Try structured regex first
  const items: HeatmapItem[] = [];
  let match: RegExpExecArray | null;

  STRUCTURED_REGEX.lastIndex = 0;
  while ((match = STRUCTURED_REGEX.exec(sectionContent)) !== null) {
    items.push({
      topic: match[1].trim(),
      status: match[2].toLowerCase() as HeatmapItem["status"],
      explanation: match[3].trim(),
    });
  }

  if (items.length > 0) return items;

  // Fallback: looser matching
  FALLBACK_REGEX.lastIndex = 0;
  while ((match = FALLBACK_REGEX.exec(sectionContent)) !== null) {
    items.push({
      topic: match[1].trim(),
      status: match[2].toLowerCase() as HeatmapItem["status"],
      explanation: match[3].trim(),
    });
  }

  if (items.length > 0) return items;

  // Last resort: scan for GREEN/YELLOW/RED keywords per line
  const lines = sectionContent.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    const lower = line.toLowerCase();
    let status: HeatmapItem["status"] | null = null;
    if (lower.includes("[green]") || lower.startsWith("green")) status = "green";
    else if (lower.includes("[yellow]") || lower.startsWith("yellow")) status = "yellow";
    else if (lower.includes("[red]") || lower.startsWith("red")) status = "red";
    if (status) {
      items.push({ topic: "", status, explanation: line.replace(/^[-*•]\s*/, "").trim() });
    }
  }

  return items;
}

const STATUS_CONFIG = {
  green: {
    badge: "bg-[rgba(96,140,34,0.12)] text-[#5b7f22] border-[rgba(96,140,34,0.22)]",
    dot: "bg-[#5b7f22]",
    label: "Ready for class",
  },
  yellow: {
    badge: "bg-[rgba(144,111,18,0.10)] text-[#906f12] border-[rgba(144,111,18,0.22)]",
    dot: "bg-[#906f12]",
    label: "Gaps remain",
  },
  red: {
    badge: "bg-[rgba(223,47,38,0.08)] text-[var(--signal)] border-[rgba(223,47,38,0.20)]",
    dot: "bg-[var(--signal)]",
    label: "Not yet ready",
  },
};

export function ReadinessHeatmap({ reportContent, sessionPurpose }: HeatmapProps) {
  const heatmapTitle = getHeatmapTitle(sessionPurpose) ?? "Readiness Heatmap";
  const upperTitle = heatmapTitle.toUpperCase();
  const items = parseHeatmapItems(reportContent, upperTitle);

  if (items.length === 0) {
    return (
      <p className="text-sm italic text-[var(--dim-grey)]">
        Heatmap data not available for this report. Regenerate the brief to include it.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.map((item, idx) => {
        const config = STATUS_CONFIG[item.status];
        return (
          <div
            key={idx}
            className="flex items-start gap-3 rounded-xl border border-[var(--rule)] bg-white p-4"
          >
            <span
              className={`mt-0.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${config.badge} flex-shrink-0`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
              {config.label}
            </span>
            <div className="min-w-0">
              {item.topic && (
                <p className="text-sm font-semibold text-[var(--charcoal)]">{item.topic}</p>
              )}
              <p className="mt-0.5 text-sm leading-5 text-[var(--dim-grey)]">{item.explanation}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
