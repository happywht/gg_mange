-- ============================================
-- 修复 config 表的 RLS 策略
-- ============================================

-- 删除旧的 config 表策略（如果存在）
DROP POLICY IF EXISTS "config_select_policy" ON config;
DROP POLICY IF EXISTS "config_update_policy" ON config;
DROP POLICY IF EXISTS "config_insert_policy" ON config;
DROP POLICY IF EXISTS "config_upsert_policy" ON config;

-- 创建新的策略：允许已认证用户读取 config
CREATE POLICY "config_select_policy" ON config
  FOR SELECT
  TO authenticated
  USING (true);

-- 创建策略：允许已认证用户更新 config
CREATE POLICY "config_update_policy" ON config
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 创建策略：允许已认证用户插入 config
CREATE POLICY "config_insert_policy" ON config
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 验证策略已创建
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
WHERE tablename = 'config';
