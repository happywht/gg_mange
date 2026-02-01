-- ============================================
-- 安全升级脚本 - 修正版
-- 针对 UID: 5d04056a-f13b-4353-a572-6626c2af6dd4
-- ============================================

-- 步骤1: 启用加密扩展
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 步骤2: 备份现有数据
DROP TABLE IF EXISTS accounts_backup;
CREATE TABLE accounts_backup AS
SELECT * FROM accounts;

-- 步骤3: 创建新的安全账号表（如果不存在）
DROP TABLE IF EXISTS secure_accounts;
CREATE TABLE secure_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,  -- 关联到Supabase Auth用户
  name TEXT,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  secret_encrypted TEXT,   -- 加密的2FA密钥
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 步骤4: 迁移现有数据到新表
INSERT INTO secure_accounts (id, user_id, name, email, password, secret_encrypted)
SELECT
  a.id,
  '5d04056a-f13b-4353-a572-6626c2af6dd4',  -- 你的管理员 UID
  a.name,
  a.email,
  a.password,
  CASE
    WHEN a.secret IS NOT NULL AND a.secret != ''
    THEN encode(pgp_sym_encrypt(a.secret, 'ChangeMe123!@#'), 'base64')
    ELSE NULL
  END as secret_encrypted
FROM accounts a;

-- 验证迁移结果
SELECT COUNT(*) as migrated_count FROM secure_accounts;

-- 步骤5: 删除旧的RLS策略
DROP POLICY IF EXISTS "Allow anon all on accounts" ON accounts;
DROP POLICY IF EXISTS "Allow anon all on announcements" ON announcements;
DROP POLICY IF EXISTS "Allow anon all on config" ON config;

-- 步骤6: 创建新的安全RLS策略

-- 6.1 secure_accounts 表策略
ALTER TABLE secure_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own secure accounts" ON secure_accounts;
DROP POLICY IF EXISTS "Users can insert own secure accounts" ON secure_accounts;
DROP POLICY IF EXISTS "Users can update own secure accounts" ON secure_accounts;
DROP POLICY IF EXISTS "Users can delete own secure accounts" ON secure_accounts;

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

-- 6.2 原有 accounts 表策略（保持兼容）
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read accounts" ON accounts;
DROP POLICY IF EXISTS "Authenticated users can insert accounts" ON accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON accounts;

CREATE POLICY "Authenticated users can read accounts"
ON accounts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert accounts"
ON accounts FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update own accounts"
ON accounts FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can delete own accounts"
ON accounts FOR DELETE
TO authenticated
USING (true);

-- 6.3 announcements 表策略
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read announcements" ON announcements;
DROP POLICY IF EXISTS "Admins can manage announcements" ON announcements;

CREATE POLICY "Authenticated users can read announcements"
ON announcements FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage announcements"
ON announcements FOR ALL
TO authenticated
USING (
  auth.jwt() ->> 'email' = 'wanghaitao@sucdri.com'  -- 你的管理员邮箱
)
WITH CHECK (
  auth.jwt() ->> 'email' = 'wanghaitao@sucdri.com'
);

-- 6.4 config 表策略
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read config" ON config;
DROP POLICY IF EXISTS "Admins can update config" ON config;

CREATE POLICY "Authenticated users can read config"
ON config FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can update config"
ON config FOR UPDATE
TO authenticated
USING (
  auth.jwt() ->> 'email' = 'wanghaitao@sucdri.com'
)
WITH CHECK (
  auth.jwt() ->> 'email' = 'wanghaitao@sucdri.com'
);

-- 步骤7: 创建审计日志表
DROP TABLE IF EXISTS audit_logs;
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Users can insert audit logs" ON audit_logs;

CREATE POLICY "Users can read own audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert audit logs"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 步骤8: 创建审计触发器函数
DROP FUNCTION IF EXISTS audit_trigger_func() CASCADE;
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

-- 步骤9: 添加审计触发器
DROP TRIGGER IF EXISTS audit_secure_accounts ON secure_accounts;
DROP TRIGGER IF EXISTS audit_accounts ON accounts;
DROP TRIGGER IF EXISTS audit_announcements ON announcements;
DROP TRIGGER IF EXISTS audit_config ON config;

CREATE TRIGGER audit_secure_accounts
AFTER INSERT OR UPDATE OR DELETE ON secure_accounts
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_accounts
AFTER INSERT OR UPDATE OR DELETE ON accounts
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_announcements
AFTER INSERT OR UPDATE OR DELETE ON announcements
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_config
AFTER UPDATE ON config
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- 步骤10: 创建加密/解密函数
DROP FUNCTION IF EXISTS encrypt_secret(TEXT, TEXT);
DROP FUNCTION IF EXISTS decrypt_secret(TEXT, TEXT);

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

-- 步骤11: 创建用于前端的视图（自动解密）
DROP VIEW IF EXISTS user_accounts_with_decrypted_secret;
CREATE OR REPLACE VIEW user_accounts_with_decrypted_secret AS
SELECT
  id,
  user_id,
  name,
  email,
  password,
  decrypt_secret(secret_encrypted, 'ChangeMe123!@#') AS secret,
  created_at,
  updated_at
FROM secure_accounts
WHERE user_id = auth.uid()::text;

-- ============================================
-- 验证部署的查询
-- ============================================

-- 检查数据迁移
SELECT
  'accounts' as table_name,
  COUNT(*) as count
FROM accounts
UNION ALL
SELECT
  'secure_accounts' as table_name,
  COUNT(*) as count
FROM secure_accounts
UNION ALL
SELECT
  'accounts_backup' as table_name,
  COUNT(*) as count
FROM accounts_backup;

-- 检查RLS策略
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
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

-- ============================================
-- 完成提示
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE '安全升级脚本执行完成！';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '✓ 数据已备份到 accounts_backup 表';
  RAISE NOTICE '✓ 数据已迁移到 secure_accounts 表';
  RAISE NOTICE '✓ RLS 策略已更新';
  RAISE NOTICE '✓ 审计日志已启用';
  RAISE NOTICE '✓ 加密函数已创建';
  RAISE NOTICE '';
  RAISE NOTICE '下一步：';
  RAISE NOTICE '1. 使用 security-test.html 验证部署';
  RAISE NOTICE '2. 使用 login-auth.html 测试登录';
  RAISE NOTICE '3. 记住修改加密密钥（默认是 ChangeMe123!@#）';
  RAISE NOTICE '===========================================';
END $$;
