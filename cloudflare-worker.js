// Cloudflare Worker — 为 ERS Tech ISP 短接宝典 反向代理 GitHub 内容
// 部署方式：复制此文件到 Cloudflare Dashboard > Workers & Pages > 创建 Worker
// 绑定域名：在 Worker 的 Triggers > Custom Domain 添加 ers-tech.net

const GITHUB_RAW = 'https://raw.githubusercontent.com/bavenbaven/ERS-TECH-ISP-PICTURES-ONLY/main';
const JSDELIVR_CDN = 'https://cdn.jsdelivr.net/gh/bavenbaven/ERS-TECH-ISP-PICTURES-ONLY@main';
const CACHE_TTL = {
  json: 300,       // 5分钟 — metadata.json, auth.json, versions.json
  image: 86400,    // 1天 — 图片文件
  default: 3600,   // 1小时
};

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;  // e.g. /Samsung/Galaxy_S21/photo.ers

  // 健康检查
  if (path === '/') {
    return new Response(JSON.stringify({ status: 'ok', service: 'ers-tech-cdn' }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  // 判断文件类型以决定缓存策略
  const isJson = path.endsWith('.json');
  const cacheTtl = isJson ? CACHE_TTL.json : CACHE_TTL.image;

  // 构造 GitHub Raw URL
  const upstreamUrl = GITHUB_RAW + path;

  // 构造请求
  const upstreamRequest = new Request(upstreamUrl, {
    method: request.method,
    headers: {
      'User-Agent': 'ERS-Tech-Cloudflare-Worker/1.0',
    },
  });

  let response = await fetch(upstreamRequest);

  // 如果 GitHub Raw 失败，尝试 jsDelivr CDN 作为回退
  if (!response.ok) {
    const cdnUrl = JSDELIVR_CDN + path;
    const cdnRequest = new Request(cdnUrl, {
      method: request.method,
      headers: { 'User-Agent': 'ERS-Tech-Cloudflare-Worker/1.0' },
    });
    response = await fetch(cdnRequest);
  }

  if (!response.ok) {
    return new Response('Not Found', { status: 404 });
  }

  // 克隆响应以便修改头部
  const newResponse = new Response(response.body, response);

  // 设置缓存控制
  newResponse.headers.set('Cache-Control', `public, max-age=${cacheTtl}, s-maxage=${cacheTtl}`);
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set('X-Cache-Status', 'HIT');

  return newResponse;
}

export default {
  fetch: handleRequest,
};
