/*
 * ============================================
 *     IPPure Panel
 * ============================================
 * 通过 CF Worker 中转，获取完整的 IPPure 数据
 * 包括：纯净度、Bot流量比、IP属性、风险等级等
 * 
 * 版本：1.0.0
 * ============================================
 */

// ==================== 配置 ====================

const CF_WORKER_URL = "https://ippure-proxy.你的用户名.workers.dev/api/ippure";
const IP_CHECK_URL = "http://ip-api.com/json/?fields=query";  // 获取出口 IP
const TIMEOUT = 15000;

// ==================== 国旗映射 ====================

const FLAG_MAP = {
  "US": "🇺🇸", "CN": "🇨🇳", "HK": "🇭🇰", "TW": "🇹🇼", "JP": "🇯🇵",
  "KR": "🇰🇷", "SG": "🇸🇬", "GB": "🇬🇧", "DE": "🇩🇪", "FR": "🇫🇷",
  "NL": "🇳🇱", "AU": "🇦🇺", "CA": "🇨🇦", "RU": "🇷🇺", "IN": "🇮🇳",
  "BR": "🇧🇷", "IT": "🇮🇹", "ES": "🇪🇸", "TR": "🇹🇷", "TH": "🇹🇭",
  "VN": "🇻🇳", "PH": "🇵🇭", "MY": "🇲🇾", "ID": "🇮🇩", "AE": "🇦🇪"
};

function getFlag(code) {
  return FLAG_MAP[code?.toUpperCase()] || "🏳️";
}

// ==================== 工具函数 ====================

function getEmoji(val) {
  if (val == null || isNaN(val)) return "❓";
  if (val <= 10) return "⚪";
  if (val <= 30) return "🟢";
  if (val <= 50) return "🟡";
  if (val <= 70) return "🟠";
  if (val <= 90) return "🔴";
  return "⚫";
}

function getScoreText(score) {
  if (score == null || isNaN(score)) return "未知";
  if (score <= 10) return "极佳";
  if (score <= 30) return "良好";
  if (score <= 50) return "一般";
  if (score <= 70) return "较差";
  if (score <= 90) return "很差";
  return "极差";
}

function getBgColor(score) {
  if (score == null) return "#909399";
  if (score <= 10) return "#4A90D9";
  if (score <= 30) return "#67C23A";
  if (score <= 50) return "#E6A23C";
  if (score <= 70) return "#F56C6C";
  return "#909399";
}

function getSelectedNode() {
  try {
    if (typeof $environment !== "undefined" && $environment.params?.node) {
      return $environment.params.node;
    }
  } catch (e) {}
  return null;
}

// ==================== HTTP 请求封装 ====================

function httpGet(options) {
  return new Promise((resolve, reject) => {
    $httpClient.get(options, (error, response, data) => {
      if (error) {
        reject(new Error(error));
      } else {
        resolve({ response, data });
      }
    });
  });
}

// ==================== 步骤 1: 获取出口 IP ====================

async function getExitIP(nodeName) {
  const options = {
    url: IP_CHECK_URL,
    timeout: TIMEOUT,
    headers: {
      "User-Agent": "curl/7.64.1"
    }
  };
  
  if (nodeName) {
    options.node = nodeName;
  }
  
  const { data } = await httpGet(options);
  const json = JSON.parse(data);
  
  if (!json.query) {
    throw new Error("无法获取出口 IP");
  }
  
  return json.query;
}

// ==================== 步骤 2: 查询 IPPure ====================

async function queryIPPure(ip) {
  const options = {
    url: `${CF_WORKER_URL}?ip=${encodeURIComponent(ip)}`,
    timeout: TIMEOUT,
    headers: {
      "Accept": "application/json"
    }
  };
  
  const { data } = await httpGet(options);
  const json = JSON.parse(data);
  
  if (!json.success) {
    throw new Error(json.error || "查询失败");
  }
  
  return json;
}

// ==================== 格式化输出 ====================

