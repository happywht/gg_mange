/**
 * Supabase Auth 认证管理器
 * 替代原有的简单密码验证，使用真正的用户认证
 */

(function() {
  'use strict';

  // 配置
  const CONFIG = {
    // 管理员邮箱列表（需要在 Supabase 控制台创建对应的用户）
    adminEmails: ['wanghaitao@sucdri.com'],
    // 会话超时时间（毫秒）- 2小时
    sessionTimeout: 2 * 60 * 60 * 1000
  };

  // Supabase 客户端（延迟初始化）
  let supabaseClient = null;

  /**
   * 初始化 Supabase 客户端
   */
  function initSupabase() {
    if (supabaseClient) return supabaseClient;

    if (typeof supabase === 'undefined' ||
        typeof window.SUPABASE_URL === 'undefined' ||
        typeof window.SUPABASE_ANON_KEY === 'undefined') {
      console.error('Supabase 未正确配置');
      return null;
    }

    supabaseClient = supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    );

    return supabaseClient;
  }

  /**
   * 获取当前会话信息
   */
  async function getSession() {
    const client = initSupabase();
    if (!client) return null;

    try {
      const { data: { session }, error } = await client.auth.getSession();
      if (error) {
        console.error('获取会话失败:', error);
        return null;
      }
      return session;
    } catch (e) {
      console.error('获取会话异常:', e);
      return null;
    }
  }

  /**
   * 检查是否已认证
   */
  async function isAuthenticated() {
    const session = await getSession();
    if (!session) return false;

    // 检查会话是否过期
    const now = Date.now();
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;

    if (now > expiresAt) {
      // 会话已过期，清除
      await logout();
      return false;
    }

    return true;
  }

  /**
   * 检查当前用户是否是管理员
   */
  async function isAdmin() {
    const session = await getSession();
    if (!session || !session.user) return false;

    const email = session.user.email;
    return CONFIG.adminEmails.includes(email);
  }

  /**
   * 登录（邮箱+密码）
   */
  async function signIn(email, password) {
    const client = initSupabase();
    if (!client) {
      return { success: false, error: 'Supabase 未配置' };
    }

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        console.error('登录失败:', error);
        return { success: false, error: error.message };
      }

      const user = data.user;
      const isAdminUser = CONFIG.adminEmails.includes(email);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          isAdmin: isAdminUser
        },
        session: data.session
      };
    } catch (e) {
      console.error('登录异常:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * 登出
   */
  async function logout() {
    const client = initSupabase();
    if (!client) return;

    try {
      await client.auth.signOut();
    } catch (e) {
      console.error('登出异常:', e);
    }
  }

  /**
   * 注册新用户
   */
  async function signUp(email, password, metadata = {}) {
    const client = initSupabase();
    if (!client) {
      return { success: false, error: 'Supabase 未配置' };
    }

    try {
      const { data, error } = await client.auth.signUp({
        email: email,
        password: password,
        options: {
          data: metadata
        }
      });

      if (error) {
        console.error('注册失败:', error);
        return { success: false, error: error.message };
      }

      return {
        success: true,
        user: data.user,
        session: data.session
      };
    } catch (e) {
      console.error('注册异常:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * 获取当前用户信息
   */
  async function getCurrentUser() {
    const session = await getSession();
    if (!session || !session.user) return null;

    const email = session.user.email;
    return {
      id: session.user.id,
      email: email,
      isAdmin: CONFIG.adminEmails.includes(email),
      metadata: session.user.user_metadata
    };
  }

  /**
   * 强制要求认证（用于受保护的页面）
   * 如果未认证，跳转到登录页
   */
  async function requireAuth(redirectTo = 'login.html') {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
      const currentUrl = window.location.href.split('?')[0];
      const currentPage = window.location.pathname.split('/').pop() || 'index.html';
      const redirectUrl = `${redirectTo}?redirect=${encodeURIComponent(currentPage)}`;
      window.location.href = redirectUrl;
      return false;
    }

    return true;
  }

  /**
   * 强制要求管理员权限（用于管理页面）
   */
  async function requireAdmin(redirectTo = 'login.html') {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      window.location.href = redirectTo;
      return false;
    }

    const adminUser = await isAdmin();
    if (!adminUser) {
      alert('您没有管理员权限');
      window.location.href = 'index.html';
      return false;
    }

    return true;
  }

  /**
   * 监听认证状态变化
   */
  function onAuthStateChange(callback) {
    const client = initSupabase();
    if (!client) return;

    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });

    return subscription;
  }

  // 导出 API
  window.SupabaseAuth = {
    // 会话管理
    getSession,
    getCurrentUser,
    isAuthenticated,
    isAdmin,

    // 认证操作
    signIn,
    signUp,
    logout,

    // 权限控制
    requireAuth,
    requireAdmin,

    // 工具函数
    onAuthStateChange,

    // 配置
    CONFIG
  };

  // 兼容旧的 API（平滑迁移）
  window.logout = logout;
  window.AuthManager = window.SupabaseAuth;

  console.log('Supabase Auth 认证管理器已加载');
})();
