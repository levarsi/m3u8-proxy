import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Panel } from '../ui/Panel';
import { PageHeader } from '../ui/PageHeader';
import { http } from '../lib/http';
import { toast } from 'sonner';

// 定义训练数据类型
interface TrainingData {
  id: string;
  url: string;
  isAd: boolean;
  patternMatching?: {
    confidence: number;
  };
  structuralAnalysis?: {
    confidence: number;
  };
  durationAnalysis?: {
    confidence: number;
    duration: number;
  };
  tsContentAnalysis?: {
    confidence: number;
    probability: number;
  };
  networkAnalysis?: {
    confidence: number;
    features: {
      queryParamCount: number;
      adDomainMatch: boolean;
      hasAdKeywords: boolean;
      isThirdParty: boolean;
      cdnDomain: boolean;
    };
  };
  playlistContext?: {
    confidence: number;
    patterns: string[];
  };
  createdAt: string;
  updatedAt?: string;
}

// 定义模型状态类型
interface ModelStatus {
  isTrained: boolean;
  stats: {
    totalTrainingSessions: number;
    totalPredictions: number;
    correctPredictions: number;
    trainingTime: number;
    predictionTime: number;
    modelSize: number;
  };
  trainConfig: {
    epochs: number;
    batchSize: number;
    learningRate: number;
    validationSplit: number;
    callbacks: any[];
  };
  trainingStatus?: {
    isTraining: boolean;
    currentEpoch: number;
    totalEpochs: number;
    loss: number;
    accuracy: number;
    valLoss: number;
    valAccuracy: number;
    startTime: number;
    endTime: number | null;
    status: 'idle' | 'training' | 'completed' | 'failed';
    error?: string;
  };
}

// 定义训练参数类型
interface TrainParams {
  epochs: number;
  batchSize: number;
  learningRate: number;
  validationSplit: number;
}

