const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5001; // ← Render 用に PORT を process.env.PORT に変更

app.use(cors());
app.use(express.json());

// 📂 uploads/ ディレクトリの存在確認と作成
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// .webmで保存（Whisper対応）
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}.webm`);
  }
});
const upload = multer({ storage });

// 🔊 音声→テキスト→構造化
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    const audioFilePath = req.file.path;
    const audioFile = fs.createReadStream(audioFilePath);

    const formData = new FormData();
    formData.append("file", audioFile);
    formData.append("model", "whisper-1");

    const response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...formData.getHeaders(),
        },
      }
    );

    const text = response.data.text;
    console.log("📝 認識結果:", text);

    const matches = [...text.matchAll(/(.+?)(\d{1,4})個/g)];
    const parsed = matches.map(match => ({
      item: match[1].replace(/[、。・]/g, "").trim(),
      quantity: parseInt(match[2])
    }));

    fs.unlinkSync(audioFilePath);

    res.json({ text, parsed });
  } catch (error) {
    console.error("Whisper API error:", error.response?.data || error.message);
    res.status(500).json({ error: "Whisper error" });
  }
});

// 💾 保存エンドポイント
app.post("/save", (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "保存対象がありません" });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `saved-${timestamp}.json`;
    const savePath = path.join(__dirname, "data");

    if (!fs.existsSync(savePath)) {
      fs.mkdirSync(savePath);
    }

    fs.writeFileSync(path.join(savePath, filename), JSON.stringify(items, null, 2));

    console.log(`✅ 保存完了：${filename}`);
    res.json({ success: true, filename });
  } catch (error) {
    console.error("保存エラー:", error);
    res.status(500).json({ error: "保存に失敗しました" });
  }
});

// 📋 履歴一覧エンドポイント
app.get("/history", (req, res) => {
  try {
    const dataDir = path.join(__dirname, "data");
    if (!fs.existsSync(dataDir)) {
      return res.json([]);
    }

    const files = fs
      .readdirSync(dataDir)
      .filter((f) => f.startsWith("saved-") && f.endsWith(".json"))
      .sort()
      .reverse(); // 最新順に

    res.json(files);
  } catch (error) {
    console.error("履歴取得エラー:", error);
    res.status(500).json({ error: "履歴取得に失敗しました" });
  }
});

// 📥 ファイル読み込みエンドポイント
app.get("/load/:filename", (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, "data", filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "ファイルが見つかりません" });
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content);
    res.json({ parsed });
  } catch (error) {
    console.error("読み込みエラー:", error);
    res.status(500).json({ error: "読み込みに失敗しました" });
  }
});

// 🚀 サーバー起動
app.listen(port, () => {
  console.log(`🧠 Whisperサーバー起動中：http://localhost:${port}`);
});
