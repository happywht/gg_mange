/**
 * 本地认证管理器
 * 使用固定密码进行本地认证，不依赖外部服务
 */

(function() {
  'use strict';

  // 配置
  const CONFIG = {
    // 固定密码
    password: 'Sucrdri2026',
    // 系统账号信息
    systemUser: {
      id: 'local-user-001',
      email: 'system@sucdri.com',
      name: 'SUCDRI001'
    },
    // 会话超时时间（毫秒）- 2小时
    sessionTimeout: 2 * 60 * 60 * 1000,
    // 存储键名
    storageKeys: {
      token: 'auth_token',
      timestamp: 'auth_timestamp',
      user: 'auth_user'
    }
  };

  /**
   * 检查是否已认证
   */
  function isAuthenticated() {
    const authToken = sessionStorage.getItem(CONFIG.storageKeys.token);
    const authTimestamp = sessionStorage.getItem(CONFIG.storageKeys.timestamp);

    if (!authToken || !authTimestamp) {
      return false;
    }

    const now = Date.now();
    const elapsed = now - parseInt(authTimestamp);

    // 检查是否过期
    if (elapsed > CONFIG.sessionTimeout) {
      // 会话已过期，清除
      _clearSession();
      return false;
    }

    // 更新时间戳，延长会话
    sessionStorage.setItem(CONFIG.storageKeys.timestamp, now.toString());

    return true;
  }

  /**
   * 登录验证
   * @param {string} password - 用户输入的密码
   * @returns {Promise<{success: boolean, error?: string, user?: object}>}
   */
  async function signIn(password) {
    // 模拟网络延迟，增加真实感
    await _delay(300);

    if (!password) {
      return { success: false, error: '请输入登录密码' };
    }

    // 验证密码
    if (password === CONFIG.password) {
      // 登录成功，创建会话
      const now = Date.now();
      const token = _generateToken();

      sessionStorage.setItem(CONFIG.storageKeys.token, token);
      sessionStorage.setItem(CONFIG.storageKeys.timestamp, now.toString());
      sessionStorage.setItem(CONFIG.storageKeys.user, JSON.stringify(CONFIG.systemUser));

      return {
        success: true,
        user: {
          id: CONFIG.systemUser.id,
          email: CONFIG.systemUser.email,
          name: CONFIG.systemUser.name,
          isAdmin: true
        },
        session: {
          token: token,
          expiresAt: now + CONFIG.sessionTimeout
        }
      };
    }

    // 密码错误
    return { success: false, error: '密码错误，请重新输入' };
  }

  /**
   * 登出
   */
  function logout() {
    _clearSession();
  }

  /**
   * 获取当前用户信息
   */
  function getCurrentUser() {
    if (!isAuthenticated()) {
      return null;
    }

    const userStr = sessionStorage.getItem(CONFIG.storageKeys.user);
    if (!userStr) {
      return null;
    }

    try {
      const user = JSON.parse(userStr);
      return {
        ...user,
        isAdmin: true
      };
    } catch (e) {
      console.error('解析用户信息失败:', e);
      return null;
    }
  }

  /**
   * 获取会话信息
   */
  function getSession() {
    if (!isAuthenticated()) {
      return null;
    }

    const authTimestamp = sessionStorage.getItem(CONFIG.storageKeys.timestamp);
    const user = getCurrentUser();

    return {
      user: user,
      expiresAt: parseInt(authTimestamp) + CONFIG.sessionTimeout,
      createdAt: parseInt(authTimestamp)
    };
  }

  /**
   * 检查是否是管理员（本地认证默认都是管理员）
   */
  function isAdmin() {
    return isAuthenticated();
  }

  /**
   * 强制要求认证（用于受保护的页面）
   * 如果未认证，跳转到登录页
   */
  function requireAuth(redirectTo = 'login.html') {
    if (!isAuthenticated()) {
      const currentPage = window.location.pathname.split('/').pop() || 'index.html';
      const redirectUrl = `${redirectTo}?redirect=${encodeURIComponent(currentPage)}`;
      window.location.href = redirectUrl;
      return false;
    }
    return true;
  }

  /**
   * 强制要求管理员权限（本地认证默认通过）
   */
  function requireAdmin(redirectTo = 'login.html') {
    return requireAuth(redirectTo);
  }

  /**
   * 生成随机令牌
   * @private
   */
  function _generateToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * 清除会话
   * @private
   */
  function _clearSession() {
    sessionStorage.removeItem(CONFIG.storageKeys.token);
    sessionStorage.removeItem(CONFIG.storageKeys.timestamp);
    sessionStorage.removeItem(CONFIG.storageKeys.user);
  }

  /**
   * 延迟函数
   * @private
   */
  function _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 导出 API - 本地认证
  window.LocalAuth = {
    // 会话管理
    getSession,
    getCurrentUser,
    isAuthenticated,
    isAdmin,

    // 认证操作
    signIn,
    logout,

    // 权限控制
    requireAuth,
    requireAdmin,

    // 配置（只读）
    CONFIG: {
      sessionTimeout: CONFIG.sessionTimeout
    }
  };

  // 兼容旧的 Supabase Auth API（平滑迁移）
  window.SupabaseAuth = {
    getSession,
    getCurrentUser,
    isAuthenticated,
    isAdmin,
    signIn: async (email, password) => {
      // 忽略 email 参数，只验证密码
      return signIn(password);
    },
    signUp: async () => ({ success: false, error: '本地认证不支持注册' }),
    logout,
    requireAuth,
    requireAdmin,
    onAuthStateChange: () => null,
    CONFIG: {}
  };

  // 兼容旧的 API
  window.logout = logout;
  window.AuthManager = window.LocalAuth;

  console.log('本地认证管理器已加载');
})();
