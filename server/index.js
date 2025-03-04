require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./models');
const routes = require('./routes');
const net = require('net');

const app = express();
const PORT = process.env.PORT || 3000;

// 配置中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件目录
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 路由
app.use('/api', routes);

// 检查端口是否被占用
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', () => {
        resolve(true);
      })
      .once('listening', () => {
        server.close();
        resolve(false);
      })
      .listen(port);
  });
}

// 终止占用端口的进程（支持macOS和Windows系统）
async function killProcessOnPort(port) {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    let command;
    
    // 根据操作系统选择命令
    if (process.platform === 'win32') {
      // Windows命令
      command = `for /f "tokens=5" %a in ('netstat -aon ^| find ":${port}"') do taskkill /F /PID %a`;
    } else if (process.platform === 'darwin' || process.platform === 'linux') {
      // macOS/Linux命令
      command = `lsof -i :${port} | grep LISTEN | awk '{print $2}' | xargs kill -9`;
    } else {
      console.log(`不支持的操作系统: ${process.platform}`);
      resolve(false);
      return;
    }
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.log(`端口 ${port} 未被占用或进程释放失败`);
        console.log(`原因: ${error.message}`);
        resolve(false);
      } else {
        console.log(`端口 ${port} 已释放`);
        resolve(true);
      }
    });
  });
}

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 启动服务器
async function startServer() {
  try {
    // 检查数据库连接
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    // 同步数据库模型
    await sequelize.sync({ alter: false });
    console.log('数据库已同步');
    
    // 检查端口是否被占用
    const portInUse = await isPortInUse(PORT);
    if (portInUse) {
      console.log(`端口 ${PORT} 被占用，尝试释放...`);
      await killProcessOnPort(PORT);
      // 等待端口释放
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 启动服务器
    app.listen(PORT, () => {
      console.log(`服务器运行在端口: ${PORT}`);
    });
  } catch (error) {
    console.error('启动服务器时出错:', error);
    process.exit(1);
  }
}

// 启动服务器
startServer(); 