export function ModelTrainingPage() {
  // 状态管理
  const [trainingData, setTrainingData] = useState<TrainingData[]>([]);
  const [selectedData, setSelectedData] = useState<string[]>([]);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainParams, setTrainParams] = useState<TrainParams>({
    epochs: 50,
    batchSize: 32,
    learningRate: 0.001,
    validationSplit: 0.2
  });
  const [newData, setNewData] = useState<Omit<TrainingData, 'id' | 'createdAt' | 'updatedAt'>>({ 
    url: '', 
    isAd: false 
  });
  const [file, setFile] = useState<File | null>(null);
  // 训练状态和历史记录
  const [trainingStatus, setTrainingStatus] = useState<any>(null);
  const [trainingHistory, setTrainingHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<number | null>(null);

  // 加载训练数据
  const loadTrainingData = async () => {
    try {
      const { data } = await http.get('/nn-model/training-data');
      if (data.success) {
        setTrainingData(data.data);
      }
    } catch (error) {
      toast.error('加载训练数据失败');
    }
  };

  // 加载模型状态
  const loadModelStatus = async () => {
    try {
      const { data } = await http.get('/nn-model/train/status');
      if (data.isTrained !== undefined) {
        setModelStatus(data);
        // 更新训练状态
        if (data.trainingStatus) {
          setTrainingStatus(data.trainingStatus);
          setIsTraining(data.trainingStatus.isTraining);
        }
      }
    } catch (error) {
      toast.error('加载模型状态失败');
    }
  };

  // 加载训练历史记录
  const loadTrainingHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const { data } = await http.get('/nn-model/train/history');
      if (data.success && data.history) {
        setTrainingHistory(data.history);
      }
    } catch (error) {
      toast.error('加载训练历史记录失败');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // 开始轮询训练状态
  const startPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    const interval = setInterval(() => {
      loadModelStatus();
    }, 2000); // 每2秒轮询一次
    setPollingInterval(interval);
  };

  // 停止轮询训练状态
  const stopPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };

  // 初始化数据
  useEffect(() => {
    loadTrainingData();
    loadModelStatus();
    loadTrainingHistory();
  }, []);

  // 监听isTraining状态变化，启动/停止轮询
  useEffect(() => {
    if (isTraining) {
      startPolling();
    } else {
      stopPolling();
    }
    return () => {
      stopPolling();
    };
  }, [isTraining]);

  // 选择/取消选择数据
  const toggleDataSelection = (id: string) => {
    setSelectedData(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id) 
        : [...prev, id]
    );
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    setSelectedData(selectedData.length === trainingData.length 
      ? [] 
      : trainingData.map(item => item.id)
    );
  };

  // 添加训练数据
  const addTrainingData = async () => {
    if (!newData.url) {
      toast.error('请输入URL');
      return;
    }

    try {
      const { data } = await http.post('/nn-model/training-data', newData);
      if (data.success) {
        toast.success('训练数据添加成功');
        setNewData({ url: '', isAd: false });
        loadTrainingData();
      }
    } catch (error) {
      toast.error('添加训练数据失败');
    }
  };

  // 删除训练数据
  const deleteTrainingData = async (id: string) => {
    try {
      await http.delete(`/nn-model/training-data/${id}`);
      toast.success('训练数据删除成功');
      loadTrainingData();
      setSelectedData(prev => prev.filter(item => item !== id));
    } catch (error) {
      toast.error('删除训练数据失败');
    }
  };

  // 批量删除训练数据
  const batchDeleteTrainingData = async () => {
    if (selectedData.length === 0) {
      toast.error('请选择要删除的数据');
      return;
    }

    try {
      await http.delete('/nn-model/training-data/batch', { data: { ids: selectedData } });
      toast.success(`成功删除 ${selectedData.length} 条训练数据`);
      loadTrainingData();
      setSelectedData([]);
    } catch (error) {
      toast.error('批量删除训练数据失败');
    }
  };

  // 上传训练数据
  const handleFileUpload = async () => {
    if (!file) {
      toast.error('请选择文件');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      await http.post('/nn-model/training-data/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success('训练数据上传成功');
      setFile(null);
      loadTrainingData();
    } catch (error) {
      toast.error('上传训练数据失败');
    }
  };

  // 开始训练模型
  const startTraining = async () => {
    if (trainingData.length === 0) {
      toast.error('训练数据不能为空');
      return;
    }

    setIsTraining(true);
    // 显示训练开始提示
    toast('开始模型训练...');

    try {
      const { data } = await http.post('/nn-model/train', { 
        trainingData, 
        trainConfig: trainParams 
      });
      if (data.success) {
        toast.success('模型训练成功');
        loadModelStatus();
        loadTrainingHistory();
      } else {
        toast.error('模型训练失败');
      }
    } catch (error: any) {
      toast.error(`模型训练失败: ${error.message || '未知错误'}`);
    } finally {
      setIsTraining(false);
    }
  };

  // 重置模型
  const resetModel = async () => {
    try {
      await http.post('/nn-model/reset');
      toast.success('模型重置成功');
      loadModelStatus();
    } catch (error) {
      toast.error('模型重置失败');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="模型训练"
        subtitle="管理训练数据并训练神经网络模型"
      />

      {/* 模型状态面板 */}
      <Panel title="模型状态">
        {modelStatus ? (
          <div className="space-y-4">
            {/* 模型基本信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-slate-600 dark:text-slate-400">训练状态</div>
                <div className="text-lg font-semibold">
                  {modelStatus.isTrained ? '已训练' : '未训练'}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-600 dark:text-slate-400">训练次数</div>
                <div className="text-lg font-semibold">{modelStatus.stats.totalTrainingSessions}</div>
              </div>
              <div>
                <div className="text-sm text-slate-600 dark:text-slate-400">预测次数</div>
                <div className="text-lg font-semibold">{modelStatus.stats.totalPredictions}</div>
              </div>
              <div>
                <div className="text-sm text-slate-600 dark:text-slate-400">正确预测</div>
                <div className="text-lg font-semibold">{modelStatus.stats.correctPredictions}</div>
              </div>
              <div>
                <div className="text-sm text-slate-600 dark:text-slate-400">训练时间 (ms)</div>
                <div className="text-lg font-semibold">{modelStatus.stats.trainingTime}</div>
              </div>
              <div>
                <div className="text-sm text-slate-600 dark:text-slate-400">模型大小 (bytes)</div>
                <div className="text-lg font-semibold">{modelStatus.stats.modelSize}</div>
              </div>
            </div>
            
            {/* 训练进度显示 */}
            {trainingStatus && (trainingStatus.isTraining || trainingStatus.status !== 'idle') && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 dark:bg-blue-900/20 dark:border-blue-700">
                <div className="mb-2 font-semibold text-blue-800 dark:text-blue-300">训练进度</div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>训练状态</span>
                    <span className={`font-semibold ${trainingStatus.status === 'training' ? 'text-blue-600 dark:text-blue-400' : trainingStatus.status === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {trainingStatus.status === 'training' && '训练中'}
                      {trainingStatus.status === 'completed' && '已完成'}
                      {trainingStatus.status === 'failed' && '失败'}
                      {trainingStatus.status === 'idle' && '空闲'}
                    </span>
                  </div>
                  
                  {trainingStatus.isTraining && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>当前轮次</span>
                        <span className="font-semibold">{trainingStatus.currentEpoch} / {trainingStatus.totalEpochs}</span>
                      </div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300 dark:bg-blue-500" 
                          style={{ width: `${(trainingStatus.currentEpoch / trainingStatus.totalEpochs) * 100}%` }}
                        ></div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">损失值</div>
                          <div className="font-semibold">{trainingStatus.loss.toFixed(4)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">准确率</div>
                          <div className="font-semibold">{(trainingStatus.accuracy * 100).toFixed(2)}%</div>
                        </div>
                      </div>
                    </>
                  )}
                  
                  {trainingStatus.status === 'completed' && trainingStatus.endTime && trainingStatus.startTime && (
                    <div className="text-sm">
                      <div className="space-y-1">
                        <div>训练时长: {(trainingStatus.endTime - trainingStatus.startTime) / 1000} 秒</div>
                        <div>最终损失值: {trainingStatus.loss.toFixed(4)}</div>
                        <div>最终准确率: {(trainingStatus.accuracy * 100).toFixed(2)}%</div>
                      </div>
                    </div>
                  )}
                  
                  {trainingStatus.status === 'failed' && trainingStatus.error && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded dark:bg-red-900/20 dark:text-red-400">
                      <div className="font-medium mb-1">训练失败原因:</div>
                      <div>{trainingStatus.error}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* 操作按钮 */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="danger" onClick={resetModel}>
                重置模型
              </Button>
              <Button 
                variant="primary" 
                onClick={startTraining}
                disabled={isTraining || trainingData.length === 0}
              >
                {isTraining ? '训练中...' : '开始训练'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">加载模型状态中...</div>
        )}
      </Panel>
      
      {/* 训练参数面板 */}
      <Panel title="训练参数">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm mb-1">训练轮次</div>
            <input
              type="number"
              min="1"
              value={trainParams.epochs}
              onChange={(e) => setTrainParams(prev => ({ ...prev, epochs: parseInt(e.target.value) }))}
              className="w-full p-2 border border-slate-300 rounded dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <div className="text-sm mb-1">批量大小</div>
            <input
              type="number"
              min="1"
              value={trainParams.batchSize}
              onChange={(e) => setTrainParams(prev => ({ ...prev, batchSize: parseInt(e.target.value) }))}
              className="w-full p-2 border border-slate-300 rounded dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <div className="text-sm mb-1">学习率</div>
            <input
              type="number"
              step="0.0001"
              min="0.00001"
              max="0.1"
              value={trainParams.learningRate}
              onChange={(e) => setTrainParams(prev => ({ ...prev, learningRate: parseFloat(e.target.value) }))}
              className="w-full p-2 border border-slate-300 rounded dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <div className="text-sm mb-1">验证集比例</div>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={trainParams.validationSplit}
              onChange={(e) => setTrainParams(prev => ({ ...prev, validationSplit: parseFloat(e.target.value) }))}
              className="w-full p-2 border border-slate-300 rounded dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>
      </Panel>
      
      {/* 训练历史记录面板 */}
      <Panel title="训练历史记录">
        <div className="flex justify-between items-center mb-4">
          <div></div>
          <Button 
              variant="secondary" 
              onClick={loadTrainingHistory}
              disabled={isLoadingHistory}
            >
            {isLoadingHistory ? '刷新中...' : '刷新'}
          </Button>
        </div>
        
        {isLoadingHistory ? (
          <div className="text-center py-4">加载训练历史记录中...</div>
        ) : trainingHistory.length === 0 ? (
          <div className="text-center py-4">暂无训练历史记录</div>
        ) : (
          <div className="space-y-3">
            {trainingHistory.map((history, index) => (
              <div key={history.id} className="border border-slate-200 rounded-lg p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
                  <div className="font-semibold text-sm mb-1 md:mb-0">训练 #{index + 1}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(history.startTime).toLocaleString()}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">训练轮次</div>
                    <div>{history.epochs} 轮</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">训练时长</div>
                    <div>{(history.duration / 1000).toFixed(2)} 秒</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">最终准确率</div>
                    <div className={`font-semibold ${history.finalAccuracy > 0.8 ? 'text-green-600 dark:text-green-400' : history.finalAccuracy > 0.6 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                      {(history.finalAccuracy * 100).toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      
      {/* 训练数据面板 */}
      <Panel title="训练数据管理">
        <div className="mb-4">
          <div className="font-semibold mb-2">添加训练数据</div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm mb-1">URL</div>
              <input
                type="text"
                value={newData.url}
                onChange={(e) => setNewData(prev => ({ ...prev, url: e.target.value }))}
                placeholder="输入URL"
                className="w-full p-2 border border-slate-300 rounded dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newData.isAd}
                onChange={(e) => setNewData(prev => ({ ...prev, isAd: e.target.checked }))}
              />
              <span className="text-sm">是否为广告</span>
            </div>
          </div>
          
          <div className="mt-2 flex gap-2">
            <Button variant="primary" onClick={addTrainingData}>
              添加数据
            </Button>
            
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".json"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
                id="training-data-file"
              />
              <label 
                htmlFor="training-data-file"
                className="cursor-pointer px-3 py-1.5 border border-slate-300 rounded dark:border-slate-600 dark:bg-slate-800 dark:text-white text-sm"
              >
                选择文件
              </label>
              {file && (
                <span className="text-sm text-slate-500 dark:text-slate-400">{file.name}</span>
              )}
              <Button 
                variant="secondary" 
                onClick={handleFileUpload}
                disabled={!file}
              >
                上传
              </Button>
            </div>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="font-semibold">训练数据列表</div>
            <Button 
                variant="danger" 
                onClick={batchDeleteTrainingData}
                disabled={selectedData.length === 0}
              >
              批量删除 ({selectedData.length})
            </Button>
          </div>
          
          {trainingData.length === 0 ? (
            <div className="text-center py-4 text-slate-500 dark:text-slate-400">暂无训练数据</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left px-2 py-1 text-sm font-medium text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={selectedData.length === trainingData.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="text-left px-2 py-1 text-sm font-medium text-slate-600 dark:text-slate-300">URL</th>
                    <th className="text-left px-2 py-1 text-sm font-medium text-slate-600 dark:text-slate-300">是否为广告</th>
                    <th className="text-left px-2 py-1 text-sm font-medium text-slate-600 dark:text-slate-300">创建时间</th>
                    <th className="text-right px-2 py-1 text-sm font-medium text-slate-600 dark:text-slate-300">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {trainingData.map((data) => (
                    <tr key={data.id} className="border-b border-slate-200 dark:border-slate-700">
                      <td className="px-2 py-1">
                        <input
                          type="checkbox"
                          checked={selectedData.includes(data.id)}
                          onChange={() => toggleDataSelection(data.id)}
                        />
                      </td>
                      <td className="px-2 py-1 text-sm truncate max-w-[300px]">{data.url}</td>
                      <td className="px-2 py-1 text-sm">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${data.isAd ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'}`}>
                          {data.isAd ? '是' : '否'}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-sm text-slate-500 dark:text-slate-400">
                        {new Date(data.createdAt).toLocaleString()}
                      </td>
                      <td className="px-2 py-1 text-right">
                        <Button 
                          variant="danger" 
                          onClick={() => deleteTrainingData(data.id)}
                        >
                          删除
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
