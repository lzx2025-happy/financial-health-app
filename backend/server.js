console.log('🔍 收到的 MONGODB_URL:', process.env.MONGODB_URL ? '已设置' : '未设置');
console.log('🔍 完整字符串:', process.env.MONGODB_URL ? process.env.MONGODB_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') : '未设置');
console.log('🔍 收到的 MONGO_URL:', process.env.MONGO_URL ? '已设置' : '未设置');
console.log('🔍 收到的 DATABASE_URL:', process.env.DATABASE_URL ? '已设置' : '未设置');

require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// ========== 环境变量配置 ==========
const PORT = process.env.PORT || 3000;  // Railway会提供PORT

const JWT_SECRET = process.env.JWT_SECRET || process.env.JMT_SECRET || 'dev-secret-key-2023-financial-health';
const MONGODB_URI = process.env.MONGO_URL || process.env.DATABASE_URL || process.env.MONGODB_URL || process.env.MONGOOD_URL || 'mongodb://localhost:27017/financial_health';
const NODE_ENV = process.env.NODE_ENV || 'development';

// ========== 启动日志 ==========
console.log('\n🚀 ========== 金融健康应用启动 ==========');
console.log(`📅 时间: ${new Date().toISOString()}`);
console.log(`🌍 环境: ${NODE_ENV}`);
console.log(`📡 端口: ${PORT}`);
console.log(`🔐 JWT_SECRET 已设置: ${!!JWT_SECRET}`);
console.log(`🗄️  MONGODB_URI 已设置: ${!!MONGODB_URI}`);

if (NODE_ENV === 'production' && !JWT_SECRET.includes('dev-secret')) {
  console.warn('⚠️  警告：生产环境未设置 JWT_SECRET，使用默认值不安全！');
}

// ========== 中间件配置 ==========
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// ========== 数据库连接 ==========
console.log('\n🔄 连接数据库中...');

if (!MONGODB_URI) {
  console.error('❌ 错误：MongoDB 连接字符串未设置！');
  process.exit(1);
}

const safeURI = MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
console.log(`🔗 使用连接字符串: ${safeURI}`);

// 修改数据库连接部分（第60-100行左右）

// 修改数据库连接部分
async function connectDatabase() {
  try {
    console.log('🔄 正在连接 MongoDB...');
    
    // 获取连接字符串
    const connectionString = process.env.MONGO_URL;
    console.log('🔍 连接字符串:', connectionString ? '已设置' : '未设置');
    
    if (!connectionString) {
      console.error('❌ MONGO_URL 环境变量未设置！');
      console.log('💡 Railway应该自动提供这个变量');
      return false;
    }
    
    // 安全显示连接字符串（隐藏密码）
    const safeString = connectionString.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
    console.log(`🔗 连接字符串: ${safeString}`);
    
    // 设置较短的超时时间
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('数据库连接超时(10秒)')), 10000);
    });
    
    // 尝试连接
    const connectPromise = mongoose.connect(connectionString, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
    });
    
    // 使用Promise.race确保不会无限等待
    await Promise.race([connectPromise, timeoutPromise]);
    
    console.log('✅ MongoDB 连接成功！');
    console.log(`   数据库: ${mongoose.connection.name}`);
    console.log(`   主机: ${mongoose.connection.host}`);
    console.log(`   端口: ${mongoose.connection.port}`);
    
    return true;
  } catch (error) {
    console.error('❌ MongoDB 连接失败:');
    console.error(`   错误: ${error.message}`);
    console.error(`   错误类型: ${error.name}`);
    
    // 显示更多调试信息
    if (error.name === 'MongoParseError') {
      console.error('💡 提示: 连接字符串格式错误');
    } else if (error.name === 'MongoNetworkError') {
      console.error('💡 提示: 网络连接失败，请检查:');
      console.error('   1. Railway MongoDB服务状态');
      console.error('   2. 网络连通性');
      console.error('   3. IP白名单设置');
    }
    
    return false;
  }
}

let dbConnected = false;

