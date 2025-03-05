const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 定义一个动态的Excel数据模型
// 我们使用JSONB类型来存储每行数据，这样可以灵活处理不同结构的Excel文件
const excel_data = sequelize.define('excel_data', {
  // 文件信息
  filename: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'file_name'
  },
  originalname: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'original_name'
  },
  // 数据内容，使用JSONB存储Excel的每一行
  data: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  // 记录此行数据来自Excel的哪一行
  rowindex: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'row_index'
  },
  // 存储表名或工作表名
  sheetname: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'sheet_name'
  }
}, {
  // 其他模型选项
  tableName: 'excel_data',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = excel_data; 