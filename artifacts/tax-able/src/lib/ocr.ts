import { spawn } from "node:child_process";

export const OCR_NATIVE_WORD_THRESHOLD = 25;

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function pageNeedsOcr(nativeText: string): boolean {
  return wordCount(nativeText) < OCR_NATIVE_WORD_THRESHOLD;
}

/** OCR only replaces sparse native text when it recovers materially more content. */
export function selectBestPageText(
  nativeText: string,
  ocrText: string,
): { text: string; usedOcr: boolean } {
  const nativeWords = wordCount(nativeText);
  const ocrWords = wordCount(ocrText);
  if (ocrWords >= Math.max(10, nativeWords * 1.5))
    return { text: ocrText.trim(), usedOcr: true };
  return { text: nativeText.trim(), usedOcr: false };
}

export async function runTesseractOcr(
  png: Uint8Array,
  timeoutMs = 45_000,
): Promise<string> {
  const executable = process.env.TESSERACT_PATH || "tesseract";

  return new Promise((resolve, reject) => {
    const child = spawn(
      executable,
      ["stdin", "stdout", "--dpi", "300", "--psm", "6", "-l", "eng"],
      {
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(Buffer.concat(stdout).toString("utf8").trim());
    };

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error(`OCR timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    timeout.unref();

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (code === 0) finish();
      else
        finish(
          new Error(
            `OCR failed with exit code ${code}: ${Buffer.concat(stderr).toString("utf8").trim()}`,
          ),
        );
    });

    child.stdin.end(Buffer.from(png));
  });
}
