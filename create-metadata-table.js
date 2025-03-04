const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'stock',
  user: 'postgres',
  password: '123456'
});

async function createMetadataTable() {
  try {
    await client.connect();
    console.log('已连接到数据库');
    
    // 先检查表是否存在，若不存在则创建
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'table_metadata'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('表table_metadata不存在，开始创建...');
      
      // 创建table_metadata表
      await client.query(`
        CREATE TABLE table_metadata (
          id SERIAL PRIMARY KEY,
          table_name VARCHAR(255) NOT NULL UNIQUE,
          metadata JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
      `);
      console.log('表table_metadata创建成功');
      
      // 创建索引
      console.log('开始创建索引...');
      await client.query(`CREATE INDEX table_metadata_table_name_idx ON table_metadata(table_name);`);
      console.log('table_name索引创建成功');
    } else {
      console.log('表table_metadata已存在，跳过创建');
    }
    
    console.log('元数据表设置完成');
    await client.end();
  } catch (err) {
    console.error('创建元数据表时出错:', err);
    await client.end();
  }
}

createMetadataTable(); 