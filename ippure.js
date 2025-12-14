/*
 * ============================================
 *     IPPure Panel v2.0
 * ============================================
 * 直接请求 IPPure API，获取完整 IP 纯净度数据
 * 
 * 版本：2.0.0
 * ============================================
 */

// ==================== 配置 ====================

const IPPURE_API = "https://my.ippure.com/v1/info";
const IPPURE_WEB = "https://ippure.com/";
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
    const timeout = setTimeout(() => {
      reject(new Error("请求超时"));
    }, options.timeout || TIMEOUT);
    
    $httpClient.get(options, (error, response, data) => {
      clearTimeout(timeout);
      if (error) {
        reject(new Error(error));
      } else {
        resolve({ response, data });
      }
    });
  });
}

// ==================== 请求 IPPure API ====================

async function fetchIPPureAPI(nodeName) {
  const options = {
    url: IPPURE_API,
    timeout: TIMEOUT,
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      "Accept": "application/json",
      "Accept-Language": "zh-CN,zh;q=0.9"
    }
  };
  
  if (nodeName) {
    options.node = nodeName;
  }
  
  const { data } = await httpGet(options);
  return JSON.parse(data);
}

// ==================== 请求 IPPure 网页 ====================

async function fetchIPPureWeb(nodeName) {
  const options = {
    url: IPPURE_WEB,
    timeout: TIMEOUT,
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "zh-CN,zh;q=0.9"
    }
  };
  
  if (nodeName) {
    options.node = nodeName;
  }
  
  const { data } = await httpGet(options);
  return parseIPPureHTML(data);
}

// ==================== 解析 HTML ====================

function parseIPPureHTML(html) {
  const result = {
    pureScore: null,
    botRatio: null,
    humanRatio: null,
    ipAttr: null,
    ipSource: null,
    riskLevel: null
  };

  if (!html) return result;

  try {
    // 1. 提取 Bot 流量比 - 多种模式匹配
    const botPatterns = [
      /bot[:\s]*(\d+(?:\.\d+)?)\s*%/i,
      /(\d+(?:\.\d+)?)\s*%\s*bot/i,
      /机器人[:\s]*(\d+(?:\.\d+)?)\s*%/i
    ];
    for (const pattern of botPatterns) {
      const match = html.match(pattern);
      if (match) {
        result.botRatio = parseFloat(match[1]);
        break;
      }
    }

    // 2. 提取 Human 流量比
    const humanPatterns = [
      /human[:\s]*(\d+(?:\.\d+)?)\s*%/i,
      /(\d+(?:\.\d+)?)\s*%\s*human/i,
      /人类[:\s]*(\d+(?:\.\d+)?)\s*%/i
    ];
    for (const pattern of humanPatterns) {
      const match = html.match(pattern);
      if (match) {
        result.humanRatio = parseFloat(match[1]);
        break;
      }
    }

    // 3. 提取纯净度分数
    const scorePatterns = [
      /ippure[^<]*?(\d+(?:\.\d+)?)\s*%/i,
      /纯净度[^<]*?(\d+(?:\.\d+)?)\s*%/i,
      /pure[^<]*?(\d+(?:\.\d+)?)\s*%/i,
      /(\d+(?:\.\d+)?)\s*%\s*(?:低|中|高)度?风险/
    ];
    for (const pattern of scorePatterns) {
      const match = html.match(pattern);
      if (match) {
        result.pureScore = parseFloat(match[1]);
        break;
      }
    }

    // 4. 提取风险等级
    const riskMatch = html.match(/([低中高])度?风险/);
    if (riskMatch) {
      result.riskLevel = riskMatch[1] + "度风险";
    }

    // 5. 提取 IP 来源
    if (/广播\s*IP|broadcast/i.test(html)) {
      result.ipSource = "广播";
    } else if (/原生\s*IP|native/i.test(html)) {
      result.ipSource = "原生";
    }

    // 6. 提取 IP 属性
    if (/机房\s*IP|datacenter|data\s*center|idc/i.test(html)) {
      result.ipAttr = "机房";
    } else if (/住宅\s*IP|residential/i.test(html)) {
      result.ipAttr = "住宅";
    }

  } catch (e) {
    console.log(`[IPPure] HTML 解析错误: ${e.message}`);
  }

  return result;
}

// ==================== 格式化输出 ====================

