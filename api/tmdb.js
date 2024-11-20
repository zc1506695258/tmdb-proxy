const axios = require('axios');
const TMDB_BASE_URL = 'https://api.themoviedb.org';

// 创建缓存对象
const cache = new Map();
// 缓存过期时间（5分钟）
const CACHE_DURATION = 5 * 60 * 1000;

// 缓存清理函数
function cleanExpiredCache() {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
        if (now > value.expiry) {
            cache.delete(key);
        }
    }
}

// 定期清理缓存（每5分钟）
setInterval(cleanExpiredCache, CACHE_DURATION);

module.exports = async (req, res) => {
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');  // 允许所有域名访问
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');  // 允许的HTTP方法
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');  // 允许的请求头

    // 处理 OPTIONS 请求
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const fullPath = req.url;
        const authHeader = req.headers.authorization;

        // 获取缓存键（包含认证信息，确保不同认证有不同缓存）
        const cacheKey = `${fullPath}-${authHeader || ''}`;

        // 检查缓存
        if (cache.has(cacheKey)) {
            const cachedData = cache.get(cacheKey);
            if (Date.now() < cachedData.expiry) {
                console.log('Cache hit:', fullPath);
                return res.status(200).json(cachedData.data);
            } else {
                cache.delete(cacheKey);
            }
        }

        // 构建 TMDB 请求 URL
        const tmdbUrl = `${TMDB_BASE_URL}${fullPath}`;

        // 构建请求配置
        const config = {};

        // 只有在存在 Authorization header 时才添加
        if (authHeader) {
            config.headers = {
                'Authorization': authHeader
            };
        }

        // 发送请求到 TMDB
        const response = await axios.get(tmdbUrl, config);

        // 只有响应状态码为 200 时才缓存
        if (response.status === 200) {
            cache.set(cacheKey, {
                data: response.data,
                expiry: Date.now() + CACHE_DURATION
            });
            console.log('Cache miss and stored:', fullPath);
        } else {
            console.log('Response not cached due to non-200 status:', response.status);
        }

        // 返回响应
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('TMDB API error:', error);
        res.status(error.response?.status || 500).json({
            error: error.message,
            details: error.response?.data
        });
    }
}; 