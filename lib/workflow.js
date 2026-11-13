/*!
 * AI 视频生成工作流 · 共享核心逻辑
 * 同时被 Node.js（server.js require）与浏览器（<script> 直接加载）使用
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Workflow = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------- 7 阶段流水线 ---------------- */
  const STAGES = [
    { id: 'idea', name: '创意构思', desc: '确定选题、目标观众、核心钩子与差异化角度', tool: 'Claude Code / Codex', duration: '10-20 min', output: '选题卡 + 钩子清单', cost: 0 },
    { id: 'script', name: '脚本生成', desc: '口播文案、画面描述、字幕与节奏点', tool: 'Claude Code', duration: '15-30 min', output: '口播稿 + 分镜 JSON', cost: 0.02 },
    { id: 'storyboard', name: '分镜绘制', desc: '关键帧画面生成、风格统一与角色一致性', tool: 'Seedance / 图像模型', duration: '30-60 min', output: '关键帧图片集', cost: 0.15 },
    { id: 'video', name: '视频生成', desc: '文生视频 / 图生视频，逐镜生成与重试', tool: 'Seedance AI', duration: '1-3 h', output: '分镜视频片段', cost: 0.8 },
    { id: 'voice', name: '配音配乐', desc: 'TTS 配音、背景音乐、音效与响度统一', tool: 'TTS / 音乐模型', duration: '20-40 min', output: '音频轨', cost: 0.05 },
    { id: 'edit', name: '剪辑合成', desc: '拼接、字幕、转场、封面与响度检查', tool: '剪辑脚本 / FFmpeg', duration: '30-60 min', output: '成片 + 封面', cost: 0.02 },
    { id: 'publish', name: '多平台发布', desc: '标题、标签、封面文案、分发排期与数据回收', tool: '发布 API', duration: '10-20 min', output: '各平台分发包', cost: 0 }
  ];

  /* ---------------- 平台预设 ---------------- */
  const PLATFORMS = [
    { id: 'douyin', name: '抖音', defaultDur: 45, sceneSec: 5, aspect: '9:16', tags: 3, heat: 1.0, tip: '前 3 秒必须给冲突或结果，冷启动看完播率' },
    { id: 'xiaohongshu', name: '小红书', defaultDur: 60, sceneSec: 6, aspect: '9:16', tags: 6, heat: 0.95, tip: '封面承担 70% 点击，标题带具体人群与数字' },
    { id: 'bilibili', name: 'B站', defaultDur: 300, sceneSec: 10, aspect: '16:9', tags: 6, heat: 1.05, tip: '容忍长铺垫但要章节感，标题可带系列名' },
    { id: 'ytshorts', name: 'YouTube Shorts', defaultDur: 60, sceneSec: 5, aspect: '9:16', tags: 5, heat: 1.1, tip: '首帧即价值，字幕要大且居中' },
    { id: 'tiktok', name: 'TikTok', defaultDur: 45, sceneSec: 5, aspect: '9:16', tags: 5, heat: 1.05, tip: '开头禁止 logo 与自我介绍，直接上钩子' },
    { id: 'shipinhao', name: '视频号', defaultDur: 60, sceneSec: 6, aspect: '9:16', tags: 4, heat: 0.9, tip: '标题偏资讯向，适合转发到社群' }
  ];

  /* ---------------- 质量档位 ---------------- */
  const QUALITY = {
    draft: { label: '草稿', mult: 0.5, note: '验证结构，不追求画质' },
    standard: { label: '标准', mult: 1, note: '日常发布的平衡档' },
    high: { label: '高质', mult: 2.2, note: '商单 / 品牌片，渲染更慢' }
  };

  /* ---------------- 节拍模板 ---------------- */
  const BEATS = [
    { key: 'hook', name: '钩子/冲突开场', shot: '特写', ratio: 1.0, guide: '用结果、反常识或提问制造停留' },
    { key: 'pain', name: '痛点共鸣', shot: '中景', ratio: 1.0, guide: '描述用户此刻的具体困境' },
    { key: 'solution', name: '解决方案引入', shot: '屏幕录制', ratio: 1.0, guide: '一句话讲清「怎么解决」' },
    { key: 'demo', name: '核心功能演示', shot: '实拍空镜', ratio: 1.3, guide: '给可复制的具体操作，不要抽象描述' },
    { key: 'data', name: '数据/效果对比', shot: '图形动效', ratio: 1.0, guide: '前后对比，数字要有出处' },
    { key: 'case', name: '真实案例', shot: '中景', ratio: 1.2, guide: '具体人 + 具体结果，避免泛泛而谈' },
    { key: 'pitfall', name: '避坑指南', shot: '特写', ratio: 1.0, guide: '列 2-3 个新手常犯的错' },
    { key: 'cta', name: '行动号召', shot: '全景', ratio: 0.8, guide: '明确下一步动作与利益点' }
  ];

  const SHOT_TYPES = ['特写', '中景', '全景', '屏幕录制', '实拍空镜', '图形动效'];

  function getPlatform(id) {
    return PLATFORMS.find(p => p.id === id) || PLATFORMS[0];
  }
  function getQuality(id) {
    return QUALITY[id] || QUALITY.standard;
  }

  /* ---------------- 成本与耗时估算 ---------------- */
  function estimate(opts) {
    const o = opts || {};
    const durationSec = Math.max(10, Number(o.durationSec) || 60);
    const scenes = Math.max(2, Math.min(20, Number(o.scenes) || 8));
    const platform = getPlatform(o.platform);
    const quality = getQuality(o.quality);
    const m = quality.mult;

    const fixed = STAGES.reduce((a, s) => a + s.cost, 0);          // 0.99
    const videoGen = scenes * 0.09 * m;                            // 逐镜视频生成
    const voice = (durationSec / 60) * 0.08 * m;                   // 按时长计费
    const storyboardExtra = scenes * 0.05 * m;
    const totalCost = (fixed + videoGen + voice + storyboardExtra) * platform.heat;

    const humanMin = 115 + scenes * 6 * m + (durationSec / 60) * 2;
    const machineMin = scenes * 9 * m;                            // 视频生成排队/渲染
    const totalMin = Math.round(humanMin + machineMin);

    return {
      platform: platform.id,
      platformName: platform.name,
      quality: o.quality && QUALITY[o.quality] ? o.quality : 'standard',
      qualityLabel: quality.label,
      scenes,
      durationSec,
      estimatedCost: Math.round(totalCost * 100) / 100,
      estimatedMinutes: totalMin,
      estimatedHours: (Math.round((totalMin / 60) * 10) / 10).toFixed(1),
      humanMinutes: Math.round(humanMin),
      machineMinutes: Math.round(machineMin),
      breakdown: [
        { item: '文本与脚本', cost: Math.round((0.02 * m) * 100) / 100 },
        { item: '分镜关键帧', cost: Math.round((0.15 + scenes * 0.05) * m * 100) / 100 },
        { item: '视频生成', cost: Math.round(videoGen * 100) / 100 },
        { item: '配音与音频', cost: Math.round(voice * 100) / 100 },
        { item: '剪辑与发布', cost: Math.round((0.02 * m) * 100) / 100 }
      ]
    };
  }

  /* ---------------- 分镜脚本生成 ---------------- */
  function buildStoryboard(idea, scenes, durationSec, platformId) {
    const platform = getPlatform(platformId);
    const n = Math.max(2, Math.min(20, Number(scenes) || 8));
    const total = Math.max(10, Number(durationSec) || 60);
    const sceneSec = Math.max(3, Math.round(total / n));

    const used = [];
    let idx = 0;
    for (let i = 0; i < n; i++) {
      const beat = BEATS[idx % BEATS.length];
      idx++;
      const dur = Math.max(3, Math.round(sceneSec * beat.ratio));
      const shot = beat.shot || SHOT_TYPES[i % SHOT_TYPES.length];
      used.push({
        no: i + 1,
        beat: beat.name,
        beatKey: beat.key,
        guide: beat.guide,
        shotType: shot,
        durationSec: dur,
        voiceover: `${idea}｜第 ${i + 1} 镜「${beat.name}」：${beat.guide}。在此补充具体数字、细节与个人经历，避免空话。`,
        visual: `画面：围绕「${idea}」的${shot}，主体居中偏右，${platform.aspect} 构图，留出下三分之一字幕区，光线统一。`,
        prompt: `Seedance prompt: ${idea}, ${shot}, ${platform.aspect} vertical composition, cinematic lighting, consistent subject, clean background, no text overlay, high detail`,
        caption: `${beat.name}｜${idea}`,
        sfx: i === 0 ? '低频 whoosh + 节奏起' : (i === n - 1 ? '上扬音效 + 留白' : '轻节拍')
      });
    }
    // 按比例修正总时长
    const sum = used.reduce((a, s) => a + s.durationSec, 0);
    if (sum > 0) {
      const k = total / sum;
      let acc = 0;
      used.forEach((s, i) => {
        if (i === used.length - 1) s.durationSec = Math.max(2, total - acc);
        else { s.durationSec = Math.max(2, Math.round(s.durationSec * k)); acc += s.durationSec; }
      });
    }
    return used;
  }

  /* ---------------- 钩子变体 ---------------- */
  function generateHooks(idea, platformId) {
    const platform = getPlatform(platformId);
    return [
      {
        type: '结果前置',
        text: `我用「${idea}」做出了这条视频，过程比想象中简单`,
        why: '先把成品/结果摆出来，观众为了看过程会留下来'
      },
      {
        type: '反常识',
        text: `别再随便拍「${idea}」了，先改这 3 个地方`,
        why: '与既有认知冲突，制造「凭什么」的追问'
      },
      {
        type: '身份代入',
        text: `如果你是${platform.name}上的创作者，这条「${idea}」方法直接抄`,
        why: '精准点名人群，提高目标观众的代入感'
      }
    ];
  }

  /* ---------------- 平台发布包 ---------------- */
  function buildPublishPackage(idea, storyboard, platformId, quality) {
    const platform = getPlatform(platformId);
    const beatList = (storyboard || []).map(s => s.beat).join(' / ');
    const titles = [
      `${idea}｜从想法到成片的完整流程`,
      `我用 ${platform.name} 做「${idea}」，全过程记录`,
      `${idea}：${(storyboard && storyboard[0]) ? storyboard[0].beat : '一次实战'}`
    ];
    const tagPool = ['AI视频', '视频创作', '工作流', 'Seedance', 'ClaudeCode', '内容创作', '剪辑技巧', '独立创作'];
    const hashtags = tagPool.slice(0, platform.tags).map(t => '#' + t);
    return {
      platform: platform.id,
      platformName: platform.name,
      aspect: platform.aspect,
      recommendedDuration: platform.defaultDur,
      tip: platform.tip,
      qualityLabel: getQuality(quality).label,
      titles,
      description: `围绕「${idea}」展开：${beatList}。成片节奏 ${platform.aspect}，建议时长 ${platform.defaultDur} 秒内。${platform.tip}。`,
      hashtags,
      coverText: `${idea}\n${platform.name}实战`,
      publishChecklist: [
        '封面文字不超过 12 字，手机端可读',
        '前 3 秒无 logo、无自我介绍',
        '字幕描边 2px，对比度足够',
        '音量峰值归一化到 -14 LUFS 左右',
        `话题标签 ${platform.tags} 个以内`,
        '结尾给出明确下一步动作'
      ]
    };
  }

  /* ---------------- 爆款要素自检 ---------------- */
  function selfCheck(opts) {
    const o = opts || {};
    const scenes = o.storyboard || [];
    const pkg = o.publishPackage || {};
    const items = [];

    items.push({
      name: '前 3 秒钩子',
      ok: scenes.length > 0 && /钩子|冲突/.test(scenes[0].beat || ''),
      tip: '第一镜必须是钩子或冲突，不能是铺垫'
    });
    const avg = scenes.length ? scenes.reduce((a, s) => a + (s.durationSec || 0), 0) / scenes.length : 0;
    items.push({ name: '镜头节奏', ok: avg > 0 && avg <= 12, tip: '单镜平均时长建议 3-12 秒' });
    items.push({
      name: 'CTA 收尾',
      ok: scenes.length > 0 && /行动号召|CTA/.test(scenes[scenes.length - 1].beat || ''),
      tip: '最后一镜要给出明确行动指令'
    });
    items.push({ name: '封面文案', ok: !!(pkg.coverText && pkg.coverText.length <= 30), tip: '封面文字控制在 30 字以内' });
    items.push({ name: '标题数量', ok: !!(pkg.titles && pkg.titles.length >= 2), tip: '至少准备 2 个标题做 A/B' });
    items.push({ name: '话题标签', ok: !!(pkg.hashtags && pkg.hashtags.length > 0 && pkg.hashtags.length <= 8), tip: '标签 3-8 个，与内容强相关' });
    items.push({ name: '时长符合平台', ok: !!pkg.recommendedDuration, tip: '按平台推荐时长裁剪' });

    const passed = items.filter(i => i.ok).length;
    return {
      items,
      passed,
      total: items.length,
      score: Math.round((passed / items.length) * 100)
    };
  }

  /* ---------------- 组合：完整方案 ---------------- */
  function buildPlan(input) {
    const idea = (input && input.idea ? String(input.idea) : '').trim();
    if (!idea) throw new Error('请填写创意主题');
    const scenes = Number(input.scenes) || 8;
    const durationSec = Number(input.durationSec) || 60;
    const platform = input.platform || 'douyin';
    const quality = input.quality || 'standard';

    const est = estimate({ durationSec, scenes, quality, platform });
    const storyboard = buildStoryboard(idea, scenes, durationSec, platform);
    const hooks = generateHooks(idea, platform);
    const publishPackage = buildPublishPackage(idea, storyboard, platform, quality);
    const check = selfCheck({ storyboard, publishPackage });

    return {
      idea, stages: STAGES, platforms: PLATFORMS, estimate: est,
      storyboard, hooks, publishPackage, check
    };
  }

  return {
    STAGES, PLATFORMS, QUALITY, BEATS,
    getPlatform, getQuality, estimate, buildStoryboard,
    generateHooks, buildPublishPackage, selfCheck, buildPlan
  };
});
