const { excel_data } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

/**
 * 获取数据列表，支持分页
 */
const getDataList = async (req, res) => {
  try {
    console.log('===== 搜索请求开始 =====');
    console.log('请求参数:', req.query);
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;
    const sortField = req.query.sortField;
    const sortOrder = req.query.sortOrder;
    let filters = {};
    let searchKeywords = {};
    
    // 解析筛选参数
    if (req.query.filters) {
      try {
        filters = JSON.parse(req.query.filters);
        console.log('解析到的筛选条件:', filters);
      } catch (error) {
        console.error('解析筛选参数时出错:', error);
      }
    }
    
    // 解析搜索关键字参数
    if (req.query.searchKeywords) {
      try {
        searchKeywords = JSON.parse(req.query.searchKeywords);
        console.log('解析到的搜索关键字:', searchKeywords);
      } catch (error) {
        console.error('解析搜索关键字参数时出错:', error);
      }
    }
    
    // 查询最新上传的文件
    const latestFile = await excel_data.findOne({
      attributes: ['filename'],
      order: [['created_at', 'DESC']]
    });
    
    if (!latestFile) {
      return res.status(200).json({
        success: true,
        message: '没有数据',
        data: [],
        total: 0
      });
    }
    
    // 设置默认排序
    let orderConfig = [['rowindex', 'ASC']];
    
    // 处理自定义排序
    if (sortField && sortField !== 'rowindex') {
      // 注意：由于数据存储在JSON列中，排序字段需要作为JSON路径处理
      // 使用sequelize.json方法来访问data列中的JSON字段
      const direction = sortOrder === 'ascend' ? 'ASC' : sortOrder === 'descend' ? 'DESC' : 'ASC';
      
      // 这里我们需要构建一个排序路径到data JSON列中指定字段
      // 由于JSON数据结构可能因不同框架和数据库而异，以下是一种常见的方法
      // 使用sequelize的literal函数来创建一个自定义的排序表达式
      orderConfig = [
        [sequelize.literal(`data->>'${sortField}'`), direction]
      ];
    }
    
    // 构建筛选条件
    const whereCondition = {
      filename: latestFile.filename
    };
    
    // 处理筛选条件
    if (Object.keys(filters).length > 0) {
      const filterConditions = [];
      
      for (const [field, values] of Object.entries(filters)) {
        if (Array.isArray(values) && values.length > 0) {
          // 对于JSON数据列，我们需要使用特殊的查询语法
          // 注意：具体语法可能因数据库类型而异（这里假设使用PostgreSQL）
          const jsonCondition = sequelize.literal(
            `data->>'${field}' IN (${values.map(v => `'${v}'`).join(',')})`
          );
          filterConditions.push(jsonCondition);
        }
      }
      
      if (filterConditions.length > 0) {
        whereCondition[Op.and] = filterConditions;
      }
    }
    
    // 处理搜索关键字
    if (searchKeywords && Object.keys(searchKeywords).length > 0) {
      const searchConditions = [];
      const queryParams = [];
      
      // 为每个搜索字段构建ILIKE条件
      for (const [field, keyword] of Object.entries(searchKeywords)) {
        if (keyword) {
          // 使用ILIKE进行不区分大小写的模糊匹配
          searchConditions.push(`data->>'${field}' ILIKE ?`);
          queryParams.push(`%${keyword}%`);
        }
      }
      
      // 如果有搜索条件，添加到主条件中
      if (searchConditions.length > 0) {
        // 使用OR连接所有搜索条件
        whereCondition[Op.or] = searchConditions;
      }
    }
    
    // 如果有搜索条件，添加到查询中
    if (searchConditions.length > 0) {
      // 创建原始SQL WHERE子句，使用AND将所有不同类型的条件连接起来
      const searchSql = searchConditions.join(' AND ');
      whereCondition[Op.and] = sequelize.literal(`(${searchSql})`);
      
      console.log('搜索SQL:', searchSql);
    }
    
    // 添加详细日志，打印完整查询对象
    console.log('最终查询对象:', JSON.stringify(whereCondition, null, 2));
    
    // 启用SQL日志
    const queryOptions = {
      where: whereCondition,
      order: orderConfig,
      limit: pageSize,
      offset: offset,
      logging: (sql) => console.log('执行的SQL查询:', sql)
    };
    
    // 执行查询
    const { count, rows } = await excel_data.findAndCountAll(queryOptions);
    
    // 提取数据部分
    const data = rows.map(item => item.data);
    
    // 打印最终查询结果统计
    console.log('查询结果统计:', {
      total: count,
      返回数据条数: data.length,
      页码: page,
      每页条数: pageSize
    });
    console.log('===== 搜索请求结束 =====\n');
    
    res.status(200).json({
      success: true,
      data,
      total: count,
      page,
      pageSize
    });
  } catch (error) {
    console.error('获取数据列表时出错:', error);
    res.status(500).json({
      success: false,
      message: `获取数据失败: ${error.message}`
    });
  }
};

/**
 * 获取文件列表
 */
