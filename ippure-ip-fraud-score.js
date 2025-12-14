/*
 * Loon Generic Script - Fraud Score Tile
 * 用于显示当前出口 IP 的欺诈风险评分
 */

const url = "https://my.ippure.com/v1/info";

$httpClient.get(url, (error, response, data) => {
  // 网络错误处理
  if (error || !data) {
    $done({
      title: "Fraud Score",
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
      title: "Fraud Score",
      content: "Invalid JSON",
      backgroundColor: "#CC4444",
    });
    return;
  }

  const score = json.fraudScore;

  // 评分缺失处理
  if (score === undefined || score === null) {
    $done({
      title: "Fraud Score",
      content: "No Score",
      backgroundColor: "#CC4444",
    });
    return;
  }

  // 风险等级颜色映射
  let color = "#88A788"; // 低风险：绿色 (score < 40)
  if (score >= 40 && score < 70) {
    color = "#D4A017"; // 中风险：黄橙色
  } else if (score >= 70) {
    color = "#CC4444"; // 高风险：红色
  }

  $done({
    title: "Fraud Score",
    content: `Score: ${score}`,
    backgroundColor: color,
  });
});
