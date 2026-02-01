# 🚀 中国大陆部署指南

## 📋 部署平台对比

### 推荐平台（按优先级排序）

| 平台 | 推荐指数 | 优点 | 缺点 | 价格 | 速度 |
|------|---------|------|------|------|------|
| **Vercel** | ⭐⭐⭐⭐⭐ | 免费额度大，全球CDN，自动HTTPS | 需要科学上网访问 | 免费版够用 | ⭐⭐⭐⭐ |
| **Netlify** | ⭐⭐⭐⭐ | 操作简单，CI/CD强大 | 需要科学上网 | 免费版够用 | ⭐⭐⭐⭐ |
| **阿里云OSS** | ⭐⭐⭐⭐ | 国内访问快，稳定 | 配置复杂，需要备案 | ¥0.5/GB/月 | ⭐⭐⭐⭐⭐ |
| **腾讯云COS** | ⭐⭐⭐⭐ | 国内访问快，价格便宜 | 配置复杂，需要备案 | ¥0.5/GB/月 | ⭐⭐⭐⭐⭐ |
| **Cloudflare Pages** | ⭐⭐⭐⭐ | 全球CDN，免费HTTPS | 控制台在国外 | 免费 | ⭐⭐⭐⭐ |
| **Gitee Pages** | ⭐⭐⭐ | 完全免费，国内访问快 | 功能有限，更新慢 | 免费 | ⭐⭐⭐⭐ |

---

## 🏆 最佳推荐方案

### 方案1：Vercel（最推荐）⭐⭐⭐⭐⭐

**适合场景**：快速部署，免费，全球CDN

#### 优点：
- ✅ 免费额度慷慨（100GB带宽/月）
- ✅ 自动配置HTTPS
- ✅ 全球CDN加速
- ✅ Git集成，自动部署
- ✅ 支持自定义域名

#### 缺点：
- ⚠️ 控制台需要科学上网
- ⚠️ 国内访问速度一般（但可接受）

#### 部署步骤：

