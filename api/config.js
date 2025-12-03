// api/config.js
const API_CONFIG = {
  BASE_URL: "https://financial-health-app-up.railway.app",
  ENDPOINTS: {
    AUTH: {
      LOGIN: "/api/auth/login",
      REGISTER: "/api/auth/register",
      PROFILE: "/api/auth/profile"
    },
    TRANSACTIONS: {
      LIST: "/api/transactions",
      CREATE: "/api/transactions",
      SUMMARY: "/api/transactions/summary"
    },
    DASHBOARD: "/api/dashboard",
    CATEGORIES: "/api/categories",
    GOALS: "/api/goals"
  }
};

// 导出配置
window.API_CONFIG = API_CONFIG;