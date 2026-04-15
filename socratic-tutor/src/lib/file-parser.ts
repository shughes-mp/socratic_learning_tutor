export type SupportedFileType = "pdf" | "docx" | "txt" | "md";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function getFileType(filename: string): SupportedFileType | null {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "pdf":
      return "pdf";
    case "docx":
      return "docx";
    case "txt":
      return "txt";
    case "md":
      return "md";
    default:
      return null;
  }
}

export function validateFile(
  filename: string,
  size: number
): { valid: boolean; error?: string } {
  const fileType = getFileType(filename);
  if (!fileType) {
    return {
      valid: false,
      error: `Unsupported file type. Accepted formats: .pdf, .docx, .txt, .md`,
    };
  }
  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File exceeds the 10MB size limit.`,
    };
  }
  return { valid: true };
}

export async function parseFile(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const fileType = getFileType(filename);

  switch (fileType) {
    case "pdf":
      return parsePdf(buffer);
    case "docx":
      return parseDocx(buffer);
    case "txt":
    case "md":
      return buffer.toString("utf-8");
    default:
      throw new Error(`Unsupported file type: ${filename}`);
  }
}

async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    await parser.destroy();
    const text = data.text.trim();
    if (!text || text.length < 20) {
      throw new Error(
        "This PDF looks like a scanned or image-based file. Please upload a text-based PDF, DOCX, TXT, or Markdown file instead."
      );
    }
    return text;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("scanned images") ||
        error.message.includes("scanned or image-based file"))
    ) {
      throw error;
    }
    throw new Error(
      "Failed to parse PDF. Please upload a text-based PDF, DOCX, TXT, or Markdown file instead."
    );
  }
}

async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  } catch {
    throw new Error(
      "Failed to parse DOCX. Please ensure the file is a valid Word document."
    );
  }
}
