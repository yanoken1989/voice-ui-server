const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { google } = require("googleapis");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = "your_jwt_secret"; // 👉 あとで .env に移してOK

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, "voice-ui-455107-077393f5df7f.json"), // ← あなたのjsonキー
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const SPREADSHEET_ID = "18QXDj4YtrO20_eZ4KhNBQ0d2ZMeBQwHRet9L1Vuwrn4";
const SHEET_NAME = "users";

// ✅ /login エンドポイント
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:C`,
    });

    const users = response.data.values || [];
    const user = users.find((row) => row[0] === email);

    if (!user) {
      return res.status(401).json({ error: "ユーザーが見つかりません" });
    }

    const [_, hashedPassword, userId] = user;
    const isMatch = await bcrypt.compare(password, hashedPassword);

    if (!isMatch) {
      return res.status(401).json({ error: "パスワードが違います" });
    }

    const token = jwt.sign({ user_id: userId, email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ token, user_id: userId });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "サーバーエラー" });
  }
});

app.listen(5001, () => {
  console.log("🧠 Whisperサーバー起動中：http://localhost:5001");
});
