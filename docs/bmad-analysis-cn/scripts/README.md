# BMAD-METHOD 分析脚本工具

这个目录包含了用于深入分析BMAD-METHOD项目的脚本工具。

## 脚本列表

### 1. agent-analyzer.js
**功能**: 分析所有Agent的结构和特性

**使用方法**:
```bash
# 在项目根目录运行
cd /path/to/BMAD-METHOD
node docs/bmad-analysis-cn/scripts/agent-analyzer.js
```

**输出**:
- 控制台显示详细分析报告
- 生成 `docs/bmad-analysis-cn/agent-analysis-report.json`

**分析内容**:
- Agent总数和模块分布
- 特性统计 (discussion, webskip, sidecar等)
- 触发器类型分析
- 详细Agent信息

### 2. workflow-mapper.js
**功能**: 分析工作流结构和依赖关系

**使用方法**:
```bash
cd /path/to/BMAD-METHOD
node docs/bmad-analysis-cn/scripts/workflow-mapper.js
```

**输出**:
- 控制台显示工作流分析报告
- 生成 `docs/bmad-analysis-cn/workflow-analysis-report.json`

**分析内容**:
- 工作流总数和类型分布
- 步骤文件统计
- 模式分析 (Create/Validate/Edit)
- 依赖关系映射

### 3. level-detector.js
**功能**: 模拟Scale-Adaptive系统的Level检测逻辑

**使用方法**:
```bash
cd /path/to/BMAD-METHOD

# 运行测试用例
node docs/bmad-analysis-cn/scripts/level-detector.js test

# 交互式模式
node docs/bmad-analysis-cn/scripts/level-detector.js interactive

# 单次检测
node docs/bmad-analysis-cn/scripts/level-detector.js "添加用户评论系统"
```

**功能特性**:
- 关键词匹配分析
- Story数量范围检测
- 综合评分算法
- 置信度计算
- 推理过程说明

## 环境要求

确保已安装必要的依赖:

```bash
# 检查Node.js版本 (需要 >= 14)
node --version

# 安装项目依赖 (如果还没有安装)
npm install
```

## 使用示例

### 完整分析流程

```bash
# 1. 进入项目目录
cd /path/to/BMAD-METHOD

# 2. 分析Agent系统
echo "=== Agent系统分析 ==="
node docs/bmad-analysis-cn/scripts/agent-analyzer.js

echo -e "\n=== 工作流系统分析 ==="
node docs/bmad-analysis-cn/scripts/workflow-mapper.js

echo -e "\n=== Level检测系统测试 ==="
node docs/bmad-analysis-cn/scripts/level-detector.js test
```

### Level检测交互示例

```bash
$ node docs/bmad-analysis-cn/scripts/level-detector.js interactive

🎮 交互式Level检测器
输入项目描述，系统将自动检测推荐Level

项目描述 (输入 "exit" 退出): 构建微服务架构的订单管理系统
预估Stories数量 (可选，直接回车跳过): 30

🎯 开始Level检测 (bmm模块):
描述: "构建微服务架构的订单管理系统"
预估Stories: 30

🔍 关键词匹配结果:
  Level 3: 2个匹配

📊 Story数量匹配:
  Level 3: ✓ 匹配 (12-40 stories)

⚖️ 综合评分:
  Level 0: 0.00分
  Level 1: 0.00分
  Level 2: 0.00分
  Level 3: 4.00分
  Level 4: 0.00分

🎯 检测结果:
推荐Level: 3 (Complex System)
描述: Subsystems, integrations, full architecture
Stories范围: 12-40 stories
文档要求: PRD + architecture + JIT tech specs
需要架构: 是
```

## 输出文件说明

### agent-analysis-report.json
```json
{
  "generatedAt": "2026-01-13T...",
  "statistics": {
    "total": 29,
    "byModule": {
      "bmm": 9,
      "cis": 6,
      "core": 1
    },
    "byFeatures": {
      "discussion": 5,
      "webskip": 2
    }
  },
  "agents": [...]
}
```

### workflow-analysis-report.json
```json
{
  "generatedAt": "2026-01-13T...",
  "statistics": {
    "total": 45,
    "byModule": {
      "bmm": 25,
      "bmgd": 15
    },
    "stepFiles": 12,
    "totalSteps": 134
  },
  "workflows": [...]
}
```

## 扩展开发

如果需要添加新的分析功能，可以参考现有脚本的结构：

1. **基础结构**: 使用类来组织分析逻辑
2. **配置加载**: 从YAML文件读取配置
3. **统计收集**: 维护详细的统计信息
4. **报告生成**: 同时输出控制台和JSON文件
5. **错误处理**: 优雅处理文件读取和解析错误

### 新脚本模板

```javascript
#!/usr/bin/env node

class NewAnalyzer {
  constructor() {
    this.data = [];
    this.statistics = {};
  }

  async analyze() {
    // 分析逻辑
  }

  generateReport() {
    // 生成报告
  }

  saveReport() {
    // 保存到文件
  }
}

if (require.main === module) {
  const analyzer = new NewAnalyzer();
  analyzer.analyze().catch(console.error);
}

module.exports = NewAnalyzer;
```

## 故障排除

### 常见问题

1. **文件路径错误**
   - 确保在BMAD-METHOD项目根目录运行脚本
   - 检查相对路径是否正确

2. **依赖缺失**
   - 运行 `npm install` 安装项目依赖
   - 检查Node.js版本是否符合要求

3. **权限问题**
   - 确保脚本文件有执行权限：`chmod +x script-name.js`

4. **YAML解析错误**
   - 检查YAML文件格式是否正确
   - 查看具体的错误信息定位问题

### 调试模式

在脚本中添加调试信息：

```javascript
// 启用详细日志
const DEBUG = process.env.DEBUG === 'true';

if (DEBUG) {
  console.log('调试信息:', data);
}
```

使用方法：
```bash
DEBUG=true node script-name.js
```