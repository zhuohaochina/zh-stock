<template>
  <div class="container">
    <div class="main-content">
      <!-- SQL查询块 -->
      <a-card class="sql-card" :bordered="false">
        <template #title>
          <div class="card-header">
            <span><code-outlined /> SQL查询</span>
            <div class="header-right">
              <div class="table-info" v-if="sql_table_columns.length > 0">
                <a-tag color="default">
                  共 {{ sql_total }} 条记录
                </a-tag>
              </div>
            </div>
          </div>
        </template>
        
        <a-textarea
          v-model:value="sql_query"
          :rows="4"
          placeholder="请输入SQL查询语句，例如: SELECT * FROM table_name"
          :maxlength="1000"
          show-count
        />
        <div class="sql-buttons">
          <a-button type="primary" @click="execute_sql" :loading="sql_loading">
            执行查询
          </a-button>
          <a-button @click="clear_sql" style="margin-left: 8px">
            清空
          </a-button>
        </div>
        
        <!-- SQL查询结果表格 -->
        <div v-if="sql_table_columns.length > 0" class="sql-table">
          <!-- 添加筛选功能说明 -->
          <div v-if="Object.keys(filter_info).length > 0 || Object.keys(search_keywords).length > 0" class="filter-info">
            <a-alert type="info" show-icon>
              <template #message>
                当前筛选条件已应用于所有数据，而非仅当前页面。
                <a-button type="link" size="small" @click="clear_all_filters">清除所有筛选</a-button>
              </template>
            </a-alert>
          </div>

          <a-table
            :dataSource="sql_table_data"
            :columns="sql_ant_table_columns"
            :pagination="{
              current: sql_pagination.current,
              pageSize: sql_pagination.page_size,
              total: sql_total,
              showSizeChanger: true,
              showQuickJumper: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: total => `共 ${total} 条记录`,
              size: 'small',
              position: ['bottomCenter'],
              onChange: undefined,
              onShowSizeChange: undefined
            }"
            :scroll="{ x: true }"
            size="small"
            bordered
            :loading="sql_loading"
            rowKey="row_index"
            :rowClassName="(record, index) => (index % 2 === 1 ? 'table-striped' : '')"
            @change="handle_sql_table_change"
          >
            <template #bodyCell="{ column, text }">
              <template v-if="column?.ellipsis">
                <a-tooltip :title="text">
                  <span class="ellipsis-cell">{{ text || '-' }}</span>
                </a-tooltip>
              </template>
              <template v-else>
                <span>{{ text || '-' }}</span>
              </template>
            </template>
            <template #emptyText>
              <a-empty 
                description="暂无数据" 
                :image="Empty.PRESENTED_IMAGE_SIMPLE"
              />
            </template>
          </a-table>
        </div>
      </a-card>

      <!-- 上传区域（包含Excel上传和动态表列表） -->
      <a-card class="upload-all-card" :bordered="false">
        <template #title>
          <div class="card-header">
            <span><upload-outlined /> 上传</span>
          </div>
        </template>
        
        <div class="upload-content">
          <!-- 上传Excel部分 -->
          <div class="upload-section">            
            <a-upload-dragger
              name="file"
              :multiple="false"
              :maxCount="1"
              :fileList="file_list"
              :beforeUpload="before_upload_handler"
              :customRequest="custom_upload_request"
              accept=".xlsx,.xls"
              class="upload-excel">
              <p class="ant-upload-drag-icon">
                <inbox-outlined />
              </p>
              <p class="ant-upload-text">
                拖拽文件到此处或<a>点击上传</a>
              </p>
              <p class="ant-upload-hint">
                请上传Excel文件（.xlsx或.xls格式）
              </p>
              <p class="ant-upload-hint" style="color: #ff4d4f; font-weight: bold;">
                注意: 选择文件后，将弹出对话框确认表名
              </p>
            </a-upload-dragger>
          </div>

          <!-- 动态表列表部分 -->
          <div class="tables-section" v-if="dynamic_tables.length > 0">
            <div class="section-header">
              <span><database-outlined /> 动态创建的表</span>
              <a-tag color="success">{{ dynamic_tables.length }}个表</a-tag>
            </div>
            
            <a-table 
              :dataSource="dynamic_tables" 
              :columns="dynamic_table_columns"
              :pagination="false"
              bordered
              :loading="table_loading"
              :rowKey="record => record.name"
              class="tables-list">
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'action'">
                  <a-button type="primary" size="small" @click="() => view_table_data(record.name)" style="margin-right: 8px;">
                    <template #icon><eye-outlined /></template>
                    查看数据
                  </a-button>
                  
                  <template v-if="!record.locked">
                    <a-button type="primary" size="small" @click="() => lock_table(record.name)" style="margin-right: 8px;">
                      <template #icon><lock-outlined /></template>
                      锁定
                    </a-button>
                    
                    <a-button danger size="small" @click="() => confirm_delete_table(record.name)">
                      <template #icon><delete-outlined /></template>
                      删除表
                    </a-button>
                  </template>
                  
                  <template v-else>
                    <a-button type="dashed" size="small" @click="() => unlock_table(record.name)" style="margin-right: 8px;">
                      <template #icon><unlock-outlined /></template>
                      解锁
                    </a-button>
                    
                    <a-button danger size="small" disabled>
                      <template #icon><delete-outlined /></template>
                      删除表
                    </a-button>
                  </template>
                </template>
              </template>
            </a-table>
          </div>

          <!-- 当没有动态表时显示空状态 -->
          <div class="tables-section" v-else>
            <div class="section-header">
              <span><database-outlined /> 动态创建的表</span>
              <a-tag color="default">0个表</a-tag>
            </div>
            <div class="empty-tables">
              <a-empty description="暂无动态表" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
            </div>
          </div>
        </div>
      </a-card>
      
      <!-- 添加表名确认对话框 -->
      <a-modal
        v-model:visible="table_name_modal_visible"
        title="确认表名"
        @ok="confirm_upload"
        @cancel="cancel_upload"
        :confirmLoading="upload_loading"
      >
        <a-alert
          v-if="selected_file"
          type="info"
          show-icon
          style="margin-bottom: 16px"
        >
          <template #message>
            已选择文件: {{ selected_file?.name }}
          </template>
        </a-alert>
        
        <a-form :model="upload_form" layout="vertical">
          <a-form-item
            label="表名"
            name="table_name"
            :rules="[{ required: true, message: '请输入表名!' }]"
          >
            <a-input 
              v-model:value="upload_form.table_name" 
              placeholder="请输入表名">
              <template #prefix><file-outlined /></template>
            </a-input>
          </a-form-item>
          
          <a-form-item name="create_dynamic_table" :wrapper-col="{ offset: 0 }">
            <a-checkbox v-model:checked="upload_form.create_dynamic_table">
              根据Excel列动态创建表
            </a-checkbox>
          </a-form-item>
          
          <div class="table-name-warning" v-if="is_table_locked(upload_form.table_name)">
            <a-alert
              type="error"
              show-icon
              message="警告：此表已被锁定，无法覆盖"
            />
          </div>
          
          <div class="table-name-info" v-else-if="upload_form.table_name">
            <a-alert
              type="warning"
              show-icon
              message="注意：如果表已存在，将会自动重建覆盖原表数据"
            />
          </div>
        </a-form>
      </a-modal>
      
      <!-- 数据展示区域 -->
      <a-card v-if="table_columns.length > 0" class="data-card" :bordered="false">
        <template #title>
          <div class="card-header">
            <span><bar-chart-outlined /> 数据展示</span>
            <div class="header-right">
              <div class="table-info">
                <a-tag v-if="current_table_name" color="blue">
                  表名: {{ current_table_name }}
                </a-tag>
                <a-tag v-else-if="current_file_name" color="green">
                  文件: {{ current_file_name }}
                </a-tag>
                <a-tag color="default">
                  共 {{ total }} 条记录
                </a-tag>
              </div>
            </div>
          </div>
        </template>
        
        <!-- 添加修改对话框 -->
        <a-modal
          v-model:visible="edit_modal_visible"
          title="修改数据"
          @ok="handle_edit_ok"
          @cancel="handle_edit_cancel"
          :confirmLoading="table_loading"
        >
          <a-form :model="edit_form" layout="vertical">
            <template v-for="col in table_columns" :key="col.prop">
              <a-form-item
                v-if="col.prop !== 'id'"
                :label="col.label"
                :name="col.prop"
              >
                <a-input v-model:value="edit_form[col.prop]" />
              </a-form-item>
            </template>
          </a-form>
        </a-modal>

        <!-- 搜索区域 -->
        <div class="search-area">
          <div class="search-container">
            <a-select
              v-model:value="selected_search_column"
              style="width: 180px; margin-right: 12px; height: 46px;"
              placeholder="选择搜索列"
              :options="search_column_options"
              size="large"
            />
            <a-input-search
              v-model:value="global_search_keyword"
              placeholder="输入关键字进行搜索"
              style="width: 420px; height: 46px;"
              @search="handle_global_search"
              :loading="table_loading"
              size="large"
              enter-button
            />
          </div>
        </div>

        <!-- 筛选功能说明 -->
        <div v-if="Object.keys(filter_info).length > 0 || Object.keys(search_keywords).length > 0" class="filter-info">
          <a-alert type="info" show-icon>
            <template #message>
              当前筛选条件已应用于所有数据，而非仅当前页面。
              <a-button type="link" size="small" @click="clear_all_filters">清除所有筛选</a-button>
            </template>
          </a-alert>
        </div>
        
        <!-- 无数据提示 -->
        <a-empty v-if="table_data.length === 0" description="暂无数据"></a-empty>
        
        <a-table
          v-else
          :dataSource="table_data"
          :columns="ant_table_columns"
          :pagination="{
            current: current_page,
            pageSize: page_size,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: total => `共 ${total} 条记录`,
            size: 'small',
            position: ['bottomCenter'],
            onChange: undefined,
            onShowSizeChange: undefined
          }"
          :scroll="{ x: true }"
          bordered
          :loading="table_loading"
          rowKey="row_index"
          :rowClassName="(record, index) => (index % 2 === 1 ? 'table-striped' : '')"
          @change="handle_table_change"
          :customFilterDropdown="true"
          :remote="true"
        >
          <template #bodyCell="{ column, text, record }">
            <template v-if="column?.ellipsis">
              <a-tooltip :title="text">
                <span class="ellipsis-cell">{{ text || '-' }}</span>
              </a-tooltip>
            </template>
            <template v-if="column.key === 'action'">
              <a-button type="primary" size="small" @click="handle_edit(record)">
                <template #icon><edit-outlined /></template>
                修改
              </a-button>
            </template>
            <template v-else>
              <span>{{ text || '-' }}</span>
            </template>
          </template>
        </a-table>
      </a-card>
      
      <!-- 无数据提示 -->
      <a-empty v-if="!table_columns.length && !dynamic_tables.length" description="暂无数据，请上传Excel文件"></a-empty>
    </div>
    
    <!-- 回到顶部按钮 -->
    <a-tooltip placement="left" title="回到顶部">
      <a-button 
        class="back-to-top-btn" 
        type="primary" 
        shape="circle" 
        size="large"
        @click="scroll_to_top">
        <template #icon><up-outlined /></template>
      </a-button>
    </a-tooltip>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive, h } from 'vue'
