/*
 * Loon Generic Script - IP Info Tile
 * 用于显示当前出口 IP 的地理位置和 ISP 信息
 */

const url = "https://my.ippure.com/v1/info";

$httpClient.get(url, (error, response, data) => {
  // 网络错误处理
  if (error || !data) {
    $done({
      title: "IP Info",
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
      title: "IP Info",
      content: "Invalid JSON",
      backgroundColor: "#CC4444",
    });
    return;
  }

  // Location 优先级：city → region → country
  const location = json.city || json.region || json.country || "Unknown";
  const org = json.asOrganization || "Unknown";

  $done({
    title: "IP Info",
    content: `${location} - ${org}`,
    backgroundColor: "#88A788",
  });
});
