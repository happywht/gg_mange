-- 在 Supabase 控制台：SQL Editor 中执行本脚本，创建表和权限

-- 账号表
create table if not exists accounts (
  id text primary key,
  name text,
  email text not null,
  password text not null,
  secret text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 公告表（取最新一条展示）
create table if not exists announcements (
  id text primary key,
  message text not null,
  created_at timestamptz default now()
);

-- 配置表（单行：联系人、按钮、密码配置）
create table if not exists config (
  id text primary key default 'default',
  contact jsonb default '{"name":"王海涛","email":"wanghaitao@sucdri.com","openId":"ou_f28f2c1dfe74461b2ca055dfe2afe20b"}'::jsonb,
  buttons jsonb default '{"guide":{"visible":true,"text":"登录指导","url":""},"gemini":{"visible":true,"text":"访问 Gemini","url":"https://gemini.google.com/app"}}'::jsonb,
  passwords jsonb default '{"access":"123456","admin":"admin123"}'::jsonb
);

-- 启用 RLS（行级安全）
alter table accounts enable row level security;
alter table announcements enable row level security;
alter table config enable row level security;

-- 允许匿名读写（内部工具：拿到链接即可用；如需限制请自行改策略）
create policy "Allow anon all on accounts" on accounts for all using (true) with check (true);
create policy "Allow anon all on announcements" on announcements for all using (true) with check (true);
create policy "Allow anon all on config" on config for all using (true) with check (true);

-- 插入默认配置
insert into config (id) values ('default') on conflict (id) do nothing;
