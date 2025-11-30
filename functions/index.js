const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const axios = require("axios");
const FormData = require("form-data");

admin.initializeApp();
const db = admin.firestore();

const TELEGRAM_TOKEN = "8523244540:AAFflYWpDiytAE0nrIOW-Q5dQSfiTuJcoY4"; 
const OWNER_ID = "7028000951";
const GROUP_ID = "-1003403716054"; 

exports.sendTelegramNotification = functions.firestore
  .document("topupRequests/{requestId}")
  .onCreate(async (snap, context) => {
    
    const data = snap.data();
    const requestId = context.params.requestId;
    const rawBase64 = data.slipBase64 || null;

    const message = `
🔔 *New Top-up Request!*
-------------------------
🆔 *Order ID:* ${requestId}
👤 *User ID:* \`${data.userId}\`
💰 *Amount:* ${data.amount} Ks
-------------------------
👇 Slip ကိုစစ်ဆေးပြီး Action ယူပါ:
`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "✅ Approve", callback_data: `approve_${requestId}` },
          { text: "❌ Decline", callback_data: `decline_${requestId}` }
        ]
      ]
    };

    const targets = [OWNER_ID, GROUP_ID];

    const promises = targets.map(async (chatId) => {
      try {
        if (rawBase64) {
          const form = new FormData();
          form.append("chat_id", chatId);
          form.append("caption", message);
          form.append("parse_mode", "Markdown");
          form.append("reply_markup", JSON.stringify(keyboard));

          const base64Data = rawBase64.includes("base64,") 
              ? rawBase64.split("base64,")[1] 
              : rawBase64;

          const imageBuffer = Buffer.from(base64Data, 'base64');
          form.append("photo", imageBuffer, { filename: "slip.jpg" });

          await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, form, {
            headers: form.getHeaders()
          });
          console.log(`✅ Photo sent to ${chatId}`);

        } else {
          await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: message,
            parse_mode: "Markdown",
            reply_markup: keyboard
          });
          console.log(`✅ Text sent to ${chatId}`);
        }
      } catch (e) {
        console.error(`❌ Error sending to ${chatId}:`, e.response ? e.response.data : e.message);
      }
    });

    await Promise.all(promises);
  });

exports.telegramWebhook = functions.https.onRequest(async (req, res) => {
  try {
    const update = req.body;
    
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const message = callbackQuery.message;
      const data = callbackQuery.data;
      const chatId = message.chat.id;
      const messageId = message.message_id;

      const [action, requestId] = data.split("_");
      const requestRef = db.collection("topupRequests").doc(requestId);

      const doc = await requestRef.get();
      if (!doc.exists) {
         return res.send({ method: "sendMessage", chat_id: chatId, text: "❌ Order မရှိတော့ပါ" });
      }
      const requestData = doc.data();
d
      if (requestData.status === "approved" || requestData.status === "declined") {
         await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
            callback_query_id: callbackQuery.id,
            text: "⚠️ ဒီ Order က ပြီးသွားပါပြီ!",
            show_alert: true
         });
         return res.sendStatus(200);
      }

      const originalText = message.caption || message.text || "Order processed";
      const isCaption = !!message.caption; 

      if (action === "approve") {
        await db.runTransaction(async (t) => {
            const userRef = db.collection("users").doc(requestData.userId);
            const userDoc = await t.get(userRef);
            
            if (!userDoc.exists) throw new Error("User not found");
            
            const newBalance = (userDoc.data().balance || 0) + Number(requestData.amount);
            
            t.update(userRef, { balance: newBalance });
            t.update(requestRef, { status: "approved", adminNote: "Approved via Telegram" });
        });

        const editMethod = isCaption ? "editMessageCaption" : "editMessageText";
        const body = {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [] } 
        };

        if (isCaption) body.caption = originalText + "\n\n✅ *APPROVED by Admin*";
        else body.text = originalText + "\n\n✅ *APPROVED by Admin*";

        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${editMethod}`, body);

      } else if (action === "decline") {
        await requestRef.update({ status: "declined", adminNote: "Declined via Telegram" });

        const editMethod = isCaption ? "editMessageCaption" : "editMessageText";
        const body = {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [] } 
        };

        if (isCaption) body.caption = originalText + "\n\n❌ *DECLINED by Admin*";
        else body.text = originalText + "\n\n❌ *DECLINED by Admin*";

        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${editMethod}`, body);
      }
    }
    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});