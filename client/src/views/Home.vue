<template>
  <div class="container">
    <!-- 使用简单轮播图组件 -->
    <simple-carousel></simple-carousel>
    
    <div class="main-content">
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
            <!-- 动态表创建选项 -->
            <div class="dynamic-table-options">
              <a-checkbox v-model:checked="createDynamicTable" class="option-checkbox">
                <span class="option-label">根据Excel列动态创建表</span>
              </a-checkbox>
              
              <div v-if="createDynamicTable" class="table-options">
                <a-input 
                  v-model:value="tableName" 
                  placeholder="表名称（默认为demo）" 
                  class="table-name-input">
                  <template #prefix><file-outlined /></template>
                </a-input>
                
                <a-checkbox v-model:checked="forceRecreate" class="option-checkbox">
                  <span class="option-label">如果表已存在，强制重建</span>
                </a-checkbox>
              </div>
            </div>
            
            <a-upload-dragger
              name="file"
              :action="'/api/upload'"
              :data="uploadData"
              :headers="{
                'accept': 'application/json'
              }"
              :multiple="false"
              :maxCount="1"
              :fileList="fileList"
              :beforeUpload="beforeUpload"
              @change="handleUploadChange"
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
            </a-upload-dragger>
          </div>

          <!-- 动态表列表部分 -->
          <div v-if="dynamicTables.length > 0" class="tables-section">
            <div class="section-header">
              <span><database-outlined /> 动态创建的表</span>
              <a-tag color="success">{{ dynamicTables.length }}个表</a-tag>
            </div>
            
            <a-table 
              :dataSource="dynamicTables" 
              :columns="dynamicTableColumns"
              :pagination="false"
              bordered
              :loading="tableLoading"
              :rowKey="record => record.name"
              class="tables-list">
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'action'">
                  <a-button type="primary" size="small" @click="() => viewTableData(record.name)" style="margin-right: 8px;">
                    <template #icon><eye-outlined /></template>
                    查看数据
                  </a-button>
                  
                  <template v-if="!record.locked">
                    <a-button type="primary" size="small" @click="() => lockTable(record.name)" style="margin-right: 8px;">
                      <template #icon><lock-outlined /></template>
                      锁定
                    </a-button>
                    
                    <a-button danger size="small" @click="() => confirmDeleteTable(record.name)">
                      <template #icon><delete-outlined /></template>
                      删除表
                    </a-button>
                  </template>
                  
                  <template v-else>
                    <a-button type="dashed" size="small" @click="() => unlockTable(record.name)" style="margin-right: 8px;">
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
        </div>
      </a-card>
      
      <!-- 数据展示区域 -->
      <a-card v-if="tableColumns.length > 0" class="data-card" :bordered="false">
        <template #title>
          <div class="card-header">
            <span><bar-chart-outlined /> 数据展示</span>
            <div class="header-right">
              <!-- 添加搜索框 -->
              <div class="search-box">
                <div class="search-container">
                  <a-select
                    v-model:value="selectedSearchColumn"
                    style="width: 150px; margin-right: 8px;"
                    placeholder="选择搜索列"
                    :options="searchColumnOptions"
                  />
                  <a-input-search
                    v-model:value="globalSearchKeyword"
                    placeholder="输入关键字进行搜索"
                    style="width: 300px"
                    @search="handleGlobalSearch"
                    :loading="tableLoading"
                  />
                </div>
              </div>
              <div class="table-info">
                <a-tag v-if="currentTableName" color="blue">
                  表名: {{ currentTableName }}
                </a-tag>
                <a-tag v-else-if="currentFileName" color="green">
                  文件: {{ currentFileName }}
                </a-tag>
                <a-tag color="default">
                  共 {{ total }} 条记录
                </a-tag>
              </div>
            </div>
          </div>
        </template>
        
        <!-- 筛选功能说明 -->
        <div v-if="Object.keys(filterInfo).length > 0 || Object.keys(searchKeywords).length > 0" class="filter-info">
          <a-alert type="info" show-icon>
            <template #message>
              当前筛选条件已应用于所有数据，而非仅当前页面。
              <a-button type="link" size="small" @click="clearAllFilters">清除所有筛选</a-button>
            </template>
          </a-alert>
        </div>
        
        <!-- 无数据提示 -->
        <a-empty v-if="tableData.length === 0" description="暂无数据"></a-empty>
        
        <a-table
          v-else
          :dataSource="tableData"
          :columns="antTableColumns"
          :pagination="false"
          bordered
          :loading="tableLoading"
          :rowKey="record => record.id || record.rowIndex"
          @change="handleTableChange"
          :customFilterDropdown="true"
          :remote="true"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">
              <a-button type="primary" size="small" @click="() => handleEdit(record)">
                <template #icon><edit-outlined /></template>
                修改
              </a-button>
            </template>
          </template>
        </a-table>
        
        <div class="pagination-container">
          <a-pagination
            v-model:current="currentPage"
            v-model:pageSize="pageSize"
            :total="total"
            :pageSizeOptions="[10, 20, 50, 100]"
            show-size-changer
            show-quick-jumper
            @change="handlePageChange"
            @showSizeChange="handleSizeChange"
          />
        </div>
        
        <!-- 添加修改弹窗 -->
        <a-modal
          v-model:visible="editModalVisible"
          title="修改数据"
          @ok="handleEditOk"
          @cancel="handleEditCancel"
          :confirmLoading="tableLoading"
        >
          <a-form layout="vertical">
            <a-form-item
              v-for="col in tableColumns"
              :key="col.prop"
              :label="col.label"
            >
              <template v-if="col.prop !== 'id' && col.prop !== 'created_at' && col.prop !== 'updated_at'">
                <a-input
                  v-model:value="editForm[col.prop]"
                  :placeholder="`请输入${col.label}`"
                />
              </template>
            </a-form-item>
          </a-form>
        </a-modal>
      </a-card>
      
      <!-- 无数据提示 -->
      <a-empty v-if="!tableColumns.length && !dynamicTables.length" description="暂无数据，请上传Excel文件"></a-empty>
    </div>
    
    <!-- 回到顶部按钮 -->
    <a-tooltip placement="left" title="回到顶部">
      <a-button 
        class="back-to-top-btn" 
        type="primary" 
        shape="circle" 
        size="large"
        @click="scrollToTop">
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
  EditOutlined
} from '@ant-design/icons-vue'
import { message, Modal } from 'ant-design-vue'
import axios from 'axios'
// 导入轮播图组件
import SimpleCarousel from '../components/SimpleCarousel.vue'

