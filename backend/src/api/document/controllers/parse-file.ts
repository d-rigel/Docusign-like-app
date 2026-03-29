// src/api/document/controllers/parse-file.ts
// Strapi v5 compiles to CommonJS — plain require() works as a global.

import * as https from 'https';
import * as http  from 'http';

function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── HTTP fetch returning Buffer ───────────────────────────────────────────────
function fetchBuffer(url: string, hdrs: Record<string,string> = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: hdrs, timeout: 120000 }, (res: any) => {
      if ([301,302,307,308].includes(res.statusCode) && res.headers.location) {
        return resolve(fetchBuffer(res.headers.location, hdrs));
      }
      if (res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} fetching file`));
      }
      const chunks: Buffer[] = [];
      res.on('data',  (c: Buffer) => chunks.push(c));
      res.on('end',   () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timed out')); });
  });
}

// ── Download from Cloudinary via SDK ─────────────────────────────────────────
async function downloadViaCloudinary(file: any): Promise<Buffer> {
  const strapi    = (global as any).strapi;
  const cloudName = process.env.CLOUDINARY_NAME;
  const apiKey    = process.env.CLOUDINARY_KEY;
  const apiSecret = process.env.CLOUDINARY_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials missing in backend/.env');
  }

  const cloudinary = require('cloudinary').v2;
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

  const publicId     = file.provider_metadata?.public_id || '';
  const resourceType = file.provider_metadata?.resource_type || 'image';
  const ext          = (file.ext || '.pdf').replace('.', '');

  strapi?.log.info(`[parse-file] public_id=${publicId} resource_type=${resourceType} ext=${ext}`);

  // Strategy 1: SDK private_download_url
  try {
    const signedUrl = cloudinary.utils.private_download_url(publicId, ext, {
      resource_type: resourceType,
      type: 'upload',
    });
    strapi?.log.info(`[parse-file] Strategy 1: private_download_url`);
    const buf = await fetchBuffer(signedUrl);
    strapi?.log.info(`[parse-file] Downloaded ${buf.length} bytes ✓`);
    return buf;
  } catch (e: any) {
    strapi?.log.warn(`[parse-file] Strategy 1 failed: ${e.message}`);
  }

  // Strategy 2: Admin API resource lookup → secure_url
  try {
    strapi?.log.info(`[parse-file] Strategy 2: Admin API resource lookup`);
    const info = await cloudinary.api.resource(publicId, { resource_type: resourceType });
    if (info.secure_url) {
      const buf = await fetchBuffer(info.secure_url);
      strapi?.log.info(`[parse-file] Downloaded ${buf.length} bytes via secure_url ✓`);
      return buf;
    }
  } catch (e: any) {
    strapi?.log.warn(`[parse-file] Strategy 2 failed: ${e.message}`);
  }

  // Strategy 3: Direct URL
  strapi?.log.info(`[parse-file] Strategy 3: Direct URL`);
  const directUrl = file.url?.startsWith('http') ? file.url : `http://localhost:1337${file.url}`;
  return fetchBuffer(directUrl);
}

// ── Extract text from PDF using pdf-parse ────────────────────────────────────
async function extractPdfText(buffer: Buffer): Promise<string> {
  const strapi = (global as any).strapi;

  // FIX: pdf-parse exports a function directly — but require() may return
  // { default: fn } in some compiled contexts. Handle both.
  const pdfParseModule = require('pdf-parse');
  const pdfParse = typeof pdfParseModule === 'function'
    ? pdfParseModule
    : (pdfParseModule.default || pdfParseModule);

  if (typeof pdfParse !== 'function') {
    throw new Error(`pdf-parse did not export a function, got: ${typeof pdfParseModule}`);
  }

  const data = await pdfParse(buffer);
  return (data.text || '').trim();
}

