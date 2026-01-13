#!/usr/bin/env node

/**
 * Agent分析器
 * 分析BMAD-METHOD中所有Agent的结构和特性
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const glob = require('glob');

class AgentAnalyzer {
  constructor() {
    this.agents = [];
    this.statistics = {
      total: 0,
      byModule: {},
      byFeatures: {
        discussion: 0,
        webskip: 0,
        hasSidecar: 0,
        withPrompts: 0
      },
      triggerTypes: {
        legacy: 0,
        multi: 0,
        compound: 0
      }
    };
  }

  /**
   * 扫描并分析所有Agent文件
   */
  async analyzeAllAgents() {
    console.log('🔍 开始分析BMAD-METHOD Agent系统...\n');

    // 查找所有agent.yaml文件
    const agentFiles = glob.sync('src/**/*.agent.yaml');
    console.log(`发现 ${agentFiles.length} 个Agent文件:\n`);

    for (const filePath of agentFiles) {
      try {
        const agent = await this.analyzeAgent(filePath);
        this.agents.push(agent);
        this.updateStatistics(agent);
        console.log(`✅ ${agent.metadata.name} (${agent.metadata.module || 'core'})`);
      } catch (error) {
        console.log(`❌ ${filePath}: ${error.message}`);
      }
    }

    this.generateReport();
  }

  /**
   * 分析单个Agent文件
   */
  async analyzeAgent(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = yaml.parse(content);

    if (!parsed.agent) {
      throw new Error('无效的Agent文件格式');
    }

    const agent = parsed.agent;

    return {
      filePath,
      metadata: agent.metadata,
      persona: agent.persona,
      menu: agent.menu || [],
      features: {
        discussion: agent.discussion || false,
        webskip: agent.webskip || false,
        hasSidecar: agent.metadata.hasSidecar || false,
        hasPrompts: (agent.prompts && agent.prompts.length > 0) || false,
        hasCriticalActions: (agent.critical_actions && agent.critical_actions.length > 0) || false
      },
      triggerAnalysis: this.analyzeTriggers(agent.menu || [])
    };
  }

  /**
   * 分析触发器类型
   */
  analyzeTriggers(menu) {
    const analysis = {
      total: menu.length,
      types: [],
      shortcuts: [],
      patterns: []
    };

    menu.forEach(item => {
      if (item.trigger) {
        // Legacy格式
        analysis.types.push('legacy');

        if (item.trigger.includes(' or fuzzy match on ')) {
          // 复合触发器
          const match = item.trigger.match(/^([A-Z]{1,3}) or fuzzy match on ([a-z0-9-]+)$/);
          if (match) {
            analysis.shortcuts.push(match[1]);
            analysis.patterns.push(match[2]);
          }
        } else {
          // 简单触发器
          analysis.patterns.push(item.trigger);
        }
      } else if (item.multi) {
        // Multi格式
        analysis.types.push('multi');
      }
    });

    return analysis;
  }

  /**
   * 更新统计信息
   */
  updateStatistics(agent) {
    this.statistics.total++;

    // 按模块统计
    const module = agent.metadata.module || 'core';
    this.statistics.byModule[module] = (this.statistics.byModule[module] || 0) + 1;

    // 按特性统计
    if (agent.features.discussion) this.statistics.byFeatures.discussion++;
    if (agent.features.webskip) this.statistics.byFeatures.webskip++;
    if (agent.features.hasSidecar) this.statistics.byFeatures.hasSidecar++;
    if (agent.features.hasPrompts) this.statistics.byFeatures.withPrompts++;

    // 按触发器类型统计
    agent.triggerAnalysis.types.forEach(type => {
      this.statistics.triggerTypes[type]++;
    });
  }

  /**
   * 生成分析报告
   */
  generateReport() {
    console.log('\n📊 === Agent系统分析报告 ===\n');

    // 总体统计
    console.log('🎯 总体统计:');
    console.log(`  总Agent数: ${this.statistics.total}`);
    console.log(`  模块分布:`);
    Object.entries(this.statistics.byModule).forEach(([module, count]) => {
      console.log(`    ${module}: ${count}个`);
    });

    // 特性统计
    console.log('\n🔧 特性统计:');
    Object.entries(this.statistics.byFeatures).forEach(([feature, count]) => {
      const percentage = ((count / this.statistics.total) * 100).toFixed(1);
      console.log(`  ${feature}: ${count}个 (${percentage}%)`);
    });

    // 触发器统计
    console.log('\n⚡ 触发器统计:');
    Object.entries(this.statistics.triggerTypes).forEach(([type, count]) => {
      console.log(`  ${type}格式: ${count}个`);
    });

    // 详细Agent信息
    console.log('\n📋 详细Agent信息:\n');
    this.agents.forEach(agent => {
      console.log(`🤖 ${agent.metadata.name} (${agent.metadata.title})`);
      console.log(`   模块: ${agent.metadata.module || 'core'}`);
      console.log(`   图标: ${agent.metadata.icon}`);
      console.log(`   菜单项: ${agent.menu.length}个`);
      console.log(`   触发器: ${agent.triggerAnalysis.shortcuts.join(', ') || '无快捷键'}`);
      console.log(`   特色: ${agent.persona.communication_style}`);
      console.log('');
    });

    // 保存详细报告
    this.saveDetailedReport();
  }

  /**
   * 保存详细报告到文件
   */
  saveDetailedReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      statistics: this.statistics,
      agents: this.agents.map(agent => ({
        name: agent.metadata.name,
        title: agent.metadata.title,
        module: agent.metadata.module || 'core',
        icon: agent.metadata.icon,
        menuItems: agent.menu.length,
        shortcuts: agent.triggerAnalysis.shortcuts,
        communicationStyle: agent.persona.communication_style,
        features: agent.features
      }))
    };

    const outputPath = path.join(__dirname, '..', 'agent-analysis-report.json');
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`📄 详细报告已保存到: ${outputPath}`);
  }
}

// 主程序
if (require.main === module) {
  const analyzer = new AgentAnalyzer();
  analyzer.analyzeAllAgents().catch(console.error);
}

module.exports = AgentAnalyzer;