(async function connectDB() {
  try {
    dbConnected = await connectDatabase();
    console.log(`✅ 数据库连接状态: ${dbConnected ? '已连接' : '未连接'}`);
  } catch (error) {
    console.error('数据库连接初始化失败:', error.message);
    dbConnected = false;
  }
})();

mongoose.connection.on('connected', () => {
  console.log('📊 MongoDB 已连接');
  dbConnected = true;
});

mongoose.connection.on('error', (err) => {
  console.error('⚠️  MongoDB 连接错误:', err.message);
  dbConnected = false;
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB 连接断开');
  dbConnected = false;
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

// 1. 根路径
app.get('/', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    success: true,
    message: '金融健康应用后端服务',
    version: '1.0.0',
    environment: NODE_ENV,
    database: dbStatus,
    databaseConnected: dbConnected,
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      test: '/test',
      publicTest: '/api/public/test',
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      dashboard: 'GET /api/dashboard (需要认证)'
    }
  });
});

// 2. 健康检查
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({ 
    success: true,
    status: 'ok',
    service: 'financial-health-app',
    database: dbStatus,
    databaseConnected: dbConnected,
    environment: NODE_ENV,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 3. 简单测试
app.get('/test', (req, res) => {
  res.json({ 
    success: true,
    message: '简单测试成功',
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: NODE_ENV
  });
});

// 4. 公开测试端点
app.get('/api/public/test', (req, res) => {
  res.json({ 
    success: true,
    message: '金融健康应用API测试成功',
    timestamp: new Date().toISOString(),
    cors: 'enabled',
    database: dbConnected ? 'connected' : 'disconnected',
    port: PORT,
    environment: NODE_ENV
  });
});

// 5. 用户注册
app.post('/api/auth/register', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({
        success: false,
        message: '数据库服务暂时不可用，请稍后重试'
      });
    }

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: '请提供姓名、邮箱和密码'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: '该邮箱已被注册'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ 
      name, 
      email: email.toLowerCase().trim(), 
      password: hashedPassword 
    });
    
    await user.save();

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

// 6. 用户登录
app.post('/api/auth/login', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({
        success: false,
        message: '数据库服务暂时不可用，请稍后重试'
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: '请提供邮箱和密码'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '邮箱或密码错误'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '邮箱或密码错误'
      });
    }

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

// 7. 获取当前用户信息
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

// 8. 仪表盘数据
app.get('/api/dashboard', authMiddleware, async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({
        success: false,
        message: '数据库服务暂时不可用，请稍后重试'
      });
    }

    const transactions = await Transaction.find({ userId: req.user._id });
    
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const balance = totalIncome - totalExpense;
    
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
          databaseConnected: dbConnected,
          timestamp: new Date().toISOString()
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

// 9. 交易管理 API
app.post('/api/transactions', authMiddleware, async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({
        success: false,
        message: '数据库服务暂时不可用，请稍后重试'
      });
    }

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
    if (!dbConnected) {
      return res.status(503).json({
        success: false,
        message: '数据库服务暂时不可用，请稍后重试'
      });
    }

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

// 10. 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
    path: req.path
  });
});

// 11. 错误处理中间件
app.use((err, req, res, next) => {
  console.error('🚨 未捕获的错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: NODE_ENV === 'development' ? err.message : undefined
  });
});

// ========== 启动服务器 ==========
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('\n✅ ========== 服务器启动成功 ==========');
  console.log(`📍 监听地址: 0.0.0.0:${PORT}`);
  console.log(`🌐 对外访问: https://financial-health-app-up.railway.app`);
  console.log(`📊 健康检查: /health`);
  console.log(`🔍 简单测试: /test`);
  console.log(`🔍 公开测试: /api/public/test`);
  console.log(`🔐 注册接口: POST /api/auth/register`);
  console.log(`🔑 登录接口: POST /api/auth/login`);
  console.log(`📈 仪表盘: GET /api/dashboard (需要认证)`);
  console.log(`💾 数据库状态: ${dbConnected ? '已连接' : '未连接'}`);
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

// 全局错误处理
process.on('uncaughtException', (error) => {
  console.error('🚨 未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 未处理的 Promise 拒绝:', reason);
});

module.exports = app;