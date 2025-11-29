// netlify/functions/api.js
import express from "express";
import serverless from "serverless-http";
import multer from "multer";

// server/storage.ts
var MemStorage = class {
  users;
  partners;
  distributions;
  userId;
  partnerId;
  distributionId;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.partners = /* @__PURE__ */ new Map();
    this.distributions = /* @__PURE__ */ new Map();
    this.userId = 1;
    this.partnerId = 1;
    this.distributionId = 1;
  }
  // User methods
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByUsername(username) {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }
  async createUser(insertUser) {
    const id = this.userId++;
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  // Partner methods
  async getPartner(id) {
    return this.partners.get(id);
  }
  async getPartners() {
    return Array.from(this.partners.values());
  }
  async createPartner(insertPartner) {
    const id = this.partnerId++;
    const partner = { ...insertPartner, id };
    this.partners.set(id, partner);
    return partner;
  }
  // Distribution methods
  async getDistribution(id) {
    return this.distributions.get(id);
  }
  async getDistributions() {
    return Array.from(this.distributions.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
  async createDistribution(insertDistribution) {
    const id = this.distributionId++;
    const distribution = {
      ...insertDistribution,
      id,
      date: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.distributions.set(id, distribution);
    return distribution;
  }
};
var storage = new MemStorage();

// server/api/gemini.netlify.js
import fetch from "node-fetch";
async function analyzeImage(imageBase64) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("No Gemini API key provided");
      return { text: null, error: "API key missing. Please configure the Gemini API key in environment variables." };
    }
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${apiKey}`;
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: "Extract and format all text from this image. Focus on any tabular data listing names and hours. Format as plain text."
            },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: imageBase64
              }
            }
          ]
        }
      ]
    };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
    const responseData = await response.json();
    if (!response.ok) {
      console.error("Gemini API error:", responseData);
      return {
        text: null,
        error: responseData.error?.message || "Error processing image with Gemini API"
      };
    }
    const extractedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!extractedText) {
      return { text: null, error: "No text extracted from image" };
    }
    return { text: extractedText, error: null };
  } catch (error) {
    console.error("Gemini API error:", error);
    return {
      text: null,
      error: error.message || "Failed to process image with Gemini API"
    };
  }
}

// client/src/lib/formatUtils.ts
function formatOCRResult(text2) {
  if (text2.includes("\n")) {
    return text2.split("\n").map((line) => line.trim()).filter((line) => line.length > 0).join("\n");
  }
  const partners2 = extractPartnerHours(text2);
  if (partners2.length > 0) {
    return partners2.map((p) => `${p.name}: ${p.hours}`).join("\n");
  }
  return text2.trim();
}
function extractPartnerHours(text2) {
  if (text2.includes("\n")) {
    const lines = text2.split("\n");
    const result = [];
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
  return extractMultiplePartnersFromText(text2);
}
function extractPartnerHoursFromLine(line) {
  line = line.trim();
  const colonIndex = line.lastIndexOf(":");
  if (colonIndex > 0) {
    const name = line.substring(0, colonIndex).trim();
    const hoursText = line.substring(colonIndex + 1).trim();
    const hours = parseFloat(hoursText);
    if (name && !isNaN(hours)) {
      return { name, hours };
    }
  }
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
function extractMultiplePartnersFromText(text2) {
  const result = [];
  const cleanedText = text2.replace(/\s+/g, " ").trim();
  const patterns = [
    // Pattern: Name: 32 hours
    /([A-Za-z\s]+)[\s\-:]+(\d+(?:\.\d+)?)\s*(?:hours|hrs?|h)/gi,
    // Pattern: Name (32 hours)
    /([A-Za-z\s]+)\s*\((\d+(?:\.\d+)?)\s*(?:hours|hrs?|h)\)/gi,
    // Pattern: Name - 32 hours
    /([A-Za-z\s]+)\s*-\s*(\d+(?:\.\d+)?)\s*(?:hours|hrs?|h)/gi,
    // Pattern: Name 32h 
    /([A-Za-z\s]+)\s+(\d+(?:\.\d+)?)\s*h(?:\b|ours|rs)/gi,
    // Pattern: Name: 32
    /([A-Za-z\s]+)[\s\-:]+(\d+(?:\.\d+)?)/gi,
    // Last resort - lines with name and a number
    /([A-Za-z\s\.]+)\s+(\d+(?:\.\d+)?)/gi
  ];
  for (const pattern of patterns) {
    let matches;
    const tempResults = [];
    pattern.lastIndex = 0;
    while ((matches = pattern.exec(cleanedText)) !== null) {
      const name = matches[1].trim();
      const hours = parseFloat(matches[2]);
      if (name && !isNaN(hours)) {
        tempResults.push({ name, hours });
      }
    }
    if (tempResults.length > 0) {
      return tempResults;
    }
  }
  return result;
}

// client/src/lib/utils.ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
function roundToNearestDollar(amount) {
  return Math.round(amount);
}
var calculatePayout = (hours, hourlyRate) => {
  return hours * hourlyRate;
};

// client/src/lib/billCalc.ts
var DENOMINATIONS = [20, 10, 5, 1];
function calculateBillBreakdown(amount) {
  const roundedAmount = roundToNearestDollar(amount);
  let remaining = roundedAmount;
  const breakdown = [];
  for (const denom of DENOMINATIONS) {
    if (remaining >= denom) {
      const quantity = Math.floor(remaining / denom);
      breakdown.push({
        denomination: denom,
        quantity
      });
      remaining -= denom * quantity;
    }
  }
  return breakdown;
}
function roundAndCalculateBills(payout) {
  const rounded = roundToNearestDollar(payout);
  const billBreakdown = calculateBillBreakdown(rounded);
  return {
    rounded,
    billBreakdown
  };
}

// shared/schema.ts
import { pgTable, text, serial, timestamp, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull()
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true
});
var partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull()
});
var insertPartnerSchema = createInsertSchema(partners).pick({
  name: true
});
var distributions = pgTable("distributions", {
  id: serial("id").primaryKey(),
  date: timestamp("date", { withTimezone: true }).defaultNow().notNull(),
  totalAmount: real("total_amount").notNull(),
  totalHours: real("total_hours").notNull(),
  hourlyRate: real("hourly_rate").notNull(),
  partnerData: jsonb("partner_data").notNull()
});
var insertDistributionSchema = createInsertSchema(distributions).pick({
  totalAmount: true,
  totalHours: true,
  hourlyRate: true,
  partnerData: true
});
var partnerHoursSchema = z.array(
  z.object({
    name: z.string().min(1, "Partner name is required"),
    hours: z.number().positive("Hours must be positive")
  })
);

// netlify/functions/api.js
var app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
var upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
    // 10MB limit
  }
});
app.post("/api/ocr", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }
    const imageBase64 = req.file.buffer.toString("base64");
    const result = await analyzeImage(imageBase64);
    if (!result.text) {
      return res.status(500).json({
        error: result.error || "Failed to extract text from image",
        suggestManualEntry: true
      });
    }
    const partnerHours = extractPartnerHours(result.text);
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
app.post("/api/distributions/calculate", async (req, res) => {
  try {
    const { partnerHours, totalAmount, totalHours, hourlyRate } = req.body;
    try {
      partnerHoursSchema.parse(partnerHours);
    } catch (error) {
      return res.status(400).json({ error: "Invalid partner hours data" });
    }
    const partnerPayouts = partnerHours.map((partner) => {
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
app.get("/api/distributions", async (req, res) => {
  try {
    const distributions2 = await storage.getDistributions();
    res.json(distributions2);
  } catch (error) {
    console.error("Get distributions error:", error);
    res.status(500).json({ error: "Failed to retrieve distributions" });
  }
});
app.post("/api/partners", async (req, res) => {
  try {
    const { name } = req.body;
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
app.get("/api/partners", async (req, res) => {
  try {
    const partners2 = await storage.getPartners();
    res.json(partners2);
  } catch (error) {
    console.error("Get partners error:", error);
    res.status(500).json({ error: "Failed to retrieve partners" });
  }
});
var handler = serverless(app);
export {
  handler
};
