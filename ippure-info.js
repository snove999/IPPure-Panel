/**
 * IPPure IP 信息聚合面板
 * 功能: 地理位置 + 风险评分 + IP类型
 * API: https://my.ippure.com/v1/info
 * 适配: Loon
 */
const CONFIG = {
  url: "https://my.ippure.com/v1/info",
  timeout: 5000,
  colors: {
    success: "#2ECC71",   // 绿 - 低风险/住宅
    warning: "#F39C12",   // 黄 - 中风险
    danger: "#E74C3C",    // 红 - 高风险/异常
    info: "#3498DB",      // 蓝 - 信息色
    neutral: "#95A5A6"    // 灰 - 未知/错误
  }
};
// ==================== 网络请求封装 ====================
function httpRequest(options) {
  return new Promise((resolve) => {
    $httpClient.get(options, (error, response, data) => {
      resolve({ error, response, data });
    });
  });
}
// ==================== 风险等级判定 ====================
function getRiskLevel(score) {
  if (score === null || score === undefined) {
    return { level: "未知", color: CONFIG.colors.neutral };
  }
  if (score <= 30) {
    return { level: "低风险", color: CONFIG.colors.success };
  }
  if (score <= 60) {
    return { level: "中风险", color: CONFIG.colors.warning };
  }
  return { level: "高风险", color: CONFIG.colors.danger };
}
// ==================== IP类型判定 ====================
function getIPType(isResidential, isBroadcast) {
  const typeText = isResidential ? "🏠 住宅" : "🖥️ 数据中心";
  const broadText = isBroadcast ? "📡 广播" : "🎯 原生";
  return ${typeText} · ${broadText};
}
// ==================== 背景色计算 ====================
function getBackgroundColor(score, isResidential) {
  // 优先根据风险分数
  if (score !== null && score !== undefined) {
    if (score <= 30 && isResidential) return CONFIG.colors.success;
    if (score <= 30) return CONFIG.colors.info;
    if (score <= 60) return CONFIG.colors.warning;
    return CONFIG.colors.danger;
  }
  // 无分数时根据IP类型
  return isResidential ? CONFIG.colors.success : CONFIG.colors.info;
}
// ==================== 主函数 ====================
async function main() {
  try {
    const { error, data } = await httpRequest({
      url: CONFIG.url,
      timeout: CONFIG.timeout
    });
    // 网络错误处理
    if (error || !data) {
      return $done({
        title: "IPPure 信息",
        content: "❌ 网络请求失败",
        icon: "wifi.exclamationmark",
        "icon-color": CONFIG.colors.danger
      });
    }
    // JSON 解析
    let json;
    try {
      json = JSON.parse(data);
    } catch {
      return $done({
        title: "IPPure 信息",
        content: "❌ 数据解析失败",
        icon: "exclamationmark.triangle",
        "icon-color": CONFIG.colors.danger
      });
    }
    // ========== 数据提取 ==========
    const ip = json.ip || "N/A";
    const location = json.city  json.region  json.country || "未知位置";
    const org = json.asOrg  json.org  "未知运营商";
    const fraudScore = json.fraudScore ?? null;
    const isResidential = Boolean(json.isResidential);
    const isBroadcast = Boolean(json.isBroadcast);
    // ========== 信息组装 ==========
    const risk = getRiskLevel(fraudScore);
    const ipType = getIPType(isResidential, isBroadcast);
    const bgColor = getBackgroundColor(fraudScore, isResidential);
    // 风险分数显示
    const scoreText = fraudScore !== null ? ${fraudScore}/100 : "N/A";
    // ========== 面板输出 ==========
    const content = [
      📍 ${location},
      🌐 ${ip},
      🏢 ${org},
      ${ipType},
      ⚠️ 风险: ${scoreText} (${risk.level})
    ].join("\n");
    $done({
      title: "IPPure IP 信息",
      content: content,
      icon: "network.badge.shield.half.filled",
      "icon-color": bgColor
    });
  } catch (e) {
    $done({
      title: "IPPure 信息",
      content: ❌ 运行错误: ${e.message},
      icon: "xmark.octagon",
      "icon-color": CONFIG.colors.danger
    });
  }
}
main();
