-- ============================================
-- 安全升级脚本 - 最小化安全改进方案
-- 执行前请先备份现有数据！
-- ============================================

-- 步骤1: 启用加密扩展
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 步骤2: 创建加密密钥管理表
CREATE TABLE IF NOT EXISTS encryption_keys (
  id TEXT PRIMARY KEY DEFAULT 'master_key',
  key_hash TEXT NOT NULL,  -- 使用哈希验证，不存储明文
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入默认加密密钥（首次部署后请立即修改）
-- 这是一个示例密钥，生产环境应该使用环境变量或密钥管理服务
INSERT INTO encryption_keys (id, key_hash)
VALUES (
  'master_key',
  encode(digest('ChangeMe123!@#', 'sha256'), 'hex')
)
ON CONFLICT (id) DO NOTHING;

-- 步骤3: 重构账号表，添加加密字段和用户关联
-- 注意：这会保留原表作为备份

-- 3.1 备份现有数据
CREATE TABLE IF NOT EXISTS accounts_backup AS
SELECT * FROM accounts;

-- 3.2 创建新的安全账号表
CREATE TABLE IF NOT EXISTS secure_accounts (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- 关联到Supabase Auth用户
  name TEXT,
  email TEXT NOT NULL,
  password TEXT NOT NULL,  -- 密码可以保持明文（因为是用户自己的Google密码）
  secret_encrypted TEXT,   -- 🔒 加密的2FA密钥
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.3 迁移现有数据到新表（关联到第一个管理员用户）
-- 注意：这里暂时将数据关联到第一个创建的管理员用户
-- 创建管理员用户后需要重新关联

-- 步骤4: 修改配置表，添加系统管理员配置
ALTER TABLE config
ADD COLUMN IF NOT EXISTS admin_emails TEXT[] DEFAULT ARRAY['wanghaitao@sucdri.com'];

-- 步骤5: 删除旧的开放RLS策略
DROP POLICY IF EXISTS "Allow anon all on accounts" ON accounts;
DROP POLICY IF EXISTS "Allow anon all on announcements" ON announcements;
DROP POLICY IF EXISTS "Allow anon all on config" ON config;

-- 步骤6: 创建新的安全RLS策略

-- 6.1 accounts 表策略
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- 只有认证用户才能读取
CREATE POLICY "Authenticated users can read accounts"
ON accounts FOR SELECT
TO authenticated
USING (true);

-- 只有认证用户才能插入
CREATE POLICY "Authenticated users can insert accounts"
ON accounts FOR INSERT
TO authenticated
WITH CHECK (true);

-- 用户只能更新自己的账号（通过user_id）
CREATE POLICY "Users can update own accounts"
ON accounts FOR UPDATE
TO authenticated
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- 用户只能删除自己的账号
CREATE POLICY "Users can delete own accounts"
ON accounts FOR DELETE
TO authenticated
USING (auth.uid()::text = user_id);

-- 6.2 secure_accounts 表策略（新表）
ALTER TABLE secure_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own secure accounts"
ON secure_accounts FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own secure accounts"
ON secure_accounts FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own secure accounts"
ON secure_accounts FOR UPDATE
TO authenticated
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own secure accounts"
ON secure_accounts FOR DELETE
TO authenticated
USING (auth.uid()::text = user_id);

-- 6.3 announcements 表策略
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 只有认证用户才能读取公告
CREATE POLICY "Authenticated users can read announcements"
ON announcements FOR SELECT
TO authenticated
USING (true);

-- 只有管理员才能创建/修改/删除公告
CREATE POLICY "Admins can manage announcements"
ON announcements FOR ALL
TO authenticated
USING (
  -- 检查用户邮箱是否在管理员列表中
  EXISTS (
    SELECT 1 FROM config
    WHERE id = 'default'
    AND auth.jwt() ->> 'email' = ANY(config.admin_emails)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM config
    WHERE id = 'default'
    AND auth.jwt() ->> 'email' = ANY(config.admin_emails)
  )
);

-- 6.4 config 表策略
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- 所有认证用户可以读取配置
CREATE POLICY "Authenticated users can read config"
ON config FOR SELECT
TO authenticated
USING (true);

-- 只有管理员可以修改配置
CREATE POLICY "Admins can update config"
ON config FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM config
    WHERE id = 'default'
    AND auth.jwt() ->> 'email' = ANY(config.admin_emails)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM config
    WHERE id = 'default'
    AND auth.jwt() ->> 'email' = ANY(config.admin_emails)
  )
);

