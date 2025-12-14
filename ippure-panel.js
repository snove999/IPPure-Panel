/*
 * ============================================
 *        IPPure Panel for Loon
 * ============================================
 * 脚本名称：IPPure Panel
 * 脚本类型：generic
 * 功能：检测当前出口 IP 的纯净度、Bot流量比、地理位置、ISP 信息
 * 数据源：
 *   - 主要：https://my.ippure.com/v1/info (API)
 *   - 补充：https://ippure.com/ (网页解析，获取Bot流量比)
 * 
 * 作者：snove999
 * 版本：4.0.0
 * 
 * Loon 配置：
 * [Script]
 * generic script-path=ippure-panel.js, tag=IPPure, img-url=https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Global.png
 * ============================================
 */

// ==================== 配置区 ====================

const CONFIG = {
  // API 端点（提供基础数据 + 地理位置 + ISP）
  API_URL: "https://my.ippure.com/v1/info",
  // 网页端点（提供 Bot 流量比等额外数据）
  WEB_URL: "https://ippure.com/",
  // 超时时间（毫秒）
  TIMEOUT: 15000,
  // 是否同时请求网页获取额外数据（Bot流量比）
  FETCH_WEB_DATA: true
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

/**
 * 根据国家代码获取国旗 Emoji
 * @param {string} countryCode - 两位国家代码
 * @returns {string} 国旗 Emoji
 */
function getFlag(countryCode) {
  if (!countryCode) return "🌍";
  return FLAG_MAP[countryCode.toUpperCase()] || "🏳️";
}

// ==================== 工具函数 ====================

/**
 * 根据百分比数值返回对应 Emoji
 * 映射逻辑（与 Python 版本一致）：
 * 0-10:   ⚪ 白色（最优/纯净）
 * 10-30:  🟢 绿色（良好）
 * 30-50:  🟡 黄色（一般）
 * 50-70:  🟠 橙色（较差）
 * 70-90:  🔴 红色（差）
 * 90+:    ⚫ 黑色（最差/严重污染）
 * 
 * @param {number|string} value - 百分比值
 * @returns {string} Emoji
 */
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

/**
 * 根据评分返回文字描述
 * @param {number} score - 评分值
 * @returns {string} 描述文字
 */
function getScoreText(score) {
  if (score === null || score === undefined || isNaN(score)) return "未知";
  
  if (score <= 10) return "极佳";
  if (score <= 30) return "良好";
  if (score <= 50) return "一般";
  if (score <= 70) return "较差";
  if (score <= 90) return "很差";
  return "极差";
}

/**
 * 根据综合评分计算背景颜色
 * @param {number} score1 - 纯净度评分
 * @param {number} score2 - Bot流量比（可选）
 * @returns {string} 十六进制颜色
 */
function getBackgroundColor(score1, score2) {
  // 取两个评分中的最大值作为判断依据
  const maxVal = Math.max(score1 || 0, score2 || 0);
  
  if (maxVal <= 10) return "#4A90D9";  // 蓝色（优秀）
  if (maxVal <= 30) return "#67C23A";  // 绿色（良好）
  if (maxVal <= 50) return "#E6A23C";  // 黄色（一般）
  if (maxVal <= 70) return "#F56C6C";  // 橙红（较差）
  return "#909399";                     // 灰色（差）
}

// ==================== 网页数据提取 ====================

/**
 * 从网页 HTML 中提取数据
 * @param {string} html - 网页 HTML 内容
 * @returns {object} 提取的数据对象
 */
function extractFromHtml(html) {
  const result = {
    pureScore: null,
    botRatio: null,
    ipAttr: null,
    ipSource: null
  };
  
  if (!html) return result;
  
  // 1. 提取 IPPure 系数
  // 可能的格式：IPPure系数 75%、IPPure系数：75%、IPPure系数\n75%
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
  
  // 2. 提取 Bot 流量比（这是网页独有的数据）
  // 可能的格式：Bot流量比 35%、bot 35%、Bot: 35%
  const botPatterns = [
    /[Bb]ot\s*流量比?[：:\s]*(\d+(?:\.\d+)?)\s*%/,
    /[Bb]ot\s*[Rr]atio[：:\s]*(\d+(?:\.\d+)?)\s*%/,
    /[Bb]ot\s*[Tt]raffic[：:\s]*(\d+(?:\.\d+)?)\s*%/,
    /[Bb]ot[：:\s]*(\d+(?:\.\d+)?)\s*%/
  ];
  
  for (const pattern of botPatterns) {
    const match = html.match(pattern);
    if (match) {
      result.botRatio = parseFloat(match[1]);
      break;
    }
  }
  
  // 3. 提取 IP 属性
  // 可能的格式：IP属性 住宅、IP属性：机房IP、IP属性\n住宅IP
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
      } else if (value.includes("机房") || value.includes("数据中心") || 
                 value.includes("datacenter") || value.includes("hosting")) {
        result.ipAttr = "机房";
      }
      break;
    }
  }
  
  // 4. 提取 IP 来源
  // 可能的格式：IP来源 原生、IP来源：广播、IP来源\n原生IP
  const sourcePatterns = [
    /IP\s*来源[：:\s]*([原生广播本地]+)/,
    /IP\s*[Ss]ource[：:\s]*(Native|Broadcast|Anycast)/i,
    /(原生|广播|本地)\s*IP/
  ];
  
  for (const pattern of sourcePatterns) {
    const match = html.match(pattern);
    if (match) {
      const value = match[1].toLowerCase();
      if (value.includes("原生") || value.includes("native") || value.includes("本地")) {
        result.ipSource = "原生";
      } else if (value.includes("广播") || value.includes("broadcast") || value.includes("anycast")) {
        result.ipSource = "广播";
      }
      break;
    }
  }
  
  return result;
}

