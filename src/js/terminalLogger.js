let container = null;
let queue = [];
let timer = null;
let active = false;

export const LOG_MESSAGES = [
  '[SYS] 正在初始化神经云协议 v4.7.1...',
  '[SYS] 校准源石能量转换矩阵...',
  '[DBG] 内存段 0x7F3A 校验通过',
  '[DBG] 缓存模块加载: TACTICAL_CORE.bin',
  '[INF] 罗德岛终端认证服务已启动',
  '[INF] 加密通道已建立 — 协议: RHODES-256',
  '[DBG] 渲染管线初始化中...',
  '[SYS] 检测硬件加速支持... OK',
  '[INF] 正在连接战术网络节点...',
  '[DBG] 加载 UI 组件库: ARKNIGHTS_UI_v3',
  '[SYS] 神经同步模块版本: 2.1.4',
  '[DBG] 量子加密种子已生成',
  '[INF] 战场数据流已连接 — 延迟: 12ms',
  '[OK]  模块已加载: OPERATOR_DB',
  '[OK]  模块已加载: MISSION_PLANNER',
  '[DBG] 粒子特效系统初始化...',
  '[SYS] 环境光遮蔽计算完成',
  '[INF] 正在解密战术地图数据包...',
  '[DBG] 纹理压缩器状态: READY',
  '[OK]  模块已加载: TERMINAL_EMULATOR',
  '[SYS] 音频引擎初始化... DOLBY_ATMOS',
  '[INF] 同步云端配置数据...',
  '[DBG] 碰撞检测网格构建完成',
  '[OK]  模块已加载: NEURAL_CLOUD',
  '[SYS] 正在进行完整性校验...',
  '[INF] 已连接到 3 个中继节点',
  '[DBG] 脚本编译器 JIT 预热中...',
  '[SYS] 内存池分配: 256MB (战术) | 128MB (图形)',
  '[OK]  模块已加载: TACTICAL_OPS_v3.2.1',
  '[INF] 正在验证操作员权限令牌...',
  '[DBG] 预测输入延迟校准中...',
  '[SYS] 安全飞地已激活 — SGX Enclave',
  '[INF] 天气系统数据注入完成',
  '[DBG] LOD 距离剔除参数优化完毕',
  '[OK]  模块已加载: COMBAT_SIMULATOR',
  '[SYS] 后台服务健康检查通过',
  '[INF] 正在预加载高优先级资源...',
  '[DBG] 骨骼动画重定向系统就绪',
  '[SYS] 最终系统自检进行中...',
];

export function initLogger(logContainer) {
  container = logContainer;
}

export function addLine(text, cls) {
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'log-line' + (cls ? ' ' + cls : '');
  div.textContent = text;
  container.appendChild(div);

  const allLines = container.querySelectorAll('.log-line');
  if (allLines.length > 80) {
    allLines[0].remove();
  }

  const lastLine = container.lastElementChild;
  if (lastLine) lastLine.scrollIntoView({ block: 'end', behavior: 'instant' });
}

function pushNext() {
  if (!active || queue.length === 0) return;

  const msg = queue.shift();
  const cls = msg.startsWith('[WRN]') ? 'warn' : msg.startsWith('[OK]') ? 'ok' : '';
  addLine(msg, cls);

  timer = setTimeout(pushNext, 80 + Math.random() * 270);
}

export function startLogStream(messages) {
  var msgs = messages || LOG_MESSAGES;
  queue = [...msgs].sort(function () { return Math.random() - 0.5; });
  active = true;
  pushNext();
}

export function stopLogStream() {
  active = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
