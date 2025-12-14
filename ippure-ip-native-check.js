/*
 * Loon Generic Script - IP Type Tile
 * 用于显示当前出口 IP 的类型（住宅/数据中心、原生/广播）
 */

const url = "https://my.ippure.com/v1/info";

$httpClient.get(url, (error, response, data) => {
  // 网络错误处理
  if (error || !data) {
    $done({
      title: "IP Type",
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
      title: "IP Type",
      content: "Invalid JSON",
      backgroundColor: "#CC4444",
    });
    return;
  }

  const isRes = Boolean(json.isResidential);
  const isBrd = Boolean(json.isBroadcast);

  const resText = isRes ? "Residential" : "DC";
  const brdText = isBrd ? "Broadcast" : "Native";

  // 颜色逻辑：绿 优 → 黄 中 → 红 差
  // 最优：住宅 + 原生 (isRes && !isBrd)
  // 中等：住宅 + 广播 或 数据中心 + 原生
  // 最差：数据中心 + 广播 (!isRes && isBrd)
  let color = "#88A788"; // 绿色（默认最优）
  if ((isRes && isBrd) || (!isRes && !isBrd)) {
    color = "#D4A017"; // 黄橙色（中等）
  }
  if (!isRes && isBrd) {
    color = "#CC4444"; // 红色（最差）
  }

  $done({
    title: "IP Type",
    content: `${resText} • ${brdText}`,
    backgroundColor: color,
  });
});
