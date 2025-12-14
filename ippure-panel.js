/*
 * Loon Generic Script - IPPure Panel
 * 集成显示：IP 地理位置、欺诈评分、IP 类型
 * Author: snove999
 * Version: 1.0.0
 */

const url = "https://my.ippure.com/v1/info";

$httpClient.get(url, (error, response, data) => {
  // 网络错误处理
  if (error || !data) {
    $done({
      title: "IPPure Panel",
      content: "Network Error",
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
      content: "Invalid JSON",
      backgroundColor: "#CC4444",
    });
    return;
  }

  // ========== 数据提取 ==========
  
  // IP 信息
  const ip = json.ip || "N/A";
  const country = json.country || "N/A";
  const region = json.region || "";
  const city = json.city || "";
  const isp = json.isp || "N/A";

  // 欺诈评分
  const fraudScore = json.fraudScore ?? "N/A";

  // IP 类型
  const isRes = Boolean(json.isResidential);
  const isBrd = Boolean(json.isBroadcast);
  const resText = isRes ? "Residential" : "DC";
  const brdText = isBrd ? "Broadcast" : "Native";

  // ========== 位置信息组装 ==========
  
  let location = country;
  if (region && region !== city) {
    location += ` • ${region}`;
  }
  if (city) {
    location += ` • ${city}`;
  }

  // ========== 背景颜色计算 ==========
  
  // 综合评估逻辑：
  // 1. 欺诈评分权重最高
  // 2. IP 类型次之
  
  let color = "#88A788"; // 默认绿色（优）

  // 欺诈评分判定
  if (typeof fraudScore === "number") {
    if (fraudScore >= 70) {
      color = "#CC4444"; // 红色（高风险）
    } else if (fraudScore >= 40) {
      color = "#D4A017"; // 黄色（中风险）
    }
  }

  // IP 类型判定（仅在欺诈评分为低风险时生效）
  if (color === "#88A788") {
    if (!isRes && isBrd) {
      color = "#CC4444"; // 红色（DC + 广播）
    } else if ((isRes && isBrd) || (!isRes && !isBrd)) {
      color = "#D4A017"; // 黄色（中等）
    }
  }

  // ========== 输出内容 ==========
  
  const content = [
    `📍 ${ip}`,
    `🌐 ${location}`,
    `🏢 ${isp}`,
    `⚠️ Fraud: ${fraudScore} | 🏷️ ${resText} • ${brdText}`,
  ].join("\n");

  $done({
    title: "IPPure Panel",
    content: content,
    backgroundColor: color,
  });
});
