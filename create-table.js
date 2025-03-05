const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'stock',
  user: 'postgres',
  password: '123456'
});

async function create_table() {
  try {
    await client.connect();
    console.log('已连接到数据库');
    
    // 先检查表是否存在，若不存在则创建
    const table_exists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'excel_data'
      );
    `);
    
    if (!table_exists.rows[0].exists) {
      console.log('表excel_data不存在，开始创建...');
      
      // 创建excel_data表
      await client.query(`
        CREATE TABLE excel_data (
          id SERIAL PRIMARY KEY,
          filename VARCHAR(255) NOT NULL,
          originalname VARCHAR(255) NOT NULL,
          data JSONB NOT NULL,
          rowindex INTEGER NOT NULL,
          sheetname VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
      `);
      console.log('表excel_data创建成功');
      
      // 创建索引
      console.log('开始创建索引...');
      await client.query(`CREATE INDEX excel_data_filename_idx ON excel_data(filename);`);
      console.log('filename索引创建成功');
      
      await client.query(`CREATE INDEX excel_data_sheetname_idx ON excel_data(sheetname);`);
      console.log('sheetname索引创建成功');
    } else {
      console.log('表excel_data已存在，跳过创建');
    }
    
    console.log('数据库设置完成');
    await client.end();
  } catch (err) {
    console.error('创建表时出错:', err);
    await client.end();
  }
}

create_table(); 