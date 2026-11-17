const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.redirect("/index.html");
});

app.post("/api/chat", async (req, res) => {
    console.log("Request masuk ke Express!");

    try {
        const messages = req.body.messages;

        if (!Array.isArray(messages)) {
            return res.status(400).json({
                error: "Messages harus berupa array"
            });
        }

        if (!process.env.OPENROUTER_API_KEY) {
            return res.status(500).json({
                error: "API key belum diatur di file .env"
            });
        }

        // Request ke OpenRouter
        const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`
                },

                body: JSON.stringify({
                    model: "inclusionai/ling-3.2-flash:free",
                    messages,
                    temperature: 0.7,
                    max_tokens: 1000,
                    stream: true
                })
            }
        );

         // Cek error OpenRouter
        if (!response.ok) {
            const errorData = await response.text();

            console.error("OpenRouter Error:", errorData);

            return res.status(response.status).json({
                error: errorData
            });
        }

        // Header SSE
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        res.flushHeaders();

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = "";

        function processLine(line) {
            const trimmedLine = line.trim();

            if (!trimmedLine.startsWith("data:")) {
                return;
            }

            const data = trimmedLine.slice(5).trim();

            if (data === "[DONE]") {
                return;
            }

            try {
                const jsonData = JSON.parse(data);

                const content =
                    jsonData.choices?.[0]?.delta?.content;

                if (typeof content === "string" && content.length > 0) {
                    if (content) {
                        res.write(
                                `data: ${JSON.stringify(content)}\n\n`
                        );
                    }
                }

                if (jsonData.error) {
                    console.error("Stream API Error:", jsonData.error);
                }

            } catch (error) {
                console.error("Gagal parsing SSE:", error);
            }
        }

        // Membaca streaming
         while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            if (res.destroyed) {
                await reader.cancel();
                return;
            }

            buffer += decoder.decode(value, {
                stream: true
            });

            const lines = buffer.split("\n");

            buffer = lines.pop();

            for (const line of lines) {
                processLine(line);
            }
        }

        // Proses sisa data
        buffer += decoder.decode();

        if (buffer.trim()) {
            processLine(buffer);
        }

        if (!res.destroyed && !res.writableEnded) {
            res.write("data: [DONE]\n\n");
            res.end();
        }

    } catch (error) {
        console.error("Server error:", error);

        if (!res.headersSent) {
            res.status(500).json({
                error: error.message
            });
        } else if (!res.destroyed && !res.writableEnded) {
            res.write(
                `data: ${JSON.stringify({
                    error: error.message
                })}\n\n`
            );

            res.end();
        }
    }
});