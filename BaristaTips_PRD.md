# 📘 Product Requirements Document (PRD)

## Product: BaristaTips

## Version: 1.1

## Owner: Walshe

## Status: Ready for Build

## 1. Overview

### 1.1 Product Summary

BaristaTips is a web application for calculating and visualizing partner
tip distributions. It:

-   Accepts uploaded partner-hours reports\
-   Uses **Azure Document Intelligence** to extract names, hours, and
    totals\
-   Calculates tip amounts and bill breakdowns\
-   Presents everything in a **Starbucks-themed UI**, similar to the
    provided TipJar mockups but more polished and feature-complete.

### 1.2 Problem Statement

Tip calculations are currently manual, error-prone, and time-consuming.
There is no standardized, visually clear tool for:

-   Extracting hours from shift reports\
-   Calculating tips accurately\
-   Breaking down bills\
-   Printing or saving a clear visual summary

### 1.3 Solution Summary

BaristaTips provides an end-to-end flow:

1.  Upload partner-hours report (PDF/image).\
2.  Azure Document Intelligence extracts structured data.\
3.  App calculates per-partner tips and optimal bill combinations.\
4.  UI shows partner cards, totals, and bill requirements in a
    **dashboard matching and improving the attached design**.\
5.  Result can be printed or saved.

## 2. Goals & Success Metrics

### 2.1 Goals

-   Automate tip distribution from uploaded reports.\
-   Provide a clear, modern UI that **looks like an upgraded version of
    the attached TipJar UI**.\
-   Reduce time to complete tip distribution.\
-   Ensure high accuracy of calculations and OCR extraction.

### 2.2 Success Metrics

  Metric                             Target
  ---------------------------------- ----------------
  OCR extraction accuracy            ≥ 98%
  Time from upload → final output    \< 2 minutes
  Visual clarity rating (UX tests)   ≥ 4.5 / 5
  Page load time (Vercel)            \< 1.5 seconds

## 3. Functional Requirements

### 4.1 OCR & Parsing (Azure Document Intelligence)

-   Accept PDF, JPG, PNG, GIF uploads\
-   File sent to API → Azure Document Intelligence\
-   Extract partner name, hours worked, total hours\
-   Editable extracted values in UI

### 4.2 Tip Calculation

-   Currency input for Total Tips\
-   Calculates hourly rate and per-partner payouts\
-   Rounding rules\
-   Summary panel for totals

### 4.3 Partner Cards View

-   Partner cards display name, tip, hours, formula, and bill breakdown\
-   Responsive grid layout\
-   Starbucks-themed design

### 4.4 Bill Denominations

-   Inputs for \$1, \$5, \$10, \$20 (and optionally \$50, \$100)\
-   Calculate optimal bill combinations\
-   Total Bill Summary section

### 4.5 Output & Reporting

-   Print-friendly layout\
-   Save to localStorage\
-   Exportable

### 4.6 UI/UX & Visual Design

-   TailwindCSS Starbucks theme\
-   Responsive layout\
-   Desktop and mobile variations

## 5. Non-Functional Requirements

-   Next.js + TypeScript\
-   TailwindCSS\
-   Hosted on Vercel\
-   OCR \< 3 sec\
-   Secure API keys

## 6. Technical Architecture

Frontend: Next.js (App Router), TailwindCSS\
Backend: API Routes → Azure OCR\
Hosting: Vercel\
Storage: LocalStorage

## 7. Risks & Mitigations

-   OCR errors → editable fields\
-   Bill edge cases → adjustment UI\
-   Mobile layout → responsive design

## 8. Future Enhancements

-   Cloud storage\
-   Multi-store support\
-   CSV/Excel export