/**
 * 格式化输出内容
 * @param {object} data - 数据对象
 * @returns {object} 格式化后的面板配置
 */
function formatOutput(data) {
  const pureEmoji = getEmoji(data.pureScore);
  const botEmoji = getEmoji(data.botRatio);
  const scoreText = getScoreText(data.pureScore);
  
  // IP 属性和来源的 Emoji
  const ipTypeEmoji = data.ipAttr === "住宅" ? "🏠" : "🏢";
  const ipSourceEmoji = data.ipSource === "广播" ? "📡" : "🎯";
  
  // 复刻 Python 版输出格式：【纯净度Emoji + Bot比Emoji + IP属性 + IP来源】
  const summaryLine = `【${pureEmoji}${botEmoji} ${data.ipAttr} ${data.ipSource}】`;
  
  // 数值显示
  const pureText = data.pureScore !== null ? `${data.pureScore}%` : "N/A";
  const botText = data.botRatio !== null ? `${data.botRatio}%` : "N/A";
  
  // 构建地理位置行
  const flag = getFlag(data.countryCode);
  const locationParts = [data.city, data.region, data.country].filter(Boolean);
  const locationLine = locationParts.length > 0 
    ? `${flag} ${locationParts.join(" • ")}`
    : `${flag} 未知位置`;
  
  // 构建 ISP 信息行
  const ispLine = data.asn 
    ? `AS${data.asn} ${data.asOrganization || ""}`
    : (data.asOrganization || "未知");
  
  // 组装内容
  const content = [
    `📍 ${data.ip || "N/A"}`,
    locationLine,
    ``,
    summaryLine,
    `━━━━━━━━━━━━━━━`,
    `🎯 纯净度: ${pureText} (${scoreText})`,
    `🤖 Bot流量: ${botText}`,
    `${ipTypeEmoji} IP属性: ${data.ipAttr}`,
    `${ipSourceEmoji} IP来源: ${data.ipSource}`,
    `━━━━━━━━━━━━━━━`,
    `🌐 ISP: ${ispLine}`,
    `⏱️ 时区: ${data.timezone || "N/A"}`
  ].join("\n");
  
  const bgColor = getBackgroundColor(data.pureScore, data.botRatio);
  
  return {
    title: `IPPure | ${pureEmoji}${botEmoji} ${pureText}`,
    content: content,
    backgroundColor: bgColor,
    icon: "network",
    "icon-color": bgColor
  };
}

