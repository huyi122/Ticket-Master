# VIP Ticket Master

本项目是一个本地运行的活动票务管理与验证工具，支持：
- 事件创建、票据生成/导入/编辑/删除
- 票据验证（含扫码支持）、状态更新
- 本地 JSON 备份/恢复
- Firebase 云端备份/恢复（Fire Backup/Fire Restore）

## 快速开始
```bash
npm install
npm run dev   # 开发模式
npm run build # 生产构建
```

## 基础功能
- Validator 模式：无需登录，直接验证票据。
- Manager 模式：需输入代码中配置的密码后，可创建/管理事件与票据。
- 本地备份/恢复：下载/导入 JSON 文件。
- 事件列表：Active / Archived 页签切换。

## Firebase 备份/恢复（可选）
如果不配置 Firebase，Fire Backup/Restore 按钮会禁用，不影响本地备份。

### 1) 在 Firebase 控制台创建项目并启用服务
1. 进入 [Firebase 控制台](https://console.firebase.google.com/) 创建项目。
2. 左侧 Authentication → “开始使用” → 启用 “匿名登录” （或配置 Email/Google 登录，跨设备建议用持久账号）。
3. 左侧 Storage → 创建默认存储桶。
4. 设置 Storage 规则（示例：仅允许用户访问自己的备份路径）：
   ```js
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /backups/{userId}/{fileId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

### 2) 获取 Web 配置（API Key 等）
1. 项目概览 → “添加应用” → 选择 Web → 注册应用。
2. 在代码片段中找到 `apiKey`, `authDomain`, `projectId`, `storageBucket`, `appId`。

### 3) 配置本地环境变量
在项目根目录创建 `.env`（或 `.env.local`），填入：
```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_APP_ID=your-app-id
```
保存后重启 `npm run dev`。

### 4) 使用
- “Fire Backup”：将当前事件/票据 JSON 上传至 `backups/{uid}/vip-ticket-backup-YYYY-MM-DD-HH-MM.json`。
- “Fire Restore”：从云端获取当前用户路径下按文件名排序的最新备份并覆盖本地数据。
- 状态指示：Firebase Ready/Auth/Error 会显示在标题区域；未就绪时按钮禁用。

### 5) 跨设备接力
- 需使用同一 Firebase 账号（匿名账号换设备 UID 会变，无法共享备份）。
- 上传前确认网络正常，恢复会覆盖本地数据。

## 其他
- 代码中 Manager 密码常量位于 `App.tsx` (`MANAGER_PASSWORD`)，可自行修改。
- 依赖：React 19、Vite、Firebase JS SDK、Recharts、lucide-react。
