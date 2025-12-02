require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// ========== 环境变量配置 ==========
// Railway 会自动提供 PORT 变量
const PORT = process.env.PORT || 3000;

// 密钥配置 - Railway 优先
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-2023-financial-health';

// 数据库配置 - Railway 会自动注入 MONGODB_URI
const MONGODB_URI = 'mongodb://mongo:YcOzJNfIcWCHoeeXIyXojbTdKuLJfzH@crossover.proxy.rlwy.net:42773/admin?authSource=admin';
// CORS 配置
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// 环境类型
const NODE_ENV = process.env.NODE_ENV || 'development';

// ========== 启动日志 ==========
console.log('\n🚀 ========== 金融健康应用启动 ==========');
console.log(`📅 时间: ${new Date().toISOString()}`);
console.log(`🌍 环境: ${NODE_ENV}`);
console.log(`📡 端口: ${PORT}`);
console.log(`🔐 JWT_SECRET 已设置: ${!!process.env.JWT_SECRET}`);
console.log(`🗄️  MONGODB_URI 已设置: ${!!process.env.MONGODB_URI}`);
console.log(`🎯 CORS_ORIGIN: ${CORS_ORIGIN}`);

// 安全警告
if (NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.warn('⚠️  警告：生产环境未设置 JWT_SECRET，使用默认值不安全！');
  console.warn('💡 请在 Railway 中添加环境变量：JWT_SECRET');
}

// ========== 中间件配置 ==========
app.use(cors({
  origin: CORS_ORIGIN === '*' ? '*' : CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// ========== 数据库连接 ==========
console.log('\n🔄 连接数据库中...');

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  w: 'majority'
});

mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB 连接成功！');
  console.log(`  数据库: ${mongoose.connection.name}`);
  console.log(`  主机: ${mongoose.connection.host}`);
  console.log(`  端口: ${mongoose.connection.port}`);
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB 连接失败:');
  console.error(`  错误: ${err.message}`);
  console.error(`  连接字符串: ${MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB 连接断开');
});

// ========== 数据模型 ==========
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, required: true },
  description: { type: String },
  date: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);

// ========== 认证中间件 ==========
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: '未提供认证令牌' 
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: '用户不存在或令牌无效' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('认证错误:', error.message);
    return res.status(401).json({ 
      success: false, 
      message: '认证失败，请重新登录' 
    });
  }
};

// ========== API 路由 ==========

// 1. 健康检查
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '金融健康应用后端服务',
    version: '1.0.0',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    documentation: '/api-docs'
  });
});

app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({ 
    success: true,
    status: 'ok',
    service: 'financial-health-app',
    database: dbStatus,
    environment: NODE_ENV,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 2. 用户注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 验证输入
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: '请提供姓名、邮箱和密码'
      });
    }

    // 检查用户是否已存在
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: '该邮箱已被注册'
      });
    }

    // 创建用户
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ 
      name, 
      email: email.toLowerCase().trim(), 
      password: hashedPassword 
    });
    
    await user.save();

    // 生成令牌
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 3. 用户登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: '请提供邮箱和密码'
      });
    }

    // 查找用户
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '邮箱或密码错误'
      });
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '邮箱或密码错误'
      });
    }

    // 生成令牌
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 4. 获取当前用户信息
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        createdAt: req.user.createdAt
      }
    }
  });
});

// 5. 仪表盘数据
app.get('/api/dashboard', authMiddleware, async (req, res) => {
  try {
    // 获取用户的交易记录
    const transactions = await Transaction.find({ userId: req.user._id });
    
    // 计算财务指标
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const balance = totalIncome - totalExpense;
    
    // 财务健康评分（简单计算）
    const healthScore = Math.min(100, Math.max(0, 
      balance > 0 ? 70 + (balance / totalIncome * 30) : 30
    ));

    res.json({
      success: true,
      data: {
        summary: {
          totalIncome,
          totalExpense,
          balance,
          transactionCount: transactions.length
        },
        healthScore: Math.round(healthScore),
        healthGrade: healthScore >= 80 ? '优秀' : 
                    healthScore >= 60 ? '良好' : 
                    healthScore >= 40 ? '一般' : '需改善',
        recentTransactions: transactions
          .sort((a, b) => b.date - a.date)
          .slice(0, 5),
        serverInfo: {
          environment: NODE_ENV,
          timestamp: new Date().toISOString(),
          service: 'Railway 部署'
        }
      }
    });
  } catch (error) {
    console.error('获取仪表盘错误:', error);
    res.status(500).json({
      success: false,
      message: '获取数据失败'
    });
  }
});

// 6. 交易管理 API
app.post('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const { type, amount, category, description, date } = req.body;
    
    if (!type || !amount || !category) {
      return res.status(400).json({
        success: false,
        message: '请提供交易类型、金额和分类'
      });
    }

    const transaction = new Transaction({
      userId: req.user._id,
      type,
      amount,
      category,
      description,
      date: date || new Date()
    });

    await transaction.save();

    res.status(201).json({
      success: true,
      message: '交易记录创建成功',
      data: { transaction }
    });
  } catch (error) {
    console.error('创建交易错误:', error);
    res.status(500).json({
      success: false,
      message: '创建交易失败'
    });
  }
});

app.get('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user._id })
      .sort({ date: -1 });
    
    res.json({
      success: true,
      data: { transactions }
    });
  } catch (error) {
    console.error('获取交易错误:', error);
    res.status(500).json({
      success: false,
      message: '获取交易记录失败'
    });
  }
});

// 7. 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
    path: req.path
  });
});

// 8. 错误处理中间件
app.use((err, req, res, next) => {
  console.error('🚨 未捕获的错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: NODE_ENV === 'development' ? err.message : undefined
  });
});

// ========== 启动服务器 ==========
const server = app.listen(PORT, () => {
  console.log('\n✅ ========== 服务器启动成功 ==========');
  console.log(`📍 本地访问: http://localhost:${PORT}`);
  console.log(`🌐 健康检查: /health`);
  console.log(`🔐 注册接口: POST /api/auth/register`);
  console.log(`🔑 登录接口: POST /api/auth/login`);
  console.log(`📊 仪表盘: GET /api/dashboard (需要认证)`);
  console.log(`⏰ 启动时间: ${new Date().toISOString()}`);
  console.log(`======================================\n`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('🛑 收到 SIGTERM 信号，正在关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    mongoose.connection.close(false, () => {
      console.log('✅ 数据库连接已关闭');
      process.exit(0);
    });
  });
});

module.exports = app;