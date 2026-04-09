import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateInstructorReport } from "@/lib/report-generator";

export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const p = await params;
    const { sessionId } = p;

    // Check for cached report
    const latestReport = await prisma.report.findFirst({
      where: { sessionId },
      orderBy: { generatedAt: "desc" },
    });

    if (latestReport) {
      // Check if it's less than 5 minutes old
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (latestReport.generatedAt > fiveMinsAgo) {
        // Also check if any new messages were added since the report was generated
        const latestMessage = await prisma.message.findFirst({
          where: { studentSession: { sessionId } },
          orderBy: { createdAt: "desc" },
        });

        if (!latestMessage || latestMessage.createdAt <= latestReport.generatedAt) {
          return NextResponse.json(latestReport);
        }
      }
    }

    // Generate new report
    const newReport = await generateInstructorReport(sessionId);
    return NextResponse.json(newReport);

  } catch (error: any) {
    console.error("Report generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate report", details: error.message },
      { status: 500 }
    );
  }
}
