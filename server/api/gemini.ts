// Gemini API implementation
import fetch from 'node-fetch';
import { GEMINI_RATE_LIMIT_CONFIG, isRateLimitError } from '../config/rate-limit';

// Simple in-memory rate limiter
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = GEMINI_RATE_LIMIT_CONFIG.maxRequests, windowMs: number = GEMINI_RATE_LIMIT_CONFIG.windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    // Remove requests older than the window
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

// Sleep utility function
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface GeminiResponse {
  candidates: {
    content: {
      parts: {
        text?: string;
      }[];
    };
  }[];
}

interface GeminiError {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  }
}

/**
 * Analyze an image using Google Gemini API to extract text with rate limiting and retry logic
 * @param imageBase64 The base64-encoded image data
 * @returns An object with extracted text or error details
 */
type Provider = "gemini" | "azure-openai" | "azure-vision";

interface AzureOptions {
  endpoint?: string;
  apiKey?: string;
  deployment?: string;
  apiVersion?: string;
}

interface AzureVisionOptions {
  endpoint?: string;
  apiKey?: string;
  apiVersion?: string;
}

interface AnalyzeOptions {
  provider?: Provider;
  azure?: AzureOptions;
  azureVision?: AzureVisionOptions;
}

export async function analyzeImage(
  imageBase64: string,
  mimeType: string = "image/jpeg",
  apiKey?: string,
  options?: AnalyzeOptions
): Promise<{ text: string | null; error?: string }> {
  // Check rate limit before making request
  if (!rateLimiter.canMakeRequest()) {
    const waitTime = rateLimiter.getTimeUntilNextRequest();
    return {
      text: null,
      error: GEMINI_RATE_LIMIT_CONFIG.messages.rateLimitExceeded(waitTime)
    };
  }

  const provider: Provider = (options?.provider || (process.env.OCR_PROVIDER as Provider) || "gemini");

  for (let attempt = 0; attempt <= GEMINI_RATE_LIMIT_CONFIG.maxRetries; attempt++) {
    try {
      const promptText = `
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
    `;

      if (provider === "azure-openai") {
        const endpoint = options?.azure?.endpoint || process.env.AZURE_OPENAI_ENDPOINT || "";
        const deployment = options?.azure?.deployment || process.env.AZURE_OPENAI_DEPLOYMENT || "";
        const azureKey = options?.azure?.apiKey || apiKey || process.env.AZURE_OPENAI_API_KEY || "";
        const apiVersion = options?.azure?.apiVersion || process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview";

        if (!endpoint || !deployment || !azureKey) {
          return {
            text: null,
            error: "Azure OpenAI configuration missing (endpoint/deployment/api key).",
          };
        }

        const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

        const payload = {
          messages: [
            { role: "system", content: "You are an OCR and parsing assistant. Return only the extracted text and partner lines." },
            {
              role: "user",
              content: [
                { type: "text", text: promptText },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 2048,
          top_p: 0.8,
        };

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": azureKey,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Azure OpenAI API error:", response.status, errorText);
          return { text: null, error: `API Error (${response.status}): Failed to call Azure OpenAI` };
        }

        const data = await response.json() as any;
        const content = data?.choices?.[0]?.message?.content;
        let extracted = "";
        if (Array.isArray(content)) {
          extracted = content.map((c: any) => c?.text).filter(Boolean).join("\n");
        } else if (typeof content === "string") {
          extracted = content;
        }

        if (!extracted) {
          return { text: null, error: "No text extracted from the image. Try a clearer image or manual entry." };
        }

        return { text: extracted };
      } else if (provider === "azure-vision") {
        // Azure Computer Vision Read API
        const endpoint = options?.azureVision?.endpoint || process.env.AZURE_VISION_ENDPOINT || "";
        const visionKey = options?.azureVision?.apiKey || apiKey || process.env.AZURE_VISION_API_KEY || "";
        const apiVersion = options?.azureVision?.apiVersion || process.env.AZURE_VISION_API_VERSION || "2023-02-01-preview";

        if (!endpoint || !visionKey) {
          return {
            text: null,
            error: "Azure Vision configuration missing (endpoint/api key).",
          };
        }

        // Step 1: Submit image for analysis
        const analyzeUrl = `${endpoint.replace(/\/$/, "")}/vision/v3.2/read/analyze?api-version=${apiVersion}`;
        
        const analyzeResponse = await fetch(analyzeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "Ocp-Apim-Subscription-Key": visionKey,
          },
          body: Buffer.from(imageBase64, 'base64'),
        });

        if (!analyzeResponse.ok) {
          const errorText = await analyzeResponse.text();
          console.error("Azure Vision API error:", analyzeResponse.status, errorText);
          return { text: null, error: `API Error (${analyzeResponse.status}): Failed to call Azure Vision` };
        }

        // Get operation location from response headers
        const operationLocation = analyzeResponse.headers.get('Operation-Location');
        if (!operationLocation) {
          return { text: null, error: "Azure Vision: No operation location returned" };
        }

        // Step 2: Poll for results
        let resultResponse;
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds max wait
        
        do {
          await sleep(1000); // Wait 1 second between polls
          attempts++;
          
          resultResponse = await fetch(operationLocation, {
            headers: {
              "Ocp-Apim-Subscription-Key": visionKey,
            },
          });

          if (!resultResponse.ok) {
            const errorText = await resultResponse.text();
            console.error("Azure Vision result error:", resultResponse.status, errorText);
            return { text: null, error: `Failed to get OCR results: ${resultResponse.status}` };
          }

          const result = await resultResponse.json() as any;
          
          if (result.status === "succeeded") {
            // Extract text from read results
            const pages = result.analyzeResult?.readResults || [];
            let extractedText = "";
            
            for (const page of pages) {
              for (const line of page.lines || []) {
                extractedText += line.text + "\n";
              }
            }

            if (!extractedText.trim()) {
              return { text: null, error: "No text extracted from the image. Try a clearer image or manual entry." };
            }

            return { text: extractedText.trim() };
          } else if (result.status === "failed") {
            return { text: null, error: "Azure Vision OCR failed to process the image." };
          }
          
          // Status is still "running" or "notStarted", continue polling
        } while (attempts < maxAttempts);

        return { text: null, error: "Azure Vision OCR timed out. Please try again." };
      } else {
        // Default: Google Gemini
        const geminiKey = apiKey || process.env.GEMINI_API_KEY || "";
        if (!geminiKey) {
          console.error("No Gemini API key provided");
          return {
            text: null,
            error: "API key missing. Please configure the Gemini API key.",
          };
        }

        const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

        const requestBody = {
          contents: [
            {
              parts: [
                {
                  text: promptText,
                },
                {
                  inline_data: {
                    mime_type: mimeType || "image/jpeg",
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 2048,
          },
        };

        const response = await fetch(`${apiUrl}?key=${geminiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Failed to call Gemini API";
        let shouldRetry = false;
        
        try {
          const errorData = JSON.parse(errorText) as GeminiError;
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
            // Hide the API key if it's in the error message
            errorMessage = errorMessage.replace(/api_key:[a-zA-Z0-9-_]+/, "api_key:[REDACTED]");
            
            // Check if this is a rate limit error that we should retry
            shouldRetry = isRateLimitError(errorData.error);
          }
        } catch (e) {
          // If error parsing fails, check status code for rate limiting
          shouldRetry = isRateLimitError({ code: response.status });
        }
        
        // If this is a rate limit error and we have retries left, wait and retry
        if (shouldRetry && attempt < GEMINI_RATE_LIMIT_CONFIG.maxRetries) {
          const delay = Math.min(
            GEMINI_RATE_LIMIT_CONFIG.baseDelay * Math.pow(GEMINI_RATE_LIMIT_CONFIG.backoffMultiplier, attempt),
            GEMINI_RATE_LIMIT_CONFIG.maxDelay
          );
          console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${GEMINI_RATE_LIMIT_CONFIG.maxRetries + 1})`);
          await sleep(delay);
          continue; // Retry the request
        }
        
        console.error("Gemini API error:", response.status, errorText);
        
        // Provide user-friendly error messages for quota issues
        if (isRateLimitError({ code: response.status, message: errorMessage })) {
          return { 
            text: null, 
            error: GEMINI_RATE_LIMIT_CONFIG.messages.quotaExceeded
          };
        }
        
        return { 
          text: null, 
          error: `API Error (${response.status}): ${errorMessage}`
        };
      }
    
        const data = await response.json() as GeminiResponse;
        
        if (!data.candidates || data.candidates.length === 0) {
          console.error("No candidates in Gemini response");
          return { 
            text: null,
            error: "No text extracted from the image. Try a clearer image or manual entry."
          };
        }
        
        const extractedText = data.candidates[0].content.parts
          .map(part => part.text)
          .filter(Boolean)
          .join("\n");
        
        if (!extractedText) {
          return { 
            text: null,
            error: "No text extracted from the image. Try a clearer image or manual entry."
          };
        }
        
        return { text: extractedText };
      }
      
    } catch (error) {
      // If this is the last attempt, return the error
      if (attempt === GEMINI_RATE_LIMIT_CONFIG.maxRetries) {
        console.error("Error calling Gemini API (final attempt):", error);
        return { 
          text: null,
          error: "An unexpected error occurred while processing the image."
        };
      }
      
      // For network errors, wait and retry
      const delay = Math.min(
        GEMINI_RATE_LIMIT_CONFIG.baseDelay * Math.pow(GEMINI_RATE_LIMIT_CONFIG.backoffMultiplier, attempt),
        GEMINI_RATE_LIMIT_CONFIG.maxDelay
      );
      console.log(`Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${GEMINI_RATE_LIMIT_CONFIG.maxRetries + 1}):`, error);
      await sleep(delay);
    }
  }
  
  // This should never be reached, but just in case
  return { 
    text: null,
    error: GEMINI_RATE_LIMIT_CONFIG.messages.maxRetriesExceeded
  };
}