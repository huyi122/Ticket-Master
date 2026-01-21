export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; message: string; error?: unknown };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const err = (message: string, error?: unknown): Result<never> => ({
  ok: false,
  message,
  error,
});
