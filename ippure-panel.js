/*
 * ============================================
 *        IPPure Panel for Loon
 * ============================================
 * 脚本名称：IPPure Panel
 * 脚本类型：generic / tile
 * 功能：检测指定节点出口 IP 的纯净度、Bot流量比、地理位置、ISP 信息
 * 
 * 数据源：
 *   - 主要：https://my.ippure.com/v1/info (API)
 *   - 补充：https://ippure.com/ (网页解析，获取Bot流量比)
 * 
 * 作者：snove999
 * 版本：4.3.0
 * ============================================
 */

// ==================== 参数读取 ====================

function getArguments() {
  const defaultArgs = {
    fetchWebData: true,
    showTimezone: true,
    showISP: true,
    timeout: 15
  };
  
  try {
    if (typeof $argument !== "undefined" && $argument) {
      const args = $argument.split(",").map(s => s.trim());
      return {
        fetchWebData: args[0] !== "false",
        showTimezone: args[1] !== "false",
        showISP: args[2] !== "false",
        timeout: parseInt(args[3]) || 15
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
  WEB_URL: "https://ippure.com/",
  TIMEOUT: ARGS.timeout * 1000,
  FETCH_WEB_DATA: ARGS.fetchWebData,
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

function getBackgroundColor(score1, score2) {
  const maxVal = Math.max(score1 || 0, score2 || 0);
  if (maxVal <= 10) return "#4A90D9";
  if (maxVal <= 30) return "#67C23A";
  if (maxVal <= 50) return "#E6A23C";
  if (maxVal <= 70) return "#F56C6C";
  return "#909399";
}

// ==================== 网页数据提取（已更新）====================

/**
 * 从 ippure.com 网页 HTML 中提取数据
 * 根据实际页面结构：
 * - 人机流量比: human 35.08% ... bot 64.92%
 * - IP来源: 广播IP
 * - IP属性: 机房IP
 * - IPPure系数: 56% 中度风险
 */
function extractFromHtml(html) {
  const result = {
    pureScore: null,
    botRatio: null,
    humanRatio: null,
    ipAttr: null,
    ipSource: null,
    riskLevel: null
  };
  
  if (!html) return result;
  
  // 清理 HTML，移除多余空白
  const cleanHtml = html.replace(/\s+/g, ' ');
  
  console.log("[IPPure] 开始解析网页数据...");
  
  // 1. 提取 Bot 流量比（核心数据）
  // 页面格式: "human 35.08%" ... "bot 64.92%"
  const botPatterns = [
    // 匹配 "bot 64.92%" 或 "bot64.92%"
    /bot\s*(\d+(?:\.\d+)?)\s*%/i,
    // 匹配带颜色标签的情况
    />bot\s*(\d+(?:\.\d+)?)\s*%</i,
    // 匹配中文
    /机器人?\s*流量?\s*[：:]\s*(\d+(?:\.\d+)?)\s*%/i
  ];
  
  for (const pattern of botPatterns) {
    const match = html.match(pattern);
    if (match) {
      result.botRatio = parseFloat(match[1]);
      console.log(`[IPPure] Bot流量: ${result.botRatio}%`);
      break;
    }
  }
  
  // 2. 提取 Human 流量比（可选，用于验证）
  const humanPatterns = [
    /human\s*(\d+(?:\.\d+)?)\s*%/i,
    />human\s*(\d+(?:\.\d+)?)\s*%</i
  ];
  
  for (const pattern of humanPatterns) {
    const match = html.match(pattern);
    if (match) {
      result.humanRatio = parseFloat(match[1]);
      console.log(`[IPPure] Human流量: ${result.humanRatio}%`);
      break;
    }
  }
  
  // 3. 提取 IPPure 系数
  // 页面格式: "56% 中度风险" 或 "IPPure系数 ... 56%"
  const scorePatterns = [
    // 匹配 "56% 中度风险"、"56% 低风险"、"56% 高风险"
    /(\d+(?:\.\d+)?)\s*%\s*[低中高]度?风险/,
    // 匹配 "IPPure系数" 后面的数字
    /IPPure\s*系数[\s\S]*?(\d+(?:\.\d+)?)\s*%/i,
    // 匹配标签内的百分比 + 风险等级
    />(\d+(?:\.\d+)?)\s*%\s*[低中高]度?风险</
  ];
  
  for (const pattern of scorePatterns) {
    const match = html.match(pattern);
    if (match) {
      result.pureScore = parseFloat(match[1]);
      console.log(`[IPPure] 纯净度系数: ${result.pureScore}%`);
      break;
    }
  }
  
  // 4. 提取风险等级
  const riskMatch = html.match(/(\d+)\s*%\s*([低中高])度?风险/);
  if (riskMatch) {
    result.riskLevel = riskMatch[2] + "度风险";
    console.log(`[IPPure] 风险等级: ${result.riskLevel}`);
  }
  
  // 5. 提取 IP 来源
  // 页面格式: "IP来源" ... "广播IP" 或 "原生IP"
  const sourcePatterns = [
    // 匹配按钮/标签中的文字
    /[>"]广播\s*IP["<]/i,
    /[>"]原生\s*IP["<]/i,
    /[>"]Broadcast["<]/i,
    /[>"]Native["<]/i,
    // 匹配 IP来源 后面的内容
    /IP\s*来源[\s\S]*?(广播|原生|Broadcast|Native)\s*IP?/i
  ];
  
  for (const pattern of sourcePatterns) {
    const match = html.match(pattern);
    if (match) {
      const value = match[0].toLowerCase();
      if (value.includes("广播") || value.includes("broadcast")) {
        result.ipSource = "广播";
      } else if (value.includes("原生") || value.includes("native")) {
        result.ipSource = "原生";
      }
      if (result.ipSource) {
        console.log(`[IPPure] IP来源: ${result.ipSource}`);
        break;
      }
    }
  }
  
  // 简化匹配
  if (!result.ipSource) {
    if (html.includes("广播IP") || html.includes("广播 IP")) {
      result.ipSource = "广播";
    } else if (html.includes("原生IP") || html.includes("原生 IP")) {
      result.ipSource = "原生";
    }
  }
  
  // 6. 提取 IP 属性
  // 页面格式: "IP属性" ... "机房IP" 或 "住宅IP"
  const attrPatterns = [
    /[>"]机房\s*IP["<]/i,
    /[>"]住宅\s*IP["<]/i,
    /[>"]Datacenter["<]/i,
    /[>"]Residential["<]/i,
    /IP\s*属性[\s\S]*?(机房|住宅|数据中心|Datacenter|Residential)\s*IP?/i
  ];
  
  for (const pattern of attrPatterns) {
    const match = html.match(pattern);
    if (match) {
      const value = match[0].toLowerCase();
      if (value.includes("机房") || value.includes("datacenter") || value.includes("数据中心")) {
        result.ipAttr = "机房";
      } else if (value.includes("住宅") || value.includes("residential")) {
        result.ipAttr = "住宅";
      }
      if (result.ipAttr) {
        console.log(`[IPPure] IP属性: ${result.ipAttr}`);
        break;
      }
    }
  }
  
  // 简化匹配
  if (!result.ipAttr) {
    if (html.includes("机房IP") || html.includes("机房 IP")) {
      result.ipAttr = "机房";
    } else if (html.includes("住宅IP") || html.includes("住宅 IP")) {
      result.ipAttr = "住宅";
    }
  }
  
  console.log(`[IPPure] 网页解析完成: Bot=${result.botRatio}, Score=${result.pureScore}, Attr=${result.ipAttr}, Source=${result.ipSource}`);
  
  return result;
}

// ==================== 格式化输出 ====================

function formatOutput(data, nodeName) {
  const pureEmoji = getEmoji(data.pureScore);
  const botEmoji = getEmoji(data.botRatio);
  const scoreText = getScoreText(data.pureScore);
  
  const ipTypeEmoji = data.ipAttr === "住宅" ? "🏠" : "🏢";
  const ipSourceEmoji = data.ipSource === "广播" ? "📡" : "🎯";
  
  const summaryLine = `【${pureEmoji}${botEmoji} ${data.ipAttr || "未知"} ${data.ipSource || "未知"}】`;
  
  const pureText = data.pureScore !== null ? `${data.pureScore}%` : "N/A";
  const botText = data.botRatio !== null ? `${data.botRatio}%` : "N/A";
  const humanText = data.humanRatio !== null ? `${data.humanRatio}%` : null;
  
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
    summaryLine,
    `━━━━━━━━━━━━━━━`
  );
  
  // 风险等级
  if (data.riskLevel) {
    contentLines.push(`⚠️ 风险: ${data.pureScore}% ${data.riskLevel}`);
  } else {
    contentLines.push(`🎯 纯净度: ${pureText} (${scoreText})`);
  }
  
  // 人机流量比
  if (humanText && data.botRatio !== null) {
    contentLines.push(`👤 人类: ${humanText} | 🤖 Bot: ${botText}`);
  } else {
    contentLines.push(`🤖 Bot流量: ${botText}`);
  }
  
  contentLines.push(
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
  const bgColor = getBackgroundColor(data.pureScore, data.botRatio);
  
  const titleSuffix = nodeName ? nodeName : (data.ip || "N/A");
  
  return {
    title: `IPPure | ${pureEmoji}${botEmoji} ${titleSuffix}`,
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

function fetchFromWeb(nodeName) {
  return new Promise((resolve, reject) => {
    const options = {
      url: CONFIG.WEB_URL,
      timeout: CONFIG.TIMEOUT,
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "zh-CN,zh;q=0.9"
      }
    };
    
    if (nodeName) {
      options.node = nodeName;
    }
    
    $httpClient.get(options, (error, response, data) => {
      if (error) {
        reject(new Error(`网页错误: ${error}`));
        return;
      }
      
      if (!data) {
        reject(new Error("网页响应为空"));
        return;
      }
      
      // 调试：输出部分网页内容
      console.log(`[IPPure] 网页响应长度: ${data.length}`);
      
      const result = extractFromHtml(data);
      resolve(result);
    });
  });
}

function mergeData(apiData, webData) {
  return {
    ip: apiData.ip,
    // 纯净度：优先使用网页数据（更准确）
    pureScore: webData.pureScore ?? apiData.pureScore ?? null,
    // Bot 流量比：仅网页提供
    botRatio: webData.botRatio ?? null,
    // Human 流量比：仅网页提供
    humanRatio: webData.humanRatio ?? null,
    // 风险等级：仅网页提供
    riskLevel: webData.riskLevel ?? null,
    // IP 属性：优先网页，备选 API
    ipAttr: webData.ipAttr || apiData.ipAttr || "未知",
    // IP 来源：优先网页，备选 API
    ipSource: webData.ipSource || apiData.ipSource || "未知",
    // 地理位置：来自 API
    country: apiData.country,
    countryCode: apiData.countryCode,
    region: apiData.region,
    city: apiData.city,
    timezone: apiData.timezone,
    asn: apiData.asn,
    asOrganization: apiData.asOrganization
  };
}

// ==================== 执行入口 ====================

(async () => {
  try {
    const nodeName = CONFIG.NODE;
    console.log(`[IPPure] 开始检测，节点: ${nodeName || "当前连接"}`);
    
    let apiData = null;
    let webData = { pureScore: null, botRatio: null, humanRatio: null, ipAttr: null, ipSource: null, riskLevel: null };
    let errors = [];
    
    // 并行请求 API 和网页
    const promises = [];
    
    // API 请求
    promises.push(
      fetchFromAPI(nodeName)
        .then(data => { apiData = data; })
        .catch(e => { errors.push(`API: ${e.message}`); })
    );
    
    // 网页请求
    if (CONFIG.FETCH_WEB_DATA) {
      promises.push(
        fetchFromWeb(nodeName)
          .then(data => { webData = data; })
          .catch(e => { errors.push(`Web: ${e.message}`); })
      );
    }
    
    await Promise.all(promises);
    
    // 检查数据
    if (!apiData && !webData.botRatio && !webData.pureScore) {
      throw new Error(`数据获取失败\n${errors.join("\n")}`);
    }
    
    // 构建基础数据
    if (!apiData) {
      apiData = {
        ip: "N/A", pureScore: null, ipAttr: null, ipSource: null,
        country: "", countryCode: "", region: "", city: "",
        timezone: "", asn: null, asOrganization: ""
      };
    }
    
    // 合并数据
    const mergedData = mergeData(apiData, webData);
    
    // 格式化输出
    const output = formatOutput(mergedData, nodeName);
    
    if (errors.length > 0) {
      output.content += `\n\n⚠️ ${errors.join("; ")}`;
    }
    
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
