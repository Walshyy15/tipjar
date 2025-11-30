/**
 * Rate limiting configuration for OCR API calls
 */

export const OCR_RATE_LIMIT_CONFIG = {
  // Maximum number of requests per time window
  maxRequests: 15,

  // Time window in milliseconds (60 seconds = 1 minute)
  windowMs: 60 * 1000,

  // Retry configuration
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,

  // Error messages
  messages: {
    rateLimitExceeded: (waitTime: number) =>
      `Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds before uploading another image.`,
    maxRetriesExceeded: "Maximum retry attempts exceeded. Please try again later.",
    quotaExceeded: "API quota exceeded. Please try again later or contact support if this persists."
  }
};

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: any): boolean {
  if (!error) return false;

  const errorMessage = typeof error === 'string' ? error : error.message || '';
  const errorCode = error.code || error.status;

  return (
    errorCode === 429 ||
    errorMessage.includes('quota') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('requests per minute') ||
    errorMessage.includes('GenerateContent request limit')
  );
}
