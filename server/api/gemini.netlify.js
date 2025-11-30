/**
 * Nanonets OCR integration for Netlify functions with rate limiting
 */

import fetch, { FormData } from 'node-fetch';

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
const NANONETS_MODEL = 'Nanonets-ocr2-7B';
const NANONETS_ENDPOINT = `https://app.nanonets.com/api/v2/OCR/Model/${NANONETS_MODEL}/LabelFile/`;
=======
=======
>>>>>>> theirs
const DEFAULT_NANONETS_MODEL = 'Nanonets-ocr2-7B';
const getNanonetsEndpoint = (modelId) => {
  const resolvedModelId = modelId || process.env.NANONETS_MODEL_ID || DEFAULT_NANONETS_MODEL;
  return `https://app.nanonets.com/api/v2/OCR/Model/${resolvedModelId}/LabelFile/`;
};
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
const getNanonetsEndpoint = (modelId) =>
  `https://app.nanonets.com/api/v2/OCR/Model/${modelId}/LabelFile/`;
>>>>>>> theirs

const RATE_LIMIT = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
};

class RateLimiter {
  constructor(maxRequests = 15, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  canMakeRequest() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      return false;
    }

    this.requests.push(now);
    return true;
  }

  getTimeUntilNextRequest() {
    if (this.requests.length < this.maxRequests) {
      return 0;
    }

    const oldestRequest = Math.min(...this.requests);
    return Math.max(0, this.windowMs - (Date.now() - oldestRequest));
  }
}

const rateLimiter = new RateLimiter();
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function isRateLimitError(error) {
  if (!error) return false;
  const errorMessage = typeof error === 'string' ? error : error.message || '';
  const errorCode = error.code || error.status;

  return (
    errorCode === 429 ||
    errorMessage.includes('quota') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('requests per minute')
  );
}

function extractTextFromNanonets(responseData) {
  const texts = [];

  const collectFromNode = (node) => {
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

/**
 * Analyzes an image using Nanonets OCR with rate limiting and retry logic
 * @param {string} imageBase64 - Base64 encoded image data
 * @param {string} mimeType - Mime type for the uploaded image
 * @param {string} [apiKey] - Optional API key override from the request
 * @returns {Promise<{text: string|null, error: string|null}>}
 */
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
export async function analyzeImage(imageBase64, mimeType = 'image/jpeg', apiKey) {
=======
export async function analyzeImage(imageBase64, mimeType = 'image/jpeg', apiKey, modelId) {
>>>>>>> theirs
=======
export async function analyzeImage(imageBase64, mimeType = 'image/jpeg', apiKey, modelId) {
>>>>>>> theirs
=======
export async function analyzeImage(imageBase64, mimeType = 'image/jpeg', apiKey, modelId) {
>>>>>>> theirs
  if (!rateLimiter.canMakeRequest()) {
    const waitTime = rateLimiter.getTimeUntilNextRequest();
    return {
      text: null,
      error: `Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds before uploading another image.`
    };
  }

  const nanonetsKey = apiKey || process.env.NANONETS_API_KEY;
  if (!nanonetsKey) {
    return { text: null, error: 'API key missing. Please configure the Nanonets API key in environment variables.' };
  }

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
=======
  const endpoint = getNanonetsEndpoint(modelId);

>>>>>>> theirs
=======
  const endpoint = getNanonetsEndpoint(modelId);

>>>>>>> theirs
=======
  const resolvedModelId = (modelId || process.env.NANONETS_MODEL_ID || '').trim();
  if (!resolvedModelId) {
    return {
      text: null,
      error:
        'Model ID missing. Configure NANONETS_MODEL_ID or send x-nanonets-model with your account-specific model ID from the Nanonets dashboard.',
    };
  }

  if (/^nanonets-ocr2-7b$/i.test(resolvedModelId)) {
    return {
      text: null,
      error:
        'The model name "Nanonets-ocr2-7B" is not a valid model ID. Copy your model ID from the Nanonets console and set NANONETS_MODEL_ID or x-nanonets-model.',
    };
  }

  const endpoint = getNanonetsEndpoint(resolvedModelId);

>>>>>>> theirs
  for (let attempt = 0; attempt <= RATE_LIMIT.maxRetries; attempt++) {
    try {
      const formData = new FormData();
      formData.append('file', Buffer.from(imageBase64, 'base64'), {
        filename: `upload.${mimeType.split('/')[1] || 'jpg'}`,
        contentType: mimeType,
      });

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
      const response = await fetch(NANONETS_ENDPOINT, {
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
      const response = await fetch(endpoint, {
>>>>>>> theirs
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${nanonetsKey}:`).toString('base64')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const shouldRetry = isRateLimitError({ code: response.status, message: errorText });

        if (shouldRetry && attempt < RATE_LIMIT.maxRetries) {
          const delay = Math.min(
            RATE_LIMIT.baseDelay * Math.pow(RATE_LIMIT.backoffMultiplier, attempt),
            RATE_LIMIT.maxDelay
          );
          console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${RATE_LIMIT.maxRetries + 1})`);
          await sleep(delay);
          continue;
        }

        console.error('Nanonets API error:', response.status, errorText);
        const sanitizedError = errorText.slice(0, 500) || 'Failed to call Nanonets OCR API';
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
        return {
          text: null,
          error: `API Error (${response.status}): ${sanitizedError}`,
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
        const modelHint =
          response.status === 400 && /model id/i.test(errorText)
            ? ' Verify the Nanonets model ID by setting NANONETS_MODEL_ID or the x-nanonets-model header.'
            : '';
        return {
          text: null,
          error: `API Error (${response.status}): ${sanitizedError}.${modelHint}`,
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
        };
      }

      const data = await response.json();
      const extractedText = extractTextFromNanonets(data);

      if (!extractedText) {
        return { text: null, error: 'No text extracted from the image. Try a clearer image or manual entry.' };
      }

      return { text: extractedText, error: null };
    } catch (error) {
      if (attempt === RATE_LIMIT.maxRetries) {
        console.error('Nanonets OCR error (final attempt):', error);
        return {
          text: null,
          error: error?.message || 'Failed to process image with Nanonets OCR'
        };
      }

      const delay = Math.min(
        RATE_LIMIT.baseDelay * Math.pow(RATE_LIMIT.backoffMultiplier, attempt),
        RATE_LIMIT.maxDelay
      );
      console.log(`Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${RATE_LIMIT.maxRetries + 1}):`, error);
      await sleep(delay);
    }
  }

  return {
    text: null,
    error: 'Maximum retry attempts exceeded.'
  };
}
