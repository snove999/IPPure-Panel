/*
 * Loon Generic Script - IPPure Panel
 * 转换自 ipcheck.py，使用 API 替代浏览器抓取
 * Author: snove999
 * Version: 2.0.0
 */

const API_URL = "https://my.ippure.com/v1/info";

/**
 * 根据百分比数值返回对应 Emoji
 * @param {number|string} value - 百分比值（可带%）
 * @returns {string} Emoji
 */
function getEmoji(value) {
  let val;
  
  if (typeof value === "string") {
    val = parseFloat(value.replace("%", ""));
  } else if (typeof value === "number") {
    val = value;
  } else {
    return "❓";
  }
  
  if (isNaN(val)) return "❓";
  
  // 映射逻辑（与 Python 版本一致）：
  // 0-10:   ⚪ 白色（最优）
  // 10-30:  🟢 绿色（良好）
  // 30-50:  🟡 黄色（一般）
  // 50-70:  🟠 橙色（较差）
  // 70-90:  🔴 红色（差）
  // 90+:    ⚫ 黑色（最差）
  if (val <= 10) return "⚪";
  if (val <= 30) return "🟢";
  if (val <= 50) return "🟡";
  if (val <= 70) return "🟠";
  if (val <= 90) return "🔴";
  return "⚫";
}

/**
 * 获取 IP 属性文本
 * @param {boolean} isResidential - 是否为住宅 IP
 * @returns {string}
 */
function getIpAttr(isResidential) {
  return isResidential ? "住宅" : "机房";
}

/**
 * 获取 IP 来源文本
 * @param {boolean} isBroadcast - 是否为广播 IP
 * @returns {string}
 */
function getIpSource(isBroadcast) {
  return isBroadcast ? "广播" : "原生";
}

/**
 * 计算背景颜色
 * @param {number} pureScore - IPPure 系数
 * @param {number} botRatio - Bot 流量比
 * @returns {string} 十六进制颜色
 */
function getBackgroundColor(pureScore, botRatio) {
  // 取两者中较差的值作为整体评估
  const maxVal = Math.max(pureScore || 0, botRatio || 0);
  
  if (maxVal <= 10) return "#FFFFFF";  // 白色
  if (maxVal <= 30) return "#88A788";  // 绿色
  if (maxVal <= 50) return "#D4A017";  // 黄色
  if (maxVal <= 70) return "#E67E22";  // 橙色
  if (maxVal <= 90) return "#CC4444";  // 红色
  return "#2C2C2C";                     // 黑色
}

// ========== 主逻辑 ==========

$httpClient.get(API_URL, (error, response, data) => {
  // 网络错误处理
  if (error || !data) {
    $done({
      title: "IPPure Panel",
      content: "❌ Network Error",
      backgroundColor: "#CC4444",
    });
    return;
  }

  // JSON 解析
  let json;
  try {
    json = JSON.parse(data);
  } catch (e) {
    $done({
      title: "IPPure Panel",
      content: "❌ Invalid JSON",
      backgroundColor: "#CC4444",
    });
    return;
  }

  // ========== 数据提取 ==========
  
  const ip = json.ip || "N/A";
  
  // IPPure 系数（API 字段名可能是 pureScore 或 fraudScore）
  // 注意：fraudScore 是欺诈评分，pureScore 是纯净度，逻辑可能相反
  // 根据实际 API 返回调整
  const pureScore = json.pureScore ?? json.fraudScore ?? null;
  const pureEmoji = pureScore !== null ? getEmoji(pureScore) : "❓";
  
  // 人机流量比（Bot 比例）
  const botRatio = json.botRatio ?? json.botScore ?? null;
  const botEmoji = botRatio !== null ? getEmoji(botRatio) : "❓";
  
  // IP 属性
  const isResidential = Boolean(json.isResidential);
  const ipAttr = getIpAttr(isResidential);
  
  // IP 来源
  const isBroadcast = Boolean(json.isBroadcast);
  const ipSource = getIpSource(isBroadcast);

  // ========== 输出格式 ==========
  
  // 复刻 Python 版输出：【IPPure系数Emoji + Bot比例Emoji + IP属性 + IP来源】
  // 例如：【⚪🟡 机房 广播】
  
  const summaryLine = `【${pureEmoji}${botEmoji} ${ipAttr} ${ipSource}】`;
  
  // 详细信息
  const pureText = pureScore !== null ? `${pureScore}%` : "N/A";
  const botText = botRatio !== null ? `${botRatio}%` : "N/A";
  
  const content = [
    `📍 ${ip}`,
    summaryLine,
    `━━━━━━━━━━━━━━━`,
    `🎯 IPPure系数: ${pureText}`,
    `🤖 Bot流量比: ${botText}`,
    `🏷️ IP属性: ${ipAttr}`,
    `📡 IP来源: ${ipSource}`,
  ].join("\n");

  const bgColor = getBackgroundColor(pureScore, botRatio);

  $done({
    title: "IPPure Panel",
    content: content,
    backgroundColor: bgColor,
  });
});