// ── Render PDF to text using pdfjs-dist (fallback for scanned PDFs) ──────────
async function pdfToText(buffer: Buffer): Promise<string> {
  const strapi = (global as any).strapi;

  // FIX: pdfjs-dist v4 changed its entry point — try multiple paths
  let pdfjsLib: any;
  const pdfPaths = [
    'pdfjs-dist/build/pdf.mjs',
    'pdfjs-dist/build/pdf.js',
    'pdfjs-dist/legacy/build/pdf.js',
    'pdfjs-dist',
  ];

  for (const p of pdfPaths) {
    try {
      pdfjsLib = require(p);
      if (pdfjsLib.getDocument || pdfjsLib.default?.getDocument) {
        if (!pdfjsLib.getDocument) pdfjsLib = pdfjsLib.default;
        strapi?.log.info(`[parse-file] Loaded pdfjs-dist from: ${p}`);
        break;
      }
    } catch { /* try next */ }
  }

  if (!pdfjsLib?.getDocument) {
    throw new Error('pdfjs-dist not available — run: npm install pdfjs-dist');
  }

  // pdfjs-dist v4 needs a canvas factory for Node.js text extraction
  // For text-only extraction we don't actually need canvas
  pdfjsLib.GlobalWorkerOptions = pdfjsLib.GlobalWorkerOptions || {};
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdfDoc      = await loadingTask.promise;
  const numPages    = pdfDoc.numPages;
  const maxPages    = Math.min(numPages, 15);

  strapi?.log.info(`[parse-file] pdfjs: extracting text from ${maxPages}/${numPages} pages`);

  const allText: string[] = [];
  for (let i = 1; i <= maxPages; i++) {
    const page    = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str || '')
      .join(' ')
      .trim();
    if (pageText) allText.push(pageText);
  }

  return allText.join('\n');
}

// ── Render PDF pages to images for OCR (scanned documents) ───────────────────
async function pdfPagesToImages(buffer: Buffer): Promise<Buffer[]> {
  const strapi = (global as any).strapi;

  let pdfjsLib: any;
  const pdfPaths = [
    'pdfjs-dist/build/pdf.mjs',
    'pdfjs-dist/build/pdf.js',
    'pdfjs-dist/legacy/build/pdf.js',
    'pdfjs-dist',
  ];
  for (const p of pdfPaths) {
    try {
      const mod = require(p);
      pdfjsLib  = mod.getDocument ? mod : mod.default;
      if (pdfjsLib?.getDocument) break;
    } catch { /* try next */ }
  }
  if (!pdfjsLib?.getDocument) throw new Error('pdfjs-dist not found');

  // canvas is needed for rendering
  const { createCanvas } = require('canvas');

  class NodeCanvasFactory {
    create(w: number, h: number) {
      const canvas = createCanvas(w, h);
      return { canvas, context: canvas.getContext('2d') };
    }
    reset(cc: any, w: number, h: number) { cc.canvas.width = w; cc.canvas.height = h; }
    destroy(cc: any) { cc.canvas.width = 0; cc.canvas.height = 0; }
  }

  pdfjsLib.GlobalWorkerOptions = pdfjsLib.GlobalWorkerOptions || {};
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';

  const pdfDoc   = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const maxPages = Math.min(pdfDoc.numPages, 10);
  const images: Buffer[] = [];

  for (let i = 1; i <= maxPages; i++) {
    const page     = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const factory  = new NodeCanvasFactory();
    const cc       = factory.create(viewport.width, viewport.height);
    await page.render({ canvasContext: cc.context, viewport, canvasFactory: factory }).promise;
    images.push(cc.canvas.toBuffer('image/png'));
    strapi?.log.info(`[parse-file] Rendered page ${i}/${maxPages}`);
  }

  return images;
}

// ── Full PDF extraction pipeline ─────────────────────────────────────────────
async function extractPdf(buffer: Buffer): Promise<{ html: string; wasScanned: boolean }> {
  const strapi = (global as any).strapi;
  let rawText  = '';

  // Step 1: Try pdf-parse (fast, works on digital PDFs)
  try {
    rawText = await extractPdfText(buffer);
    strapi?.log.info(`[parse-file] pdf-parse: ${rawText.length} chars extracted`);
  } catch (e: any) {
    strapi?.log.warn(`[parse-file] pdf-parse failed: ${e.message}`);
  }

  // Step 2: If pdf-parse got little/nothing, try pdfjs text extraction
  if (rawText.length < 50) {
    try {
      strapi?.log.info(`[parse-file] Trying pdfjs text extraction…`);
      rawText = await pdfToText(buffer);
      strapi?.log.info(`[parse-file] pdfjs text: ${rawText.length} chars`);
    } catch (e: any) {
      strapi?.log.warn(`[parse-file] pdfjs text extraction failed: ${e.message}`);
    }
  }

  // Got real text → digital PDF, return it
  if (rawText.length > 50) {
    const lines = rawText.split('\n').map((l: string) => l.trim()).filter(Boolean);
    return { html: lines.map(l => `<p>${escapeHtml(l)}</p>`).join('\n'), wasScanned: false };
  }

  // Step 3: Still no text → scanned PDF, render pages and OCR
  strapi?.log.info('[parse-file] No text found — attempting scanned PDF OCR…');
  try {
    const pageImages = await pdfPagesToImages(buffer);
    if (pageImages.length === 0) {
      return { html: '<p><em>Could not render PDF pages.</em></p>', wasScanned: true };
    }

    const { createWorker } = require('tesseract.js');
    const worker = await createWorker('eng');
    const allLines: string[] = [];

    for (let i = 0; i < pageImages.length; i++) {
      const { data: { text } } = await worker.recognize(pageImages[i]);
      const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        if (pageImages.length > 1) allLines.push(`<h3>Page ${i + 1}</h3>`);
        allLines.push(...lines.map(l => `<p>${escapeHtml(l)}</p>`));
      }
      strapi?.log.info(`[parse-file] OCR page ${i+1}: ${lines.length} lines`);
    }
    await worker.terminate();

    return {
      html: allLines.length > 0
        ? allLines.join('\n')
        : '<p><em>OCR ran but found no readable text. Please type your content below.</em></p>',
      wasScanned: true,
    };
  } catch (e: any) {
    strapi?.log.error(`[parse-file] OCR pipeline error: ${e.message}`);
    return {
      html: '<p><em>Could not extract text from this scanned document. Please type your content below.</em></p>',
      wasScanned: true,
    };
  }
}