function formatOutput(apiData, webData, nodeName) {
  // 合并数据，API 优先，Web 补充
  const ip = apiData?.ip || "N/A";
  const fraudScore = apiData?.fraudScore ?? webData?.pureScore ?? null;
  const botRatio = webData?.botRatio ?? null;
  const humanRatio = webData?.humanRatio ?? null;
  
  // IP 属性判断
  let ipAttr = webData?.ipAttr;
  if (!ipAttr && apiData?.isResidential !== undefined) {
    ipAttr = apiData.isResidential ? "住宅" : "机房";
  }
  
  // IP 来源判断
  let ipSource = webData?.ipSource;
  if (!ipSource && apiData?.isBroadcast !== undefined) {
    ipSource = apiData.isBroadcast ? "广播" : "原生";
  }
  
  const riskLevel = webData?.riskLevel;
  const country = apiData?.country;
  const countryCode = apiData?.countryCode;
  const region = apiData?.region;
  const city = apiData?.city;
  const timezone = apiData?.timezone;
  const asn = apiData?.asn;
  const asOrganization = apiData?.asOrganization;
  
  // 生成显示内容
  const pureEmoji = getEmoji(fraudScore);
  const botEmoji = getEmoji(botRatio);
  const scoreText = getScoreText(fraudScore);
  
  const ipTypeEmoji = ipAttr === "住宅" ? "🏠" : "🏢";
  const ipSourceEmoji = ipSource === "广播" ? "📡" : "🎯";
  
  const pureText = fraudScore != null ? `${fraudScore}%` : "N/A";
  const botText = botRatio != null ? `${botRatio}%` : null;
  const humanText = humanRatio != null ? `${humanRatio}%` : null;
  
  const flag = getFlag(countryCode);
  const locationParts = [city, region, country].filter(Boolean);
  const locationLine = locationParts.length > 0 
    ? `${flag} ${locationParts.join(" • ")}`
    : `${flag} 未知位置`;
  
  const ispLine = asn 
    ? `AS${asn} ${asOrganization || ""}`
    : (asOrganization || "未知");
  
  const lines = [];
  
  if (nodeName) {
    lines.push(`🔗 节点: ${nodeName}`, ``);
  }
  
  lines.push(
    `📍 ${ip}`,
    locationLine,
    ``
  );
  
  // 概览行
  const attrText = ipAttr || "未知";
  const sourceText = ipSource || "未知";
  lines.push(
    `【${pureEmoji}${botEmoji} ${attrText} ${sourceText}】`,
    `━━━━━━━━━━━━━━━`
  );
  
  // 风险/纯净度
  if (riskLevel) {
    lines.push(`⚠️ 风险: ${pureText} ${riskLevel}`);
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
  
  if (timezone) {
    lines.push(`⏱️ 时区: ${timezone}`);
  }
  
  const bgColor = getBgColor(fraudScore);
  const titleSuffix = nodeName || ip;
  
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
    
    // 并行请求 API 和网页
    console.log("[IPPure] 请求 IPPure API 和网页...");
    
    const [apiResult, webResult] = await Promise.allSettled([
      fetchIPPureAPI(nodeName),
      fetchIPPureWeb(nodeName)
    ]);
    
    const apiData = apiResult.status === "fulfilled" ? apiResult.value : null;
    const webData = webResult.status === "fulfilled" ? webResult.value : null;
    
    console.log(`[IPPure] API: ${apiResult.status}, Web: ${webResult.status}`);
    
    if (apiData) {
      console.log(`[IPPure] API 数据: IP=${apiData.ip}, fraudScore=${apiData.fraudScore}`);
    }
    if (webData) {
      console.log(`[IPPure] Web 数据: bot=${webData.botRatio}, human=${webData.humanRatio}`);
    }
    
    if (!apiData && !webData) {
      throw new Error("API 和网页都请求失败");
    }
    
    // 格式化输出
    const output = formatOutput(apiData, webData, nodeName);
    $done(output);
    
  } catch (error) {
    console.error(`[IPPure] Error: ${error.message}`);
    $done({
      title: "IPPure | ❌ 检测失败",
      content: `错误: ${error.message}\n\n请检查:\n1. 网络连接是否正常\n2. 节点是否可用\n3. IPPure 服务是否可访问`,
      backgroundColor: "#909399",
      icon: "xmark.circle",
      "icon-color": "#F56C6C"
    });
  }
})();
