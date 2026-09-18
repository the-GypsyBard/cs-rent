export type ThemeChoice = 'light' | 'dark';
export async function initialTheme(): Promise<ThemeChoice> {
  try {
    const saved = await window.desktop?.preferences.getTheme();
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* Older prototypes can migrate their browser preference. */ }
  try { return localStorage.getItem('cs-rent-theme') === 'dark' ? 'dark' : 'light'; }
  catch { return 'light'; }
}
export async function rememberTheme(theme: ThemeChoice) {
  let localSaved = false;
  try { localStorage.setItem('cs-rent-theme', theme); localSaved = true; } catch {}
  if (window.desktop?.preferences) {
    const result = await window.desktop.preferences.setTheme(theme);
    if (!result.ok) throw new Error('主题偏好保存失败，请检查用户数据目录是否可写。');
  } else if (!localSaved) throw new Error('主题偏好保存失败，请检查浏览器存储权限。');
}
