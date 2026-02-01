/**
 * 认证检查脚本 - 使用 Supabase Auth
 * 在需要保护的页面中引入此脚本
 *
 * 依赖：auth-manager.js
 */
(function() {
    'use strict';

    // 获取当前页面路径
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // 检查是否使用新的认证系统
    const useNewAuth = typeof window.SupabaseAuth !== 'undefined';

    // 检查是否已登录（旧版 - 兼容保留）
    function checkAuthLegacy() {
        const authToken = sessionStorage.getItem('auth_token');
        const authTimestamp = sessionStorage.getItem('auth_timestamp');

        if (!authToken || !authTimestamp) {
            return false;
        }

        const now = Date.now();
        const elapsed = now - parseInt(authTimestamp);

        // 检查是否过期（2小时）
        if (elapsed > 2 * 60 * 60 * 1000) {
            sessionStorage.removeItem('auth_token');
            sessionStorage.removeItem('auth_timestamp');
            return false;
        }

        return true;
    }

    // 跳转到登录页
    function redirectToLogin() {
        const loginPage = 'login.html';  // 现在统一使用 login.html
        const redirectUrl = `${loginPage}?redirect=${encodeURIComponent(currentPage)}`;
        window.location.href = redirectUrl;
    }

    // 页面加载时检查认证
    async function performAuthCheck() {
        if (useNewAuth) {
            // 使用新的 Supabase Auth
            const authenticated = await window.SupabaseAuth.isAuthenticated();
            if (!authenticated) {
                redirectToLogin();
                return false;
            }
            return true;
        } else {
            // 使用旧的简单密码验证
            const authenticated = checkAuthLegacy();
            if (!authenticated) {
                redirectToLogin();
                return false;
            }
            return true;
        }
    }

    // 根据页面加载状态执行检查
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            performAuthCheck();
        });
    } else {
        performAuthCheck();
    }

    // 暴露到全局，供其他脚本使用
    window.checkAuthentication = async function() {
        if (useNewAuth) {
            return await window.SupabaseAuth.isAuthenticated();
        }
        return checkAuthLegacy();
    };

    window.logout = async function() {
        if (useNewAuth && window.SupabaseAuth) {
            await window.SupabaseAuth.logout();
            window.location.href = 'login.html';
        } else {
            sessionStorage.removeItem('auth_token');
            sessionStorage.removeItem('auth_timestamp');
            window.location.href = 'login.html';
        }
    };

    // 向后兼容
    window.isAuthenticated = function() {
        // 同步版本（返回之前的状态，不推荐用于新代码）
        if (useNewAuth) {
            console.warn('isAuthenticated() 已过时，请使用 await checkAuthentication()');
            return null; // 无法同步检查
        }
        return checkAuthLegacy();
    };
})();