import { 
  UploadOutlined, 
  InboxOutlined, 
  FileOutlined, 
  DatabaseOutlined, 
  EyeOutlined, 
  DeleteOutlined, 
  BarChartOutlined,
  LockOutlined,
  UnlockOutlined,
  UpOutlined,
  EditOutlined,
  CodeOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons-vue'
import { message, Modal, Empty } from 'ant-design-vue'
import axios from 'axios'

// 配置axios的基础URL
axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL

const table_data = ref([])
const table_columns = ref([])
const total = ref(0)
const current_page = ref(1)
const page_size = ref(10)
const file_list = ref([])
const current_file_name = ref('')
const dynamic_tables = ref([])
const current_table_name = ref('')

// 动态表创建选项
const create_dynamic_table = ref(true)
const table_name = ref('demo')

// 添加表格加载状态
const table_loading = ref(false)

// 筛选参数
const filter_info = ref({})
// 关键字搜索参数
const search_keywords = ref({})

// 添加全局搜索关键字
const global_search_keyword = ref('')

// 添加搜索列选择
const selected_search_column = ref('all')

// 在 script setup 部分添加新的响应式变量
const editing_record = ref(null)
const edit_modal_visible = ref(false)
const edit_form = ref({})

// 计算搜索列选项
const search_column_options = computed(() => {
  const options = [
    { value: 'all', label: '所有' }
  ]
  
  if (table_columns.value && table_columns.value.length > 0) {
    options.push(...table_columns.value.map(col => ({
      value: col.prop,
      label: col.label
    })))
  }
  
  return options
})

// 为Ant Design Table准备列定义
const dynamic_table_columns = [
  {
    title: '表名',
    dataIndex: 'name',
    key: 'name',
    width: 180,
    customCell: (record) => {
      // 如果表被锁定，显示红色文字
      return {
        style: {
          color: record.locked ? '#ff4d4f' : 'inherit',
          fontWeight: record.locked ? 'bold' : 'normal'
        }
      };
    }
  },
  {
    title: '操作',
    key: 'action',
    width: 320
  }
]

// 排序参数
const sort_info = ref({
  field: '',
  order: ''
})

// 构建表格的列配置
const ant_table_columns = computed(() => {
  const columns = table_columns.value.map(col => ({
    title: col.label,
    dataIndex: col.prop,
    key: col.prop,
    align: 'center',
    minWidth: 120,
    sorter: true
  }));
  
  // 添加操作列
  columns.push({
    title: '操作',
    key: 'action',
    width: 120,
    fixed: 'right',
    align: 'center'
  });
  
  return columns;
});

// 检查表是否被锁定
const is_table_locked = (table_name) => {
  if (!table_name) return false; // 如果表名为空，直接返回false
  const table = dynamic_tables.value.find(t => t.name === table_name);
  return Boolean(table && table.locked); // 确保返回布尔值
}

// 获取所有动态表
const fetch_dynamic_tables = async () => {
  try {
    console.log('正在获取动态表列表...');
    const response = await axios.get('/api/tables');
    
    if (response.data.success) {
      console.log('成功获取动态表列表:', response.data.tables);
      
      // 从本地存储加载锁定状态
      let saved_lock_status = {};
      try {
        const saved_data = localStorage.getItem('locked_tables');
        if (saved_data) {
          saved_lock_status = JSON.parse(saved_data);
          console.log('从本地存储加载的表锁定状态:', saved_lock_status);
        }
      } catch (e) {
        console.error('加载本地锁定状态时出错:', e);
      }
      
      // 过滤掉系统表和保留表
      const user_tables = response.data.tables.filter(name => 
        name !== 'table_metadata' && 
        !name.startsWith('system_') && 
        !name.startsWith('_')
      );
      
      // 保持已有表的锁定状态，优先使用内存中的状态，其次是本地存储中的状态
      dynamic_tables.value = user_tables.map(name => {
        const existing_table = dynamic_tables.value.find(t => t.name === name);
        return { 
          name, 
          locked: existing_table ? existing_table.locked : (saved_lock_status[name] || false)
        };
      });
    } else {
      console.error('获取表列表失败:', response.data.message);
      message.error('获取表列表失败');
    }
  } catch (error) {
    console.error('获取动态表列表请求失败:', error);
    message.error('获取表列表失败，请检查网络连接');
  }
}

// 查看表数据
const view_table_data = async (table_name) => {
  current_table_name.value = table_name
  current_file_name.value = ''
  current_page.value = 1
  
  await fetch_table_data()
}

// 获取表数据
const fetch_table_data = async () => {
  if (!current_table_name.value) return;
  
  console.log('开始获取表数据，当前请求页码:', current_page.value, '每页条数:', page_size.value);
  table_loading.value = true;
  
  try {
    // 构建查询参数
    const params = {
      page: current_page.value,
      page_size: page_size.value,
      sort_field: sort_info.value.field,
      sort_order: sort_info.value.order,
      filters: JSON.stringify(filter_info.value),
      search_keywords: JSON.stringify(search_keywords.value)
    };
    
    console.log('正在获取表数据，API路径:', `/api/tables/${current_table_name.value}/data`);
    console.log('请求参数:', params);

    const response = await axios.get(`/api/tables/${current_table_name.value}/data`, {
      params
    });
    
    console.log('获取到的响应数据:', response.data);
    console.log('响应数据长度:', response.data.data ? response.data.data.length : 0);
    
    // 处理响应数据
    if (response.data.success) {
      // 确保数据是数组并添加行索引
      if (Array.isArray(response.data.data)) {
        // 检查后端返回的数据中是否有重复
        const data_ids = new Set();
        const unique_data = [];
        
        response.data.data.forEach(item => {
          // 使用id或创建一个临时id作为唯一标识
          const item_id = item.id || JSON.stringify(item);
          if (!data_ids.has(item_id)) {
            data_ids.add(item_id);
            unique_data.push(item);
          } else {
            console.warn('检测到重复数据项:', item);
          }
        });
        
        console.log('原始数据长度:', response.data.data.length, '去重后数据长度:', unique_data.length);
        
        // 完全替换现有数据
        table_data.value = unique_data.map((item, index) => ({
          ...item,
          row_index: index + 1 + (current_page.value - 1) * page_size.value
        }));
        
        console.log('最终渲染的数据:', table_data.value);
      } else {
        console.warn('服务器返回的数据不是数组:', response.data.data);
        table_data.value = [];
      }
      
      total.value = response.data.total || 0;
      
      // 处理列信息
      if (response.data.columns && Array.isArray(response.data.columns)) {
        console.log('设置列信息:', response.data.columns);
        table_columns.value = response.data.columns.map(col => ({
          prop: col.field,
          label: col.header || col.field,
          key: col.field
        }));
      } else {
        console.warn('服务器未返回列信息或列信息格式不正确');
        table_columns.value = [];
      }

      console.log('处理后的数据:', {
        table_data: table_data.value,
        table_columns: table_columns.value,
        total: total.value
      });
    } else {
      console.error('获取数据失败:', response.data.message);
      message.error(response.data.message || '获取数据失败');
      table_data.value = [];
      table_columns.value = [];
      total.value = 0;
    }
  } catch (error) {
    console.error('获取表数据失败:', error);
    message.error('获取表数据失败: ' + error.message);
  } finally {
    table_loading.value = false;
  }
};

// 确认删除表
const confirm_delete_table = (table_name) => {
  // 检查表是否被锁定
  if (is_table_locked(table_name)) {
    message.error('无法删除锁定的表，请先解锁');
    return;
  }
  
  Modal.confirm({
    title: '删除确认',
    content: `确定要删除表 "${table_name}" 吗？此操作将删除表及其所有数据，且不可恢复。`,
    okText: '确定',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      return delete_table(table_name)
    }
  })
}

