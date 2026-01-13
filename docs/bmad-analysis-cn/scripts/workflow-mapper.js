#!/usr/bin/env node

/**
 * Workflow映射器
 * 分析BMAD-METHOD中的工作流结构和依赖关系
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const glob = require('glob');

class WorkflowMapper {
  constructor() {
    this.workflows = [];
    this.statistics = {
      total: 0,
      byModule: {},
      byType: {
        yaml: 0,
        markdown: 0
      },
      stepFiles: 0,
      totalSteps: 0
    };
  }

  /**
   * 扫描并分析所有工作流文件
   */
  async analyzeAllWorkflows() {
    console.log('🔍 开始分析BMAD-METHOD工作流系统...\n');

    // 查找工作流文件
    const yamlWorkflows = glob.sync('src/**/workflows/**/*.yaml');
    const mdWorkflows = glob.sync('src/**/workflows/**/workflow.md');

    console.log(`发现工作流文件:`);
    console.log(`  YAML格式: ${yamlWorkflows.length}个`);
    console.log(`  Markdown格式: ${mdWorkflows.length}个\n`);

    // 分析YAML工作流
    for (const filePath of yamlWorkflows) {
      try {
        const workflow = await this.analyzeYamlWorkflow(filePath);
        this.workflows.push(workflow);
        this.updateStatistics(workflow);
        console.log(`✅ ${workflow.name} (YAML)`);
      } catch (error) {
        console.log(`❌ ${filePath}: ${error.message}`);
      }
    }

    // 分析Markdown工作流
    for (const filePath of mdWorkflows) {
      try {
        const workflow = await this.analyzeMarkdownWorkflow(filePath);
        this.workflows.push(workflow);
        this.updateStatistics(workflow);
        console.log(`✅ ${workflow.name} (Markdown)`);
      } catch (error) {
        console.log(`❌ ${filePath}: ${error.message}`);
      }
    }

    this.generateReport();
  }

  /**
   * 分析YAML工作流文件
   */
  async analyzeYamlWorkflow(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = yaml.parse(content);

    return {
      filePath,
      type: 'yaml',
      name: parsed.name || path.basename(path.dirname(filePath)),
      description: parsed.description || '',
      module: this.extractModule(filePath),
      config: parsed,
      steps: [], // YAML工作流通常不包含详细步骤
      dependencies: this.extractDependencies(parsed)
    };
  }

  /**
   * 分析Markdown工作流文件
   */
  async analyzeMarkdownWorkflow(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');

    // 解析frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = frontmatterMatch ? yaml.parse(frontmatterMatch[1]) : {};

    // 分析步骤文件
    const workflowDir = path.dirname(filePath);
    const steps = this.analyzeStepFiles(workflowDir);

    return {
      filePath,
      type: 'markdown',
      name: frontmatter.name || path.basename(workflowDir),
      description: frontmatter.description || '',
      module: this.extractModule(filePath),
      config: frontmatter,
      steps,
      dependencies: this.extractMarkdownDependencies(frontmatter, content),
      modes: this.detectWorkflowModes(frontmatter, content)
    };
  }

  /**
   * 分析步骤文件
   */
  analyzeStepFiles(workflowDir) {
    const stepDirs = ['steps-c', 'steps-v', 'steps-e', 'steps'];
    let allSteps = [];

    stepDirs.forEach(stepDir => {
      const stepPath = path.join(workflowDir, stepDir);
      if (fs.existsSync(stepPath)) {
        const stepFiles = glob.sync(path.join(stepPath, 'step-*.md'));
        const steps = stepFiles.map(file => {
          const content = fs.readFileSync(file, 'utf8');
          const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
          const frontmatter = frontmatterMatch ? yaml.parse(frontmatterMatch[1]) : {};

          return {
            file: path.relative(workflowDir, file),
            name: frontmatter.name || path.basename(file, '.md'),
            description: frontmatter.description || '',
            nextStep: frontmatter.nextStepFile || null,
            mode: stepDir.replace('steps-', '') || 'default'
          };
        });

        allSteps = allSteps.concat(steps);
      }
    });

    return allSteps.sort((a, b) => a.file.localeCompare(b.file));
  }

  /**
   * 检测工作流模式
   */
  detectWorkflowModes(frontmatter, content) {
    const modes = [];

    if (frontmatter.nextStep) modes.push('create');
    if (frontmatter.validateWorkflow) modes.push('validate');
    if (frontmatter.editWorkflow) modes.push('edit');

    if (content.includes('Create Mode') || content.includes('steps-c/')) {
      modes.push('create');
    }
    if (content.includes('Validate Mode') || content.includes('steps-v/')) {
      modes.push('validate');
    }
    if (content.includes('Edit Mode') || content.includes('steps-e/')) {
      modes.push('edit');
    }

    return [...new Set(modes)]; // 去重
  }

  /**
   * 提取模块信息
   */
  extractModule(filePath) {
    const match = filePath.match(/src\/modules\/([^\/]+)\//);
    return match ? match[1] : 'core';
  }

  /**
   * 提取依赖关系
   */
  extractDependencies(config) {
    const dependencies = [];

    // 检查配置中的文件引用
    if (config.main_config) dependencies.push(config.main_config);
    if (config.template) dependencies.push(config.template);
    if (config.data) dependencies.push(config.data);

    return dependencies;
  }

  /**
   * 提取Markdown工作流依赖
   */
  extractMarkdownDependencies(frontmatter, content) {
    const dependencies = [];

    // 从frontmatter提取
    if (frontmatter.main_config) dependencies.push(frontmatter.main_config);
    if (frontmatter.nextStep) dependencies.push(frontmatter.nextStep);
    if (frontmatter.validateWorkflow) dependencies.push(frontmatter.validateWorkflow);
    if (frontmatter.editWorkflow) dependencies.push(frontmatter.editWorkflow);

    // 从内容中提取文件引用
    const fileRefs = content.match(/\{[^}]*\}/g) || [];
    fileRefs.forEach(ref => {
      if (ref.includes('project-root') || ref.includes('.md') || ref.includes('.yaml')) {
        dependencies.push(ref);
      }
    });

    return [...new Set(dependencies)]; // 去重
  }

  /**
   * 更新统计信息
   */
  updateStatistics(workflow) {
    this.statistics.total++;

    // 按模块统计
    const module = workflow.module;
    this.statistics.byModule[module] = (this.statistics.byModule[module] || 0) + 1;

    // 按类型统计
    this.statistics.byType[workflow.type]++;

    // 步骤统计
    if (workflow.steps && workflow.steps.length > 0) {
      this.statistics.stepFiles++;
      this.statistics.totalSteps += workflow.steps.length;
    }
  }

  /**
   * 生成分析报告
   */
  generateReport() {
    console.log('\n📊 === 工作流系统分析报告 ===\n');

    // 总体统计
    console.log('🎯 总体统计:');
    console.log(`  总工作流数: ${this.statistics.total}`);
    console.log(`  模块分布:`);
    Object.entries(this.statistics.byModule).forEach(([module, count]) => {
      console.log(`    ${module}: ${count}个`);
    });

    // 类型统计
    console.log('\n📄 类型统计:');
    Object.entries(this.statistics.byType).forEach(([type, count]) => {
      const percentage = ((count / this.statistics.total) * 100).toFixed(1);
      console.log(`  ${type}格式: ${count}个 (${percentage}%)`);
    });

    // 步骤统计
    console.log('\n📋 步骤文件统计:');
    console.log(`  包含步骤文件的工作流: ${this.statistics.stepFiles}个`);
    console.log(`  总步骤数: ${this.statistics.totalSteps}个`);
    if (this.statistics.stepFiles > 0) {
      const avgSteps = (this.statistics.totalSteps / this.statistics.stepFiles).toFixed(1);
      console.log(`  平均每个工作流步骤数: ${avgSteps}个`);
    }

    // 详细工作流信息
    console.log('\n📋 详细工作流信息:\n');
    this.workflows.forEach(workflow => {
      console.log(`🔄 ${workflow.name} (${workflow.type.toUpperCase()})`);
      console.log(`   模块: ${workflow.module}`);
      console.log(`   描述: ${workflow.description || '无描述'}`);
      console.log(`   步骤: ${workflow.steps.length}个`);
      if (workflow.modes && workflow.modes.length > 0) {
        console.log(`   模式: ${workflow.modes.join(', ')}`);
      }
      if (workflow.dependencies && workflow.dependencies.length > 0) {
        console.log(`   依赖: ${workflow.dependencies.length}个`);
      }
      console.log('');
    });

    // 模式分析
    this.analyzeModes();

    // 保存详细报告
    this.saveDetailedReport();
  }

  /**
   * 分析工作流模式
   */
  analyzeModes() {
    console.log('🔀 工作流模式分析:\n');

    const modeStats = {};
    this.workflows.forEach(workflow => {
      if (workflow.modes && workflow.modes.length > 0) {
        workflow.modes.forEach(mode => {
          modeStats[mode] = (modeStats[mode] || 0) + 1;
        });
      }
    });

    Object.entries(modeStats).forEach(([mode, count]) => {
      console.log(`  ${mode}模式: ${count}个工作流`);
    });

    // 三模态工作流
    const triModalWorkflows = this.workflows.filter(w =>
      w.modes && w.modes.length === 3 &&
      w.modes.includes('create') && w.modes.includes('validate') && w.modes.includes('edit')
    );

    console.log(`\n  三模态工作流 (Create+Validate+Edit): ${triModalWorkflows.length}个`);
    triModalWorkflows.forEach(w => {
      console.log(`    - ${w.name}`);
    });
  }

  /**
   * 保存详细报告到文件
   */
  saveDetailedReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      statistics: this.statistics,
      workflows: this.workflows.map(workflow => ({
        name: workflow.name,
        type: workflow.type,
        module: workflow.module,
        description: workflow.description,
        stepCount: workflow.steps.length,
        modes: workflow.modes || [],
        dependencies: workflow.dependencies || [],
        steps: workflow.steps.map(step => ({
          name: step.name,
          file: step.file,
          mode: step.mode
        }))
      }))
    };

    const outputPath = path.join(__dirname, '..', 'workflow-analysis-report.json');
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 详细报告已保存到: ${outputPath}`);
  }
}

// 主程序
if (require.main === module) {
  const mapper = new WorkflowMapper();
  mapper.analyzeAllWorkflows().catch(console.error);
}

module.exports = WorkflowMapper;