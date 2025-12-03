// services/auth.js
class AuthService {
  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
    this.tokenKey = 'financial_app_token';
  }

  // 登录
  async login(email, password) {
    try {
      const response = await fetch(`${this.baseUrl}${API_CONFIG.ENDPOINTS.AUTH.LOGIN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) throw new Error('登录失败');
      
      const data = await response.json();
      
      // 保存token
      if (data.token) {
        localStorage.setItem(this.tokenKey, data.token);
      }
      
      return data;
    } catch (error) {
      console.error('登录错误:', error);
      throw error;
    }
  }

  // 获取当前用户
  async getCurrentUser() {
    const token = this.getToken();
    if (!token) return null;

    try {
      const response = await fetch(`${this.baseUrl}${API_CONFIG.ENDPOINTS.AUTH.PROFILE}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('获取用户信息失败');
      return await response.json();
    } catch (error) {
      console.error('获取用户错误:', error);
      this.logout();
      return null;
    }
  }

  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
  }

  isAuthenticated() {
    return !!this.getToken();
  }
}

// 创建单例实例
window.authService = new AuthService();