// 删除表
const delete_table = async (table_name) => {
  try {
    const response = await axios.delete(`/api/tables/${table_name}`)
    
    if (response.data.success) {
      message.success(response.data.message)
      
      // 重新获取表列表
      await fetch_dynamic_tables()
      
      // 如果当前正在查看被删除的表，清空数据
      if (current_table_name.value === table_name) {
        current_table_name.value = ''
        table_data.value = []
        table_columns.value = []
        total.value = 0
      }
    } else {
      message.error(response.data.message || '删除表失败')
    }
  } catch (error) {
    console.error('删除表错误:', error)
    message.error('删除表时发生错误')
  }
}

// 锁定表格
const lock_table = async (table_name) => {
  try {
    const table = dynamic_tables.value.find(t => t.name === table_name);
    if (table) {
      // 直接在前端完成锁定
      table.locked = true;
      message.success(`已锁定表 "${table_name}"，该表现在受保护不会被意外删除或修改`);
      
      // 保存锁定状态到本地存储
      save_lock_status();
    } else {
      message.error(`未找到名为 "${table_name}" 的表`);
    }
  } catch (error) {
    console.error('锁定表时出错:', error);
    message.error('锁定表时发生错误，请稍后重试');
  }
}

// 解锁表格
const unlock_table = async (table_name) => {
  try {
    const table = dynamic_tables.value.find(t => t.name === table_name);
    if (table) {
      // 直接在前端完成解锁
      table.locked = false;
      message.warning(`已解锁表 "${table_name}"，该表现在可以被修改或删除`);
      
      // 保存锁定状态到本地存储
      save_lock_status();
    } else {
      message.error(`未找到名为 "${table_name}" 的表`);
    }
  } catch (error) {
    console.error('解锁表时出错:', error);
    message.error('解锁表时发生错误，请稍后重试');
  }
}

