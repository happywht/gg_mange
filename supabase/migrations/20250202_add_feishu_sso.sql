-- 为账号表添加飞书 OpenID 绑定字段
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS feishu_openid TEXT;

-- 创建索引以加速查询
CREATE INDEX IF NOT EXISTS idx_accounts_feishu_openid ON accounts(feishu_openid);

-- 添加注释
COMMENT ON COLUMN accounts.feishu_openid IS '飞书用户的 OpenID，用于 SSO 免登录绑定';
