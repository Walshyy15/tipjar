# Deploying to Netlify

This document provides instructions for deploying the TipJarPro application to Netlify.

## Prerequisites

- A Netlify account
- A Gemini API key

## Deployment Steps

### 1. Set Up Environment Variables

Before deploying, you'll need to set up the following environment variables in Netlify:

- `GEMINI_API_KEY`: Your Google Gemini API key for OCR functionality
- `SESSION_SECRET`: A secure random string for session encryption

To set these up:
1. Go to your Netlify site
2. Navigate to Site settings > Environment variables
3. Add each variable and its value

### 2. Connect Repository

1. Log in to Netlify
2. Click "New site from Git"
3. Select your Git provider (GitHub, GitLab, BitBucket)
4. Select the TipJarPro repository
5. Use the following build settings:
   - Build command: `npm run build:netlify`
   - Publish directory: `dist/public`

### 3. Deploy

Once connected, Netlify will automatically deploy your site. You can trigger manual deploys from the Netlify dashboard.

### 4. Check Functions

After deployment, verify that the serverless functions are working by checking:
- `https://your-site-name.netlify.app/.netlify/functions/api/partners`

## Troubleshooting

If you encounter issues with the API endpoints:
1. Check the Function logs in the Netlify dashboard
2. Verify that environment variables are correctly set
3. Ensure API routes are properly configured

## Local Testing

To test the Netlify functions locally before deploying:

1. Install the Netlify CLI: `npm install -g netlify-cli`
2. Run `netlify dev` to start the local development server with functions support 