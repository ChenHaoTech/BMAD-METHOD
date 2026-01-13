#!/usr/bin/env node

/**
 * Level检测器
 * 模拟BMAD-METHOD的Scale-Adaptive系统Level检测逻辑
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

class LevelDetector {
  constructor() {
    this.levelConfigs = {};
    this.loadLevelConfigs();
  }

  /**
   * 加载Level配置
   */
  loadLevelConfigs() {
    // BMM模块配置
    const bmmConfigPath = 'src/modules/bmm/workflows/workflow-status/project-levels.yaml';
    if (fs.existsSync(bmmConfigPath)) {
      const content = fs.readFileSync(bmmConfigPath, 'utf8');
      this.levelConfigs.bmm = yaml.parse(content);
    }

    // BMGD模块配置
    const bmgdConfigPath = 'src/modules/bmgd/workflows/workflow-status/project-levels.yaml';
    if (fs.existsSync(bmgdConfigPath)) {
      const content = fs.readFileSync(bmgdConfigPath, 'utf8');
      this.levelConfigs.bmgd = yaml.parse(content);
    }

    console.log('📊 已加载Level配置:');
    Object.keys(this.levelConfigs).forEach(module => {
      console.log(`  ${module}: ${Object.keys(this.levelConfigs[module].levels).length}个Level`);
    });
  }

  /**
   * 检测项目Level
   */
  detectLevel(description, estimatedStories = null, module = 'bmm') {
    console.log(`\n🎯 开始Level检测 (${module}模块):`);
    console.log(`描述: "${description}"`);
    if (estimatedStories) {
      console.log(`预估Stories: ${estimatedStories}`);
    }

    const config = this.levelConfigs[module];
    if (!config) {
      throw new Error(`未找到模块 ${module} 的配置`);
    }

    // 关键词检测
    const keywordScores = this.calculateKeywordScores(description, config);
    console.log('\n🔍 关键词匹配结果:');
    Object.entries(keywordScores).forEach(([level, score]) => {
      if (score > 0) {
        console.log(`  Level ${level}: ${score}个匹配`);
      }
    });

    // Story数量检测
    let storyScores = {};
    if (estimatedStories) {
      storyScores = this.calculateStoryScores(estimatedStories, config);
      console.log('\n📊 Story数量匹配:');
      Object.entries(storyScores).forEach(([level, match]) => {
        if (match) {
          console.log(`  Level ${level}: ✓ 匹配 (${config.levels[level].stories})`);
        }
      });
    }

    // 综合评分
    const finalScores = this.combineScores(keywordScores, storyScores);
    console.log('\n⚖️ 综合评分:');
    Object.entries(finalScores).forEach(([level, score]) => {
      console.log(`  Level ${level}: ${score.toFixed(2)}分`);
    });

    // 确定推荐Level
    const recommendedLevel = this.getRecommendedLevel(finalScores);
    const levelInfo = config.levels[recommendedLevel];

    console.log('\n🎯 检测结果:');
    console.log(`推荐Level: ${recommendedLevel} (${levelInfo.title})`);
    console.log(`描述: ${levelInfo.description}`);
    console.log(`Stories范围: ${levelInfo.stories}`);
    console.log(`文档要求: ${levelInfo.documentation}`);
    console.log(`需要架构: ${levelInfo.architecture ? '是' : '否'}`);

    return {
      recommendedLevel: parseInt(recommendedLevel),
      confidence: this.calculateConfidence(finalScores),
      reasoning: this.generateReasoning(keywordScores, storyScores, config),
      levelInfo
    };
  }

  /**
   * 计算关键词匹配分数
   */
  calculateKeywordScores(description, config) {
    const words = description.toLowerCase().split(/\s+/);
    const scores = {};

    // 初始化分数
    Object.keys(config.levels).forEach(level => {
      scores[level] = 0;
    });

    // 计算每个level的关键词匹配
    if (config.detection_hints && config.detection_hints.keywords) {
      Object.entries(config.detection_hints.keywords).forEach(([levelKey, keywords]) => {
        const level = levelKey.replace('level_', '');
        keywords.forEach(keyword => {
          if (words.some(word => word.includes(keyword) || keyword.includes(word))) {
            scores[level] += 1;
          }
        });
      });
    }

    return scores;
  }

  /**
   * 计算Story数量匹配分数
   */
  calculateStoryScores(estimatedStories, config) {
    const scores = {};

    if (config.detection_hints && config.detection_hints.story_counts) {
      Object.entries(config.detection_hints.story_counts).forEach(([levelKey, range]) => {
        const level = levelKey.replace('level_', '');
        const [min, max] = range;
        scores[level] = estimatedStories >= min && estimatedStories <= max;
      });
    }

    return scores;
  }

  /**
   * 综合评分
   */
  combineScores(keywordScores, storyScores) {
    const finalScores = {};

    Object.keys(keywordScores).forEach(level => {
      let score = keywordScores[level] * 1.0; // 关键词权重

      if (storyScores[level] === true) {
        score += 2.0; // Story匹配权重更高
      } else if (storyScores[level] === false) {
        score *= 0.5; // Story不匹配降权
      }

      finalScores[level] = score;
    });

    return finalScores;
  }

  /**
   * 获取推荐Level
   */
  getRecommendedLevel(scores) {
    let maxScore = -1;
    let recommendedLevel = '1';

    Object.entries(scores).forEach(([level, score]) => {
      if (score > maxScore) {
        maxScore = score;
        recommendedLevel = level;
      }
    });

    // 如果没有明确匹配，默认推荐Level 1
    if (maxScore === 0) {
      recommendedLevel = '1';
    }

    return recommendedLevel;
  }

  /**
   * 计算置信度
   */
  calculateConfidence(scores) {
    const values = Object.values(scores);
    const maxScore = Math.max(...values);
    const secondMaxScore = values.sort((a, b) => b - a)[1] || 0;

    if (maxScore === 0) return 0.3; // 无匹配，低置信度
    if (maxScore - secondMaxScore >= 2) return 0.9; // 明显优势，高置信度
    if (maxScore - secondMaxScore >= 1) return 0.7; // 一定优势，中等置信度
    return 0.5; // 差距较小，低置信度
  }

  /**
   * 生成推理说明
   */
  generateReasoning(keywordScores, storyScores, config) {
    const reasons = [];

    // 关键词推理
    Object.entries(keywordScores).forEach(([level, score]) => {
      if (score > 0) {
        const keywords = config.detection_hints.keywords[`level_${level}`] || [];
        reasons.push(`Level ${level}: 匹配${score}个关键词 (${keywords.join(', ')})`);
      }
    });

    // Story推理
    Object.entries(storyScores).forEach(([level, match]) => {
      if (match) {
        const range = config.detection_hints.story_counts[`level_${level}`];
        reasons.push(`Level ${level}: Story数量匹配范围 ${range[0]}-${range[1]}`);
      }
    });

    return reasons;
  }

  /**
   * 批量测试用例
   */
  runTestCases() {
    console.log('\n🧪 运行测试用例:\n');

    const testCases = [
      {
        description: "修复登录页面的验证码显示问题",
        estimatedStories: 1,
        expectedLevel: 0
      },
      {
        description: "添加用户头像上传功能",
        estimatedStories: 3,
        expectedLevel: 1
      },
      {
        description: "构建用户评论和评分系统",
        estimatedStories: 8,
        expectedLevel: 2
      },
      {
        description: "设计微服务架构的订单管理平台",
        estimatedStories: 25,
        expectedLevel: 3
      },
      {
        description: "构建企业级多租户电商生态系统",
        estimatedStories: 80,
        expectedLevel: 4
      }
    ];

    testCases.forEach((testCase, index) => {
      console.log(`测试用例 ${index + 1}:`);
      const result = this.detectLevel(testCase.description, testCase.estimatedStories);
      const success = result.recommendedLevel === testCase.expectedLevel;
      console.log(`期望Level: ${testCase.expectedLevel}, 实际Level: ${result.recommendedLevel} ${success ? '✅' : '❌'}`);
      console.log(`置信度: ${(result.confidence * 100).toFixed(1)}%`);
      console.log('---');
    });
  }

  /**
   * 交互式检测
   */
  async interactiveDetection() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n🎮 交互式Level检测器');
    console.log('输入项目描述，系统将自动检测推荐Level\n');

    const question = (prompt) => {
      return new Promise((resolve) => {
        rl.question(prompt, resolve);
      });
    };

    while (true) {
      const description = await question('项目描述 (输入 "exit" 退出): ');
      if (description.toLowerCase() === 'exit') break;

      const storiesInput = await question('预估Stories数量 (可选，直接回车跳过): ');
      const estimatedStories = storiesInput ? parseInt(storiesInput) : null;

      try {
        this.detectLevel(description, estimatedStories);
      } catch (error) {
        console.log(`❌ 错误: ${error.message}`);
      }

      console.log('\n' + '='.repeat(60) + '\n');
    }

    rl.close();
  }
}

// 主程序
if (require.main === module) {
  const detector = new LevelDetector();

  const args = process.argv.slice(2);
  if (args[0] === 'test') {
    detector.runTestCases();
  } else if (args[0] === 'interactive') {
    detector.interactiveDetection();
  } else if (args.length >= 1) {
    const description = args.join(' ');
    detector.detectLevel(description);
  } else {
    console.log('Level检测器使用方法:');
    console.log('  node level-detector.js test                    # 运行测试用例');
    console.log('  node level-detector.js interactive             # 交互式模式');
    console.log('  node level-detector.js "项目描述"               # 单次检测');
    console.log('');
    console.log('示例:');
    console.log('  node level-detector.js "添加用户评论系统"');
  }
}

module.exports = LevelDetector;