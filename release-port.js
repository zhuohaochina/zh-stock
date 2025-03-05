const { exec } = require('child_process');

// 要释放的端口号
const port = process.argv[2] || 5432;

// 根据操作系统选择命令
let command;
if (process.platform === 'win32') {
  // Windows命令
  command = `for /f "tokens=5" %a in ('netstat -aon ^| find ":${port}"') do taskkill /F /PID %a`;
} else if (process.platform === 'darwin') {
  // macOS命令
  command = `lsof -i :${port} | grep LISTEN | awk '{print $2}' | xargs kill -9`;
} else if (process.platform === 'linux') {
  // Linux命令
  command = `fuser -k ${port}/tcp`;
} else {
  console.log(`不支持的操作系统: ${process.platform}`);
  process.exit(1);
}

// 定义释放端口函数
function release_port() {
  console.log(`尝试释放端口 ${port}...`);
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      // 检查特定错误情况
      if (stderr && stderr.includes('没有找到任务')) {
        console.log(`端口 ${port} 未被占用`);
      } else if (stdout === '') {
        console.log(`端口 ${port} 未被占用`);
      } else {
        console.error(`释放端口 ${port} 失败: ${error.message}`);
        console.error(`STDERR: ${stderr}`);
      }
      return;
    }
    
    if (stdout.trim()) {
      console.log(`端口 ${port} 已成功释放`);
      console.log(`输出: ${stdout.trim()}`);
    } else {
      console.log(`端口 ${port} 操作已完成，但可能未被占用`);
    }
  });
}

// 执行释放端口函数
release_port(); 