import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { analyzeImage } from "./api/gemini";
import { extractPartnerHours, formatOCRResult } from "../client/src/lib/formatUtils";
import { calculatePayout } from "../client/src/lib/utils";
import { roundAndCalculateBills } from "../client/src/lib/billCalc";
import { partnerHoursSchema } from "@shared/schema";

// Setup file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export async function registerRoutes(app: Express, skipServer = false): Promise<Server | null> {
  // API routes
  
  // OCR Processing endpoint
  app.post("/api/ocr", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }
      
      // Convert image buffer to base64
      const imageBase64 = req.file.buffer.toString("base64");
      
      // Use Gemini API to analyze the image
      const result = await analyzeImage(imageBase64);
      
      if (!result.text) {
        // Return a specific error message from the API if available
        return res.status(500).json({ 
          error: result.error || "Failed to extract text from image",
          suggestManualEntry: true
        });
      }
      
      // Parse extracted text to get partner hours
      const partnerHours = extractPartnerHours(result.text);
      
      // Format the extracted text for display
      const formattedText = formatOCRResult(result.text);
      
      res.json({
        extractedText: formattedText,
        partnerHours
      });
    } catch (error) {
      console.error("OCR processing error:", error);
      res.status(500).json({ 
        error: "Failed to process the image. Please try manual entry instead.",
        suggestManualEntry: true 
      });
    }
  });
  
  // Calculate tip distribution
  app.post("/api/distributions/calculate", async (req, res) => {
    try {
      const { partnerHours, totalAmount, totalHours, hourlyRate } = req.body;
      
      // Validate partner hours
      try {
        partnerHoursSchema.parse(partnerHours);
      } catch (error) {
        return res.status(400).json({ error: "Invalid partner hours data" });
      }
      
      // Calculate payout for each partner
      const partnerPayouts = partnerHours.map(partner => {
        const payout = calculatePayout(partner.hours, hourlyRate);
        const { rounded, billBreakdown } = roundAndCalculateBills(payout);
        
        return {
          name: partner.name,
          hours: partner.hours,
          payout,
          rounded,
          billBreakdown
        };
      });
      
      const distributionData = {
        totalAmount,
        totalHours,
        hourlyRate,
        partnerPayouts
      };
      
      res.json(distributionData);
    } catch (error) {
      console.error("Distribution calculation error:", error);
      res.status(500).json({ error: "Failed to calculate distribution" });
    }
  });
  
  // Save distribution to history
  app.post("/api/distributions", async (req, res) => {
    try {
      const { totalAmount, totalHours, hourlyRate, partnerData } = req.body;
      
      const distribution = await storage.createDistribution({
        totalAmount,
        totalHours,
        hourlyRate,
        partnerData
      });
      
      res.status(201).json(distribution);
    } catch (error) {
      console.error("Save distribution error:", error);
      res.status(500).json({ error: "Failed to save distribution" });
    }
  });
  
  // Get distribution history
  app.get("/api/distributions", async (req, res) => {
    try {
      const distributions = await storage.getDistributions();
      res.json(distributions);
    } catch (error) {
      console.error("Get distributions error:", error);
      res.status(500).json({ error: "Failed to retrieve distributions" });
    }
  });
  
  // Partners endpoints
  app.post("/api/partners", async (req, res) => {
    try {
      const { name } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: "Partner name is required" });
      }
      
      const partner = await storage.createPartner({ name: name.trim() });
      res.status(201).json(partner);
    } catch (error) {
      console.error("Create partner error:", error);
      res.status(500).json({ error: "Failed to create partner" });
    }
  });
  
  app.get("/api/partners", async (req, res) => {
    try {
      const partners = await storage.getPartners();
      res.json(partners);
    } catch (error) {
      console.error("Get partners error:", error);
      res.status(500).json({ error: "Failed to retrieve partners" });
    }
  });
  
  // Skip HTTP server creation for serverless functions
  if (skipServer) {
    return null;
  }
  
  const httpServer = createServer(app);
  return httpServer;
}
