import { err, ok, Result } from './result';

export const safeJsonParse = <T>(text: string): Result<T> => {
  try {
    return ok(JSON.parse(text) as T);
  } catch (error) {
    return err('Failed to parse JSON', error);
  }
};
