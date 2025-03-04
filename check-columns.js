const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'stock',
  user: 'postgres',
  password: '123456'
});

async function checkColumns() {
  try {
    await client.connect();
    console.log('已连接到数据库');
    
    // 检查excel_data表的列
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'excel_data'
      ORDER BY ordinal_position;
    `);
    
    console.log('excel_data表的列结构:');
    result.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type})`);
    });
    
    await client.end();
  } catch (err) {
    console.error('检查列时出错:', err);
    await client.end();
  }
}

checkColumns(); 