const getFileList = async (req, res) => {
  try {
    const files = await excel_data.findAll({
      attributes: [
        'filename', 
        'originalname', 
        'sheetname',
        [sequelize.fn('COUNT', sequelize.col('id')), 'rowCount'],
        [sequelize.fn('MAX', sequelize.col('created_at')), 'uploadedAt']
      ],
      group: ['filename', 'originalname', 'sheetname'],
      order: [[sequelize.fn('MAX', sequelize.col('created_at')), 'DESC']]
    });
    
    res.status(200).json({
      success: true,
      files
    });
  } catch (error) {
    console.error('获取文件列表时出错:', error);
    res.status(500).json({
      success: false,
      message: `获取文件列表失败: ${error.message}`
    });
  }
};

/**
 * 按文件名获取数据
 */
const getDataByFileName = async (req, res) => {
  try {
    console.log('===== 按文件名搜索请求开始 =====');
    console.log('请求参数:', req.query);
    console.log('文件名:', req.params.filename);
    const filename = req.params.filename;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;
    const sortField = req.query.sortField;
    const sortOrder = req.query.sortOrder;
    let filters = {};
    let searchKeywords = {};
    
    // 解析筛选参数
    if (req.query.filters) {
      try {
        filters = JSON.parse(req.query.filters);
        console.log('解析到的筛选条件:', filters);
      } catch (error) {
        console.error('解析筛选参数时出错:', error);
      }
    }
    
    // 解析搜索关键字参数
    if (req.query.searchKeywords) {
      try {
        searchKeywords = JSON.parse(req.query.searchKeywords);
        console.log('解析到的搜索关键字:', searchKeywords);
      } catch (error) {
        console.error('解析搜索关键字参数时出错:', error);
      }
    }
    
    // 设置默认排序
    let orderConfig = [['rowindex', 'ASC']];
    
    // 处理自定义排序
    if (sortField && sortField !== 'rowindex') {
      // 构建排序配置，访问JSON数据中的字段
      const direction = sortOrder === 'ascend' ? 'ASC' : sortOrder === 'descend' ? 'DESC' : 'ASC';
      orderConfig = [
        [sequelize.literal(`data->>'${sortField}'`), direction]
      ];
    }
    
    // 构建筛选条件
    const whereCondition = {
      filename: filename
    };
    
    // 处理筛选条件
    if (Object.keys(filters).length > 0) {
      const filterConditions = [];
      
      for (const [field, values] of Object.entries(filters)) {
        if (Array.isArray(values) && values.length > 0) {
          // 对于JSON数据列，我们需要使用特殊的查询语法
          const jsonCondition = sequelize.literal(
            `data->>'${field}' IN (${values.map(v => `'${v}'`).join(',')})`
          );
          filterConditions.push(jsonCondition);
        }
      }
      
      if (filterConditions.length > 0) {
        whereCondition[Op.and] = filterConditions;
      }
    }
    
    // 处理搜索关键字
    if (searchKeywords && Object.keys(searchKeywords).length > 0) {
      const searchConditions = [];
      const queryParams = [];
      
      // 为每个搜索字段构建ILIKE条件
      for (const [field, keyword] of Object.entries(searchKeywords)) {
        if (keyword) {
          // 使用ILIKE进行不区分大小写的模糊匹配
          searchConditions.push(`data->>'${field}' ILIKE ?`);
          queryParams.push(`%${keyword}%`);
        }
      }
      
      // 如果有搜索条件，添加到主条件中
      if (searchConditions.length > 0) {
        // 使用OR连接所有搜索条件
        whereCondition[Op.or] = searchConditions;
      }
    }
    
    // 如果有搜索条件，添加到查询中
    if (searchConditions.length > 0) {
      // 创建原始SQL WHERE子句，使用AND将所有不同类型的条件连接起来
      const searchSql = searchConditions.join(' AND ');
      whereCondition[Op.and] = sequelize.literal(`(${searchSql})`);
      
      console.log('搜索SQL:', searchSql);
    }
    
    // 添加详细日志，打印完整查询对象
    console.log('最终查询对象:', JSON.stringify(whereCondition, null, 2));
    
    // 启用SQL日志
    const queryOptions = {
      where: whereCondition,
      order: orderConfig,
      limit: pageSize,
      offset: offset,
      logging: (sql) => console.log('执行的SQL查询:', sql)
    };
    
    // 执行查询
    const { count, rows } = await excel_data.findAndCountAll(queryOptions);
    
    // 提取数据部分
    const data = rows.map(item => item.data);
    
    // 打印最终查询结果统计
    console.log('查询结果统计:', {
      total: count,
      返回数据条数: data.length,
      页码: page,
      每页条数: pageSize
    });
    console.log('===== 按文件名搜索请求结束 =====\n');
    
    res.status(200).json({
      success: true,
      data,
      total: count,
      page,
      pageSize
    });
  } catch (error) {
    console.error('获取数据时出错:', error);
    res.status(500).json({
      success: false,
      message: `获取数据失败: ${error.message}`
    });
  }
};

module.exports = {
  getDataList,
  getFileList,
  getDataByFileName
}; 