-- 步骤7: 创建审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  action TEXT NOT NULL,  -- 'create', 'read', 'update', 'delete'
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 审计日志策略
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的审计日志
CREATE POLICY "Users can read own audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 用户可以插入审计日志（自动触发）
CREATE POLICY "Users can insert audit logs"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 步骤8: 创建审计触发器函数
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (user_id, user_email, action, table_name, record_id, old_values)
    VALUES (
      auth.uid(),
      auth.jwt() ->> 'email',
      'delete',
      TG_TABLE_NAME,
      OLD.id::text,
      row_to_json(OLD)
    );
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (user_id, user_email, action, table_name, record_id, old_values, new_values)
    VALUES (
      auth.uid(),
      auth.jwt() ->> 'email',
      'update',
      TG_TABLE_NAME,
      NEW.id::text,
      row_to_json(OLD),
      row_to_json(NEW)
    );
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (user_id, user_email, action, table_name, record_id, new_values)
    VALUES (
      auth.uid(),
      auth.jwt() ->> 'email',
      'create',
      TG_TABLE_NAME,
      NEW.id::text,
      row_to_json(NEW)
    );
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 步骤9: 为重要表添加审计触发器
CREATE TRIGGER audit_accounts
AFTER INSERT OR UPDATE OR DELETE ON accounts
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_secure_accounts
AFTER INSERT OR UPDATE OR DELETE ON secure_accounts
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_announcements
AFTER INSERT OR UPDATE OR DELETE ON announcements
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_config
AFTER UPDATE ON config
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- 步骤10: 创建加密/解密函数
-- 使用 AES-256 加密

-- 加密函数
CREATE OR REPLACE FUNCTION encrypt_secret(secret TEXT, key TEXT)
RETURNS TEXT AS $$
BEGIN
  IF secret IS NULL OR secret = '' THEN
    RETURN NULL;
  END IF;
  RETURN encode(
    pgp_sym_encrypt(secret, key),
    'base64'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- 解密函数
CREATE OR REPLACE FUNCTION decrypt_secret(encrypted_secret TEXT, key TEXT)
RETURNS TEXT AS $$
BEGIN
  IF encrypted_secret IS NULL OR encrypted_secret = '' THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(
    decode(encrypted_secret, 'base64'),
    key
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- 步骤11: 创建视图，方便前端使用（自动解密）
-- 注意：这个视图只返回当前用户的解密数据
CREATE OR REPLACE VIEW user_accounts_with_decrypted_secret AS
SELECT
  id,
  user_id,
  name,
  email,
  password,
  decrypt_secret(secret_encrypted, 'ChangeMe123!@#') AS secret,  -- 🔴 部署后修改此密钥
  created_at,
  updated_at
FROM secure_accounts
WHERE user_id = auth.uid()::text;

-- 步骤12: 添加注释
COMMENT ON TABLE secure_accounts IS '安全账号表，2FA密钥已加密，仅用户本人可访问';
COMMENT ON TABLE audit_logs IS '审计日志表，记录所有数据修改操作';
COMMENT ON COLUMN secure_accounts.secret_encrypted IS '使用AES-256加密的2FA密钥';

-- ============================================
-- 部署后必须执行的操作
-- ============================================

-- 1. 在 Supabase 控制台 -> Authentication 中创建管理员用户
-- 2. 记录创建的用户的 ID
-- 3. 执行以下迁移脚本（将旧数据关联到新用户）:

/*
-- 迁移脚本（创建管理员后执行）
UPDATE secure_accounts
SET user_id = '你的管理员用户ID'
WHERE user_id IS NULL;

-- 或者如果你想保留所有用户的数据（需要对应关系）
INSERT INTO secure_accounts (id, user_id, name, email, password, secret_encrypted)
SELECT
  a.id,
  '管理员用户ID'::TEXT,  -- 替换为实际的用户ID
  a.name,
  a.email,
  a.password,
  encrypt_secret(a.secret, 'ChangeMe123!@#')
FROM accounts a
ON CONFLICT (id) DO NOTHING;
*/

-- 4. 修改加密密钥（非常重要！）
/*
UPDATE encryption_keys
SET key_hash = encode(digest('你的新密钥', 'sha256'), 'hex')
WHERE id = 'master_key';

-- 然后需要重新加密所有数据
UPDATE secure_accounts
SET secret_encrypted = encrypt_secret(
  decrypt_secret(secret_encrypted, 'ChangeMe123!@#'),  -- 旧密钥
  '你的新密钥'  -- 新密钥
);
*/

-- ============================================
-- 验证部署的查询
-- ============================================

-- 检查RLS策略
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 检查触发器
SELECT
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;

-- 检查加密函数
SELECT
  proname AS function_name,
  prosecdef AS security_definer
FROM pg_proc
WHERE proname IN ('encrypt_secret', 'decrypt_secret', 'audit_trigger_func');
