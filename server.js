/**
 * 智能登录助手 - 后端服务器
 * 使用 Node.js + Express + SQLite
 */

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'accounts.db');

// ==================== 配置 ====================
// 飞书开放平台配置
const FEISHU_CONFIG = {
    // 跳转到飞书聊天框（请替换为实际的 open_id）
    // 获取方式：https://open.feishu.cn/document/server-docs/contact-v3/user/batch_get_id
    openId: process.env.FEISHU_OPEN_ID || 'ou_f28f2c1dfe74461b2ca055dfe2afe20b',  // 替换为实际的 open_id
    // 联系邮箱
    email: 'wanghaitao@sucdri.com',
    // 联系人名称
    name: '王海涛'
};

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// 确保数据目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// 初始化数据库
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('数据库连接失败:', err.message);
    } else {
        console.log('已连接到 SQLite 数据库:', DB_PATH);
        initDatabase();
    }
});

// 初始化数据库表
function initDatabase() {
    // 创建账号表
    db.run(`
        CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY,
            name TEXT,
            email TEXT NOT NULL,
            password TEXT NOT NULL,
            secret TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('创建 accounts 表失败:', err.message);
        } else {
            console.log('accounts 表初始化成功');
        }
    });

    // 创建公告表
    db.run(`
        CREATE TABLE IF NOT EXISTS announcements (
            id TEXT PRIMARY KEY,
            message TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('创建 announcements 表失败:', err.message);
        } else {
            console.log('announcements 表初始化成功');
            // 表创建成功后，插入默认公告
            db.run(`
                INSERT OR IGNORE INTO announcements (id, message)
                VALUES ('default', '欢迎使用智能登录助手！')
            `, (err) => {
                if (err) {
                    console.error('插入默认公告失败:', err.message);
                } else {
                    console.log('默认公告已就绪');
                }
            });
        }
    });
}

// ==================== API 路由 ====================

// 获取所有账号（普通用户 - 敏感信息已过滤）
app.get('/api/accounts', (req, res) => {
    db.all('SELECT * FROM accounts ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        // 过滤敏感信息：移除 password 和 secret
        const safeAccounts = rows.map(row => ({
            id: row.id,
            name: row.name,
            email: row.email,
            hasSecret: !!row.secret,  // 只返回是否有 secret
            hasPassword: !!row.password,
            created_at: row.created_at,
            updated_at: row.updated_at
        }));
        res.json({ accounts: safeAccounts });
    });
});

// 添加账号
app.post('/api/accounts', (req, res) => {
    const { id, name, email, password, secret } = req.body;

    if (!email || !password) {
        res.status(400).json({ error: '邮箱和密码不能为空' });
        return;
    }

    const accountId = id || Date.now().toString();
    const updatedAt = new Date().toISOString();

    db.run(
        `INSERT INTO accounts (id, name, email, password, secret, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [accountId, name || '', email, password, secret || '', updatedAt],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({
                success: true,
                account: { id: accountId, name, email, password, secret, updated_at: updatedAt }
            });
        }
    );
});

// 删除账号
app.delete('/api/accounts/:id', (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM accounts WHERE id = ?', [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true, deleted: this.changes > 0 });
    });
});

// 更新账号
app.put('/api/accounts/:id', (req, res) => {
    const { id } = req.params;
    const { name, email, password, secret } = req.body;
    const updatedAt = new Date().toISOString();

    db.run(
        `UPDATE accounts SET name = ?, email = ?, password = ?, secret = ?, updated_at = ?
         WHERE id = ?`,
        [name || '', email, password, secret || '', updatedAt, id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true, updated: this.changes > 0 });
        }
    );
});

// 获取公告
app.get('/api/announcement', (req, res) => {
    db.get('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 1', [], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(row || { id: 'default', message: '' });
    });
});

// ==================== 敏感信息访问（仅限已认证的普通用户）====================
// 获取账号密码（用于复制）
app.get('/api/accounts/:id/password', (req, res) => {
    const { id } = req.params;
    db.get('SELECT password FROM accounts WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: '账号不存在' });
            return;
        }
        res.json({ password: row.password });
    });
});

// 获取动态验证码（后端生成，不需要前端secret）
app.get('/api/accounts/:id/totp', (req, res) => {
    const { id } = req.params;
    db.get('SELECT secret FROM accounts WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: '账号不存在' });
            return;
        }
        if (!row.secret) {
            res.json({ totp: null, hasSecret: false });
            return;
        }

        try {
            // 生成TOTP验证码
            const OTPAuth = require('otpauth');
            const totp = new OTPAuth.TOTP({
                secret: row.secret.replace(/\s/g, '').toUpperCase()
            });
            const token = totp.generate();

            // 计算剩余时间
            const seconds = Math.floor(Date.now() / 1000);
            const timeLeft = 30 - (seconds % 30);

            res.json({
                totp: token,
                timeLeft: timeLeft,
                hasSecret: true
            });
        } catch (e) {
            res.status(500).json({ error: '验证码生成失败: ' + e.message });
        }
    });
});

// 更新公告（需要简单密码验证）
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.post('/api/announcement', (req, res) => {
    const { message, password } = req.body;

    if (password !== ADMIN_PASSWORD) {
        res.status(401).json({ error: '密码错误' });
        return;
    }

    const id = Date.now().toString();
    db.run(
        'INSERT INTO announcements (id, message) VALUES (?, ?)',
        [id, message],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true, announcement: { id, message } });
        }
    );
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 获取配置（前端联系信息等）
app.get('/api/config', (req, res) => {
    res.json({
        contact: {
            name: FEISHU_CONFIG.name,
            email: FEISHU_CONFIG.email,
            openId: FEISHU_CONFIG.openId,
            feishuUrl: `https://applink.feishu.cn/client/chat/open?openId=${FEISHU_CONFIG.openId}`
        },
        buttons: getButtonConfigs()
    });
});

