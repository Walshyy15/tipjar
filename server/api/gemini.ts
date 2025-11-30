import fetch, { FormData } from 'node-fetch';
import { OCR_RATE_LIMIT_CONFIG, isRateLimitError } from '../config/rate-limit';

const getNanonetsEndpoint = (modelId: string) =>
  `https://app.nanonets.com/api/v2/OCR/Model/${modelId}/LabelFile/`;

// Simple in-memory rate limiter
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = OCR_RATE_LIMIT_CONFIG.maxRequests, windowMs: number = OCR_RATE_LIMIT_CONFIG.windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      return false;
    }

    this.requests.push(now);
    return true;
  }

  getTimeUntilNextRequest(): number {
    if (this.requests.length < this.maxRequests) {
      return 0;
    }

    const oldestRequest = Math.min(...this.requests);
    return Math.max(0, this.windowMs - (Date.now() - oldestRequest));
  }
}

const rateLimiter = new RateLimiter();

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function extractTextFromNanonets(responseData: any): string | null {
  const texts: string[] = [];

  const collectFromNode = (node: any) => {
    if (!node) return;

    if (typeof node === 'string') {
      texts.push(node);
      return;
    }

    if (typeof node.text === 'string') texts.push(node.text);
    if (typeof node.ocr_text === 'string') texts.push(node.ocr_text);
    if (typeof node.fullText === 'string') texts.push(node.fullText);

    const arrays = [
      node.result,
      node.results,
      node.predictions,
      node.fields,
      node.pages,
      node.page_data,
      node.lines,
    ];

    arrays.forEach(collection => {
      if (Array.isArray(collection)) {
        collection.forEach(collectFromNode);
      }
    });
  };

  collectFromNode(responseData);
  const combined = texts.map(text => text.trim()).filter(Boolean).join('\n').trim();
  return combined || null;
}

export async function analyzeImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  apiKey?: string,
  modelId?: string,
): Promise<{ text: string | null; error?: string }> {
  if (!rateLimiter.canMakeRequest()) {
    const waitTime = rateLimiter.getTimeUntilNextRequest();
    return {
      text: null,
      error: OCR_RATE_LIMIT_CONFIG.messages.rateLimitExceeded(waitTime),
    };
  }

  const nanonetsKey = apiKey || process.env.NANONETS_API_KEY || '';
  if (!nanonetsKey) {
    return {
      text: null,
      error: 'API key missing. Please configure the Nanonets API key.',
    };
  }

  const resolvedModelId = (modelId || process.env.NANONETS_MODEL_ID || '').trim();
  if (!resolvedModelId) {
    return {
      text: null,
      error:
        'Model ID missing. Configure NANONETS_MODEL_ID or pass x-nanonets-model with your account-specific model ID from the Nanonets dashboard.',
    };
  }

  if (/^nanonets-ocr2-7b$/i.test(resolvedModelId)) {
    return {
      text: null,
      error:
        'The Nanonets model name "Nanonets-ocr2-7B" is not a valid model ID. Copy your model ID from the Nanonets console and set NANONETS_MODEL_ID or x-nanonets-model.',
    };
  }

  const endpoint = getNanonetsEndpoint(resolvedModelId);
  for (let attempt = 0; attempt <= OCR_RATE_LIMIT_CONFIG.maxRetries; attempt++) {
    try {
      const formData = new FormData();
      const fileBlob = new Blob([Buffer.from(imageBase64, 'base64')], { type: mimeType });
      formData.append('file', fileBlob, `upload.${mimeType.split('/')[1] || 'jpg'}`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${nanonetsKey}:`).toString('base64')}`,
        },
        body: formData as any,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const shouldRetry = isRateLimitError({ code: response.status, message: errorText });

        if (shouldRetry && attempt < OCR_RATE_LIMIT_CONFIG.maxRetries) {
          const delay = Math.min(
            OCR_RATE_LIMIT_CONFIG.baseDelay * Math.pow(OCR_RATE_LIMIT_CONFIG.backoffMultiplier, attempt),
            OCR_RATE_LIMIT_CONFIG.maxDelay,
          );
          console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${OCR_RATE_LIMIT_CONFIG.maxRetries + 1})`);
          await sleep(delay);
          continue;
        }

        console.error('Nanonets API error:', response.status, errorText);
        const sanitizedError = errorText.slice(0, 500) || 'Failed to call Nanonets OCR API';
        const modelHint =
          response.status === 400 && /model id/i.test(errorText)
            ? ' Verify the Nanonets model ID by setting NANONETS_MODEL_ID or the x-nanonets-model header.'
            : '';
        return {
          text: null,
          error: `API Error (${response.status}): ${sanitizedError}.${modelHint}`,
        };
      }

      const data = await response.json();
      const extractedText = extractTextFromNanonets(data);

      if (!extractedText) {
        return {
          text: null,
          error: 'No text extracted from the image. Try a clearer image or manual entry.',
        };
      }

      return { text: extractedText };
    } catch (error: any) {
      if (attempt === OCR_RATE_LIMIT_CONFIG.maxRetries) {
        console.error('Error calling Nanonets OCR (final attempt):', error);
        return {
          text: null,
          error: 'An unexpected error occurred while processing the image.',
        };
      }

      const delay = Math.min(
        OCR_RATE_LIMIT_CONFIG.baseDelay * Math.pow(OCR_RATE_LIMIT_CONFIG.backoffMultiplier, attempt),
        OCR_RATE_LIMIT_CONFIG.maxDelay,
      );
      console.log(`Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${OCR_RATE_LIMIT_CONFIG.maxRetries + 1}):`, error);
      await sleep(delay);
    }
  }

  return {
    text: null,
    error: OCR_RATE_LIMIT_CONFIG.messages.maxRetriesExceeded,
  };
}