// ── Word extraction ───────────────────────────────────────────────────────────
async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = require('mammoth');
  const result  = await mammoth.convertToHtml({ buffer });
  return result.value || '<p>No content extracted.</p>';
}

// ── Image OCR ─────────────────────────────────────────────────────────────────
async function ocrImage(buffer: Buffer, mime: string): Promise<string> {
  const strapi  = (global as any).strapi;
  const b64     = buffer.toString('base64');
  const preview = `<p><img src="data:${mime};base64,${b64}" style="max-width:100%;height:auto;" /></p>`;

  try {
    const { createWorker } = require('tesseract.js');
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(buffer);
    await worker.terminate();
    const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);
    return preview + (lines.length > 0
      ? `<h3>Extracted Text (OCR)</h3>${lines.map(l => `<p>${escapeHtml(l)}</p>`).join('\n')}`
      : '');
  } catch (e: any) {
    strapi?.log.warn(`[parse-file] Image OCR failed: ${e.message}`);
    return preview;
  }
}

// ── Controller ────────────────────────────────────────────────────────────────
export default {
  async parseFile(ctx: any) {
    const strapi = (global as any).strapi;
    const user   = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { id } = ctx.params;
    const doc = await strapi.entityService.findOne(
      'api::document.document', id,
      { populate: ['owner', 'collaborators.user', 'originalFile'] }
    );
    if (!doc) return ctx.notFound();

    const isOwner  = (doc as any).owner?.id === user.id;
    const isCollab = (doc as any).collaborators?.some((c: any) => c.user?.id === user.id);
    if (!isOwner && !isCollab) return ctx.forbidden();

    const file = (doc as any).originalFile;
    if (!file) return ctx.badRequest('No attached file');

    const mime = (file.mime || '').toLowerCase();
    const name = (file.name || '').toLowerCase();
    strapi.log.info(`[parse-file] Processing: ${file.name} (${mime})`);

    try {
      const buffer = await downloadViaCloudinary(file);

      if (mime.startsWith('image/')) {
        const html = await ocrImage(buffer, mime);
        return ctx.send({ data: { html, type: 'image', wasScanned: false, filename: file.name } });
      }

      if (mime.startsWith('text/') || name.endsWith('.txt')) {
        const html = buffer.toString('utf-8')
          .split('\n').map(l => `<p>${escapeHtml(l.trim()) || '<br>'}</p>`).join('\n');
        return ctx.send({ data: { html, type: 'text', wasScanned: false, filename: file.name } });
      }

      if (mime === 'application/pdf' || name.endsWith('.pdf')) {
        const { html, wasScanned } = await extractPdf(buffer);
        return ctx.send({ data: { html, type: 'pdf', wasScanned, filename: file.name } });
      }

      if (mime.includes('officedocument.wordprocessingml') || mime === 'application/msword'
        || name.endsWith('.docx') || name.endsWith('.doc')) {
        const html = await extractDocx(buffer);
        return ctx.send({ data: { html, type: 'word', wasScanned: false, filename: file.name } });
      }

      return ctx.badRequest(`Cannot extract content from "${mime}"`);

    } catch (err: any) {
      strapi.log.error(`[parse-file] Fatal: ${err.message}`);
      return ctx.internalServerError(`File processing failed: ${err.message}`);
    }
  },
};