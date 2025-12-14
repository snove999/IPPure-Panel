/*
 * ============================================
 *        IP Check for Loon
 * ============================================
 * 脚本名称：IP节点信息
 * 脚本类型：generic / tile
 * 功能：检测指定节点出口 IP 的纯净度、地理位置、ISP 信息
 * 
 * 数据源：https://my.ippure.com/v1/info
 * 
 * 作者：snove999
 * 版本：1.0.0
 * ============================================
 */

// ==================== 参数读取 ====================

function getArguments() {
  const defaultArgs = {
    showTimezone: true,
    showISP: true,
    timeout: 15
  };
  
  try {
    if (typeof $argument !== "undefined" && $argument) {
      const args = $argument.split(",").map(s => s.trim());
      return {
        showTimezone: args[0] !== "false",
        showISP: args[1] !== "false",
        timeout: parseInt(args[2]) || 15
      };
    }
  } catch (e) {
    console.log(`参数解析失败: ${e.message}`);
  }
  
  return defaultArgs;
}

const ARGS = getArguments();

// ==================== 获取节点信息 ====================

function getSelectedNode() {
  try {
    if (typeof $environment !== "undefined") {
      if ($environment.params && $environment.params.node) {
        return $environment.params.node;
      }
    }
    if (typeof $request !== "undefined" && $request.params && $request.params.node) {
      return $request.params.node;
    }
    if (typeof $node !== "undefined" && $node.name) {
      return $node.name;
    }
  } catch (e) {
    console.log(`获取节点信息失败: ${e.message}`);
  }
  return null;
}

const SELECTED_NODE = getSelectedNode();

// ==================== 配置区 ====================

const CONFIG = {
  API_URL: "https://my.ippure.com/v1/info",
  TIMEOUT: ARGS.timeout * 1000,
  SHOW_TIMEZONE: ARGS.showTimezone,
  SHOW_ISP: ARGS.showISP,
  NODE: SELECTED_NODE
};

// ==================== 国旗 Emoji 映射 ====================

const FLAG_MAP = {
  "US": "🇺🇸", "CN": "🇨🇳", "HK": "🇭🇰", "TW": "🇹🇼", "JP": "🇯🇵",
  "KR": "🇰🇷", "SG": "🇸🇬", "GB": "🇬🇧", "DE": "🇩🇪", "FR": "🇫🇷",
  "NL": "🇳🇱", "AU": "🇦🇺", "CA": "🇨🇦", "RU": "🇷🇺", "IN": "🇮🇳",
  "BR": "🇧🇷", "IT": "🇮🇹", "ES": "🇪🇸", "TR": "🇹🇷", "TH": "🇹🇭",
  "VN": "🇻🇳", "PH": "🇵🇭", "MY": "🇲🇾", "ID": "🇮🇩", "AE": "🇦🇪",
  "SA": "🇸🇦", "IL": "🇮🇱", "ZA": "🇿🇦", "MX": "🇲🇽", "AR": "🇦🇷",
  "CL": "🇨🇱", "PL": "🇵🇱", "UA": "🇺🇦", "SE": "🇸🇪", "NO": "🇳🇴",
  "FI": "🇫🇮", "DK": "🇩🇰", "CH": "🇨🇭", "AT": "🇦🇹", "BE": "🇧🇪",
  "IE": "🇮🇪", "PT": "🇵🇹", "GR": "🇬🇷", "CZ": "🇨🇿", "RO": "🇷🇴",
  "HU": "🇭🇺", "NZ": "🇳🇿", "PK": "🇵🇰", "BD": "🇧🇩", "EG": "🇪🇬"
};

function getFlag(countryCode) {
  if (!countryCode) return "🌍";
  return FLAG_MAP[countryCode.toUpperCase()] || "🏳️";
}

// ==================== 工具函数 ====================

function getEmoji(value) {
  let val;
  if (typeof value === "string") {
    val = parseFloat(value.replace(/%/g, ""));
  } else if (typeof value === "number") {
    val = value;
  } else {
    return "❓";
  }
  if (isNaN(val)) return "❓";
  if (val <= 10) return "⚪";
  if (val <= 30) return "🟢";
  if (val <= 50) return "🟡";
  if (val <= 70) return "🟠";
  if (val <= 90) return "🔴";
  return "⚫";
}

function getScoreText(score) {
  if (score === null || score === undefined || isNaN(score)) return "未知";
  if (score <= 10) return "极佳";
  if (score <= 30) return "良好";
  if (score <= 50) return "一般";
  if (score <= 70) return "较差";
  if (score <= 90) return "很差";
  return "极差";
}