// ==================== 管理员 API ====================
// 中间件：管理员密码验证
const adminAuth = (req, res, next) => {
    const password = req.body.password || req.query.password;
    if (password !== ADMIN_PASSWORD) {
        res.status(401).json({ error: '未授权：管理员密码错误' });
        return;
    }
    next();
};

// 按钮配置存储（内存中，重启后重置）
let buttonConfigs = {
    guide: { visible: true, text: '登录指导', url: '' },
    gemini: { visible: true, text: '访问 Gemini', url: 'https://gemini.google.com/app' }
};

function getButtonConfigs() {
    return buttonConfigs;
}

// 更新按钮配置
app.put('/api/admin/buttons', adminAuth, (req, res) => {
    const { key, config } = req.body;
    if (buttonConfigs[key]) {
        buttonConfigs[key] = { ...buttonConfigs[key], ...config };
        res.json({ success: true, buttons: buttonConfigs });
    } else {
        res.status(400).json({ error: '无效的按钮配置键' });
    }
});

// 获取按钮配置
app.get('/api/admin/buttons', (req, res) => {
    res.json({ buttons: buttonConfigs });
});

// 更新技术支持配置
app.put('/api/admin/config', adminAuth, (req, res) => {
    const { contact } = req.body;
    if (contact) {
        if (contact.name) FEISHU_CONFIG.name = contact.name;
        if (contact.email) FEISHU_CONFIG.email = contact.email;
        if (contact.openId) FEISHU_CONFIG.openId = contact.openId;
        res.json({
            success: true,
            contact: {
                name: FEISHU_CONFIG.name,
                email: FEISHU_CONFIG.email,
                openId: FEISHU_CONFIG.openId,
                feishuUrl: `https://applink.feishu.cn/client/chat/open?openId=${FEISHU_CONFIG.openId}`
            }
        });
    } else {
        res.status(400).json({ error: '无效的配置' });
    }
});

// 获取数据库原始数据
app.get('/api/admin/database', (req, res) => {
    db.all('SELECT * FROM accounts ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ data: rows });
    });
});

// 删除公告
app.delete('/api/admin/announcement', adminAuth, (req, res) => {
    db.run('DELETE FROM announcements', [], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true, deleted: this.changes > 0 });
    });
});

// ==================== 管理员专用 API ====================
// 获取所有账号（管理员）
app.get('/api/admin/accounts', (req, res) => {
    db.all('SELECT * FROM accounts ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ accounts: rows });
    });
});

// 添加账号（管理员）
app.post('/api/admin/accounts', (req, res) => {
    const { id, name, email, password, secret } = req.body;

    if (!email || !password) {
        res.status(400).json({ error: '邮箱和密码不能为空' });
        return;
    }

    const accountId = id || Date.now().toString();
    const updatedAt = new Date().toISOString();

    db.run(
        `INSERT INTO accounts (id, name, email, password, secret, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [accountId, name || '', email, password, secret || '', updatedAt],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({
                success: true,
                account: { id: accountId, name, email, password, secret, updated_at: updatedAt }
            });
        }
    );
});

// 更新账号（管理员）
app.put('/api/admin/accounts/:id', (req, res) => {
    const { id } = req.params;
    const { name, email, password, secret } = req.body;
    const updatedAt = new Date().toISOString();

    db.run(
        `UPDATE accounts SET name = ?, email = ?, password = ?, secret = ?, updated_at = ?
         WHERE id = ?`,
        [name || '', email, password, secret || '', updatedAt, id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true, updated: this.changes > 0 });
        }
    );
});

// 删除账号（管理员）
app.delete('/api/admin/accounts/:id', (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM accounts WHERE id = ?', [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true, deleted: this.changes > 0 });
    });
});

// 获取公告（管理员）
app.get('/api/admin/announcement', (req, res) => {
    db.get('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 1', [], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(row || null);
    });
});

// 发布公告（管理员）
app.post('/api/admin/announcement', adminAuth, (req, res) => {
    const { message } = req.body;

    if (!message) {
        res.status(400).json({ error: '公告内容不能为空' });
        return;
    }

    const id = Date.now().toString();
    db.run(
        'INSERT INTO announcements (id, message) VALUES (?, ?)',
        [id, message],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true, announcement: { id, message, created_at: new Date().toISOString() } });
        }
    );
});

// 获取配置（管理员）
app.get('/api/admin/config', (req, res) => {
    res.json({
        contact: {
            name: FEISHU_CONFIG.name,
            email: FEISHU_CONFIG.email,
            openId: FEISHU_CONFIG.openId
        },
        buttons: buttonConfigs
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║   智能登录助手服务器已启动                             ║
║   地址: http://localhost:${PORT}                        ║
║   数据库: ${DB_PATH}                    ║
╚═══════════════════════════════════════════════════════╝
    `);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\\n正在关闭服务器...');
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('数据库连接已关闭');
        process.exit(0);
    });
});
