import express from "express";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const app = express();

app.get("/render-image", async (req, res) => {
  const { url, width = 533, height = 690 } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required" });
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0" });
    await page.setViewport({ width: Number(width), height: Number(height) });

    const filename = `screenshot-${Date.now()}.png`;
    const filepath = path.join("screenshots", filename);

    if (!fs.existsSync("screenshots")) fs.mkdirSync("screenshots");

    await page.screenshot({ path: filepath });
    await browser.close();

    res.json({
      success: true,
      url: `${req.protocol}://${req.get("host")}/htmltoimage/screenshots/${filename}`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use("/screenshots", express.static("screenshots"));

app.listen(8000, () => console.log("🚀 API running on port 8000"));