// ==================== 数据获取函数 ====================

/**
 * 从 API 获取数据
 * @returns {Promise<object>} API 数据
 */
function fetchFromAPI() {
  return new Promise((resolve, reject) => {
    const options = {
      url: CONFIG.API_URL,
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "application/json",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
      }
    };
    
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
          // 基础信息
          ip: json.ip || "N/A",
          
          // 纯净度评分
          pureScore: json.fraudScore ?? null,
          
          // IP 属性与来源
          ipAttr: json.isResidential ? "住宅" : "机房",
          ipSource: json.isBroadcast ? "广播" : "原生",
          
          // 地理位置
          country: json.country || "",
          countryCode: json.countryCode || "",
          region: json.region || "",
          city: json.city || "",
          timezone: json.timezone || "",
          
          // ISP 信息
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
 * @returns {Promise<object>} 网页提取的数据
 */
function fetchFromWeb() {
  return new Promise((resolve, reject) => {
    const options = {
      url: CONFIG.WEB_URL,
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
      }
    };
    
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
 * 合并 API 数据和网页数据
 * API 数据为主，网页数据作为补充（特别是 Bot 流量比）
 * @param {object} apiData - API 返回的数据
 * @param {object} webData - 网页提取的数据
 * @returns {object} 合并后的数据
 */
function mergeData(apiData, webData) {
  return {
    // 基础信息（来自 API）
    ip: apiData.ip,
    
    // 纯净度评分：优先使用 API，网页作为备份
    pureScore: apiData.pureScore ?? webData.pureScore ?? null,
    
    // Bot 流量比：仅网页提供
    botRatio: webData.botRatio ?? null,
    
    // IP 属性：优先使用 API，网页作为备份
    ipAttr: apiData.ipAttr || webData.ipAttr || "未知",
    
    // IP 来源：优先使用 API，网页作为备份
    ipSource: apiData.ipSource || webData.ipSource || "未知",
    
    // 地理位置（仅来自 API）
    country: apiData.country,
    countryCode: apiData.countryCode,
    region: apiData.region,
    city: apiData.city,
    timezone: apiData.timezone,
    
    // ISP 信息（仅来自 API）
    asn: apiData.asn,
    asOrganization: apiData.asOrganization
  };
}

// ==================== 执行入口 ====================

(async () => {
  try {
    let apiData = null;
    let webData = { pureScore: null, botRatio: null, ipAttr: null, ipSource: null };
    let errors = [];
    
    // 1. 获取 API 数据（主要数据源）
    try {
      apiData = await fetchFromAPI();
    } catch (e) {
      errors.push(`API: ${e.message}`);
      console.log(`API 获取失败: ${e.message}`);
    }
    
    // 2. 获取网页数据（补充数据源，主要用于获取 Bot 流量比）
    if (CONFIG.FETCH_WEB_DATA) {
      try {
        webData = await fetchFromWeb();
      } catch (e) {
        errors.push(`Web: ${e.message}`);
        console.log(`网页获取失败: ${e.message}`);
      }
    }
    
    // 3. 检查是否至少有一个数据源成功
    if (!apiData && !webData.pureScore && !webData.botRatio) {
      throw new Error(`所有数据源均失败\n${errors.join("\n")}`);
    }
    
    // 4. 如果 API 失败但网页成功，构建基础数据
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
    
    // 6. 格式化输出
    const output = formatOutput(mergedData);
    
    // 7. 如果有错误但仍有数据，在内容中添加警告
    if (errors.length > 0 && (mergedData.pureScore !== null || mergedData.botRatio !== null)) {
      output.content += `\n\n⚠️ 部分数据源异常`;
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
