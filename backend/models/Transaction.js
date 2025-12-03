// services/transactions.js
class TransactionService {
  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
  }

  // 获取所有交易
  async getTransactions(filters = {}) {
    const token = authService.getToken();
    if (!token) throw new Error('未登录');

    try {
      const queryParams = new URLSearchParams(filters).toString();
      const url = `${this.baseUrl}${API_CONFIG.ENDPOINTS.TRANSACTIONS.LIST}${queryParams ? `?${queryParams}` : ''}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('获取交易失败');
      return await response.json();
    } catch (error) {
      console.error('获取交易错误:', error);
      throw error;
    }
  }

  // 添加交易
  async addTransaction(transactionData) {
    const token = authService.getToken();
    if (!token) throw new Error('未登录');

    try {
      const response = await fetch(`${this.baseUrl}${API_CONFIG.ENDPOINTS.TRANSACTIONS.CREATE}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(transactionData)
      });

      if (!response.ok) throw new Error('添加交易失败');
      return await response.json();
    } catch (error) {
      console.error('添加交易错误:', error);
      throw error;
    }
  }

  // 获取财务摘要
  async getSummary() {
    const token = authService.getToken();
    if (!token) throw new Error('未登录');

    try {
      const response = await fetch(`${this.baseUrl}${API_CONFIG.ENDPOINTS.TRANSACTIONS.SUMMARY}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('获取摘要失败');
      return await response.json();
    } catch (error) {
      console.error('获取摘要错误:', error);
      throw error;
    }
  }
}

window.transactionService = new TransactionService();