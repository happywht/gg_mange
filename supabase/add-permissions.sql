-- ============================================
-- 添加功能权限配置
-- ============================================

-- 为 config 表添加 permissions 字段
ALTER TABLE config
ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{
  "showAddAccount": true,
  "showDeleteButton": true,
  "showModeSwitch": true
}'::jsonb;

-- 更新现有配置（如果没有 permissions）
UPDATE config
SET permissions = COALESCE(
  permissions,
  '{"showAddAccount": true, "showDeleteButton": true, "showModeSwitch": true}'::jsonb
)
WHERE id = 'default';

-- 验证更新
SELECT id, permissions FROM config WHERE id = 'default';
