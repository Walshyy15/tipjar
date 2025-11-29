/**
 * API client helper for TipJarPro
 * Automatically handles Netlify functions in production environment
 */

// Base API URL - automatically adjusts for Netlify environment
const getBaseUrl = () => {
  // In production on Netlify, use the functions path
  if (import.meta.env.PROD) {
    return '/.netlify/functions/api';
  }
  // In development, use the local server
  return '/api';
};

/**
 * Makes an API request with proper error handling
 * @param {string} endpoint - API endpoint path
 * @param {Object} options - Fetch options
 * @returns {Promise<any>} - API response
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${getBaseUrl()}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }
    
    return data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

/**
 * Uploads an image for OCR processing
 * @param {File} imageFile - Image file to upload
 * @returns {Promise<Object>} OCR results
 */
export async function uploadImageForOcr(imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);
  
  const response = await fetch(`${getBaseUrl()}/ocr`, {
    method: 'POST',
    body: formData,
  });
  
  return response.json();
}

/**
 * Calculates tip distribution
 * @param {Object} distributionData - Distribution data
 * @returns {Promise<Object>} Calculation results
 */
export async function calculateDistribution(distributionData) {
  return apiRequest('/distributions/calculate', {
    method: 'POST',
    body: JSON.stringify(distributionData),
  });
}

/**
 * Saves a distribution
 * @param {Object} distribution - Distribution to save
 * @returns {Promise<Object>} Saved distribution
 */
export async function saveDistribution(distribution) {
  return apiRequest('/distributions', {
    method: 'POST',
    body: JSON.stringify(distribution),
  });
}

/**
 * Gets all distributions
 * @returns {Promise<Array>} List of distributions
 */
export async function getDistributions() {
  return apiRequest('/distributions');
}

/**
 * Gets all partners
 * @returns {Promise<Array>} List of partners
 */
export async function getPartners() {
  return apiRequest('/partners');
}

/**
 * Creates a new partner
 * @param {string} name - Partner name
 * @returns {Promise<Object>} Created partner
 */
export async function createPartner(name) {
  return apiRequest('/partners', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
} 