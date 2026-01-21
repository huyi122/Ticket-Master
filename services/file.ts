import { err, ok, Result } from './result';

export const readTextFile = (file: File): Promise<Result<string>> => {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        resolve(ok((event.target?.result as string) ?? ''));
      };
      reader.onerror = () => {
        resolve(err('Failed to read file', reader.error));
      };
      reader.readAsText(file);
    } catch (error) {
      resolve(err('Failed to read file', error));
    }
  });
};
