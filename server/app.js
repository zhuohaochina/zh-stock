const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const uploadController = require('./controllers/uploadController');
const dynamicTableRoutes = require('./routes/dynamicTableRoutes');

const app = express();
const upload = multer({ dest: 'uploads/' });

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 路由
app.post('/api/upload', uploadController.handleUpload);
app.use('/api/tables', dynamicTableRoutes);

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: err.message
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
}); 