// 配置axios的基础URL
axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL

const tableData = ref([])
const tableColumns = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const fileList = ref([])
const currentFileName = ref('')
const dynamicTables = ref([])
const currentTableName = ref('')

// 动态表创建选项
const createDynamicTable = ref(true)
const tableName = ref('demo')
const forceRecreate = ref(false)

// 添加表格加载状态
const tableLoading = ref(false)

// 筛选参数
const filterInfo = ref({})
// 关键字搜索参数
const searchKeywords = ref({})

// 添加全局搜索关键字
const globalSearchKeyword = ref('')

// 添加搜索列选择
const selectedSearchColumn = ref('all')

// 在 script setup 部分添加新的响应式变量
const editingRecord = ref(null)
const editModalVisible = ref(false)
const editForm = ref({})

// 计算搜索列选项
const searchColumnOptions = computed(() => {
  const options = [
    { value: 'all', label: '所有' }
  ]
  
  if (tableColumns.value && tableColumns.value.length > 0) {
    options.push(...tableColumns.value.map(col => ({
      value: col.prop,
      label: col.label
    })))
  }
  
  return options
})

// 为Ant Design Table准备列定义
const dynamicTableColumns = [
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
const sortInfo = ref({
  field: '',
  order: ''
})

// 构建表格的列配置
const antTableColumns = computed(() => {
  const columns = tableColumns.value.map(col => {
    // 获取列的唯一值，用于构建筛选器选项
    let filterValues = [];
    if (tableData.value.length > 0) {
      // 提取该列所有不同的值
      const values = new Set();
      tableData.value.forEach(row => {
        if (row[col.prop] !== undefined && row[col.prop] !== null) {
          values.add(row[col.prop].toString());
        }
      });
      filterValues = Array.from(values).map(value => ({ text: value, value }));
    }

    return {
      title: col.label,
      dataIndex: col.prop,
      key: col.prop,
      align: 'center',
      ellipsis: true,
      minWidth: 120,
      sorter: true,  // 简化为true，让后端处理排序逻辑
      // 添加筛选功能
      filters: filterValues,
      // 启用服务端筛选
      filterMode: 'menu',
      // 启用自定义筛选搜索
      filterSearch: true,
      // 禁用本地筛选
      onFilter: null, // 不在前端过滤，由后端处理
      filteredValue: filterInfo.value[col.prop] || null,
      // 显式设置为不要在前端进行筛选处理
      filter: {
        // 强制使用服务端筛选
        filters: filterValues,
        filterSearch: true,
        menus: filterValues
      },
      // 防止前端自动处理筛选
      onFilterDropdownVisibleChange: (visible) => {
        if (!visible) {
          // 当筛选下拉框关闭时，确保触发handleTableChange
          console.log('筛选下拉框关闭，准备发送筛选请求到服务器');
        }
      }
    }
  })
  
  // 添加操作列
  columns.push({
    title: '操作',
    key: 'action',
    width: 120,
    fixed: 'right',
    align: 'center'
  })
  
  return columns
})

// 检查表是否被锁定
const isTableLocked = (tableName) => {
  if (!tableName) return false; // 如果表名为空，直接返回false
  const table = dynamicTables.value.find(t => t.name === tableName);
  return Boolean(table && table.locked); // 确保返回布尔值
}

// 上传数据
const uploadData = computed(() => {
  const data = {
    createDynamicTable: createDynamicTable.value.toString(),
    tableName: tableName.value || 'demo',
    forceRecreate: forceRecreate.value.toString(),
    // 添加表锁定状态到上传数据，确保始终是布尔值的字符串表示
    targetTableLocked: String(isTableLocked(tableName.value))
  };
  
  // 如果表被锁定，添加警告
  if (createDynamicTable.value && isTableLocked(tableName.value)) {
    console.warn(`警告: 尝试上传数据到锁定的表 "${tableName.value}"`);
  }
  
  return data;
})

// 获取所有动态表
const fetchDynamicTables = async () => {
  try {
    console.log('正在获取动态表列表...');
    const response = await axios.get('/api/tables');
    
    if (response.data.success) {
      console.log('成功获取动态表列表:', response.data.tables);
      
      // 从本地存储加载锁定状态
      let savedLockStatus = {};
      try {
        const savedData = localStorage.getItem('lockedTables');
        if (savedData) {
          savedLockStatus = JSON.parse(savedData);
          console.log('从本地存储加载的表锁定状态:', savedLockStatus);
        }
      } catch (e) {
        console.error('加载本地锁定状态时出错:', e);
      }
      
      // 过滤掉系统表和保留表
      const userTables = response.data.tables.filter(name => 
        name !== 'table_metadata' && 
        !name.startsWith('system_') && 
        !name.startsWith('_')
      );
      
      // 保持已有表的锁定状态，优先使用内存中的状态，其次是本地存储中的状态
      dynamicTables.value = userTables.map(name => {
        const existingTable = dynamicTables.value.find(t => t.name === name);
        return { 
          name, 
          locked: existingTable ? existingTable.locked : (savedLockStatus[name] || false)
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
const viewTableData = async (tableName) => {
  currentTableName.value = tableName
  currentFileName.value = ''
  currentPage.value = 1
  
  await fetchTableData()
}

// 获取表数据
const fetchTableData = async () => {
  if (!currentTableName.value) return
  
  // 显示表格加载状态
  tableLoading.value = true
  
  try {
    const response = await axios.get(`/api/tables/${currentTableName.value}/data`, {
      params: {
        page: currentPage.value,
        pageSize: pageSize.value,
        sortField: sortInfo.value.field,
        sortOrder: sortInfo.value.order,
        filters: JSON.stringify(filterInfo.value),
        searchKeywords: JSON.stringify(searchKeywords.value)
      }
    })
    
    if (response.data.success) {
      tableData.value = response.data.data
      total.value = response.data.total
      
      // 如果服务器返回了列信息，使用它
      if (response.data.columns) {
        console.log('服务器返回的表列信息:', response.data.columns);
        tableColumns.value = response.data.columns.map(col => ({
          prop: col.field,
          label: col.header || col.field
        }));
      }
    } else {
      message.error(response.data.message || '获取数据失败')
    }
  } catch (error) {
    console.error('获取表数据错误:', error)
    message.error('获取表数据时发生错误')
  } finally {
    // 关闭表格加载状态
    tableLoading.value = false
  }
}

// 确认删除表
const confirmDeleteTable = (tableName) => {
  // 检查表是否被锁定
  if (isTableLocked(tableName)) {
    message.error('无法删除锁定的表，请先解锁');
    return;
  }
  
  Modal.confirm({
    title: '删除确认',
    content: `确定要删除表 "${tableName}" 吗？此操作将删除表及其所有数据，且不可恢复。`,
    okText: '确定',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      return deleteTable(tableName)
    }
  })
}

// 删除表
const deleteTable = async (tableName) => {
  try {
    const response = await axios.delete(`/api/tables/${tableName}`)
    
    if (response.data.success) {
      message.success(response.data.message)
      
      // 重新获取表列表
      await fetchDynamicTables()
      
      // 如果当前正在查看被删除的表，清空数据
      if (currentTableName.value === tableName) {
        currentTableName.value = ''
        tableData.value = []
        tableColumns.value = []
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
const lockTable = async (tableName) => {
  try {
    const table = dynamicTables.value.find(t => t.name === tableName);
    if (table) {
      // 直接在前端完成锁定
      table.locked = true;
      message.success(`已锁定表 "${tableName}"，该表现在受保护不会被意外删除或修改`);
      
      // 保存锁定状态到本地存储
      saveLockStatus();
    } else {
      message.error(`未找到名为 "${tableName}" 的表`);
    }
  } catch (error) {
    console.error('锁定表时出错:', error);
    message.error('锁定表时发生错误，请稍后重试');
  }
}

// 解锁表格
const unlockTable = async (tableName) => {
  try {
    const table = dynamicTables.value.find(t => t.name === tableName);
    if (table) {
      // 直接在前端完成解锁
      table.locked = false;
      message.warning(`已解锁表 "${tableName}"，该表现在可以被修改或删除`);
      
      // 保存锁定状态到本地存储
      saveLockStatus();
    } else {
      message.error(`未找到名为 "${tableName}" 的表`);
    }
  } catch (error) {
    console.error('解锁表时出错:', error);
    message.error('解锁表时发生错误，请稍后重试');
  }
}

// 保存锁定状态到本地存储
const saveLockStatus = () => {
  try {
    // 创建锁定表状态的映射
    const lockStatusMap = {};
    dynamicTables.value.forEach(table => {
      if (table.locked) {
        lockStatusMap[table.name] = true;
      }
    });
    
    // 保存到本地存储
    localStorage.setItem('lockedTables', JSON.stringify(lockStatusMap));
    console.log('表锁定状态已保存到本地存储');
  } catch (error) {
    console.error('保存锁定状态时出错:', error);
  }
}

// 获取数据列表
const fetchData = async () => {
  if (!currentTableName.value) return;
  
  tableLoading.value = true;
  try {
    const params = new URLSearchParams({
      page: currentPage.value,
      pageSize: pageSize.value,
      sortField: sortInfo.value.field,
      sortOrder: sortInfo.value.order,
      filters: JSON.stringify(filterInfo.value),
      searchKeywords: JSON.stringify(searchKeywords.value)
    });

    const response = await fetch(`/api/tables/${currentTableName.value}/data?${params}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    
    if (result.success) {
      tableData.value = result.data;
      total.value = result.total;
      if (result.columns) {
        tableColumns.value = result.columns;
      }
    } else {
      message.error(result.message || '获取数据失败');
    }
  } catch (error) {
    console.error('获取数据失败:', error);
    message.error('获取数据失败: ' + error.message);
  } finally {
    tableLoading.value = false;
  }
};

// 上传前验证
const beforeUpload = (file) => {
  // 检查文件类型
  const isExcel = /\.(xlsx|xls)$/.test(file.name.toLowerCase())
  if (!isExcel) {
    message.error('只能上传Excel文件!')
    return false
  }
  
  // 检查目标表是否被锁定
  if (createDynamicTable.value && tableName.value && tableName.value.trim() !== '') {
    if (isTableLocked(tableName.value)) {
      message.error(`表 "${tableName.value}" 已被锁定，无法修改其数据。请先解锁表或使用其他表名。`)
      return false
    }
  }
  
  return true
}

// 处理上传状态变化
const handleUploadChange = (info) => {
  const { file, fileList: newFileList } = info;
  
  // 更新文件列表
  fileList.value = [...newFileList];
  
  if (file.status === 'uploading') {
    // 显示上传中的提示
    message.loading('正在上传文件，请稍候...', 0);
  } else if (file.status === 'done') {
    // 上传成功
    message.destroy(); // 清除所有消息，包括"上传中"
    const response = file.response;
    
    if (response && response.success) {
      // 显示成功消息
      message.success({
        content: response.message || '上传成功！',
        duration: 4,
      });
      
      currentFileName.value = file.name;
      
      // 清空并设置新的文件列表
      fileList.value = [{
        uid: file.uid,
        name: file.name,
        status: 'done'
      }];
      
      // 设置列信息 - 确保使用Excel第一行作为表头
      if (response.columns) {
        console.log('服务器返回的列信息:', response.columns);
        tableColumns.value = response.columns.map(col => ({
          prop: col.field,
          label: col.header // 使用header作为标签文本，这就是Excel第一行的内容
        }));
        
        // 记录一下列数据，以便调试
        console.log('设置列信息：', tableColumns.value);
      }
      
      // 强制刷新表列表并添加视觉反馈
      refreshTablesWithAnimation();
      
      // 如果创建了表，更新当前表名并查看表数据
      if (response.tableCreated && response.tableName) {
        currentTableName.value = response.tableName;
        currentFileName.value = '';
        
        // 显示表创建成功的特殊消息
        setTimeout(() => {
          message.success({
            content: `已创建新表: ${response.tableName}`,
            duration: 3
          });
        }, 1000);
      } else {
        currentTableName.value = '';
      }
      
      // 重新获取数据
      fetchTableData();
    } else {
      // 显示错误消息
      message.error({
        content: response?.message || '上传失败，服务器未返回成功状态',
        duration: 5
      });
      console.error('上传失败:', response);
      fileList.value = [];
    }
  } else if (file.status === 'error') {
    // 清除所有消息
    message.destroy();
    
    // 显示详细错误信息
    message.error({
      content: `上传失败: ${file.error?.message || '未知错误，请稍后重试'}`,
      duration: 5
    });
    console.error('上传错误:', file.error);
    fileList.value = [];
  } else if (file.status === 'removed') {
    fileList.value = [];
    currentFileName.value = '';
  }
}

// 移除文件
const handleRemove = () => {
  fileList.value = []
  currentFileName.value = ''
}

// 分页操作
const handleSizeChange = (current, size) => {
  pageSize.value = size
  fetchTableData()
}

const handlePageChange = (page) => {
  currentPage.value = page
  fetchTableData()
}

// 带动画效果刷新表列表
const refreshTablesWithAnimation = async () => {
  // 显示加载状态
  const hide = message.loading('刷新表列表...', 0);
  
  try {
    console.log('开始刷新表列表');
    // 确保获取最新的表列表
    await fetchDynamicTables();
    console.log('表列表已更新:', dynamicTables.value);
    
    // 短暂延迟以确保DOM已更新
    setTimeout(() => {
      // 尝试添加高亮效果
      const tablesSection = document.querySelector('.tables-section');
      if (tablesSection) {
        console.log('应用高亮动画效果');
        tablesSection.classList.add('highlight-animation');
        
        // 移除高亮效果
        setTimeout(() => {
          tablesSection.classList.remove('highlight-animation');
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
const initLockedTablesStatus = () => {
  try {
    // 从本地存储加载锁定状态
    const savedData = localStorage.getItem('lockedTables');
    if (savedData) {
      const savedLockStatus = JSON.parse(savedData);
      console.log('从本地存储加载的表锁定状态:', savedLockStatus);
      
      // 应用锁定状态到现有表
      dynamicTables.value.forEach(table => {
        if (savedLockStatus[table.name]) {
          table.locked = true;
        }
      });
    }
  } catch (error) {
    console.error('初始化表锁定状态时出错:', error);
  }
}

// 回到顶部函数
const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

// 清除所有筛选条件
const clearAllFilters = () => {
  // 清空筛选信息
  filterInfo.value = {};
  searchKeywords.value = {};
  
  // 显示加载状态
  tableLoading.value = true;
  
  // 加载未筛选的数据
  fetchTableData().then(() => {
    message.success('已清除所有筛选条件');
  });
}

// 处理表格变化 (排序、筛选等)
const handleTableChange = (pagination, filters, sorter) => {
  console.log('表格变化:', { sorter, filters });
  
  // 更新排序信息
  if (sorter && sorter.field) {
    sortInfo.value.field = sorter.field;
    sortInfo.value.order = sorter.order;
  } else {
    sortInfo.value.field = '';
    sortInfo.value.order = '';
  }
  
  // 更新筛选信息
  filterInfo.value = {};
  searchKeywords.value = {};
  
  // 处理筛选条件
  if (filters) {
    Object.keys(filters).forEach(key => {
      if (filters[key]) {
        if (Array.isArray(filters[key]) && filters[key].length > 0) {
          filterInfo.value[key] = filters[key];
          console.log(`添加筛选条件 ${key}:`, filters[key]);
        }
        
        if (filters[key]._custom && typeof filters[key]._custom === 'string' && filters[key]._custom.trim()) {
          searchKeywords.value[key] = filters[key]._custom.trim();
          console.log(`添加搜索关键字 ${key}:`, filters[key]._custom.trim());
        }
      }
    });
  }
  
  // 重置到第一页
  currentPage.value = 1;
  
  // 设置表格加载状态
  tableLoading.value = true;
  
  // 显示筛选应用中的提示
  const filterApplyMsg = message.loading('正在对所有数据应用筛选条件...', 0);
  
  console.log('发送筛选请求到后端，筛选条件:', {
    filters: filterInfo.value,
    searchKeywords: searchKeywords.value
  });
  
  // 重新获取数据
  fetchTableData().finally(() => {
    filterApplyMsg();
    
    if (Object.keys(filterInfo.value).length > 0 || Object.keys(searchKeywords.value).length > 0) {
      message.success('已对全部数据应用筛选条件');
    }
  });
}

// 处理全局搜索
const handleGlobalSearch = (value) => {
  if (!value) {
    searchKeywords.value = {}
    fetchTableData()
    return
  }
  
  tableLoading.value = true
  const hide = message.loading('正在搜索数据...', 0)
  
  const searchConditions = {}
  
  if (selectedSearchColumn.value === 'all') {
    tableColumns.value.forEach(col => {
      searchConditions[col.prop] = value
    })
  } else {
    searchConditions[selectedSearchColumn.value] = value
  }
  
  searchKeywords.value = searchConditions
  currentPage.value = 1
  
  fetchTableData().finally(() => {
    hide()
  })
}

// 添加编辑相关的方法
const handleEdit = (record) => {
  // 深拷贝记录，避免直接修改原数据
  editingRecord.value = JSON.parse(JSON.stringify(record))
  // 使用实际的列名创建编辑表单数据
  editForm.value = {}
  tableColumns.value.forEach(col => {
    if (col.prop !== 'id' && col.prop !== 'created_at' && col.prop !== 'updated_at') {
      editForm.value[col.prop] = record[col.prop]
    }
  })
  editModalVisible.value = true
}

const handleEditCancel = () => {
  editModalVisible.value = false
  editingRecord.value = null
  editForm.value = {}
}

const handleEditOk = async () => {
  if (!currentTableName.value || !editingRecord.value?.id) {
    message.error('缺少必要的修改信息')
    return
  }

  const hide = message.loading('正在保存修改...', 0)
  tableLoading.value = true

  try {
    // 构建要更新的数据对象，使用实际的列名
    const updateData = {}
    tableColumns.value.forEach(col => {
      if (col.prop !== 'id' && col.prop !== 'created_at' && col.prop !== 'updated_at') {
        updateData[col.prop] = editForm.value[col.prop]
      }
    })

    console.log('提交修改数据:', updateData)

    const response = await fetch(
      `/api/tables/${currentTableName.value}/data/${editingRecord.value.id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: updateData })
      }
    )

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message || '修改失败')
    }

    if (result.success) {
      // 先关闭弹窗和清理表单
      editModalVisible.value = false
      editingRecord.value = null
      editForm.value = {}
      
      // 显示成功消息
      message.success('修改成功')
      
      // 重新获取数据
      await fetchTableData()
    } else {
      throw new Error(result.message || '修改失败')
    }
  } catch (error) {
    console.error('修改数据错误:', error)
    message.error('修改数据时发生错误: ' + error.message)
  } finally {
    // 确保loading状态被关闭
    tableLoading.value = false
    hide()
  }
}

onMounted(() => {
  fetchDynamicTables()
  // 只在有当前表名时才获取数据
  if (currentTableName.value) {
    fetchTableData()
  }
  
  setTimeout(initLockedTablesStatus, 500)
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
  flex-direction: column;
  gap: 20px;
}

/* 大屏幕上使用两列布局 - 上传与表格列表并排 */
@media (min-width: 992px) {
  .upload-content {
    flex-direction: row;
    align-items: flex-start;
  }
  
  .upload-section {
    width: 40%;
  }
  
  .tables-section {
    width: 60%;
    padding-left: 20px;
  }
}

.upload-all-card, .data-card {
  margin-bottom: 20px;
  transition: all 0.3s;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 2px -2px rgba(0, 0, 0, 0.16), 
              0 3px 6px 0 rgba(0, 0, 0, 0.12), 
              0 5px 12px 4px rgba(0, 0, 0, 0.09);
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

.search-box {
  margin-right: 16px;
}

.search-container {
  display: flex;
  align-items: center;
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

.dynamic-table-options {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f0f7ff;
  border-radius: 6px;
  border-left: 3px solid #1890ff;
}

.option-label {
  font-weight: 500;
  color: rgba(0, 0, 0, 0.85);
}

.option-checkbox {
  margin-bottom: 10px;
}

.table-options {
  margin-top: 15px;
  padding-left: 25px;
  border-top: 1px dashed #d9d9d9;
  padding-top: 15px;
}

.table-name-input {
  margin-bottom: 15px;
}

.upload-excel {
  width: 100%;
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

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  padding: 10px 0;
}

.filter-info {
  margin-bottom: 16px;
}

[class*="ant-"] {
  box-sizing: border-box;
}

.back-to-top-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
}
</style> 