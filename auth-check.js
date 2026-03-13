/**
 * 认证检查脚本 - 本地密码认证
 * 在需要保护的页面中引入此脚本
 *
 * 依赖：auth-manager.js
 */
(function() {
    'use strict';

    // 获取当前页面路径
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // 跳转到登录页
    function redirectToLogin() {
        const loginPage = 'login.html';
        const redirectUrl = `${loginPage}?redirect=${encodeURIComponent(currentPage)}`;
        window.location.href = redirectUrl;
    }

    // 检查认证状态
    function checkAuth() {
        // 使用本地认证
        if (typeof window.LocalAuth !== 'undefined') {
            return window.LocalAuth.isAuthenticated();
        }

        // 兼容旧的 sessionStorage 检查
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
            sessionStorage.removeItem('auth_user');
            return false;
        }

        return true;
    }

    // 页面加载时检查认证
    function performAuthCheck() {
        const authenticated = checkAuth();

        if (!authenticated) {
            redirectToLogin();
            return false;
        }

        return true;
    }

    // 根据页面加载状态执行检查
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', performAuthCheck);
    } else {
        performAuthCheck();
    }

    // 暴露到全局，供其他脚本使用
    window.checkAuthentication = function() {
        if (typeof window.LocalAuth !== 'undefined') {
            return Promise.resolve(window.LocalAuth.isAuthenticated());
        }
        return Promise.resolve(checkAuth());
    };

    window.logout = function() {
        if (typeof window.LocalAuth !== 'undefined') {
            window.LocalAuth.logout();
        } else {
            sessionStorage.removeItem('auth_token');
            sessionStorage.removeItem('auth_timestamp');
            sessionStorage.removeItem('auth_user');
        }
        window.location.href = 'login.html';
    };

    // 向后兼容
    window.isAuthenticated = function() {
        return checkAuth();
    };

    console.log('认证检查脚本已加载');
})();
