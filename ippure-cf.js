/*
 * ============================================
 *     IPPure Panel (Cloudflare Worker 版)
 * ============================================
 * 通过 CF Worker 中转，获取完整的 IPPure 数据
 * 包括：纯净度、Bot流量比、IP属性、风险等级等
 * 
 * 版本：1.0.0
 * ============================================
 */

// ==================== 配置 ====================

// 替换为你的 Worker 地址
const CF_WORKER_URL = "https://ippure-proxy.你的用户名.workers.dev/api/ippure";

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

function getBgColor(score1, score2) {
  const max = Math.max(score1 || 0, score2 || 0);
  if (max <= 10) return "#4A90D9";
  if (max <= 30) return "#67C23A";
  if (max <= 50) return "#E6A23C";
  if (max <= 70) return "#F56C6C";
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

// ==================== 格式化输出 ====================

function formatOutput(data, nodeName) {
  const d = data.data;
  
  const pureEmoji = getEmoji(d.fraudScore);
  const botEmoji = getEmoji(d.botRatio);
  const scoreText = getScoreText(d.fraudScore);
  
  const ipTypeEmoji = d.ipAttr === "住宅" ? "🏠" : "🏢";
  const ipSourceEmoji = d.ipSource === "广播" ? "📡" : "🎯";
  
  const pureText = d.fraudScore != null ? `${d.fraudScore}%` : "N/A";
  const botText = d.botRatio != null ? `${d.botRatio}%` : "N/A";
  const humanText = d.humanRatio != null ? `${d.humanRatio}%` : null;
  
  const flag = getFlag(d.countryCode);
  const locationParts = [d.city, d.region, d.country].filter(Boolean);
  const locationLine = locationParts.length > 0 
    ? `${flag} ${locationParts.join(" • ")}`
    : `${flag} 未知位置`;
  
  const ispLine = d.asn 
    ? `AS${d.asn} ${d.asOrganization || ""}`
    : (d.asOrganization || "未知");
  
  // 构建内容
  const lines = [];
  
  if (nodeName) {
    lines.push(`🔗 节点: ${nodeName}`, ``);
  }
  
  lines.push(
    `📍 ${d.ip || data.ip || "N/A"}`,
    locationLine,
    ``,
    `【${pureEmoji}${botEmoji} ${d.ipAttr || "未知"} ${d.ipSource || "未知"}】`,
    `━━━━━━━━━━━━━━━`
  );
  
  // 风险等级或纯净度
  if (d.riskLevel) {
    lines.push(`⚠️ 风险: ${pureText} ${d.riskLevel}`);
  } else {
    lines.push(`🎯 纯净度: ${pureText} (${scoreText})`);
  }
  
  // 人机流量比
  if (humanText && d.botRatio != null) {
    lines.push(`👤 人类: ${humanText} | 🤖 Bot: ${botText}`);
  } else if (d.botRatio != null) {
    lines.push(`🤖 Bot流量: ${botText}`);
  }
  
  lines.push(
    `${ipTypeEmoji} IP属性: ${d.ipAttr || "未知"}`,
    `${ipSourceEmoji} IP来源: ${d.ipSource || "未知"}`,
    `━━━━━━━━━━━━━━━`,
    `🌐 ISP: ${ispLine}`,
    `⏱️ 时区: ${d.timezone || "N/A"}`
  );
  
  // 数据来源标记
  const sourceNote = [];
  if (data.source?.api) sourceNote.push("API");
  if (data.source?.web) sourceNote.push("Web");
  if (sourceNote.length > 0) {
    lines.push(``, `📡 数据源: ${sourceNote.join(" + ")}`);
  }
  
  const bgColor = getBgColor(d.fraudScore, d.botRatio);
  const titleSuffix = nodeName || d.ip || "N/A";
  
  return {
    title: `IPPure | ${pureEmoji}${botEmoji} ${pureText} ${titleSuffix}`,
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
    console.log(`[IPPure-CF] 开始检测，节点: ${nodeName || "当前连接"}`);
    
    const options = {
      url: CF_WORKER_URL,
      timeout: TIMEOUT,
      headers: {
        "User-Agent": "Loon/3.2",
        "Accept": "application/json"
      }
    };
    
    // 如果有指定节点，通过该节点发起请求
    if (nodeName) {
      options.node = nodeName;
    }
    
    const response = await new Promise((resolve, reject) => {
      $httpClient.get(options, (error, resp, data) => {
        if (error) {
          reject(new Error(`请求失败: ${error}`));
          return;
        }
        if (!data) {
          reject(new Error("响应为空"));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON解析失败: ${e.message}`));
        }
      });
    });
    
    if (!response.success) {
      throw new Error(response.error || "Unknown error");
    }
    
    const output = formatOutput(response, nodeName);
    $done(output);
    
  } catch (error) {
    console.error(`[IPPure-CF] Error: ${error.message}`);
    $done({
      title: "IPPure | ❌ 检测失败",
      content: `错误: ${error.message}\n\n请检查:\n1. Worker 地址是否正确\n2. 网络连接是否正常\n3. 节点是否可用`,
      backgroundColor: "#909399",
      icon: "xmark.circle",
      "icon-color": "#F56C6C"
    });
  }
})();
