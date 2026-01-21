import { err, ok, Result } from './result';
import { safeJsonParse } from './json';

export const readJson = <T>(key: string): Result<T | null> => {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return ok(null);
    const parsed = safeJsonParse<T>(raw);
    if (!parsed.ok) return parsed;
    return ok(parsed.value);
  } catch (error) {
    return err(`Failed to read localStorage key: ${key}`, error);
  }
};

export const writeJson = (key: string, value: unknown): Result<void> => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return ok(undefined);
  } catch (error) {
    return err(`Failed to write localStorage key: ${key}`, error);
  }
};
