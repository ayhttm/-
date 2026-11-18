export async function fetchJsonWithRetry<T = any>(
  url: string,
  options?: RequestInit,
  maxRetries = 2
): Promise<{ ok: boolean; status: number; data: T }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      const rawText = await res.text();

      try {
        const parsed = rawText ? (JSON.parse(rawText) as T) : ({} as T);
        return { ok: res.ok, status: res.status, data: parsed };
      } catch {
        const isTransientStatus =
          res.status === 502 || res.status === 503 || res.status === 504 || res.status === 404;

        if (attempt < maxRetries && isTransientStatus) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }

        const preview = rawText.replace(/\s+/g, ' ').trim().slice(0, 80);
        throw new Error(
          `เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง (HTTP ${res.status}${preview ? `: ${preview}` : ''}) กรุณารีเฟรชหน้าเว็บแล้วลองใหม่อีกครั้ง`
        );
      }
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isNetworkError =
        lastError.name === 'TypeError' ||
        lastError.message.includes('Failed to fetch') ||
        lastError.message.includes('NetworkError');

      if (attempt < maxRetries && isNetworkError) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError || new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
}
