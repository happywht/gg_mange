# 智能登录助手（纯前端静态版）

自托管的 Google 账号管理工具，支持两步验证 (2FA/TOTP) 动态验证码生成。**纯前端项目，可静态部署。**

## 数据模式

- **本地存储（默认）**：不配置 Supabase 时，数据存于浏览器 localStorage，仅本机多标签可同步。
- **云端 Supabase（可选）**：配置 Supabase 后，账号/公告/配置存于云端，**所有人、所有设备实时同步**；管理页更新后，用户首页会自动刷新。

## 特性

- **纯前端静态部署**：无需自建后端，可直接用任意静态服务器或 CDN 部署
- **双模式**：本地 localStorage 或 Supabase 云端，由是否填写 `supabase-config.js` 决定
- **功能完整**
  - 账号密码管理、添加/删除
  - TOTP 动态验证码（30 秒自动更新，前端 OTPAuth 生成）
  - 一键复制账号、密码、验证码
  - 系统公告、飞书联系、登录指导与 Gemini 按钮配置（管理后台）

## 快速开始

### 本地预览（端口 8899）

```bash
npm start
```

浏览器访问：**http://localhost:8899**

（无需 `npm install`，使用 `npx serve` 即可。）

### 静态部署

必须部署的文件：`index.html`、`admin.html`、`supabase-config.js`（若用 Supabase）。  
用户首页：`index.html`；管理后台：`admin.html`（管理员密码默认 `admin123`，仅前端校验）。

---

## 使用 Supabase 云端（跨设备同步）

### 1. 创建项目

1. 打开 [Supabase](https://supabase.com) 注册/登录
2. 新建项目，记下 **Project URL** 和 **anon public** key（Project Settings → API）

### 2. 建表

在 Supabase 控制台 → **SQL Editor** 中新建查询，粘贴并执行 `supabase/schema.sql` 中的全部 SQL。

### 3. 填写配置

编辑项目根目录下的 **`supabase-config.js`**：

```javascript
window.SUPABASE_URL = 'https://你的项目.supabase.co';
window.SUPABASE_ANON_KEY = '你的 anon public key';
```

保存后刷新页面。首页右上角显示 **「云端 (Supabase)」** 即表示已接入；管理页的增删改会同步到云端，所有打开首页的用户都会自动看到更新。

### 4. 实时同步说明

- 已为 `accounts`、`announcements`、`config` 表开启 Supabase 实时订阅
- 若未自动刷新，可在 Supabase 控制台 → Database → Replication 中确认相关表已加入 Replication

---

## 文件结构

```
谷歌账号管理/
├── index.html         # 用户端
├── admin.html          # 管理端
├── supabase-config.js  # Supabase 配置（必填后才用云端）
├── supabase/
│   └── schema.sql      # Supabase 建表脚本
├── package.json
└── README.md
```

## 配置说明（管理后台）

- **公告**：在管理后台「公告管理」中发布，首页展示
- **技术支持（飞书）**：在「技术支持」中填写联系人名称、邮箱、飞书 Open ID
- **按钮配置**：登录指导、访问 Gemini 的显示与文案、链接

未配置 Supabase 时，以上存于 localStorage；配置 Supabase 后存于云端。

## 端口

本地运行端口为 **8899**（在 `package.json` 的 `start` 脚本中配置）。

## 安全说明

1. 管理密码仅在前端校验，敏感环境建议不要将管理后台暴露给未信任用户。
2. 使用 Supabase 时，当前策略为匿名可读写（内部工具）；若需限制，请在 Supabase 控制台修改 RLS 策略。
3. 若需 HTTPS，请在部署层（如 Nginx、CDN）配置。

## 开发者

王海涛 · wanghaitao@sucdri.com

## 许可证

MIT License
