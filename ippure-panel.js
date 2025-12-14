/*
 * ============================================
 *        IPPure Panel for Loon
 * ============================================
 * 脚本名称：IPPure Panel
 * 脚本类型：generic / tile
 * 功能：检测指定节点出口 IP 的纯净度、Bot流量比、地理位置、ISP 信息
 * 
 * 关键特性：
 *   - 支持长按节点检测该节点的 IP 信息
 *   - 通过 $environment.node 获取被选中的节点
 *   - 通过 node 参数指定请求走哪个节点
 * 
 * 数据源：
 *   - 主要：https://my.ippure.com/v1/info (API)
 *   - 补充：https://ippure.com/ (网页解析)
 * 
 * 作者：snove999
 * 版本：4.2.0
 * ============================================
 */

// ==================== 参数读取 ====================

/**
 * 解析插件传入的参数
 */
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

/**
 * 获取当前选中的节点名称
 * 在 Loon 中，长按节点触发脚本时，$environment.params.node 会包含节点名称
 */
function getSelectedNode() {
  try {
    // 方式1: tile 脚本通过 $environment 获取
    if (typeof $environment !== "undefined") {
      // Loon 的 tile 脚本
      if ($environment.params && $environment.params.node) {
        return $environment.params.node;
      }
    }
    
    // 方式2: 通过 $request 获取（某些场景）
    if (typeof $request !== "undefined" && $request.params && $request.params.node) {
      return $request.params.node;
    }
    
    // 方式3: 直接从 $node 获取（如果存在）
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
  // 选中的节点
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

// ==================== 网页数据提取 ====================

function extractFromHtml(html) {
  const result = {
    pureScore: null,
    botRatio: null,
    ipAttr: null,
    ipSource: null
  };
  
  if (!html) return result;
  
  // 提取 IPPure 系数
  const scorePatterns = [
    /IPPure\s*系数[：:\s]*(\d+(?:\.\d+)?)\s*%/i,
    /IPPure\s*Score[：:\s]*(\d+(?:\.\d+)?)\s*%/i,
    /纯净度[：:\s]*(\d+(?:\.\d+)?)\s*%/i,
    /fraud\s*score[：:\s]*(\d+(?:\.\d+)?)/i
  ];
  
  for (const pattern of scorePatterns) {
    const match = html.match(pattern);
    if (match) {
      result.pureScore = parseFloat(match[1]);
      break;
    }
  }
  
  // 提取 Bot 流量比
  const botPatterns = [
    /[Bb]ot\s*流量比?[：:\s]*(\d+(?:\.\d+)?)\s*%/,
    /[Bb]ot\s*[Rr]atio[：:\s]*(\d+(?:\.\d+)?)\s*%/,
    /[Bb]ot[：:\s]*(\d+(?:\.\d+)?)\s*%/
  ];
  
  for (const pattern of botPatterns) {
    const match = html.match(pattern);
    if (match) {
      result.botRatio = parseFloat(match[1]);
      break;
    }
  }
  
  // 提取 IP 属性
  const attrPatterns = [
    /IP\s*属性[：:\s]*([住宅机房数据中心]+)/,
    /IP\s*[Tt]ype[：:\s]*(Residential|Datacenter|Hosting)/i,
    /(住宅|机房|数据中心)\s*IP/
  ];
  
  for (const pattern of attrPatterns) {
    const match = html.match(pattern);
    if (match) {
      const value = match[1].toLowerCase();
      if (value.includes("住宅") || value.includes("residential")) {
        result.ipAttr = "住宅";
      } else {
        result.ipAttr = "机房";
      }
      break;
    }
  }
  
  // 提取 IP 来源
  const sourcePatterns = [
    /IP\s*来源[：:\s]*([原生广播本地]+)/,
    /IP\s*[Ss]ource[：:\s]*(Native|Broadcast|Anycast)/i,
    /(原生|广播|本地)\s*IP/
  ];
  
  for (const pattern of sourcePatterns) {
    const match = html.match(pattern);
    if (match) {
      const value = match[1].toLowerCase();
      if (value.includes("广播") || value.includes("broadcast") || value.includes("anycast")) {
        result.ipSource = "广播";
      } else {
        result.ipSource = "原生";
      }
      break;
    }
  }
  
  return result;
}

// ==================== 格式化输出 ====================

function formatOutput(data, nodeName) {
  const pureEmoji = getEmoji(data.pureScore);
  const botEmoji = getEmoji(data.botRatio);
  const scoreText = getScoreText(data.pureScore);
  
  const ipTypeEmoji = data.ipAttr === "住宅" ? "🏠" : "🏢";
  const ipSourceEmoji = data.ipSource === "广播" ? "📡" : "🎯";
  
  const summaryLine = `【${pureEmoji}${botEmoji} ${data.ipAttr} ${data.ipSource}】`;
  
  const pureText = data.pureScore !== null ? `${data.pureScore}%` : "N/A";
  const botText = data.botRatio !== null ? `${data.botRatio}%` : "N/A";
  
  const flag = getFlag(data.countryCode);
  const locationParts = [data.city, data.region, data.country].filter(Boolean);
  const locationLine = locationParts.length > 0 
    ? `${flag} ${locationParts.join(" • ")}`
    : `${flag} 未知位置`;
  
  const ispLine = data.asn 
    ? `AS${data.asn} ${data.asOrganization || ""}`
    : (data.asOrganization || "未知");
  
  // 组装内容
  const contentLines = [];
  
  // 如果有节点名称，显示在最前面
  if (nodeName) {
    contentLines.push(`🔗 节点: ${nodeName}`);
    contentLines.push(``);
  }
  
  contentLines.push(
    `📍 ${data.ip || "N/A"}`,
    locationLine,
    ``,
    summaryLine,
    `━━━━━━━━━━━━━━━`,
    `🎯 纯净度: ${pureText} (${scoreText})`,
    `🤖 Bot流量: ${botText}`,
    `${ipTypeEmoji} IP属性: ${data.ipAttr}`,
    `${ipSourceEmoji} IP来源: ${data.ipSource}`
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
  
  // 标题中显示节点名或 IP
  const titleSuffix = nodeName ? nodeName : data.ip;
  
  return {
    title: `IPPure | ${pureEmoji}${botEmoji} ${titleSuffix}`,
    content: content,
    backgroundColor: bgColor,
    icon: "network",
    "icon-color": bgColor
  };
}

// ==================== 数据获取函数（支持指定节点）====================

/**
 * 从 API 获取数据
 * @param {string|null} nodeName - 指定的节点名称，null 表示使用当前连接
 * @returns {Promise<object>} API 数据
 */
function fetchFromAPI(nodeName) {
  return new Promise((resolve, reject) => {
    const options = {
      url: CONFIG.API_URL,
      timeout: CONFIG.TIMEOUT,
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "application/json",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
      }
    };
    
    // 关键：如果指定了节点，添加 node 参数
    if (nodeName) {
      options.node = nodeName;
    }
    
    $httpClient.get(options, (error, response, data) => {
      if (error) {
        reject(new Error(`API 网络错误: ${error}`));
        return;
      }
      
      if (!data) {
        reject(new Error("API 响应为空"));
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
        reject(new Error(`API JSON 解析失败: ${e.message}`));
      }
    });
  });
}

/**
 * 从网页获取数据
 * @param {string|null} nodeName - 指定的节点名称
 * @returns {Promise<object>} 网页提取的数据
 */
function fetchFromWeb(nodeName) {
  return new Promise((resolve, reject) => {
    const options = {
      url: CONFIG.WEB_URL,
      timeout: CONFIG.TIMEOUT,
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
      }
    };
    
    // 关键：如果指定了节点，添加 node 参数
    if (nodeName) {
      options.node = nodeName;
    }
    
    $httpClient.get(options, (error, response, data) => {
      if (error) {
        reject(new Error(`网页请求错误: ${error}`));
        return;
      }
      
      if (!data) {
        reject(new Error("网页响应为空"));
        return;
      }
      
      const result = extractFromHtml(data);
      resolve(result);
    });
  });
}

/**
 * 合并数据
 */
function mergeData(apiData, webData) {
  return {
    ip: apiData.ip,
    pureScore: apiData.pureScore ?? webData.pureScore ?? null,
    botRatio: webData.botRatio ?? null,
    ipAttr: apiData.ipAttr || webData.ipAttr || "未知",
    ipSource: apiData.ipSource || webData.ipSource || "未知",
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
    
    // 调试日志
    console.log(`[IPPure] 选中节点: ${nodeName || "当前连接"}`);
    
    let apiData = null;
    let webData = { pureScore: null, botRatio: null, ipAttr: null, ipSource: null };
    let errors = [];
    
    // 1. 获取 API 数据（通过指定节点）
    try {
      apiData = await fetchFromAPI(nodeName);
    } catch (e) {
      errors.push(`API: ${e.message}`);
      console.log(`[IPPure] API 获取失败: ${e.message}`);
    }
    
    // 2. 获取网页数据（通过指定节点）
    if (CONFIG.FETCH_WEB_DATA) {
      try {
        webData = await fetchFromWeb(nodeName);
      } catch (e) {
        errors.push(`Web: ${e.message}`);
        console.log(`[IPPure] 网页获取失败: ${e.message}`);
      }
    }
    
    // 3. 检查数据
    if (!apiData && !webData.pureScore && !webData.botRatio) {
      throw new Error(`所有数据源均失败\n${errors.join("\n")}`);
    }
    
    // 4. 构建基础数据
    if (!apiData) {
      apiData = {
        ip: "N/A",
        pureScore: null,
        ipAttr: null,
        ipSource: null,
        country: "",
        countryCode: "",
        region: "",
        city: "",
        timezone: "",
        asn: null,
        asOrganization: ""
      };
    }
    
    // 5. 合并数据
    const mergedData = mergeData(apiData, webData);
    
    // 6. 格式化输出（传入节点名称）
    const output = formatOutput(mergedData, nodeName);
    
    // 7. 警告提示
    if (errors.length > 0 && (mergedData.pureScore !== null || mergedData.botRatio !== null)) {
      output.content += `\n\n⚠️ 部分数据源异常`;
    }
    
    $done(output);
    
  } catch (error) {
    $done({
      title: "IPPure Panel",
      content: `❌ 检测失败\n${error.message}\n\n节点: ${CONFIG.NODE || "当前连接"}`,
      backgroundColor: "#909399",
      icon: "xmark.circle",
      "icon-color": "#F56C6C"
    });
  }
})();