1. **注册 Vercel 账号**
   - 访问 [vercel.com](https://vercel.com)
   - 使用 GitHub 账号登录

2. **导入项目**
   ```bash
   # 进入项目目录
   cd "D:\工作\城建院\2601\谷歌账号管理"

   # 初始化 Git（如果还没有）
   git init
   git add .
   git commit -m "Initial commit"

   # 推送到 GitHub
   # 先在 GitHub 创建新仓库，然后：
   git remote add origin https://github.com/你的用户名/仓库名.git
   git push -u origin main
   ```

3. **在 Vercel 导入**
   - 登录 Vercel → **Add New Project**
   - 从 GitHub 导入你的仓库
   - 配置项目：
     - **Framework Preset**: Other
     - **Root Directory**: `./`
     - **Build Command**: 留空（静态网站）
     - **Output Directory**: `/`
   - 点击 **Deploy**

4. **配置环境变量（可选）**
   如果想隐藏 Supabase 配置：
   - 项目设置 → **Environment Variables**
   - 添加：
     - `VITE_SUPABASE_URL`: 你的 Supabase URL
     - `VITE_SUPABASE_ANON_KEY`: 你的 Supabase Key

5. **完成！**
   - Vercel 会给你一个 `.vercel.app` 域名
   - 访问测试：`https://你的项目名.vercel.app`

---

### 方案2：阿里云 OSS + CDN（国内访问最快）⭐⭐⭐⭐

**适合场景**：需要国内最快访问速度，已备案域名

#### 优点：
- ✅ 国内访问速度极快
- ✅ 稳定可靠
- ✅ 价格便宜

#### 缺点：
- ❌ 需要域名备案
- ❌ 配置相对复杂
- ❌ 需要手动上传更新

#### 部署步骤：

1. **开通阿里云 OSS**
   - 登录 [阿里云 OSS 控制台](https://oss.console.aliyun.com)
   - 创建 Bucket：
     - **Bucket名称**: 自定义（如：sucdri2026）
     - **地域**: 选择离你最近的（如：华东1-杭州）
     - **存储类型**: 标准存储
     - **读写权限**: 公共读

2. **上传文件**
   ```bash
   # 方式1：控制台直接上传
   # 选中所有 .html 和 .js 文件上传

   # 方式2：使用 ossutil 工具
   # 下载并配置 ossutil
   ossutil cp D:\工作\城建院\2601\谷歌账号管理\ oss://sucdri2026/ -rf
   ```

3. **配置静态网站托管**
   - Bucket → **数据管理** → **静态页面**
   - 点击 **设置**
   - **默认首页**: `index.html`
   - **默认404页**: `index.html`
   - 开启静态站点

4. **配置 HTTPS（可选但推荐）**
   - 申请免费 SSL 证书（阿里云提供）
   - Bucket → **传输管理** → **域名管理**
   - 绑定域名 → 上传证书

5. **配置 CDN 加速（可选）**
   - 开通阿里云 CDN 服务
   - 添加加速域名 → 源站填写 OSS 域名

---

### 方案3：Cloudflare Pages（免费且稳定）⭐⭐⭐⭐

**适合场景**：完全免费，有自定义域名

#### 优点：
- ✅ 完全免费，无限带宽
- ✅ 全球CDN
- ✅ 自动HTTPS
- ✅ 支持自定义域名

#### 缺点：
- ⚠️ 控制台在国外
- ⚠️ 国内速度一般

#### 部署步骤：

1. **注册 Cloudflare**
   - 访问 [dash.cloudflare.com](https://dash.cloudflare.com)
   - 注册账号

2. **连接 Git 仓库**
   - **Workers & Pages** → **Create application** → **Pages**
   - 连接 GitHub/GitLab 仓库

3. **配置构建设置**
   - **Build command**: 留空
   - **Build output directory**: `/`
   - **Root directory**: `/`

4. **部署**
   - 点击 **Save and Deploy**
   - 等待部署完成（约1-2分钟）

5. **绑定自定义域名（可选）**
   - 项目设置 → **Custom domains**
   - 添加你的域名
   - 按照提示配置 DNS

---

### 方案4：Gitee Pages（完全免费国内方案）⭐⭐⭐

**适合场景**：完全免费，不想备案

#### 优点：
- ✅ 完全免费
- ✅ 国内访问快
- ✅ 支持自定义域名

#### 缺点：
- ⚠️ 功能相对有限
- ⚠️ 更新有延迟（5-10分钟）
- ⚠️ 需要公开仓库

#### 部署步骤：

1. **创建 Gitee 仓库**
   - 访问 [gitee.com](https://gitee.com)
   - 注册并创建新仓库
   - 上传所有项目文件

2. **开启 Gitee Pages**
   - 仓库 → **服务** → **Gitee Pages**
   - 点击 **启动**
   - 选择部署分支（通常是 `main` 或 `master`）
   - 选择部署目录（根目录 `/`）

3. **访问网站**
   - 部署成功后会得到一个网址：`https://你的用户名.gitee.io/仓库名`

4. **更新网站**
   - Push 代码到 Gitee
   - 在 Gitee Pages 页面点击 **更新**

---

## 🎯 我的推荐

### 如果是个人使用或团队内部工具：
→ **Vercel**（最简单，免费，够用）

### 如果需要给客户/领导演示：
→ **阿里云OSS** 或 **腾讯云COS**（速度快，专业）

### 如果预算有限，追求完全免费：
→ **Cloudflare Pages** 或 **Gitee Pages**

---

## 🔐 重要提醒

### 1. 保护 Supabase 密钥

**不要**将包含真实密钥的代码公开到 GitHub！

**解决方法：**

```javascript
// supabase-config.js
// ❌ 错误：直接写密钥
window.SUPABASE_URL = 'https://xxx.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbG...';

// ✅ 正确：使用环境变量
window.SUPABASE_URL = process.env.SUPABASE_URL || '默认值';
window.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '默认值';
```

或者：
1. 在 Supabase 控制台重新生成密钥
2. 将 `supabase-config.js` 添加到 `.gitignore`
3. 部署时手动上传或通过环境变量配置

### 2. 域名和备案

如果使用国内平台（阿里云、腾讯云）：
- **必须备案**（需要20-30个工作日）
- 需要企业营业执照或个人身份证

如果使用国外平台（Vercel、Cloudflare）：
- **不需要备案**
- 可以直接使用 `.app` 域名

### 3. HTTPS 证书

- **Vercel/Cloudflare**: 自动配置，免费 Let's Encrypt
- **阿里云/腾讯云**: 需要手动申请（有免费证书）

---

## 📊 成本对比

### 预估月费用（假设访问量：1000次/天）

| 平台 | 流量费 | SSL证书 | 存储费 | **总计** |
|------|--------|---------|--------|---------|
| **Vercel** | 免费 | 免费 | 免费 | **¥0** |
| **Cloudflare Pages** | 免费 | 免费 | 免费 | **¥0** |
| **Gitee Pages** | 免费 | 免费 | 免费 | **¥0** |
| **阿里云OSS** | ¥1-5 | 免费 | ¥0.1 | **¥2-6** |
| **腾讯云COS** | ¥1-5 | 免费 | ¥0.1 | **¥2-6** |

**结论：个人或小团队使用，Vercel/Cloudflare 完全免费！**

---

## 🚦 快速决策树

```
需要备案吗？
├─ 是 → 使用国内平台（阿里云OSS/腾讯云COS）
└─ 否 →
   ├─ 想要最简单的部署？
   │  └─ Vercel ⭐⭐⭐⭐⭐
   ├─ 想要完全免费？
   │  └─ Cloudflare Pages ⭐⭐⭐⭐
   └─ 只在国内用？
      └─ Gitee Pages ⭐⭐⭐
```

---

## 📞 需要帮助？

如果遇到部署问题，请告诉我：
1. 你选择的平台
2. 具体的错误信息
3. 你当前的步骤

我会帮你解决！

---

**下一步**: 选择一个平台，我来帮你详细部署！🚀
