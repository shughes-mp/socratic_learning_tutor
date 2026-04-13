import React from "react";

interface HeatmapProps {
  reportContent: string;
}

export function ReadinessHeatmap({ reportContent }: HeatmapProps) {
  // Extract the READINESS HEATMAP section
  const sectionRegex = /READINESS HEATMAP\s*([\s\S]*?)(?=MISCONCEPTIONS AND GAPS|PER-STUDENT SUMMARY|SESSION OVERVIEW|SUGGESTED TEACHING APPROACHES|$)/i;
  const match = reportContent.match(sectionRegex);

  if (!match || !match[1].trim()) {
    return <div className="text-slate-500 italic text-sm">No readiness data available.</div>;
  }

  const lines = match[1].trim().split('\n').filter(l => l.trim().length > 0);

  const parsedItems = lines.map(line => {
    // Attempt to parse "GREEN: Topic Name - explanation" or "- [GREEN] Topic: explanation"
    const lowerLine = line.toLowerCase();
    let status: "green" | "yellow" | "red" | "unknown" = "unknown";
    
    if (lowerLine.includes("green")) status = "green";
    else if (lowerLine.includes("yellow")) status = "yellow";
    else if (lowerLine.includes("red")) status = "red";

    return { rawText: line.replace(/^-\s*/, '').trim(), status };
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {parsedItems.map((item, idx) => {
        let badgeColor = "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
        let displayStatus = "UNKNOWN";
        
        switch (item.status) {
          case "green":
            badgeColor = "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800";
            displayStatus = "READY";
            break;
          case "yellow":
            badgeColor = "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800";
            displayStatus = "REVIEW";
            break;
          case "red":
            badgeColor = "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800";
            displayStatus = "CRITICAL";
            break;
        }

        return (
          <div key={idx} className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-md border uppercase tracking-wider ${badgeColor}`}>
              {displayStatus}
            </span>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {item.rawText}
            </p>
          </div>
        );
      })}
    </div>
  );
}
