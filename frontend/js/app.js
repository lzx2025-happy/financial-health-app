// 前端应用主逻辑
class FinancialHealthApp {
    constructor() {
        this.currentUser = null;
        this.charts = {};
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuthStatus();
        this.initCharts();
    }

    bindEvents() {
        // 登录注册切换
        document.getElementById('show-register').addEventListener('click', (e) => {
            e.preventDefault();
            this.showPage('register-page');
        });

        document.getElementById('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            this.showPage('login-page');
        });

        // 表单提交
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // 退出登录
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.handleLogout();
        });

        // 导航菜单
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.showContentPage(page);
            });
        });

        // 同步数据
        document.getElementById('sync-data').addEventListener('click', () => {
            this.syncFinancialData();
        });
    }

    async checkAuthStatus() {
        try {
            const token = localStorage.getItem('authToken');
            if (token) {
                const response = await fetch('/api/auth/me', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    this.currentUser = await response.json();
                    this.showMainApp();
                } else {
                    this.showLogin();
                }
            } else {
                this.showLogin();
            }
        } catch (error) {
            console.error('检查认证状态失败:', error);
            this.showLogin();
        }
    }

    async handleLogin() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('authToken', data.token);
                this.currentUser = data.user;
                this.showMainApp();
            } else {
                this.showError(data.message);
            }
        } catch (error) {
            this.showError('登录失败，请重试');
        }
    }

    async handleRegister() {
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.showSuccess('注册成功，请登录');
                this.showPage('login-page');
            } else {
                this.showError(data.message);
            }
        } catch (error) {
            this.showError('注册失败，请重试');
        }
    }

    handleLogout() {
        localStorage.removeItem('authToken');
        this.currentUser = null;
        this.showLogin();
    }

    showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(pageId).classList.add('active');
    }

    showContentPage(pageId) {
        document.querySelectorAll('.content-page').forEach(page => {
            page.classList.remove('active');
        });
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        document.getElementById(`${pageId}-page`).classList.add('active');
        document.querySelector(`[data-page="${pageId}"]`).classList.add('active');

        // 加载页面特定内容
        this.loadPageContent(pageId);
    }

    showLogin() {
        this.showPage('login-page');
    }

    showMainApp() {
        this.showPage('main-app');
        this.updateUserInfo();
        this.loadDashboardData();
    }

    updateUserInfo() {
        if (this.currentUser) {
            document.getElementById('user-name').textContent = this.currentUser.name;
            document.getElementById('user-avatar').textContent = this.currentUser.name.charAt(0);
        }
    }

    async loadDashboardData() {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/dashboard', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.updateDashboard(data);
            }
        } catch (error) {
            console.error('加载仪表盘数据失败:', error);
        }
    }

    updateDashboard(data) {
        // 更新健康评分
        document.getElementById('health-score').textContent = data.healthScore;
        document.getElementById('health-grade').textContent = data.grade;
        
        // 更新指标
        this.updateIndicator('debt-ratio-indicator', data.indicators.debtRatio);
        this.updateIndicator('savings-rate-indicator', data.indicators.savingsRate);
        this.updateIndicator('emergency-ratio-indicator', data.indicators.emergencyRatio);

        // 更新预警列表
        this.updateAlerts(data.alerts);

        // 更新建议列表
        this.updateRecommendations(data.recommendations);

        // 更新图表
        this.updateCharts(data.charts);

        // 更新目标列表
        this.updateGoals(data.goals);
    }

    updateIndicator(indicatorId, value) {
        const indicator = document.getElementById(indicatorId);
        const progressBar = indicator.querySelector('.indicator-progress');
        const valueElement = indicator.querySelector('.indicator-value');
        
        const percentage = value * 100;
        progressBar.style.width = `${percentage}%`;
        valueElement.textContent = `${percentage.toFixed(1)}%`;
        
        // 根据数值设置颜色
        if (percentage > 70) {
            progressBar.style.background = 'var(--secondary)';
        } else if (percentage > 40) {
            progressBar.style.background = 'var(--warning)';
        } else {
            progressBar.style.background = 'var(--danger)';
        }
    }

    updateAlerts(alerts) {
        const alertsList = document.getElementById('alerts-list');
        alertsList.innerHTML = alerts.map(alert => `
            <div class="alert-item ${alert.type}">
                <div class="alert-icon">
                    <i class="fas fa-${alert.icon}"></i>
                </div>
                <div class="alert-content">
                    <div class="alert-title">${alert.title}</div>
                    <div class="alert-desc">${alert.description}</div>
                </div>
            </div>
        `).join('');
    }

    updateRecommendations(recommendations) {
        const recommendationsList = document.getElementById('recommendations-list');
        recommendationsList.innerHTML = recommendations.map(rec => `
            <div class="recommendation-item">
                <div class="recommendation-icon">
                    <i class="fas fa-${rec.icon}"></i>
                </div>
                <div class="recommendation-content">
                    <div class="recommendation-title">${rec.title}</div>
                    <div class="recommendation-desc">${rec.description}</div>
                </div>
            </div>
        `).join('');
    }

    updateGoals(goals) {
        const goalsList = document.getElementById('goals-list');
        goalsList.innerHTML = goals.map(goal => `
            <div class="goal-item">
                <div class="goal-icon">
                    <i class="fas fa-${goal.icon}"></i>
                </div>
                <div class="goal-info">
                    <div class="goal-header">
                        <div class="goal-name">${goal.name}</div>
                        <div class="goal-amount">${goal.currentAmount}/${goal.targetAmount}</div>
                    </div>
                    <div>目标日期: ${goal.targetDate}</div>
                    <div class="goal-progress">
                        <div class="goal-progress-bar" style="width: ${goal.progress}%"></div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    initCharts() {
        // 初始化资产分布图表
        const assetsCtx = document.getElementById('assets-chart').getContext('2d');
        this.charts.assets = new Chart(assetsCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#1e88e5', '#43a047', '#fbc02d', '#ab47bc', 
                        '#26c6da', '#ff7043', '#78909c', '#bdbdbd'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });

        // 初始化现金流图表
        const cashflowCtx = document.getElementById('cashflow-chart').getContext('2d');
        this.charts.cashflow = new Chart(cashflowCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: '收入',
                        data: [],
                        backgroundColor: '#4caf50'
                    },
                    {
                        label: '支出',
                        data: [],
                        backgroundColor: '#f44336'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    updateCharts(chartData) {
        if (chartData.assets) {
            this.charts.assets.data.labels = chartData.assets.labels;
            this.charts.assets.data.datasets[0].data = chartData.assets.data;
            this.charts.assets.update();
        }

        if (chartData.cashflow) {
            this.charts.cashflow.data.labels = chartData.cashflow.labels;
            this.charts.cashflow.data.datasets[0].data = chartData.cashflow.income;
            this.charts.cashflow.data.datasets[1].data = chartData.cashflow.expense;
            this.charts.cashflow.update();
        }
    }

    async syncFinancialData() {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/data/sync', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                this.showSuccess('数据同步成功');
                this.loadDashboardData();
            } else {
                this.showError('数据同步失败');
            }
        } catch (error) {
            this.showError('数据同步失败');
        }
    }

    async loadPageContent(pageId) {
        // 这里可以根据页面ID加载不同的内容
        // 例如：加载账户列表、交易记录等
        console.log(`加载页面: ${pageId}`);
    }

    showError(message) {
        // 实现错误提示
        alert(`错误: ${message}`);
    }

    showSuccess(message) {
        // 实现成功提示
        alert(`成功: ${message}`);
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    new FinancialHealthApp();
});
// 模拟登录功能
document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (email && password) {
        // 隐藏登录页，显示主应用
        document.getElementById('login-page').classList.remove('active');
        document.getElementById('main-app').classList.add('active');
        
        // 加载模拟数据
        loadMockData();
    } else {
        alert('请输入邮箱和密码');
    }
});

// 模拟注册功能
document.getElementById('register-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    
    if (name && email && password) {
        alert('注册成功！已自动登录');
        document.getElementById('register-page').classList.remove('active');
        document.getElementById('main-app').classList.add('active');
        loadMockData();
    }
});

// 加载模拟数据
function loadMockData() {
    // 这里填充模拟的财务数据
    document.getElementById('health-score').textContent = '78';
    document.getElementById('health-grade').textContent = '良好';
    
    // 更新其他UI元素...
}