function getBackgroundColor(score) {
  if (score === null || score === undefined) return "#909399";
  if (score <= 10) return "#4A90D9";
  if (score <= 30) return "#67C23A";
  if (score <= 50) return "#E6A23C";
  if (score <= 70) return "#F56C6C";
  return "#909399";
}

// ==================== 格式化输出 ====================

function formatOutput(data, nodeName) {
  const pureEmoji = getEmoji(data.pureScore);
  const scoreText = getScoreText(data.pureScore);
  
  const ipTypeEmoji = data.ipAttr === "住宅" ? "🏠" : "🏢";
  const ipSourceEmoji = data.ipSource === "广播" ? "📡" : "🎯";
  
  const pureText = data.pureScore !== null ? `${data.pureScore}%` : "N/A";
  
  const flag = getFlag(data.countryCode);
  const locationParts = [data.city, data.region, data.country].filter(Boolean);
  const locationLine = locationParts.length > 0 
    ? `${flag} ${locationParts.join(" • ")}`
    : `${flag} 未知位置`;
  
  const ispLine = data.asn 
    ? `AS${data.asn} ${data.asOrganization || ""}`
    : (data.asOrganization || "未知");
  
  const contentLines = [];
  
  if (nodeName) {
    contentLines.push(`🔗 节点: ${nodeName}`);
    contentLines.push(``);
  }
  
  contentLines.push(
    `📍 ${data.ip || "N/A"}`,
    locationLine,
    ``,
    `━━━━━━━━━━━━━━━`,
    `${pureEmoji} 纯净度: ${pureText} (${scoreText})`,
    `${ipTypeEmoji} IP属性: ${data.ipAttr || "未知"}`,
    `${ipSourceEmoji} IP来源: ${data.ipSource || "未知"}`
  );
  
  if (CONFIG.SHOW_ISP || CONFIG.SHOW_TIMEZONE) {
    contentLines.push(`━━━━━━━━━━━━━━━`);
  }
  
  if (CONFIG.SHOW_ISP) {
    contentLines.push(`🌐 ISP: ${ispLine}`);
  }
  
  if (CONFIG.SHOW_TIMEZONE) {
    contentLines.push(`⏱️ 时区: ${data.timezone || "N/A"}`);
  }
  
  const content = contentLines.join("\n");
  const bgColor = getBackgroundColor(data.pureScore);
  
  const titleSuffix = nodeName ? nodeName : (data.ip || "N/A");
  
  return {
    title: `IPPure | ${pureEmoji} ${pureText} ${titleSuffix}`,
    content: content,
    backgroundColor: bgColor,
    icon: "network",
    "icon-color": bgColor
  };
}

// ==================== 数据获取函数 ====================

function fetchFromAPI(nodeName) {
  return new Promise((resolve, reject) => {
    const options = {
      url: CONFIG.API_URL,
      timeout: CONFIG.TIMEOUT,
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept": "application/json",
        "Accept-Language": "zh-CN,zh;q=0.9"
      }
    };
    
    if (nodeName) {
      options.node = nodeName;
    }
    
    $httpClient.get(options, (error, response, data) => {
      if (error) {
        reject(new Error(`API错误: ${error}`));
        return;
      }
      
      if (!data) {
        reject(new Error("API响应为空"));
        return;
      }
      
      try {
        const json = JSON.parse(data);
        resolve({
          ip: json.ip || "N/A",
          pureScore: json.fraudScore ?? null,
          ipAttr: json.isResidential ? "住宅" : "机房",
          ipSource: json.isBroadcast ? "广播" : "原生",
          country: json.country || "",
          countryCode: json.countryCode || "",
          region: json.region || "",
          city: json.city || "",
          timezone: json.timezone || "",
          asn: json.asn || null,
          asOrganization: json.asOrganization || ""
        });
      } catch (e) {
        reject(new Error(`JSON解析失败: ${e.message}`));
      }
    });
  });
}

// ==================== 执行入口 ====================

(async () => {
  try {
    const nodeName = CONFIG.NODE;
    console.log(`[IPPure] 开始检测，节点: ${nodeName || "当前连接"}`);
    
    const data = await fetchFromAPI(nodeName);
    const output = formatOutput(data, nodeName);
    
    $done(output);
    
  } catch (error) {
    $done({
      title: "IPPure Panel",
      content: `❌ 检测失败\n${error.message}`,
      backgroundColor: "#909399",
      icon: "xmark.circle",
      "icon-color": "#F56C6C"
    });
  }
})();
