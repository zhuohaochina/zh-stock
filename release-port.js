const { exec } = require('child_process');

/**
 * 释放指定端口上的进程
 * @param {number} port 要释放的端口号
 */
function releasePort(port = 3000) {
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
    return;
  }
  
  console.log(`尝试释放端口 ${port}...`);
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.log(`端口 ${port} 未被占用或进程释放失败`);
      if (error.message) {
        console.log(`错误信息: ${error.message}`);
      }
    } else {
      console.log(`端口 ${port} 已成功释放`);
    }
  });
}

// 获取命令行传入的端口号，没有则默认为3000
const portArg = process.argv[2];
const port = portArg ? parseInt(portArg) : 3000;

releasePort(port); 