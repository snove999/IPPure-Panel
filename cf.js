/**
 * IPPure Proxy Worker v2
 * 修复：通过参数传入 IP 进行查询
 */

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    
    if (url.pathname === '/api/ippure' || url.pathname === '/') {
      return handleIPPure(request, url, corsHeaders);
    }
    
    if (url.pathname === '/api/health') {
      return jsonResponse({ status: 'ok', time: new Date().toISOString() }, 200, corsHeaders);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};

/**
 * 处理 IPPure 查询
 */
async function handleIPPure(request, url, corsHeaders) {
  try {
    // 优先从 URL 参数获取 IP
    let targetIP = url.searchParams.get('ip');
    
    // 如果没有传入 IP，使用客户端 IP（回退方案）
    if (!targetIP) {
      targetIP = request.headers.get('cf-connecting-ip') || 
                 request.headers.get('x-real-ip') ||
                 request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    }
    
    if (!targetIP) {
      return jsonResponse({ success: false, error: 'No IP provided. Use ?ip=x.x.x.x' }, 400, corsHeaders);
    }

    // 验证 IP 格式
    if (!isValidIP(targetIP)) {
      return jsonResponse({ success: false, error: `Invalid IP format: ${targetIP}` }, 400, corsHeaders);
    }

    console.log(`Querying IP: ${targetIP}`);

    // 并行请求 API 和网页
    const [apiResult, webResult] = await Promise.allSettled([
      fetchIPPureAPI(targetIP),
      fetchIPPureWeb(targetIP)
    ]);

    const apiData = apiResult.status === 'fulfilled' ? apiResult.value : null;
    const webData = webResult.status === 'fulfilled' ? webResult.value : null;

    if (!apiData && !webData) {
      return jsonResponse({
        success: false,
        error: 'Both API and Web requests failed',
        ip: targetIP,
        details: {
          api: apiResult.status === 'rejected' ? apiResult.reason?.message : null,
          web: webResult.status === 'rejected' ? webResult.reason?.message : null
        }
      }, 500, corsHeaders);
    }

    // 合并结果，统一使用传入的 targetIP
    const result = {
      success: true,
      ip: targetIP,
      timestamp: new Date().toISOString(),
      data: {
        ip: targetIP,
        
        // 纯净度分数（优先 API）
        fraudScore: apiData?.fraudScore ?? webData?.pureScore ?? null,
        
        // Bot 流量比（仅网页有）
        botRatio: webData?.botRatio ?? null,
        humanRatio: webData?.humanRatio ?? null,
        
        // IP 属性
        ipAttr: webData?.ipAttr || (apiData?.isResidential ? '住宅' : (apiData?.isResidential === false ? '机房' : null)),
        ipSource: webData?.ipSource || (apiData?.isBroadcast ? '广播' : (apiData?.isBroadcast === false ? '原生' : null)),
        isResidential: apiData?.isResidential ?? null,
        isBroadcast: apiData?.isBroadcast ?? null,
        
        // 风险等级（仅网页有）
        riskLevel: webData?.riskLevel ?? null,
        
        // 地理位置
        country: apiData?.country || null,
        countryCode: apiData?.countryCode || null,
        region: apiData?.region || null,
        city: apiData?.city || null,
        timezone: apiData?.timezone || null,
        
        // ISP 信息
        asn: apiData?.asn || null,
        asOrganization: apiData?.asOrganization || null
      },
      source: {
        api: apiResult.status === 'fulfilled',
        web: webResult.status === 'fulfilled'
      }
    };

    return jsonResponse(result, 200, corsHeaders);

  } catch (error) {
    console.error('Error:', error);
    return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
  }
}

/**
 * 验证 IP 格式
 */
function isValidIP(ip) {
  // IPv4
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 (简化验证)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.').map(Number);
    return parts.every(p => p >= 0 && p <= 255);
  }
  
  return ipv6Regex.test(ip);
}

/**
 * 请求 IPPure API（带 IP 参数）
 */
async function fetchIPPureAPI(ip) {
  // IPPure API 支持查询指定 IP
  const apiUrl = `https://my.ippure.com/v1/info?ip=${encodeURIComponent(ip)}`;
  
  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`API HTTP ${response.status}`);
  }

  const data = await response.json();
  
  // 验证返回的 IP 是否匹配
  if (data.ip && data.ip !== ip) {
    console.warn(`API returned different IP: ${data.ip} vs ${ip}`);
  }
  
  return data;
}

/**
 * 请求 IPPure 网页（带 IP 参数）
 */
async function fetchIPPureWeb(ip) {
  // IPPure 网页可能支持查询指定 IP
  const webUrl = `https://ippure.com/?ip=${encodeURIComponent(ip)}`;
  
  const response = await fetch(webUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9'
    }
  });

  if (!response.ok) {
    throw new Error(`Web HTTP ${response.status}`);
  }

  const html = await response.text();
  return parseIPPureHTML(html);
}

/**
 * 解析 IPPure 网页 HTML
 */
function parseIPPureHTML(html) {
  const result = {
    pureScore: null,
    botRatio: null,
    humanRatio: null,
    ipAttr: null,
    ipSource: null,
    riskLevel: null
  };

  if (!html) return result;

  // 提取 Bot 流量比
  const botMatch = html.match(/bot[:\s]*(\d+(?:\.\d+)?)\s*%/i);
  if (botMatch) {
    result.botRatio = parseFloat(botMatch[1]);
  }

  // 提取 Human 流量比
  const humanMatch = html.match(/human[:\s]*(\d+(?:\.\d+)?)\s*%/i);
  if (humanMatch) {
    result.humanRatio = parseFloat(humanMatch[1]);
  }

  // 提取纯净度分数
  const scorePatterns = [
    /ippure[^<]*?(\d+(?:\.\d+)?)\s*%/i,
    /纯净度[^<]*?(\d+(?:\.\d+)?)\s*%/i,
    /(\d+(?:\.\d+)?)\s*%\s*[低中高]/
  ];
  
  for (const pattern of scorePatterns) {
    const match = html.match(pattern);
    if (match) {
      result.pureScore = parseFloat(match[1]);
      break;
    }
  }

  // 提取风险等级
  const riskMatch = html.match(/([低中高])度?风险/);
  if (riskMatch) {
    result.riskLevel = riskMatch[1] + '度风险';
  }

  // 提取 IP 来源
  if (/广播\s*IP|broadcast/i.test(html)) {
    result.ipSource = '广播';
  } else if (/原生\s*IP|native/i.test(html)) {
    result.ipSource = '原生';
  }

  // 提取 IP 属性
  if (/机房\s*IP|datacenter|data\s*center/i.test(html)) {
    result.ipAttr = '机房';
  } else if (/住宅\s*IP|residential/i.test(html)) {
    result.ipAttr = '住宅';
  }

  return result;
}

/**
 * JSON 响应
 */
function jsonResponse(data, status, corsHeaders) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
  });
}
