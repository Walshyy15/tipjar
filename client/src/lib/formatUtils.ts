/**
 * Formats a string of partners and hours from the OCR result into a clean format
 * @param text The raw OCR text
 * @returns Formatted text with each partner on a new line
 */
export function formatOCRResult(text: string): string {
  // If the text already contains line breaks, assume it's already formatted by Gemini API
  if (text.includes('\n')) {
    // Just clean each line
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  }
  
  // For single-line text, try to extract and format partners
  const partners = extractPartnerHours(text);
  
  if (partners.length > 0) {
    return partners.map(p => `${p.name}: ${p.hours}`).join('\n');
  }
  
  // If we couldn't extract partners in a structured way, return the original text
  return text.trim();
}

/**
 * Attempts to extract partner names and hours from the OCR text
 * @param text The OCR text to parse
 * @returns Array of {name, hours} objects
 */
export function extractPartnerHours(text: string): Array<{name: string, hours: number}> {
  if (!text || typeof text !== 'string') return [];
  // Normalize newlines
  text = text.replace(/\r\n?/g, '\n');
  // If the text contains line breaks, process each line separately
  if (text.includes('\n')) {
    const lines = text.split('\n');
    const result: Array<{name: string, hours: number}> = [];
    
    for (const line of lines) {
      if (line.trim()) {
        const lineResult = extractPartnerHoursFromLine(line);
        if (lineResult.name && !isNaN(lineResult.hours)) {
          result.push(lineResult);
        }
      }
    }
    
    return result;
  }
  
  // For single-line text, use the traditional approach and then dedupe
  const items = extractMultiplePartnersFromText(text);
  const map = new Map<string, number>();
  for (const p of items) {
    const key = p.name.replace(/\s+/g, ' ').trim();
    if (!key) continue;
    map.set(key, p.hours);
  }
  return Array.from(map.entries()).map(([name, hours]) => ({ name, hours }));
}

// Extract name and hours from a single formatted line (e.g., "John Smith: 32")
function extractPartnerHoursFromLine(line: string): {name: string, hours: number} {
  line = line.trim();
  
  // Look for a colon separator
  const colonIndex = line.lastIndexOf(':');
  
  if (colonIndex > 0) {
    const name = line.substring(0, colonIndex).trim();
    const hoursText = line.substring(colonIndex + 1).trim();
    const hours = parseFloat(hoursText);
    
    if (name && !isNaN(hours)) {
      return { name, hours };
    }
  }
  
  // Try other patterns if colon format doesn't match
  const patterns = [
    // Pattern: Name - 32
    /^(.+?)\s+-\s+(\d+(?:\.\d+)?)$/,
    // Pattern: Name (32)
    /^(.+?)\s+\((\d+(?:\.\d+)?)\)$/,
    // Last resort - extract name and trailing number
    /^(.+?)\s+(\d+(?:\.\d+)?)$/
  ];
  
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      const name = match[1].trim();
      const hours = parseFloat(match[2]);
      
      if (name && !isNaN(hours)) {
        return { name, hours };
      }
    }
  }
  
  return { name: "", hours: NaN };
}

// Extract multiple partners from a block of text without clear line breaks
function extractMultiplePartnersFromText(text: string): Array<{name: string, hours: number}> {
  const result: Array<{name: string, hours: number}> = [];
  
  // Clean up text
  const cleanedText = text
    .replace(/[•·]\s*/g, '\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
  
  // Different patterns that might appear in schedule images
  const patterns = [
    // Pattern: Name: 32 hours
    /([A-Za-z][A-Za-z\s\.\-']+?)[\s\-:]+(\d+(?:\.\d+)?)\s*(?:hours|hrs?|h)/gi,
    // Pattern: Name (32 hours)
    /([A-Za-z][A-Za-z\s\.\-']+?)\s*\((\d+(?:\.\d+)?)\s*(?:hours|hrs?|h)\)/gi,
    // Pattern: Name - 32 hours
    /([A-Za-z][A-Za-z\s\.\-']+?)\s*-\s*(\d+(?:\.\d+)?)\s*(?:hours|hrs?|h)/gi,
    // Pattern: Name 32h 
    /([A-Za-z][A-Za-z\s\.\-']+?)\s+(\d+(?:\.\d+)?)\s*h(?:\b|ours|rs)/gi,
    // Pattern: Name: 32
    /([A-Za-z][A-Za-z\s\.\-']+?)[\s\-:]+(\d+(?:\.\d+)?)/gi,
    // Last resort - lines with name and a number
    /([A-Za-z][A-Za-z\s\.\-']+?)\s+(\d+(?:\.\d+)?)/gi
  ];
  
  // Try each pattern until we get some results
  for (const pattern of patterns) {
    let matches;
    const tempResults: Array<{name: string, hours: number}> = [];
    
    // Reset regex state
    pattern.lastIndex = 0;
    
    while ((matches = pattern.exec(cleanedText)) !== null) {
      const name = matches[1].trim();
      const hours = parseFloat(matches[2]);
      
      if (name && !isNaN(hours)) {
        tempResults.push({ name, hours });
      }
    }
    
    // If we found any valid matches, use this pattern
    if (tempResults.length > 0) {
      return tempResults;
    }
  }
  
  return result;
}