function formatOutput(result, nodeName) {
  const d = result.data;
  
  const pureEmoji = getEmoji(d.fraudScore);
  const botEmoji = getEmoji(d.botRatio);
  const scoreText = getScoreText(d.fraudScore);
  
  const ipTypeEmoji = d.ipAttr === "住宅" ? "🏠" : "🏢";
  const ipSourceEmoji = d.ipSource === "广播" ? "📡" : "🎯";
  
  const pureText = d.fraudScore != null ? `${d.fraudScore}%` : "N/A";
  const botText = d.botRatio != null ? `${d.botRatio}%` : null;
  const humanText = d.humanRatio != null ? `${d.humanRatio}%` : null;
  
  const flag = getFlag(d.countryCode);
  const locationParts = [d.city, d.region, d.country].filter(Boolean);
  const locationLine = locationParts.length > 0 
    ? `${flag} ${locationParts.join(" • ")}`
    : `${flag} 未知位置`;
  
  const ispLine = d.asn 
    ? `AS${d.asn} ${d.asOrganization || ""}`
    : (d.asOrganization || "未知");
  
  const lines = [];
  
  if (nodeName) {
    lines.push(`🔗 节点: ${nodeName}`, ``);
  }
  
  lines.push(
    `📍 ${result.ip}`,
    locationLine,
    ``
  );
  
  // 概览行
  const attrText = d.ipAttr || "未知";
  const sourceText = d.ipSource || "未知";
  lines.push(
    `【${pureEmoji}${botEmoji} ${attrText} ${sourceText}】`,
    `━━━━━━━━━━━━━━━`
  );
  
  // 风险/纯净度
  if (d.riskLevel) {
    lines.push(`⚠️ 风险: ${pureText} ${d.riskLevel}`);
  } else {
    lines.push(`🎯 纯净度: ${pureText} (${scoreText})`);
  }
  
  // 人机流量比
  if (humanText && botText) {
    lines.push(`👤 人类: ${humanText} | 🤖 Bot: ${botText}`);
  } else if (botText) {
    lines.push(`🤖 Bot流量: ${botText}`);
  }
  
  lines.push(
    `${ipTypeEmoji} IP属性: ${attrText}`,
    `${ipSourceEmoji} IP来源: ${sourceText}`,
    `━━━━━━━━━━━━━━━`,
    `🌐 ISP: ${ispLine}`
  );
  
  if (d.timezone) {
    lines.push(`⏱️ 时区: ${d.timezone}`);
  }
  
  // 数据来源
  const sources = [];
  if (result.source?.api) sources.push("API");
  if (result.source?.web) sources.push("Web");
  if (sources.length > 0) {
    lines.push(``, `📡 数据源: ${sources.join(" + ")}`);
  }
  
  const bgColor = getBgColor(d.fraudScore);
  const titleSuffix = nodeName || result.ip;
  
  return {
    title: `IPPure | ${pureEmoji}${botText ? botEmoji : ""} ${pureText} ${titleSuffix}`,
    content: lines.join("\n"),
    backgroundColor: bgColor,
    icon: "network",
    "icon-color": bgColor
  };
}

// ==================== 主函数 ====================

(async () => {
  try {
    const nodeName = getSelectedNode();
    console.log(`[IPPure] 开始检测，节点: ${nodeName || "当前连接"}`);
    
    // 步骤 1: 获取出口 IP
    console.log("[IPPure] 步骤1: 获取出口 IP...");
    const exitIP = await getExitIP(nodeName);
    console.log(`[IPPure] 出口 IP: ${exitIP}`);
    
    // 步骤 2: 查询 IPPure
    console.log("[IPPure] 步骤2: 查询 IPPure...");
    const result = await queryIPPure(exitIP);
    console.log("[IPPure] 查询完成");
    
    // 格式化输出
    const output = formatOutput(result, nodeName);
    $done(output);
    
  } catch (error) {
    console.error(`[IPPure] Error: ${error.message}`);
    $done({
      title: "IPPure | ❌ 检测失败",
      content: `错误: ${error.message}\n\n请检查:\n1. 网络连接是否正常\n2. 节点是否可用\n3. Worker 是否正常`,
      backgroundColor: "#909399",
      icon: "xmark.circle",
      "icon-color": "#F56C6C"
    });
  }
})();

