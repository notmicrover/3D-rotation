import Busboy from 'busboy';
import { Readable } from 'stream';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(400).json({ error: 'Missing API Key' });
  }

  const busboy = Busboy({ headers: req.headers });
  let fileBuffer = null;
  let filePromise = new Promise((resolve, reject) => {
    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      const chunks = [];
      file.on('data', data => chunks.push(data));
      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
        // 不在这里 resolve
      });
      file.on('error', reject);
    });
    busboy.on('finish', () => {
      if (!fileBuffer) {
        reject(new Error('No file uploaded'));
      } else {
        resolve();
      }
    });
  });

  req.pipe(busboy);

  try {
    await filePromise;
  } catch (err) {
    return res.status(400).json({ error: 'File parsing failed' });
  }

  if (!fileBuffer) {
    return res.status(400).json({ error: 'No file received' });
  }

  try {
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'video/webm' });
    formData.append('file', blob, 'recording.webm');
    formData.append('target_format', 'gif');

    const convertRes = await fetch('https://api.converthub.com/v2/convert', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!convertRes.ok) {
      const errorText = await convertRes.text();
      return res.status(convertRes.status).json({ error: errorText });
    }

    res.setHeader('Content-Type', 'image/gif');
    // 将 Web ReadableStream 转换为 Node 流并 pipe
    Readable.fromWeb(convertRes.body).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
