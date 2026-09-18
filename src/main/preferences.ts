import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
export type ThemeChoice = 'light' | 'dark';
export class Preferences {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private directory: string) {}
  async getTheme(): Promise<ThemeChoice | null> {
    try {
      const data = JSON.parse(await readFile(join(this.directory, 'preferences.json'), 'utf8'));
      return data.theme === 'dark' || data.theme === 'light' ? data.theme : null;
    } catch { return null; }
  }
  setTheme(theme: unknown): Promise<void> {
    if (theme !== 'dark' && theme !== 'light') return Promise.reject(new Error('无效的主题选择'));
    // Serialize rapid toggles so the last choice always wins on disk.
    const save = this.queue.then(async () => {
      await mkdir(this.directory, { recursive: true });
      const pending = join(this.directory, 'preferences.pending.json');
      await writeFile(pending, JSON.stringify({ theme }), 'utf8');
      await rename(pending, join(this.directory, 'preferences.json'));
    });
    this.queue = save.catch(() => {});
    return save;
  }
}
