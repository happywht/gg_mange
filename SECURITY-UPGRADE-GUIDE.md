# 🔒 安全升级部署指南

## 📋 升级概述

本次升级将系统从**简单的密码验证**升级到**真正的用户认证**，主要改进：

- ✅ 使用 Supabase Auth 进行用户认证
- ✅ 实施 Row Level Security (RLS) 策略
- ✅ 加密敏感字段（2FA密钥）
- ✅ 添加审计日志
- ✅ 细粒度的权限控制

---

## 🚀 部署步骤

### 步骤1：在 Supabase 创建管理员用户

**重要！** 在执行 SQL 脚本之前，需要先创建管理员用户。

1. 登录 [Supabase 控制台](https://supabase.com/dashboard)
2. 选择你的项目
3. 进入 **Authentication** → **Users**
4. 点击 **Add user** → **Create new user**
5. 填写信息：
   - **Email**: `wanghaitao@sucdri.com`（或你的管理员邮箱）
   - **Password**: 设置一个强密码（至少12位）
   - **Auto Confirm User**: ✅ 勾选（自动确认，不需要邮箱验证）
6. 点击 **Create user**

7. 记录创建的用户的 **UID**（在用户列表中可以看到）

---

### 步骤2：执行安全升级 SQL 脚本

1. 在 Supabase 控制台，进入 **SQL Editor**
2. 点击 **New query**
3. 复制 `supabase/security-upgrade.sql` 文件的全部内容
4. 粘贴到 SQL Editor 中
5. 点击 **Run** 执行脚本

**脚本会做什么：**
- ✅ 启用 `pgcrypto` 加密扩展
- ✅ 创建加密密钥管理表
- ✅ 创建新的安全账号表（`secure_accounts`）
- ✅ 备份现有数据到 `accounts_backup`
- ✅ 删除旧的开放 RLS 策略
- ✅ 创建新的安全 RLS 策略
- ✅ 创建审计日志表和触发器
- ✅ 创建加密/解密函数

---

### 步骤3：迁移现有数据

执行数据迁移脚本，将旧账号关联到新用户：

```sql
-- 在 SQL Editor 中执行此脚本

-- 将旧账号数据迁移到新表（使用你刚才创建的管理员用户ID）
UPDATE secure_accounts
SET user_id = '你的管理员用户ID'::TEXT  -- 替换为步骤1中记录的UID
WHERE user_id IS NULL;

-- 或者插入新记录（保留原表）
INSERT INTO secure_accounts (id, user_id, name, email, password, secret_encrypted)
SELECT
  a.id,
  '你的管理员用户ID'::TEXT,  -- 替换为实际的UID
  a.name,
  a.email,
  a.password,
  encrypt_secret(a.secret, 'ChangeMe123!@#')  -- 加密2FA密钥
FROM accounts a
ON CONFLICT (id) DO NOTHING;

-- 验证迁移结果
SELECT COUNT(*) as total_accounts FROM secure_accounts;
SELECT id, name, email FROM secure_accounts;
```

---

### 步骤4：修改加密密钥（重要！）

默认的加密密钥是公开的，必须修改：

```sql
-- 1. 生成新的密钥哈希
-- 在本地运行以下代码生成哈希：
/*
const crypto = require('crypto');
const newKey = '你的强密码（至少32位）';
console.log(crypto.createHash('sha256').update(newKey).digest('hex'));
*/

-- 2. 更新数据库中的密钥哈希
UPDATE encryption_keys
SET key_hash = '你的新密钥的SHA256哈希'
WHERE id = 'master_key';

-- 3. 重新加密所有2FA密钥（使用新密钥）
UPDATE secure_accounts
SET secret_encrypted = encrypt_secret(
  decrypt_secret(secret_encrypted, 'ChangeMe123!@#'),  -- 用旧密钥解密
  '你的新密钥'  -- 用新密钥加密
)
WHERE secret_encrypted IS NOT NULL;
```

---

### 步骤5：更新前端代码

#### 5.1 更新 `index.html`

在 `<head>` 部分添加认证管理器：

```html
<!-- 在其他 script 标签之前添加 -->
<script src="supabase-config.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="auth-manager.js"></script>
<script src="auth-check.js"></script>
```

#### 5.2 更新 `admin.html`

同样添加认证管理器和管理员权限检查：

```html
<!-- 在其他 script 标签之前添加 -->
<script src="supabase-config.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="auth-manager.js"></script>
<script src="auth-check.js"></script>
```

在页面的 React 组件初始化时添加管理员检查：

```javascript
// 在 App 组件的 useEffect 中添加
useEffect(() => {
  const checkAdmin = async () => {
    const isAdminUser = await window.SupabaseAuth?.isAdmin();
    if (!isAdminUser) {
      alert('您没有管理员权限');
      window.location.href = 'index.html';
    }
  };
  checkAdmin();
}, []);
```

#### 5.3 切换登录页面

将 `login.html` 重命名为 `login-old.html`（保留作为备份）
将 `login-auth.html` 重命名为 `login.html`

---

### 步骤6：配置管理员邮箱列表

在 Supabase 控制台中更新管理员邮箱：

```sql
-- 在 SQL Editor 中执行
UPDATE config
SET admin_emails = ARRAY['wanghaitao@sucdri.com', 'other-admin@example.com']
WHERE id = 'default';
```

或在 `auth-manager.js` 中修改配置：

```javascript
const CONFIG = {
  adminEmails: ['wanghaitao@sucdri.com', 'other-admin@example.com'],
  // ...
};
```

---

### 步骤7：测试验证

1. **测试登录**
   - 访问 `login.html`（新的认证登录页）
   - 使用你在步骤1中创建的管理员账号登录
   - 验证是否成功跳转到主页面

2. **测试权限**
   - 访问 `admin.html`，验证管理员可以访问
   - 退出登录，使用非管理员邮箱登录（需要先创建）
   - 验证非管理员无法访问 `admin.html`

3. **测试数据隔离**
   - 创建多个用户，每个用户添加自己的账号
   - 验证用户A只能看到自己的账号
   - 验证用户B只能看到自己的账号

4. **测试审计日志**
   - 执行一些操作（添加/修改/删除账号）
   - 在 Supabase 控制台查看 `audit_logs` 表
   - 验证所有操作都被记录

---

## 🛡️ 安全验证清单

- [ ] Supabase Auth 已启用
- [ ] RLS 策略已正确配置
- [ ] 旧数据已迁移并加密
- [ ] 加密密钥已修改
- [ ] 前端使用新的认证系统
- [ ] 管理员权限正常工作
- [ ] 数据隔离正常工作
- [ ] 审计日志正常记录

---

## 🔧 故障排查

### 问题1：登录后立即跳回登录页

**原因**: 认证检查脚本执行顺序问题

**解决**: 确保 `auth-manager.js` 在 `auth-check.js` 之前加载

```html
<script src="auth-manager.js"></script>
<script src="auth-check.js"></script>
```

### 问题2：看不到之前的数据

**原因**: 数据迁移未正确执行

**解决**: 检查 `secure_accounts` 表，确认 `user_id` 字段正确填充

```sql
SELECT id, user_id, name, email FROM secure_accounts;
```

### 问题3：2FA密钥显示乱码

**原因**: 加密/解密使用了错误的密钥

**解决**: 确保加密函数使用的密钥与数据库中存储的一致

### 问题4：提示"没有管理员权限"

**原因**: 邮箱不在管理员列表中

**解决**: 在 `auth-manager.js` 或数据库中添加该邮箱到管理员列表

---

## 📊 安全对比

| 安全措施 | 升级前 | 升级后 |
|---------|-------|-------|
| 认证方式 | 简单密码（明文） | Supabase Auth（JWT） |
| API访问 | 完全开放 | RLS 策略保护 |
| 2FA密钥 | 明文存储 | AES-256 加密 |
| 数据隔离 | 无 | 用户级别隔离 |
| 审计日志 | 无 | 完整操作记录 |
| 权限控制 | 无 | 细粒度权限 |

---

## 🎯 下一步建议

### 短期（1-2周）
- [ ] 定期审查审计日志
- [ ] 监控异常登录行为
- [ ] 备份加密密钥

### 中期（1个月）
- [ ] 添加多因素认证（MFA）
- [ ] 实施密码策略（复杂度、过期）
- [ ] 添加用户自助注册功能

### 长期（3个月）
- [ ] 实施零知识架构
- [ ] 添加端到端加密
- [ ] 定期安全审计

---

## 📞 技术支持

如遇到问题，请检查：
1. Supabase 控制台的日志
2. 浏览器的开发者工具控制台
3. SQL 执行结果和错误信息

---

**升级完成后，请删除或妥善保管以下文件：**
- `login-old.html`（旧版登录页）
- 任何包含原始密码的备份文件
- `auth-config.js`（如果不再使用）

**重要提示**:
- ⚠️ 永远不要将加密密钥提交到版本控制系统
- ⚠️ 定期更换加密密钥（建议每季度）
- ⚠️ 监控审计日志，及时发现异常行为