// 保存锁定状态到本地存储
const save_lock_status = () => {
  try {
    // 创建锁定表状态的映射
    const lock_status_map = {};
    dynamic_tables.value.forEach(table => {
      if (table.locked) {
        lock_status_map[table.name] = true;
      }
    });
    
    // 保存到本地存储
    localStorage.setItem('locked_tables', JSON.stringify(lock_status_map));
    console.log('表锁定状态已保存到本地存储');
  } catch (error) {
    console.error('保存锁定状态时出错:', error);
  }
}

// 获取数据列表
const fetch_data = async () => {
  if (!current_table_name.value) return;
  
  table_loading.value = true;
  try {
    const params = new URLSearchParams({
      page: current_page.value,
      page_size: page_size.value,
      sort_field: sort_info.value.field,
      sort_order: sort_info.value.order,
      filters: JSON.stringify(filter_info.value),
      search_keywords: JSON.stringify(search_keywords.value)
    });

    const response = await fetch(`/api/tables/${current_table_name.value}/data?${params}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    
    if (result.success) {
      table_data.value = result.data;
      total.value = result.total;
      if (result.columns) {
        table_columns.value = result.columns;
      }
    } else {
      message.error(result.message || '获取数据失败');
    }
  } catch (error) {
    console.error('获取数据失败:', error);
    message.error('获取数据失败: ' + error.message);
  } finally {
    table_loading.value = false;
  }
};

// 添加上传表单相关状态
const table_name_modal_visible = ref(false);
const upload_form = reactive({
  table_name: 'demo',
  create_dynamic_table: true
});
const selected_file = ref(null);
const upload_loading = ref(false);

// 文件上传前处理 - 现在只做验证，不直接上传
const before_upload_handler = (file) => {
  console.log('开始验证上传文件:', file.name, file.type, file.size);
  
  // 检查文件类型
  const is_excel = /\.(xlsx|xls)$/.test(file.name.toLowerCase());
  
  // 检查MIME类型 (更严格的验证)
  const valid_mime_types = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'  // 某些浏览器可能使用这个通用类型
  ];
  
  if (!is_excel) {
    message.error('只能上传Excel文件!');
    return false;
  }
  
  // MIME类型验证
  if (file.type && !valid_mime_types.includes(file.type)) {
    console.warn(`文件MIME类型不匹配: ${file.type}，但文件扩展名正确，将继续上传`);
  }
  
  // 检查文件大小 (限制为20MB)
  const is_less_than_20M = file.size / 1024 / 1024 < 20;
  if (!is_less_than_20M) {
    message.error('文件必须小于20MB!');
    return false;
  }
  
  // 文件验证通过，保存选中文件并显示表名对话框
  selected_file.value = file;
  
  // 显示表名确认对话框
  show_table_name_modal();
  
  // 返回false，阻止自动上传
  return false;
};

// 自定义上传请求
const custom_upload_request = ({ file, onSuccess, onError }) => {
  // 这个函数在点击上传按钮选择文件后被调用
  // 但我们不在这里执行上传，而是通过对话框确认后手动上传
  // 所以这里不需要实现任何逻辑
  console.log("Custom request handler invoked but not doing anything here");
};

// 显示表名确认对话框
const show_table_name_modal = () => {
  // 预填写表单
  upload_form.table_name = table_name.value || 'demo';
  upload_form.create_dynamic_table = create_dynamic_table.value;
  
  // 显示对话框
  table_name_modal_visible.value = true;
};

// 取消上传
const cancel_upload = () => {
  table_name_modal_visible.value = false;
  selected_file.value = null;
  file_list.value = [];
};

// 确认上传文件
const confirm_upload = async () => {
  if (!selected_file.value) {
    message.error('未选择文件');
    return;
  }
  
  if (!upload_form.table_name) {
    message.error('请输入表名');
    return;
  }
  
  // 检查表是否被锁定
  if (is_table_locked(upload_form.table_name)) {
    message.error(`表 "${upload_form.table_name}" 已被锁定，无法修改其数据。请先解锁表或使用其他表名。`);
    return;
  }
  
  // 设置上传中状态
  upload_loading.value = true;
  message.loading('正在上传文件，请稍候...', 0);
  
  try {
    // 创建表单数据
    const form_data = new FormData();
    form_data.append('file', selected_file.value);
    form_data.append('create_dynamic_table', upload_form.create_dynamic_table.toString());
    form_data.append('table_name', upload_form.table_name || 'demo');
    form_data.append('force_recreate', 'true');
    form_data.append('target_table_locked', is_table_locked(upload_form.table_name).toString());
    
    // 执行上传
    const response = await axios.post('/api/upload', form_data);
    
    message.destroy(); // 清除所有消息，包括"上传中"
    
    if (response.data.success) {
      // 检查表是否被重建
      if (response.data.table_recreated) {
        message.success(`成功重建表 "${response.data.table_name}" 并导入数据！`);
      } else {
        // 显示成功消息
        message.success({
          content: response.data.message || '上传成功！',
          duration: 4,
        });
      }
      
      current_file_name.value = selected_file.value.name;
      
      // 清空并设置新的文件列表，用于显示
      file_list.value = [{
        uid: '1',
        name: selected_file.value.name,
        status: 'done'
      }];
      
      // 设置列信息 - 确保使用Excel第一行作为表头
      if (response.data.columns) {
        console.log('服务器返回的列信息:', response.data.columns);
        table_columns.value = response.data.columns.map(col => ({
          prop: col.field,
          label: col.header // 使用header作为标签文本，这就是Excel第一行的内容
        }));
        
        // 记录一下列数据，以便调试
        console.log('设置列信息：', table_columns.value);
      }
      
      // 强制刷新表列表并添加视觉反馈
      refresh_tables_with_animation();
      
      // 设置当前表名和更新数据显示
      if (response.data.tableCreated && response.data.tableName) {
        // 如果成功创建了动态表，直接使用返回的表名
        current_table_name.value = response.data.tableName;
        current_file_name.value = '';
        
        // 显示表创建成功的特殊消息
        setTimeout(() => {
          message.success({
            content: `已创建新表: ${response.data.tableName}`,
            duration: 3
          });
        }, 1000);
      } else if (upload_form.create_dynamic_table) {
        // 如果请求是创建动态表但没有成功创建，使用用户指定的表名
        current_table_name.value = upload_form.table_name;
        current_file_name.value = '';
        
        // 根据是否重建表显示不同消息
        if (response.data.tableRecreated) {
          setTimeout(() => {
            message.success({
              content: `已更新表: ${upload_form.table_name}`,
              duration: 3
            });
          }, 1000);
        }
      } else {
        // 如果使用的是excel_data表（非动态表），使用文件名作为标识
        current_table_name.value = upload_form.table_name || 'demo';
        message.success(`数据已保存到表: ${current_table_name.value}`);
      }
      
      // 重新获取数据
      await fetch_table_data();
      
      // 关闭对话框
      table_name_modal_visible.value = false;
    } else {
      // 显示错误消息
      message.error({
        content: response?.message || '上传失败，服务器未返回成功状态',
        duration: 5
      });
      console.error('上传失败:', response);
      file_list.value = [];
    }
  } catch (error) {
    message.destroy(); // 清除所有消息
    
    console.error('上传错误:', error);
    
    let error_msg = '未知错误，请稍后重试';
    
    // 尝试获取更详细的错误信息
    if (error.response) {
      if (error.response.data && error.response.data.message) {
        error_msg = error.response.data.message;
      } else if (error.response.status === 400) {
        error_msg = '请求格式不正确，请检查参数设置';
      } else if (error.response.status === 413) {
        error_msg = '文件过大，请上传较小的文件';
      } else if (error.response.status) {
        error_msg = `服务器返回错误状态码: ${error.response.status}`;
      }
    } else if (error.message) {
      error_msg = error.message;
    }
    
    // 显示详细错误信息
    message.error({
      content: `上传失败: ${error_msg}`,
      duration: 5
    });
    file_list.value = [];
  } finally {
    upload_loading.value = false;
    selected_file.value = null;
  }
};

// 带动画效果刷新表列表
const refresh_tables_with_animation = async () => {
  // 显示加载状态
  const hide = message.loading('刷新表列表...', 0);
  
  try {
    console.log('开始刷新表列表');
    // 确保获取最新的表列表
    await fetch_dynamic_tables();
    console.log('表列表已更新:', dynamic_tables.value);
    
    // 短暂延迟以确保DOM已更新
    setTimeout(() => {
      // 尝试添加高亮效果
      const tables_section = document.querySelector('.tables-section');
      if (tables_section) {
        console.log('应用高亮动画效果');
        tables_section.classList.add('highlight-animation');
        
        // 移除高亮效果
        setTimeout(() => {
          tables_section.classList.remove('highlight-animation');
        }, 2000);
      } else {
        console.log('未找到表格部分DOM元素');
      }
    }, 500);
  } catch (error) {
    console.error('刷新表列表时出错:', error);
    message.error('刷新表列表失败，请手动刷新页面');
  } finally {
    // 确保关闭加载状态
    hide();
  }
}

// 初始化表锁定状态
const init_locked_tables_status = () => {
  try {
    // 从本地存储加载锁定状态
    const saved_data = localStorage.getItem('locked_tables');
    if (saved_data) {
      const saved_lock_status = JSON.parse(saved_data);
      console.log('从本地存储加载的表锁定状态:', saved_lock_status);
      
      // 应用锁定状态到现有表
      dynamic_tables.value.forEach(table => {
        if (saved_lock_status[table.name]) {
          table.locked = true;
        }
      });
    }
  } catch (error) {
    console.error('初始化表锁定状态时出错:', error);
  }
}

// 回到顶部函数
const scroll_to_top = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

// 清除所有筛选条件
const clear_all_filters = () => {
  // 清空筛选信息
  filter_info.value = {};
  search_keywords.value = {};
  
  // 显示加载状态
  table_loading.value = true;
  
  // 加载未筛选的数据
  fetch_table_data().then(() => {
    message.success('已清除所有筛选条件');
  });
}

// 添加防抖标志，防止短时间内多次触发
let table_change_processing = false;

// 处理表格变化 (排序、筛选等)
const handle_table_change = (pagination, filters, sorter) => {
  console.log('表格变化:', { pagination, sorter, filters });
  
  // 如果当前正在处理变更，直接返回
  if (table_change_processing) {
    console.log('上一次变更处理尚未完成，忽略此次变更');
    return;
  }
  
  // 设置标志，防止重复处理
  table_change_processing = true;
  
  // 判断是否为分页操作
  const is_pagination_change = 
    pagination.current !== current_page.value || 
    pagination.pageSize !== page_size.value;
  
  // 更新页码和每页数量
  if (is_pagination_change) {
    console.log('检测到分页变化:', { 
      old_page: current_page.value, 
      new_page: pagination.current,
      old_size: page_size.value,
      new_size: pagination.pageSize
    });
    
    current_page.value = pagination.current;
    page_size.value = pagination.pageSize;
    
    // 分页变化后获取新数据，保留当前表名和搜索条件
    fetch_table_data().finally(() => {
      // 请求完成后重置处理标志
      table_change_processing = false;
    });
    // 仅处理分页，不处理其他变化
    return;
  }
  
  // 更新排序信息
  if (sorter && sorter.field) {
    sort_info.value.field = sorter.field;
    sort_info.value.order = sorter.order;
  } else {
    sort_info.value = { field: '', order: '' };
  }
  
  // 更新筛选信息 - 仅在有筛选操作时更新
  if (filters) {
    // 仅当有筛选变化时才重置筛选条件
    const has_filter_changes = Object.keys(filters).length > 0;
    
    if (has_filter_changes) {
      // 重置筛选条件
      filter_info.value = {};
      search_keywords.value = {};
      
      // 处理筛选条件
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          if (Array.isArray(filters[key]) && filters[key].length > 0) {
            filter_info.value[key] = filters[key];
            console.log(`添加筛选条件 ${key}:`, filters[key]);
          }
          
          if (filters[key]._custom && typeof filters[key]._custom === 'string' && filters[key]._custom.trim()) {
            search_keywords.value[key] = filters[key]._custom.trim();
            console.log(`添加搜索关键字 ${key}:`, filters[key]._custom.trim());
          }
        }
      });
      
      // 筛选变化时重置到第一页
      current_page.value = 1;
    }
  }
  
  // 仅当是排序变化时才重置到第一页
  if (sorter && sorter.column) {
    current_page.value = 1;
  }
  
  // 设置表格加载状态
  table_loading.value = true;
  
  // 显示筛选应用中的提示
  let filter_apply_msg;
  if (Object.keys(filter_info.value).length > 0 || Object.keys(search_keywords.value).length > 0) {
    filter_apply_msg = message.loading('正在对所有数据应用筛选条件...', 0);
  }
  
  console.log('发送请求到后端，参数:', {
    page: current_page.value,
    page_size: page_size.value,
    sort_field: sort_info.value.field,
    sort_order: sort_info.value.order,
    filters: filter_info.value,
    search_keywords: search_keywords.value
  });
  
  // 重新获取数据
  fetch_table_data().finally(() => {
    if (filter_apply_msg) {
      filter_apply_msg();
      
      if (Object.keys(filter_info.value).length > 0 || Object.keys(search_keywords.value).length > 0) {
        message.success('已对全部数据应用筛选条件');
      }
    }
    
    // 请求完成后重置处理标志
    table_change_processing = false;
  });
}

// 处理全局搜索
const handle_global_search = (value) => {
  if (!value) {
    // 如果搜索值为空，清除搜索条件
    search_keywords.value = {}
    fetch_table_data()
    return
  }
  
  table_loading.value = true
  const hide = message.loading('正在搜索数据...', 0)
  
  const search_conditions = {}
  
  if (selected_search_column.value === 'all') {
    // 当选择"所有"时，在所有列中搜索
    table_columns.value.forEach(col => {
      // 只对文本类型的列应用搜索
      if (col.prop !== 'id' && col.prop !== 'row_index') {
        search_conditions[col.prop] = value.trim()
      }
    })
  } else {
    // 在特定列中搜索
    search_conditions[selected_search_column.value] = value.trim()
  }
  
  console.log('开始发送搜索请求，搜索条件:', search_conditions)
  
  search_keywords.value = search_conditions
  current_page.value = 1
  
  fetch_table_data().finally(() => {
    hide()
    message.success(`已搜索关键字: "${value}"`)
    console.log('搜索请求已完成')
  })
}

// 处理修改按钮点击
const handle_edit = (record) => {
  editing_record.value = { ...record };
  edit_form.value = {};
  // 复制需要编辑的字段
  table_columns.value.forEach(col => {
    if (col.prop !== 'id') {
      edit_form.value[col.prop] = record[col.prop];
    }
  });
  edit_modal_visible.value = true;
};

// 处理取消修改
const handle_edit_cancel = () => {
  edit_modal_visible.value = false;
  editing_record.value = null;
  edit_form.value = {};
};

// 处理确认修改
const handle_edit_ok = async () => {
  if (!current_table_name.value || !editing_record.value?.id) {
    message.error('缺少必要的修改信息');
    return;
  }

  table_loading.value = true;
  try {
    const response = await fetch(
      `/api/tables/${current_table_name.value}/data/${editing_record.value.id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: edit_form.value })
      }
    );

    const result = await response.json();
    if (result.success) {
      message.success('修改成功');
      edit_modal_visible.value = false;
      editing_record.value = null;
      edit_form.value = {};
      // 重新加载数据
      await fetch_table_data();
    } else {
      throw new Error(result.message || '修改失败');
    }
  } catch (error) {
    console.error('修改数据错误:', error);
    message.error('修改数据时发生错误: ' + error.message);
  } finally {
    table_loading.value = false;
  }
};

