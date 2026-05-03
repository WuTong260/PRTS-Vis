export var LOCAL_CVE_DB = {
  redis: [
    { version_range: '<= 5.0.5', cve_id: 'CVE-2015-4335', desc: 'Redis 弱口令或未授权访问可导致远程代码执行 (RCE)' },
    { version_range: 'any', cve_id: 'Misconfig', desc: '未配置 requirepass 或 bind 0.0.0.0 导致外网裸露' },
  ],
  log4j: [
    { version_range: '2.0-beta9 to 2.14.1', cve_id: 'CVE-2021-44228', desc: 'Log4Shell JNDI 注入漏洞，最高危 RCE' },
  ],
  openssh: [
    { version_range: '< 8.5', cve_id: 'CVE-2021-28041', desc: 'SSH 代理转发中潜在的命令注入' },
  ],
  nginx: [
    { version_range: '0.8.41 - 1.4.3', cve_id: 'CVE-2013-4547', desc: '文件名逻辑漏洞导致可能绕过 URI 限制' },
  ],
  mysql: [
    { version_range: '5.7.x, 8.0.x', cve_id: 'CVE-2023-22103', desc: 'MySQL 客户端连接处理内存越界导致崩溃 (DoS)' },
  ],
  tomcat: [
    { version_range: '7.0.x - 9.0.39', cve_id: 'CVE-2020-17530', desc: 'Apache Struts2 / Tomcat 远程代码执行 (OGNL 注入)' },
  ],
};
