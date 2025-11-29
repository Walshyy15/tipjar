# Rate Limiting Solution for Gemini API

This document explains the rate limiting implementation to prevent "Quota exceeded" errors when using the Google Gemini API.

## Problem
The error "Quota exceeded for quota metric 'Generate Content API requests per minute'" occurs when your application exceeds Google's API rate limits, which are typically:
- 15 requests per minute for free tier
- 1500 requests per day for free tier

## Solution Implemented

### 1. Client-Side Rate Limiting
- **In-memory rate limiter**: Tracks requests per minute to prevent exceeding limits
- **Configurable limits**: Default 15 requests per minute (adjustable in `server/config/rate-limit.ts`)
- **User feedback**: Clear error messages when rate limits are hit

### 2. Retry Logic with Exponential Backoff
- **Automatic retries**: Up to 3 retry attempts for rate limit errors
- **Exponential backoff**: Delays increase exponentially (1s, 2s, 4s, etc.)
- **Maximum delay**: Capped at 30 seconds to prevent excessive waiting

### 3. Error Detection and Handling
- **Smart error detection**: Identifies rate limit errors by status codes and error messages
- **User-friendly messages**: Converts technical errors into actionable user guidance
- **Graceful degradation**: Provides manual entry option when OCR fails

## Configuration

Edit `server/config/rate-limit.ts` to adjust settings:

```typescript
export const GEMINI_RATE_LIMIT_CONFIG = {
  maxRequests: 15,        // Requests per minute
  windowMs: 60 * 1000,    // Time window (1 minute)
  maxRetries: 3,          // Retry attempts
  baseDelay: 1000,        // Initial delay (1 second)
  maxDelay: 30000,        // Maximum delay (30 seconds)
  backoffMultiplier: 2    // Delay multiplier
};
```

## How It Works

1. **Request Tracking**: Each API call is tracked with a timestamp
2. **Rate Check**: Before making a request, check if limit is exceeded
3. **Retry on Failure**: If rate limited, wait and retry with exponential backoff
4. **User Feedback**: Show clear messages about wait times and retry status

## Benefits

- **Prevents quota errors**: Proactive rate limiting prevents API rejections
- **Better user experience**: Clear feedback instead of cryptic error messages
- **Automatic recovery**: Retries handle temporary rate limit issues
- **Configurable**: Easy to adjust limits based on your API tier

## Monitoring

Check server logs for rate limiting activity:
- `Rate limit hit, retrying in Xms` - Automatic retry in progress
- `Network error, retrying in Xms` - Network issue retry
- Rate limit status in console during development

## Upgrading API Limits

To handle more requests:
1. Upgrade your Google Cloud project to a paid tier
2. Increase quotas in Google Cloud Console
3. Update `maxRequests` in the configuration file
4. Consider implementing Redis-based rate limiting for multiple server instances