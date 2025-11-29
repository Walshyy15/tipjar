import express from "express";
import serverless from "serverless-http";
import multer from "multer";
import { storage } from "../server/storage";
import { analyzeImage } from "../server/api/gemini";
import { extractPartnerHours, formatOCRResult } from "../client/src/lib/formatUtils";
import { calculatePayout } from "../client/src/lib/utils";
import { roundAndCalculateBills } from "../client/src/lib/billCalc";
import { partnerHoursSchema } from "../shared/schema";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

app.post("/api/ocr", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }
    const imageBase64 = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype || "image/jpeg";
    const userGeminiKey = (req.headers["x-gemini-key"] as string) || undefined;
    const provider = (req.headers["x-ocr-provider"] as string) as any; // "gemini" | "azure-openai"
    const azure = {
      endpoint: (req.headers["x-azure-endpoint"] as string) || undefined,
      apiKey: (req.headers["x-azure-key"] as string) || undefined,
      deployment: (req.headers["x-azure-deployment"] as string) || undefined,
      apiVersion: (req.headers["x-azure-api-version"] as string) || undefined,
    };
    const azureVision = {
      endpoint: (req.headers["x-azure-vision-endpoint"] as string) || undefined,
      apiKey: (req.headers["x-azure-vision-key"] as string) || undefined,
      apiVersion: (req.headers["x-azure-vision-api-version"] as string) || undefined,
    };
    const result = await analyzeImage(imageBase64, mimeType, userGeminiKey, { provider, azure, azureVision });
    if (!result.text) {
      return res.status(500).json({
        error: result.error || "Failed to extract text from image",
        suggestManualEntry: true,
      });
    }
    const partnerHours = extractPartnerHours(result.text);
    const formattedText = formatOCRResult(result.text);
    res.json({ extractedText: formattedText, partnerHours });
  } catch (error) {
    console.error("OCR processing error:", error);
    res.status(500).json({
      error: "Failed to process the image. Please try manual entry instead.",
      suggestManualEntry: true,
    });
  }
});

app.post("/api/distributions/calculate", async (req, res) => {
  try {
    const { partnerHours, totalAmount, totalHours, hourlyRate } = req.body ?? {};
    try {
      partnerHoursSchema.parse(partnerHours);
    } catch {
      return res.status(400).json({ error: "Invalid partner hours data" });
    }
    const partnerPayouts = partnerHours.map((partner: { name: string; hours: number }) => {
      const payout = calculatePayout(partner.hours, hourlyRate);
      const { rounded, billBreakdown } = roundAndCalculateBills(payout);
      return { name: partner.name, hours: partner.hours, payout, rounded, billBreakdown };
    });
    res.json({ totalAmount, totalHours, hourlyRate, partnerPayouts });
  } catch (error) {
    console.error("Distribution calculation error:", error);
    res.status(500).json({ error: "Failed to calculate distribution" });
  }
});

app.post("/api/distributions", async (req, res) => {
  try {
    const { totalAmount, totalHours, hourlyRate, partnerData } = req.body ?? {};
    const distribution = await storage.createDistribution({ totalAmount, totalHours, hourlyRate, partnerData });
    res.status(201).json(distribution);
  } catch (error) {
    console.error("Save distribution error:", error);
    res.status(500).json({ error: "Failed to save distribution" });
  }
});

app.get("/api/distributions", async (_req, res) => {
  try {
    const distributions = await storage.getDistributions();
    res.json(distributions);
  } catch (error) {
    console.error("Get distributions error:", error);
    res.status(500).json({ error: "Failed to retrieve distributions" });
  }
});

app.post("/api/partners", async (req, res) => {
  try {
    const { name } = req.body ?? {};
    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Partner name is required" });
    }
    const partner = await storage.createPartner({ name: name.trim() });
    res.status(201).json(partner);
  } catch (error) {
    console.error("Create partner error:", error);
    res.status(500).json({ error: "Failed to create partner" });
  }
});

app.get("/api/partners", async (_req, res) => {
  try {
    const partners = await storage.getPartners();
    res.json(partners);
  } catch (error) {
    console.error("Get partners error:", error);
    res.status(500).json({ error: "Failed to retrieve partners" });
  }
});

export default serverless(app);


