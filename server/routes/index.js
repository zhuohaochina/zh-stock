const express = require('express');
const { handleUpload } = require('../controllers/uploadController');
const { getDataList, getFileList, getDataByFileName } = require('../controllers/dataController');
const { 
  getAllTables, 
  getTableStructure, 
  getTableData, 
  deleteTable 
} = require('../controllers/dynamicTableController');

const router = express.Router();

// 上传路由
router.post('/upload', handleUpload);

// 数据查询路由
router.get('/data', getDataList);
router.get('/files', getFileList);
router.get('/data/:fileName', getDataByFileName);

// 动态表路由
router.get('/tables', getAllTables);
router.get('/tables/:tableName', getTableStructure);
router.get('/tables/:tableName/data', getTableData);
router.delete('/tables/:tableName', deleteTable);

module.exports = router; 