const sequelize = require('../config/database');
const { getDynamicTables, getTableColumns } = require('../utils/tableBuilder');

/**
 * 获取所有动态创建的表
 */
const getAllTables = async (req, res) => {
  try {
    const tables = await getDynamicTables();
    
    res.status(200).json({
      success: true,
      tables
    });
  } catch (error) {
    console.error('获取表列表时出错:', error);
    res.status(500).json({
      success: false,
      message: `获取表列表失败: ${error.message}`
    });
  }
};

/**
 * 获取指定表的结构信息
 */
const getTableStructure = async (req, res) => {
  try {
    const { tableName } = req.params;
    
    if (!tableName) {
      return res.status(400).json({
        success: false,
        message: '缺少表名参数'
      });
    }
    
    const columns = await getTableColumns(tableName);
    
    res.status(200).json({
      success: true,
      tableName,
      columns
    });
  } catch (error) {
    console.error('获取表结构时出错:', error);
    res.status(500).json({
      success: false,
      message: `获取表结构失败: ${error.message}`
    });
  }
};

/**
 * 获取表中的数据
 */
const getTableData = async (req, res) => {
  try {
    const { tableName } = req.params;
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
      } catch (error) {
        console.error('解析筛选参数时出错:', error);
      }
    }
    
    // 解析搜索关键字参数
    if (req.query.searchKeywords) {
      try {
        searchKeywords = JSON.parse(req.query.searchKeywords);
      } catch (error) {
        console.error('解析搜索关键字参数时出错:', error);
      }
    }
    
    if (!tableName) {
      return res.status(400).json({
        success: false,
        message: '缺少表名参数'
      });
    }
    
    // 检查表是否存在
    const tables = await getDynamicTables();
    if (!tables.includes(tableName)) {
      return res.status(404).json({
        success: false,
        message: `表 "${tableName}" 不存在`
      });
    }
    
    // 获取表的列信息，包括原始表头
    const columns = await getTableColumns(tableName);
    
    // 构建WHERE子句用于筛选和搜索
    let whereClause = '';
    let whereParams = [];
    const conditions = [];
    
    // 处理精确筛选条件
    if (Object.keys(filters).length > 0) {
      const validColumns = columns.map(col => col.field);
      
      // 为每个筛选字段构建条件
      for (const [field, values] of Object.entries(filters)) {
        if (validColumns.includes(field) && Array.isArray(values) && values.length > 0) {
          // 创建字段的IN条件 (field IN (value1, value2, ...))
          const placeholders = values.map(() => '?').join(', ');
          conditions.push(`"${field}" IN (${placeholders})`);
          whereParams.push(...values);
        }
      }
    }
    
    // 处理模糊搜索条件
    if (Object.keys(searchKeywords).length > 0) {
      const validColumns = columns.map(col => col.field);
      const searchConditions = [];
      
      // 为每个搜索字段构建LIKE条件
      for (const [field, keyword] of Object.entries(searchKeywords)) {
        if (validColumns.includes(field) && keyword) {
          // 创建字段的LIKE条件 (field LIKE '%keyword%')
          searchConditions.push(`"${field}" LIKE ?`);
          whereParams.push(`%${keyword}%`);
        }
      }
      
      // 如果有搜索条件，添加到主条件中
      if (searchConditions.length > 0) {
        // 使用OR连接所有搜索条件
        conditions.push(`(${searchConditions.join(' OR ')})`);
      }
    }
    
    // 组合所有条件
    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }
    
    // 获取总记录数（应用筛选条件）
    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM "${tableName}" ${whereClause}`,
      {
        replacements: whereParams
      }
    );
    const total = parseInt(countResult[0].total);
    
    // 构建排序部分的SQL
    let orderClause = 'ORDER BY id';
    
    // 如果提供了排序字段和排序方向，则使用它们
    if (sortField) {
      // 验证排序字段是否存在于表中，以防SQL注入
      const validColumns = columns.map(col => col.field);
      if (validColumns.includes(sortField)) {
        const direction = sortOrder === 'ascend' ? 'ASC' : sortOrder === 'descend' ? 'DESC' : '';
        if (direction) {
          orderClause = `ORDER BY "${sortField}" ${direction}`;
        }
      }
    }
    
    // 获取分页数据，应用筛选条件和排序
    const [rows] = await sequelize.query(
      `SELECT * FROM "${tableName}" ${whereClause} ${orderClause} LIMIT ? OFFSET ?`,
      {
        replacements: [...whereParams, pageSize, offset]
      }
    );
    
    res.status(200).json({
      success: true,
      data: rows,
      columns: columns, // 添加列信息，包括表头
      total,
      page,
      pageSize
    });
  } catch (error) {
    console.error('获取表数据时出错:', error);
    res.status(500).json({
      success: false,
      message: `获取表数据失败: ${error.message}`
    });
  }
};

/**
 * 删除指定表
 */
const deleteTable = async (req, res) => {
  try {
    const { tableName } = req.params;
    
    if (!tableName) {
      return res.status(400).json({
        success: false,
        message: '缺少表名参数'
      });
    }
    
    // 检查表是否存在
    const tables = await getDynamicTables();
    if (!tables.includes(tableName)) {
      return res.status(404).json({
        success: false,
        message: `表 "${tableName}" 不存在`
      });
    }
    
    // 删除表
    await sequelize.query(`DROP TABLE IF EXISTS "${tableName}"`);
    
    res.status(200).json({
      success: true,
      message: `表 "${tableName}" 已成功删除`
    });
  } catch (error) {
    console.error('删除表时出错:', error);
    res.status(500).json({
      success: false,
      message: `删除表失败: ${error.message}`
    });
  }
};

// 修改表数据
const updateTableData = async (req, res) => {
  const { tableName, id } = req.params;
  const { data } = req.body;

  console.log('收到更新请求:', { tableName, id, data });

  try {
    // 检查表是否存在
    const [tables] = await sequelize.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1',
      {
        bind: [tableName],
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!tables || tables.length === 0) {
      console.log(`表 ${tableName} 不存在`);
      return res.status(404).json({
        success: false,
        message: `表 ${tableName} 不存在`
      });
    }

    // 构建更新语句
    const updateFields = Object.entries(data)
      .filter(([key]) => key !== 'id' && key !== 'created_at' && key !== 'updated_at')
      .map(([key]) => `"${key}" = :${key}`)
      .join(', ');

    const updateValues = {
      ...data,
      id: id
    };

    console.log('构建的SQL:', `UPDATE "${tableName}" SET ${updateFields} WHERE id = :id`);
    console.log('参数值:', updateValues);

    // 执行更新操作
    const [result] = await sequelize.query(
      `UPDATE "${tableName}" SET ${updateFields} WHERE id = :id RETURNING *`,
      {
        replacements: updateValues,
        type: sequelize.QueryTypes.UPDATE
      }
    );

    console.log('更新结果:', result);

    if (!result || result.length === 0) {
      console.log('未找到要修改的数据');
      return res.status(404).json({
        success: false,
        message: '未找到要修改的数据'
      });
    }

    res.json({
      success: true,
      message: '数据修改成功',
      data: result[0]
    });
  } catch (error) {
    console.error('修改数据错误:', error);
    res.status(500).json({
      success: false,
      message: '修改数据时发生错误',
      error: error.message
    });
  }
};

module.exports = {
  getAllTables,
  getTableStructure,
  getTableData,
  deleteTable,
  updateTableData
}; 