// SQL查询相关
const sql_query = ref('select * from demo');
const sql_table_data = ref([]);
const sql_table_columns = ref([]);
const sql_loading = ref(false);
const sql_total = ref(0);
const sql_pagination = reactive({
  current: 1,
  page_size: 10
});

// SQL分页处理
const handle_sql_page_change = async (page, page_size) => {
  sql_pagination.current = page;
  sql_pagination.page_size = page_size;
  await execute_sql(true);
};

const handle_sql_size_change = async (current, size) => {
  sql_pagination.current = 1;
  sql_pagination.page_size = size;
  await execute_sql(true);
};

// 执行SQL查询
const execute_sql = async (is_page_change = false) => {
  if (!sql_query.value.trim() && !is_page_change) {
    message.warning('请输入SQL查询语句');
    return;
  }

  sql_loading.value = true;
  try {
    const response = await axios.post('/api/sql/execute', {
      sql: sql_query.value,
      page_size: sql_pagination.page_size,
      page: sql_pagination.current
    });

    if (response.data.success) {
      // 确保数据是数组
      const data = Array.isArray(response.data.data) ? response.data.data : [];
      
      // 处理返回的数据，添加key属性和行索引
      sql_table_data.value = data.map((item, index) => ({
        ...item,
        key: index,
        row_index: index + 1 + (sql_pagination.current - 1) * sql_pagination.page_size
      }));

      // 设置总记录数
      sql_total.value = response.data.total || 0;

      // 使用服务器返回的列信息
      if (response.data.columns && Array.isArray(response.data.columns)) {
        sql_table_columns.value = response.data.columns;
      } else if (sql_table_data.value.length > 0) {
        // 如果服务器没有返回列信息，从第一条记录中提取
        sql_table_columns.value = Object.keys(sql_table_data.value[0])
          .filter(key => !['key', 'row_index'].includes(key))
          .map(key => ({
            field: key,
            header: key
          }));
      } else {
        sql_table_columns.value = [];
      }

      if (!is_page_change) {
        message.success('查询执行成功');
      }
    } else {
      message.error(response.data.message || '查询执行失败');
      sql_table_data.value = [];
      sql_table_columns.value = [];
      sql_total.value = 0;
    }
  } catch (error) {
    console.error('SQL查询出错:', error);
    message.error(error.response?.data?.message || '查询执行失败');
    sql_table_data.value = [];
    sql_table_columns.value = [];
    sql_total.value = 0;
  } finally {
    sql_loading.value = false;
  }
};

