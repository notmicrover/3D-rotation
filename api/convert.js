// 此文件运行在 Vercel 的 Node.js 环境中
export default async function handler(req, res) {
    // 只允许 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 从请求头获取 API Key（由前端传递）
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(400).json({ error: 'Missing API Key' });
    }

    try {
        // 解析 multipart/form-data（Vercel 内置支持）
        const form = new FormData();
        const fileBuffer = await new Promise((resolve, reject) => {
            const chunks = [];
            req.on('data', chunk => chunks.push(chunk));
            req.on('end', () => resolve(Buffer.concat(chunks)));
            req.on('error', reject);
        });
        // 这里需要更复杂的 multipart 解析，为简化，我们假设使用 busboy 或类似库
        // 实际部署时推荐使用 busboy 或 @vercel/body-parser
        // 为演示目的，我们使用一个简单的假设：文件以 multipart 格式上传，需要解析。
        // 您可以使用 busboy 库：npm install busboy
        const Busboy = require('busboy');
        const busboy = new Busboy({ headers: req.headers });
        let fileBuffer;
        busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
            const chunks = [];
            file.on('data', data => chunks.push(data));
            file.on('end', () => {
                fileBuffer = Buffer.concat(chunks);
            });
        });
        busboy.on('finish', async () => {
            if (!fileBuffer) return res.status(400).json({ error: 'No file uploaded' });

            // 调用 ConvertHub API
            const formData = new FormData();
            formData.append('file', new Blob([fileBuffer]), 'recording.webm');
            formData.append('target_format', 'gif');

            const convertRes = await fetch('https://api.converthub.com/v2/convert', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                },
                body: formData
            });

            if (!convertRes.ok) {
                const errorText = await convertRes.text();
                return res.status(convertRes.status).json({ error: errorText });
            }

            // 将转换后的 GIF 流式返回给前端
            res.setHeader('Content-Type', 'image/gif');
            convertRes.body.pipe(res);
        });
        req.pipe(busboy);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}