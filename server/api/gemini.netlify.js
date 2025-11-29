/**
 * Gemini API integration for Netlify functions with rate limiting
 */

// Import libraries needed for Gemini API
import fetch from 'node-fetch';

// Rate limiting configuration
const RATE_LIMIT = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2
};

// Simple in-memory rate limiter for serverless functions
class RateLimiter {
  constructor(maxRequests = 15, windowMs = 60000) { // 15 requests per minute
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  canMakeRequest() {
    const now = Date.now();
    // Remove requests older than the window
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

// Sleep utility function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Analyzes an image using Google's Gemini API with rate limiting and retry logic
 * @param {string} imageBase64 - Base64 encoded image data
 * @returns {Promise<{text: string|null, error: string|null}>} - Extracted text or error
 */
export async function analyzeImage(imageBase64) {
  // Check rate limit before making request
  if (!rateLimiter.canMakeRequest()) {
    const waitTime = rateLimiter.getTimeUntilNextRequest();
    return {
      text: null,
      error: `Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds before uploading another image.`
    };
  }

  for (let attempt = 0; attempt <= RATE_LIMIT.maxRetries; attempt++) {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        console.error("No Gemini API key provided");
        return { text: null, error: "API key missing. Please configure the Gemini API key in environment variables." };
      }
      
      // Google Gemini API endpoint - Updated to use Gemini 1.5 Flash
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
      // Construct the request body with the image and prompt
      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: `
                  Extract ALL TEXT from this image first. Then identify and extract ALL partner names and their tippable hours from the text.
                  
                  Look for patterns indicating partner names followed by hours, such as:
                  - "Name: X hours" or "Name: Xh"
                  - "Name - X hours"
                  - "Name (X hours)"
                  - Any text that includes names with numeric values that could represent hours
                  
                  Return EACH partner's full name followed by their hours, with one partner per line.
                  Format the output exactly like this:
                  John Smith: 32
                  Maria Garcia: 24.5
                  Alex Johnson: 18.75
                  
                  Make sure to include ALL partners mentioned in the image, not just the first one.
                  If hours are not explicitly labeled, look for numeric values near names that could represent hours.
                `
              },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: imageBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 2048,
        }
      };
      
      // Make the API call
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      // Parse the response
      const responseData = await response.json();
      
      if (!response.ok) {
        let shouldRetry = false;
        let errorMessage = responseData.error?.message || "Error processing image with Gemini API";
        
        // Check if this is a rate limit error that we should retry
        if (response.status === 429 || 
            errorMessage.includes('quota') || 
            errorMessage.includes('rate limit') ||
            errorMessage.includes('requests per minute')) {
          shouldRetry = true;
        }
        
        // If this is a rate limit error and we have retries left, wait and retry
        if (shouldRetry && attempt < RATE_LIMIT.maxRetries) {
          const delay = Math.min(
            RATE_LIMIT.baseDelay * Math.pow(RATE_LIMIT.backoffMultiplier, attempt),
            RATE_LIMIT.maxDelay
          );
          console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${RATE_LIMIT.maxRetries + 1})`);
          await sleep(delay);
          continue; // Retry the request
        }
        
        console.error("Gemini API error:", responseData);
        return { 
          text: null, 
          error: errorMessage
        };
      }
      
      // Extract text from Gemini response
      const extractedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!extractedText) {
        return { text: null, error: "No text extracted from image" };
      }
      
      return { text: extractedText, error: null };
      
    } catch (error) {
      // If this is the last attempt, return the error
      if (attempt === RATE_LIMIT.maxRetries) {
        console.error("Gemini API error (final attempt):", error);
        return { 
          text: null, 
          error: error.message || "Failed to process image with Gemini API"
        };
      }
      
      // For network errors, wait and retry
      const delay = Math.min(
        RATE_LIMIT.baseDelay * Math.pow(RATE_LIMIT.backoffMultiplier, attempt),
        RATE_LIMIT.maxDelay
      );
      console.log(`Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${RATE_LIMIT.maxRetries + 1}):`, error);
      await sleep(delay);
    }
  }
  
  // This should never be reached, but just in case
  return { 
    text: null,
    error: "Maximum retry attempts exceeded."
  };
}