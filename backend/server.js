const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// ========== 环境变量诊断 ==========
console.log('🔍 === Railway 环境诊断开始 ===');
console.log('部署时间:', new Date().toISOString());

// 检查所有可能的密钥变量名
const possibleSecretKeys = [
  'JWT_SECRET', 'JMT_SECRET', 'JNT_SECRET',
  'APP_SECRET', 'SECRET_KEY', 'TOKEN_SECRET',
  'API_KEY', 'SECRET'
];

let jwtSecret = null;
let foundKey = null;

for (const key of possibleSecretKeys) {
  if (process.env[key]) {
    jwtSecret = process.env[key];
    foundKey = key;
    console.log(`✅ 找到密钥变量: ${key} (值长度: ${jwtSecret.length})`);
    break;
  }
}

if (!jwtSecret) {
  console.log('❌ 未找到任何密钥环境变量');
  console.log('所有包含 SECRET/KEY 的变量:', 
    Object.keys(process.env).filter(k => 
      k.includes('SECRET') || k.includes('KEY') || k.includes('TOKEN')
    )
  );
  
  // 使用硬编码密钥（仅用于测试！）
  jwtSecret = 'RailwayTestHardcodedSecret123!@#2023';
  console.log('⚠️ 警告：使用硬编码密钥（仅用于测试部署）');
} else {
  console.log(`✅ 使用密钥变量: ${foundKey}`);
}

// 检查数据库连接变量
const possibleDbKeys = ['DATABASE_URL', 'MONGODB_URI', 'MONGO_URL', 'DB_URL'];
let mongoURI = null;
let foundDbKey = null;

for (const key of possibleDbKeys) {
  if (process.env[key]) {
    mongoURI = process.env[key];
    foundDbKey = key;
    console.log(`✅ 找到数据库变量: ${key}`);
    break;
  }
}

if (!mongoURI) {
  console.log('⚠️ 未找到数据库连接变量，使用默认地址');
  mongoURI = 'mongodb://mongo:27017/financial_health';
} else {
  console.log(`✅ 使用数据库变量: ${foundDbKey}`);
}

console.log('🔍 === 环境诊断结束 ===\n');
// ========== 诊断结束 ==========

// 中间件
app.use(cors());
app.use(express.json());

// ========== 数据库连接 ==========
console.log('🔄 正在连接数据库...');

// 清理连接字符串中的空白字符
if (mongoURI) {
  mongoURI = mongoURI.replace(/\s/g, '');
  console.log(`清理后的数据库连接: ${mongoURI.substring(0, 50)}...`);
}

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
});

mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB 连接成功！');
  console.log(`数据库: ${mongoose.connection.name}`);
  console.log(`地址: ${mongoose.connection.host}`);
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB 连接失败:');
  console.error('错误:', err.message);
  console.error('连接字符串:', mongoURI);
});
// ========== 数据库连接结束 ==========

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

        const decoded = jwt.verify(token, jwtSecret);
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

// 健康检查端点
app.get('/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.status(200).json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        mongodb: dbStatus,
        environment: process.env.NODE_ENV || 'development',
        service: 'financial-health-app'
    });
});

// API 路由
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: '用户已存在' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({ name, email, password: hashedPassword });
        await user.save();

        const token = jwt.sign({ userId: user._id }, jwtSecret, { expiresIn: '7d' });

        res.status(201).json({
            message: '用户创建成功',
            token,
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: '用户不存在' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: '密码错误' });
        }

        const token = jwt.sign({ userId: user._id }, jwtSecret, { expiresIn: '7d' });

        res.json({
            message: '登录成功',
            token,
            user: { id: user._id, name: user.name, email: user.email }
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

app.get('/api/dashboard', authMiddleware, async (req, res) => {
    try {
        const dashboardData = {
            healthScore: 78,
            grade: '良好',
            message: '后端API运行正常',
            server: 'Railway 部署',
            timestamp: new Date().toISOString()
        };
        res.json(dashboardData);
    } catch (error) {
        console.error('获取仪表盘错误:', error);
        res.status(500).json({ message: '获取数据失败' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 服务器启动成功！`);
    console.log(`📡 端口: ${PORT}`);
    console.log(`📊 健康检查: https://你的域名/health`);
    console.log(`🔐 认证API: https://你的域名/api/auth/login`);
    console.log(`⏰ 启动时间: ${new Date().toISOString()}`);
    console.log(`✨ 部署环境: ${process.env.NODE_ENV || 'production'}`);
});