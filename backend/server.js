const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// ========== 修改1：兼容两个变量名 ==========
const jwtSecret = process.env.JWT_SECRET || process.env.JMT_SECRET;
if (!jwtSecret) {
    console.error('❌ 错误：未设置 JWT_SECRET 或 JMT_SECRET 环境变量'); // 注意：是 JWT_SECRET
    process.exit(1);
}
console.log('🔑 JWT密钥状态:', jwtSecret ? '已设置' : '未设置');
// ========== 修改结束 ==========
// 中间件
app.use(cors());
app.use(express.json());

// ========== 数据库连接处理 - 增强版 ==========
console.log('🔍 检查环境变量...');

// 尝试获取 MongoDB 连接字符串的多种可能名称
let mongoURI = process.env.MONGODB_URI || process.env.DATABASE_URL || process.env.MONGO_URL;

console.log('原始 MONGODB_URI:', process.env.MONGODB_URI ? '已设置' : '未设置');
console.log('原始 DATABASE_URL:', process.env.DATABASE_URL ? '已设置' : '未设置');
console.log('原始 MONGO_URL:', process.env.MONGO_URL ? '已设置' : '未设置');

// 清理连接字符串：移除所有空白字符（空格、换行等）
if (mongoURI) {
  // 移除所有空格、换行、制表符等空白字符
  mongoURI = mongoURI.replace(/\s/g, '');
  console.log('清理后的连接字符串:', mongoURI.substring(0, 60) + '...');
} else {
  // 如果所有环境变量都没有，使用 Railway 内部默认地址
  console.log('⚠️ 未找到MongoDB连接字符串，使用默认地址');
  mongoURI = 'mongodb://mongo:27017/financial_health';
}

// 连接数据库
console.log('正在连接 MongoDB...');
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000, // 10秒超时
  socketTimeoutMS: 45000,
});

mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB 连接成功！');
  console.log('数据库地址:', mongoose.connection.host);
  console.log('数据库名称:', mongoose.connection.name);
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB 连接失败:');
  console.error('错误信息:', err.message);
  console.error('错误代码:', err.code);
  console.error('使用的连接字符串:', mongoURI);
  
  // 如果是认证错误，提示检查密码
  if (err.code === 8000 || err.message.includes('authentication')) {
    console.error('💡 提示：请检查MongoDB用户名和密码是否正确');
  }
});
// ========== 结束数据库连接处理 ==========

// 数据模型
const User = require('./models/User');
const Transaction = require('./models/Transaction');

// 认证中间件
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ message: '未提供认证令牌' });
        }

        // ========== 修改2：使用 jwtSecret 变量 ==========
        const decoded = jwt.verify(token, jwtSecret);
        // ========== 修改结束 ==========
        
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ message: '认证失败' });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ message: '认证失败' });
    }
};

// 健康检查端点（Railway 需要）
app.get('/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.status(200).json({ 
        status: 'ok',
        timestamp: new Date(),
        mongodb: dbStatus,
        environment: process.env.NODE_ENV || 'development'
    });
});

// 路由
// 认证路由
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // 检查用户是否已存在
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: '用户已存在' });
        }

        // 创建新用户
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({
            name,
            email,
            password: hashedPassword
        });

        await user.save();

        // 生成JWT令牌
        // ========== 修改3：使用 jwtSecret 变量 ==========
        const token = jwt.sign(
            { userId: user._id },
            jwtSecret,
            { expiresIn: '7d' }
        );
        // ========== 修改结束 ==========

        res.status(201).json({
            message: '用户创建成功',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 查找用户
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: '用户不存在' });
        }

        // 验证密码
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: '密码错误' });
        }

        // 生成JWT令牌
        // ========== 修改4：使用 jwtSecret 变量 ==========
        const token = jwt.sign(
            { userId: user._id },
            jwtSecret,
            { expiresIn: '7d' }
        );
        // ========== 修改结束 ==========

        res.json({
            message: '登录成功',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.json({
        id: req.user._id,
        name: req.user.name,
        email: req.user.email
    });
});

// 仪表盘数据
app.get('/api/dashboard', authMiddleware, async (req, res) => {
    try {
        // 这里应该从数据库获取真实数据
        // 现在返回模拟数据
        const dashboardData = {
            healthScore: 78,
            grade: '良好',
            indicators: {
                debtRatio: 0.32,
                savingsRate: 0.25,
                emergencyRatio: 0.7
            },
            alerts: [
                {
                    type: 'warning',
                    icon: 'credit-card',
                    title: '信用卡还款提醒',
                    description: '招商银行信用卡将于3天后到期，应还金额 2,450元'
                },
                {
                    type: 'danger',
                    icon: 'chart-pie',
                    title: '资产集中风险',
                    description: '股票资产占比过高（42%），超出建议范围'
                }
            ],
            recommendations: [
                {
                    icon: 'plus-circle',
                    title: '增加应急资金',
                    description: '建议将3个月支出作为应急金存入活期账户'
                },
                {
                    icon: 'exchange-alt',
                    title: '分散股票投资',
                    description: '将部分股票资产转为债券或基金，降低风险'
                }
            ],
            charts: {
                assets: {
                    labels: ['活期存款', '定期理财', '股票', '基金', '债券'],
                    data: [18, 22, 28, 15, 8]
                },
                cashflow: {
                    labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
                    income: [12000, 15000, 13000, 14000, 16000, 15500],
                    expense: [8000, 9500, 8200, 8800, 10200, 9800]
                }
            },
            goals: [
                {
                    icon: 'graduation-cap',
                    name: '子女教育基金',
                    currentAmount: '¥120,000',
                    targetAmount: '¥200,000',
                    targetDate: '2025年9月',
                    progress: 60
                },
                {
                    icon: 'home',
                    name: '购房首付',
                    currentAmount: '¥180,000',
                    targetAmount: '¥500,000',
                    targetDate: '2027年5月',
                    progress: 36
                }
            ]
        };

        res.json(dashboardData);
    } catch (error) {
        console.error('获取仪表盘错误:', error);
        res.status(500).json({ message: '获取仪表盘数据失败' });
    }
});

// 数据同步
app.post('/api/data/sync', authMiddleware, async (req, res) => {
    try {
        // 这里应该实现真实的数据同步逻辑
        // 例如：连接银行API、处理上传的文件等
        
        // 模拟同步过程
        setTimeout(() => {
            res.json({ message: '数据同步成功', syncedAt: new Date() });
        }, 2000);
    } catch (error) {
        console.error('数据同步错误:', error);
        res.status(500).json({ message: '数据同步失败' });
    }
});

// 文件上传
app.post('/api/upload/csv', authMiddleware, async (req, res) => {
    try {
        // 这里应该实现CSV文件解析和数据处理
        res.json({ message: '文件上传成功', processed: true });
    } catch (error) {
        console.error('文件上传错误:', error);
        res.status(500).json({ message: '文件处理失败' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 服务器运行在端口 ${PORT}`);
    console.log(`📊 健康检查: http://localhost:${PORT}/health`);
    console.log(`🔄 Railway 自动部署版本: ${new Date().toISOString()}`);
});