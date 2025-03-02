const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * 根据Excel列信息动态创建数据库表
 * @param {string} tableName - 要创建的表名
 * @param {Array} columns - Excel的列信息
 * @param {boolean} forceRecreate - 如果表已存在是否强制重建
 */
async function createTableFromExcel(tableName, columns, forceRecreate = false) {
  try {
    // 检查表名是否合法（只允许字母、数字和下划线）
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error(`表名 "${tableName}" 无效，只允许字母、数字和下划线且必须以字母开头`);
    }
    
    // 估计数据类型
    const columnDefinitions = {};
    
    // 添加ID主键
    columnDefinitions.id = {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    };
    
    // 保存列名和表头的映射关系
    const columnHeaders = {};
    
    // 处理每一列
    columns.forEach(column => {
      // 确保列名合法（只允许字母、数字和下划线）
      let fieldName = column.field.replace(/[^a-zA-Z0-9_]/g, '_');
      if (!/^[a-zA-Z_]/.test(fieldName)) {
        fieldName = `col_${fieldName}`;
      }
      
      // 保存原始表头
      columnHeaders[fieldName] = column.header || fieldName;
      
      // 默认为TEXT类型，这样可以存储任何值
      columnDefinitions[fieldName] = {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: column.header || fieldName // 将表头存储为列注释
      };
    });
    
    // 添加创建和更新时间戳
    columnDefinitions.createdAt = {
      type: DataTypes.DATE,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
    };
    
    columnDefinitions.updatedAt = {
      type: DataTypes.DATE,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
    };
    
    // 定义模型
    const DynamicModel = sequelize.define(tableName, columnDefinitions, {
      tableName: tableName,
      timestamps: true,
      freezeTableName: true, // 不自动复数化表名
      // 保存列头信息为模型的元数据
      columnHeaders: columnHeaders
    });
    
    // 同步到数据库（如果表已存在，forceRecreate控制是否重建）
    await DynamicModel.sync({ force: forceRecreate });
    
    // 存储列表头映射关系到数据库中的元数据表
    await storeColumnHeaders(tableName, columnHeaders);
    
    console.log(`表 "${tableName}" 已${forceRecreate ? '重建' : '创建'}`);
    return DynamicModel;
  } catch (error) {
    console.error('创建表时出错:', error);
    throw new Error(`创建表 "${tableName}" 失败: ${error.message}`);
  }
}

/**
 * 存储列表头映射关系
 */
async function storeColumnHeaders(tableName, columnHeaders) {
  try {
    // 检查是否存在元数据表
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS table_metadata (
        id SERIAL PRIMARY KEY,
        table_name TEXT NOT NULL,
        metadata JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 删除之前的记录
    await sequelize.query(`
      DELETE FROM table_metadata WHERE table_name = ?
    `, {
      replacements: [tableName]
    });
    
    // 插入新记录
    await sequelize.query(`
      INSERT INTO table_metadata (table_name, metadata)
      VALUES (?, ?)
    `, {
      replacements: [tableName, JSON.stringify({ columnHeaders })]
    });
    
    console.log(`已为表 "${tableName}" 存储列表头映射关系`);
  } catch (error) {
    console.error('存储列表头映射关系时出错:', error);
  }
}

/**
 * 将Excel数据插入到动态创建的表中
 * @param {Object} model - Sequelize模型
 * @param {Array} data - Excel数据
 * @param {Array} columns - Excel列信息
 */
async function insertDataToTable(model, data, columns) {
  try {
    // 准备要插入的数据
    const records = data.map(item => {
      const record = {};
      
      // 处理每个字段
      columns.forEach(column => {
        let fieldName = column.field.replace(/[^a-zA-Z0-9_]/g, '_');
        if (!/^[a-zA-Z_]/.test(fieldName)) {
          fieldName = `col_${fieldName}`;
        }
        
        record[fieldName] = item.rowData[column.field] || null;
      });
      
      return record;
    });
    
    // 批量插入数据
    if (records.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await model.bulkCreate(batch);
      }
    }
    
    return records.length;
  } catch (error) {
    console.error('插入数据时出错:', error);
    throw new Error(`向表插入数据失败: ${error.message}`);
  }
}

/**
 * 获取数据库中所有动态创建的表
 */
async function getDynamicTables() {
  try {
    const [results] = await sequelize.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('excel_data', 'SequelizeMeta')
      ORDER BY table_name
    `);
    
    return results.map(r => r.table_name);
  } catch (error) {
    console.error('获取表列表时出错:', error);
    return [];
  }
}

/**
 * 获取表的列信息，包括原始表头
 */
async function getTableColumns(tableName) {
  try {
    // 获取元数据
    const [metadataResults] = await sequelize.query(`
      SELECT metadata FROM table_metadata WHERE table_name = ?
    `, {
      replacements: [tableName]
    });
    
    let columnHeaders = {};
    
    if (metadataResults.length > 0) {
      columnHeaders = metadataResults[0].metadata.columnHeaders || {};
    }
    
    // 获取表结构
    const [columnsResults] = await sequelize.query(`
      SELECT column_name, data_type, character_maximum_length, column_default
      FROM information_schema.columns
      WHERE table_name = ?
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `, {
      replacements: [tableName]
    });
    
    // 映射列信息，添加原始表头
    return columnsResults
      .filter(col => !['id', 'createdAt', 'updatedAt'].includes(col.column_name))
      .map(col => ({
        field: col.column_name,
        header: columnHeaders[col.column_name] || col.column_name, // 使用原始表头或默认值
        type: col.data_type,
        maxLength: col.character_maximum_length
      }));
  } catch (error) {
    console.error('获取表列信息时出错:', error);
    throw new Error(`获取表 "${tableName}" 的列信息失败: ${error.message}`);
  }
}

module.exports = {
  createTableFromExcel,
  insertDataToTable,
  getDynamicTables,
  getTableColumns
}; 