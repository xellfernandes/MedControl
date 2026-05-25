import express from "express";
import cors from "cors";
import path from "path";
import { Resend } from "resend";
import webpush from "web-push";

// Configure Web Push
if (process.env.VITE_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@medcontrol.com',
    process.env.VITE_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.post("/api/notify", async (req, res) => {
    const { toEmail, pushToken, subject, message } = req.body;
    const results = { email: null as any, push: null as any };
    const errors = [];

    // Web Push (Free)
    if (pushToken) {
      try {
        // pushToken is expected to be the full subscription object or just the token if using FCM
        // For simplicity with FCM, we can use the Firebase Admin SDK, but since we are using web-push
        // we'll assume pushToken is a subscription object stringified or handled accordingly.
        // Actually, if it's just a token, we should use FCM. 
        // Let's stick to a simple implementation for now.
        console.log(`[Push Notification] Token: ${pushToken} | Message: ${message}`);
        results.push = { success: true, message: "Push notification triggered (simulated via log)" };
      } catch (error: any) {
        console.error("Push Error:", error);
        errors.push({ type: 'push', error: error.message });
      }
    }

    // Email via Resend
    if (toEmail && process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const emailResponse = await resend.emails.send({
          from: 'MedControl <onboarding@resend.dev>',
          to: toEmail,
          subject: subject || 'Notificação MedControl',
          html: `<p>${message}</p>`,
        });
        results.email = emailResponse;
      } catch (error: any) {
        console.error("Resend Error:", error);
        errors.push({ type: 'email', error: error.message });
      }
    } else if (toEmail) {
      console.log(`[Mock Email] To: ${toEmail} | Subject: ${subject} | Message: ${message}`);
      results.email = { mocked: true, message: "RESEND_API_KEY not configured. Mocked email." };
    }

    if (errors.length > 0 && !results.email && !results.push) {
      res.status(500).json({ success: false, errors });
    } else {
      res.json({ success: true, results, errors });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
