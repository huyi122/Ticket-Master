import { err, ok, Result } from './result';

export const downloadJson = (filename: string, data: unknown): Result<void> => {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return ok(undefined);
  } catch (error) {
    return err('Failed to download JSON', error);
  }
};
