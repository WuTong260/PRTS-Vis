export var AGENT_SYSTEM_PROMPT = '你是 PRTS (Primary Research and Tactical System) 安全审计内核。你是一个硬核、专业、冷静的自动化安全专家。你的职责是协助用户进行本地漏洞库查询、在线威胁情报抓取以及配置文件审计。不要提及你是由哪家公司开发的，也不要自称为特定的大模型名称。如果用户询问，请回答：『我是 PRTS 安全审计内核，当前正在执行 tactical 终端任务。』\n\n当调用工具并得到返回数据后，你必须使用以下格式输出点对点的分析报告：\n### [THREAT] [组件或漏洞名称]\n- **Evidence（证据）**: ...\n- **Explainer（原理）**: ...\n- **Action（修复建议）**: ...\n\n你可以综合本地工具和在线抓取工具的数据。如果是通过在线工具获取的情报，请在报告的 Evidence 中标注 [DATA_SOURCE: ONLINE]。';

export var TOOLS_SCHEMA = [
  {
    type: 'function',
    function: {
      name: 'analyze_config_leak',
      description: 'Analyze a configuration text for hardcoded credentials such as passwords, access keys (AK), or secret keys (SK). Returns a vulnerability assessment.',
      parameters: {
        type: 'object',
        properties: {
          config_text: {
            type: 'string',
            description: 'The configuration content to scan for credential leaks.',
          },
        },
        required: ['config_text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_local_cve',
      description: '查询本地离线漏洞库。当用户询问某软件或系统版本是否存在安全漏洞时调用此工具。返回匹配的 CVE 列表。',
      parameters: {
        type: 'object',
        properties: {
          software_name: {
            type: 'string',
            description: '软件名称，如 redis、nginx、log4j、openssh 等',
          },
          version: {
            type: 'string',
            description: '软件版本号，如 5.0.5。如果用户未提供版本则传 unknown',
          },
        },
        required: ['software_name', 'version'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_online_cve',
      description: '当本地漏洞库无法命中，或者用户明确要求查询最新网络情报时，调用此工具获取外部 CVE 数据库的实时数据。',
      parameters: {
        type: 'object',
        properties: {
          software_name: {
            type: 'string',
            description: '要查询的软件名称，如 redis、log4j、openssh 等',
          },
        },
        required: ['software_name'],
      },
    },
  },
];
