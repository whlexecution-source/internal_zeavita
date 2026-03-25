# Deployment Guide

## Part 1: Deploy the Web App

This application is a static React app.

1.  **Build**: `npm run build`
2.  **Deploy**: Drag the `dist` folder to [Netlify Drop](https://app.netlify.com/drop).
3.  **URL**: You will get a public URL for your web app.

## Part 2: Setup Google Sheets Automation (Required for "Auto Sync")

To enable the "Auto Sync" button to write to your Google Sheet without logging in every time:

1.  Open your Google Sheet: `https://docs.google.com/spreadsheets/d/11loA9lb22W__409KQPT1dUfhzjdy0CqNzCMjtc0t-T0`
2.  Go to **Extensions** > **Apps Script**.
3.  Delete any code in `Code.gs` and paste the code from `APPS_SCRIPT.md` (included in this project).
4.  Click **Deploy** (Blue button top right) > **New Deployment**.
5.  **Select type**: "Web app".
6.  **Configuration**:
    *   **Description**: "ETL Sync"
    *   **Execute as**: **Me** (your email).
    *   **Who has access**: **Anyone** (This is crucial so the React app can talk to it).
7.  Click **Deploy**.
8.  **Copy the "Web App URL"**. (It looks like `https://script.google.com/macros/s/.../exec`).
9.  Open the Zeavita ETL Web App.
10. Click the **Settings (Gear Icon)** in the top right.
11. Paste the Web App URL and click **Save**.

Now you can click **"Auto Sync to Sheet"** and the data will be intelligently merged (New rows appended, existing rows updated).