// 清空SQL查询
const clear_sql = () => {
  sql_query.value = '';
  sql_table_data.value = [];
  sql_table_columns.value = [];
  sql_total.value = 0;
  sql_pagination.current = 1;
};

// SQL表格列配置
const sql_ant_table_columns = computed(() => {
  return sql_table_columns.value.map(col => {
    return {
      title: col.header || col.field,
      dataIndex: col.field,
      key: col.field,
      align: 'center',
      minWidth: 120,
    }
  });
});

// 测试上传参数
const test_upload_params = async () => {
  try {
    // 构建与上传相同的参数
    const test_params = {
      create_dynamic_table: create_dynamic_table.value,
      table_name: table_name.value || 'demo',
      force_recreate: true,
      target_table_locked: is_table_locked(table_name.value)
    };
    
    console.log('测试上传参数:', test_params);
    
    // 向后端发送测试请求
    const response = await axios.post('/api/upload/test-params', test_params, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (response.data.success) {
      console.log('参数测试成功，后端解析结果:', response.data);
      message.success('参数验证成功，配置正确');
    } else {
      console.error('参数测试失败:', response.data.message);
      message.error('参数验证失败: ' + response.data.message);
    }
  } catch (error) {
    console.error('测试上传参数时出错:', error);
    message.error('测试参数时发生错误: ' + (error.response?.data?.message || error.message));
  }
};

// 添加测试强制重建表的函数
const test_force_recreate = async () => {
  if (!table_name.value) {
    message.warning('请输入表名');
    return;
  }
  
  if (is_table_locked(table_name.value)) {
    message.error(`表 "${table_name.value}" 已被锁定，无法修改`);
    return;
  }
  
  try {
    const hide = message.loading(`正在测试强制重建表 "${table_name.value}"...`, 0);
    
    const response = await axios.post('/api/tables/recreate', {
      table_name: table_name.value,
      force_recreate: true
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    hide();
    
    if (response.data.success) {
      message.success(`表 "${table_name.value}" 重建测试成功: ${response.data.message}`);
      console.log('重建表响应:', response.data);
      
      // 刷新表列表
      await refresh_tables_with_animation();
    } else {
      message.error(`表重建失败: ${response.data.message}`);
      console.error('重建表失败:', response.data);
    }
  } catch (error) {
    message.error(`测试重建表时出错: ${error.response?.data?.message || error.message}`);
    console.error('测试重建表错误:', error);
  }
};

// 添加SQL表格防抖标志
let sql_table_change_processing = false;

// 处理SQL表格变化 (排序、筛选等)
const handle_sql_table_change = (pagination, filters, sorter) => {
  console.log('SQL表格变化:', { pagination, sorter, filters });
  
  // 如果当前正在处理变更，直接返回
  if (sql_table_change_processing) {
    console.log('上一次SQL表格变更处理尚未完成，忽略此次变更');
    return;
  }
  
  // 设置标志，防止重复处理
  sql_table_change_processing = true;
  
  // 判断是否为分页操作
  const is_pagination_change = 
    pagination.current !== sql_pagination.current || 
    pagination.pageSize !== sql_pagination.page_size;
  
  // 更新页码和每页数量
  if (is_pagination_change) {
    console.log('检测到SQL表格分页变化:', { 
      old_page: sql_pagination.current, 
      new_page: pagination.current,
      old_size: sql_pagination.page_size,
      new_size: pagination.pageSize
    });
    
    sql_pagination.current = pagination.current;
    sql_pagination.page_size = pagination.pageSize;
    
    // 分页变化后获取新数据
    execute_sql(true).finally(() => {
      // 请求完成后重置处理标志
      sql_table_change_processing = false;
    });
    // 仅处理分页，不处理其他变化
    return;
  }
  
  // 处理排序和筛选逻辑可以在这里添加
  
  // 重新执行查询
  execute_sql(true).finally(() => {
    // 请求完成后重置处理标志
    sql_table_change_processing = false;
  });
};

onMounted(() => {
  fetch_dynamic_tables()
  // 只在有当前表名时才获取数据
  if (current_table_name.value) {
    fetch_table_data()
  }
  
  setTimeout(init_locked_tables_status, 500)
})
</script>

<style scoped>
.container {
  padding: 20px;
  background-color: #f0f2f5;
  min-height: 100vh;
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.upload-content {
  display: flex;
  flex-direction: row;
  gap: 20px;
  align-items: flex-start;
}

/* 设置两个区域的宽度比例为1:1 */
.upload-section {
  width: 50%;
  flex-shrink: 0;
}

.tables-section {
  width: 50%;
  flex-shrink: 0;
}

/* 小屏幕下切换为垂直布局 */
@media (max-width: 992px) {
  .upload-content {
    flex-direction: column;
  }
  
  .upload-section,
  .tables-section {
    width: 100%;
  }
}

.sql-card {
  margin-bottom: 16px;
  transition: all 0.3s;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 2px -2px rgba(0, 0, 0, 0.08), 
              0 3px 6px 0 rgba(0, 0, 0, 0.06), 
              0 5px 12px 4px rgba(0, 0, 0, 0.04);
}

.sql-card:hover {
  transform: translateY(-3px);
}

.upload-all-card, .data-card {
  margin-bottom: 20px;
  transition: all 0.3s;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 2px -2px rgba(0, 0, 0, 0.08), 
              0 3px 6px 0 rgba(0, 0, 0, 0.06), 
              0 5px 12px 4px rgba(0, 0, 0, 0.04);
}

.upload-all-card:hover, .data-card:hover {
  transform: translateY(-3px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  color: #1890ff;
  padding: 10px 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.search-area {
  margin: 20px 0 24px;
  padding: 24px;
  background: #f9fafb;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.search-area:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  border-color: #d1d5db;
}

.search-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-container :deep(.ant-select-selector) {
  height: 46px !important;
  display: flex;
  align-items: center;
  border-radius: 8px !important;
}

.search-container :deep(.ant-input-search) {
  border-radius: 8px !important;
}

.search-container :deep(.ant-input) {
  height: 46px !important;
  font-size: 16px;
  padding-left: 16px;
}

.search-container :deep(.ant-input-search-button) {
  height: 46px !important;
  width: 80px;
  border-radius: 0 8px 8px 0 !important;
  font-size: 16px;
}

.card-header .anticon, .section-header .anticon {
  margin-right: 8px;
  font-size: 18px;
  vertical-align: middle;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  color: #1890ff;
  padding: 10px 0;
  margin-bottom: 10px;
  border-bottom: 1px dashed #e8e8e8;
}

.table-info {
  display: flex;
  gap: 8px;
}

.upload-excel {
  width: 100%;
  margin-top: 10px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 2px -2px rgba(0, 0, 0, 0.08), 
              0 3px 6px 0 rgba(0, 0, 0, 0.06), 
              0 5px 12px 4px rgba(0, 0, 0, 0.04);
  transition: all 0.3s;
}

.upload-excel:hover {
  transform: translateY(-2px);
  box-shadow: 0 3px 6px -4px rgba(0, 0, 0, 0.12), 
              0 6px 16px 0 rgba(0, 0, 0, 0.08), 
              0 9px 28px 8px rgba(0, 0, 0, 0.05);
}

.upload-excel :deep(.ant-upload-drag) {
  border-radius: 8px;
  border: 1px dashed #d9d9d9;
  background: #fafafa;
  transition: all 0.3s;
}

.upload-excel :deep(.ant-upload-drag:hover) {
  border-color: #1890ff;
  background: #f0f7ff;
}

.upload-excel :deep(.ant-upload-drag-icon) {
  color: #1890ff;
  font-size: 48px;
  margin-bottom: 16px;
}

.tables-list {
  width: 100%;
}

/* 高亮动画效果 */
@keyframes highlight {
  0% {
    background-color: rgba(24, 144, 255, 0.1);
  }
  50% {
    background-color: rgba(24, 144, 255, 0.2);
  }
  100% {
    background-color: transparent;
  }
}

.highlight-animation {
  animation: highlight 2s ease-in-out;
}

.ant-upload-text {
  margin: 8px 0;
  font-size: 16px;
  color: rgba(0, 0, 0, 0.85);
}

.ant-upload-text a {
  color: #1890ff;
  font-weight: bold;
}

.ant-upload-hint {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.45);
}

.filter-info {
  margin-bottom: 16px;
}

[class*="ant-"] {
  box-sizing: border-box;
}

.back-to-top-btn {
  position: fixed;
  bottom: 30px;
  right: 30px;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.sql-buttons {
  margin-top: 16px;
}

.sql-table {
  margin-top: 16px;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 2px -2px rgba(0, 0, 0, 0.08), 
              0 3px 6px 0 rgba(0, 0, 0, 0.06), 
              0 5px 12px 4px rgba(0, 0, 0, 0.04);
}

.sql-table :deep(.ant-table) {
  border-radius: 8px;
}

.sql-table :deep(.ant-table-thead > tr > th) {
  background: #f7f9fc;
  color: #1f2937;
  font-weight: 600;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.sql-table :deep(.ant-table-tbody > tr > td) {
  padding: 12px 16px;
  color: #374151;
}

.sql-table :deep(.table-striped) {
  background-color: #f9fafb;
}

.sql-table :deep(.ant-table-tbody > tr:hover > td) {
  background: #f0f7ff !important;
}

.sql-table :deep(.ellipsis-cell) {
  display: inline-block;
  width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sql-table :deep(.ant-pagination),
.data-card :deep(.ant-pagination),
.tables-section :deep(.ant-pagination) {
  margin: 16px 0;
  padding: 0 16px;
}

.sql-table :deep(.ant-table-empty .ant-table-tbody > tr:hover > td),
.data-card :deep(.ant-table-empty .ant-table-tbody > tr:hover > td),
.tables-section :deep(.ant-table-empty .ant-table-tbody > tr:hover > td) {
  background: none !important;
}

/* 禁用表格内部滚动条 */
:deep(.ant-table-body) {
  overflow-y: visible !important;
}

:deep(.ant-table-body-inner) {
  overflow-y: visible !important;
}

:deep(.ant-table-header) {
  overflow-y: visible !important;
  margin-bottom: 0 !important;
  padding-bottom: 0 !important;
}

:deep(.ant-table-header::-webkit-scrollbar),
:deep(.ant-table-body::-webkit-scrollbar),
:deep(.ant-table-body-inner::-webkit-scrollbar) {
  display: none !important;
}

.empty-tables {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 2px -2px rgba(0, 0, 0, 0.08), 
              0 3px 6px 0 rgba(0, 0, 0, 0.06), 
              0 5px 12px 4px rgba(0, 0, 0, 0.04);
}

.option-hint {
  font-size: 12px;
  color: #ff4d4f;
  margin-top: 8px;
  padding-left: 25px;
  line-height: 1.5;
}

.table-name-warning, .table-name-info {
  margin-top: 8px;
  margin-bottom: 16px;
}
</style> 