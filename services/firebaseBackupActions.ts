import type { BackupDataV1, EventData, Ticket } from '../types';
import { getFirebaseServices } from './firebaseClient';
import { err, ok, Result } from './result';
import { safeJsonParse } from './json';
import { isBackupDataV1, buildBackupDataV1, makeFirebaseBackupFilename } from './backup';
import { ref as storageRef, uploadBytes, listAll, getBytes, type StorageReference } from 'firebase/storage';
import type { User } from 'firebase/auth';

export type FireStatus = 'off' | 'authenticating' | 'ready' | 'error' | 'needs_auth';

export const decodeBackupBytes = (bytes: Uint8Array): Result<BackupDataV1> => {
  try {
    const text = new TextDecoder().decode(bytes);
    const parsed = safeJsonParse<unknown>(text);
    if (!parsed.ok) {
      const parseError = 'error' in parsed ? parsed.error : undefined;
      return err('备份格式不正确。', parseError);
    }
    if (!isBackupDataV1(parsed.value)) return err('备份格式不正确。');
    return ok(parsed.value);
  } catch (error) {
    return err('备份格式不正确。', error);
  }
};

export const pickLatestByName = (items: StorageReference[]): StorageReference | null => {
  if (!items.length) return null;
  return items.sort((a, b) => a.name.localeCompare(b.name)).slice(-1)[0] ?? null;
};

export const ensureFireReady = (input: {
  fireStatus: FireStatus;
  fireError: string;
  fireUser: User | null;
}): Result<{ services: NonNullable<ReturnType<typeof getFirebaseServices>>; user: User }> => {
  const services = getFirebaseServices();
  if (!services || input.fireStatus === 'off') {
    return err('Firebase 未配置，无法使用 Fire Backup。请先在 Vite 环境变量中填写 Firebase 配置信息。');
  }
  if (input.fireStatus === 'error') {
    return err(`Firebase 连接异常：${input.fireError || '未知错误'}`);
  }
  if (input.fireStatus === 'needs_auth') {
    return err('请先用 Google 登录后再使用 Fire 功能。');
  }
  if (!input.fireUser) {
    return err('尚未登录 Firebase，稍后再试。');
  }
  return ok({ services, user: input.fireUser });
};

export const fireUploadBackup = async (input: {
  events: EventData[];
  tickets: Ticket[];
  fireStatus: FireStatus;
  fireError: string;
  fireUser: User | null;
}): Promise<Result<{ fileName: string }>> => {
  const ready = ensureFireReady({
    fireStatus: input.fireStatus,
    fireError: input.fireError,
    fireUser: input.fireUser,
  });
  if (!ready.ok) {
    return err(
      'message' in ready ? ready.message : '上传失败，请检查网络或 Firebase 配置。',
      'error' in ready ? ready.error : undefined,
    );
  }

  try {
    const now = new Date();
    const fileName = makeFirebaseBackupFilename(now);
    const data = buildBackupDataV1(input.events, input.tickets);

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const fileRef = storageRef(ready.value.services.storage, `backups/${ready.value.user.uid}/${fileName}`);
    await uploadBytes(fileRef, blob, { contentType: 'application/json' });
    return ok({ fileName });
  } catch (error) {
    console.error('Fire backup failed', error);
    return err('上传失败，请检查网络或 Firebase 配置。', error);
  }
};

export const fireRestoreLatest = async (input: {
  fireStatus: FireStatus;
  fireError: string;
  fireUser: User | null;
}): Promise<Result<{ backup: BackupDataV1; name: string }>> => {
  const ready = ensureFireReady({
    fireStatus: input.fireStatus,
    fireError: input.fireError,
    fireUser: input.fireUser,
  });
  if (!ready.ok) {
    return err(
      'message' in ready ? ready.message : '下载失败，请检查网络或 Firebase 配置。',
      'error' in ready ? ready.error : undefined,
    );
  }

  try {
    const folderRef = storageRef(ready.value.services.storage, `backups/${ready.value.user.uid}`);
    const list = await listAll(folderRef);
    if (!list.items.length) {
      return err('云端没有可用备份。');
    }

    const latest = pickLatestByName(list.items);
    if (!latest) return err('云端没有可用备份。');

    const bytes = await getBytes(latest);
    const decoded = decodeBackupBytes(new Uint8Array(bytes));
    if (!decoded.ok) {
      return err(
        'message' in decoded ? decoded.message : '备份格式不正确。',
        'error' in decoded ? decoded.error : undefined,
      );
    }

    return ok({ backup: decoded.value, name: latest.name });
  } catch (error) {
    console.error('Fire restore failed', error);
    return err('下载失败，请检查网络或 Firebase 配置。', error);
  }
};
