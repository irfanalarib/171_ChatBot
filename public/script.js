const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const sendBtn = document.getElementById("send-btn");

const messages = [];

const BOT_AVATAR_SVG = `
<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="23" y1="18" x2="19" y2="9" stroke="#cbd5e1" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="19" cy="8" r="3" fill="#e2e8f0"/>
    <line x1="41" y1="18" x2="45" y2="9" stroke="#cbd5e1" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="45" cy="8" r="3" fill="#e2e8f0"/>
    <rect x="10" y="29" width="5" height="10" rx="2.5" fill="#cbd5e1"/>
    <rect x="49" y="29" width="5" height="10" rx="2.5" fill="#cbd5e1"/>
    <rect x="14" y="17" width="36" height="30" rx="15" fill="#e2e8f0"/>
    <rect x="19" y="25" width="26" height="12" rx="6" fill="#0f172a"/>
    <circle cx="26" cy="31" r="3" fill="#38bdf8"/>
    <circle cx="38" cy="31" r="3" fill="#38bdf8"/>
    <path d="M18 54C18 48.5 23.5 45 32 45C40.5 45 46 48.5 46 54" fill="#cbd5e1"/>
</svg>`;

const USER_AVATAR_SVG = `
<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 56C16 47.5 22.5 43 32 43C41.5 43 48 47.5 48 56" fill="#0d3b66"/>
    <path d="M27 40H37V46C37 48.5 34.8 50 32 50C29.2 50 27 48.5 27 46V40Z" fill="#dce7f2"/>
    <path d="M21 26C21 18.5 25.8 14 32 14C38.2 14 43 18.5 43 26V31C43 37.5 38.2 42 32 42C25.8 42 21 37.5 21 31V26Z" fill="#e6eff8"/>
    <path d="M20 27C20 17.5 25 12 32 12C39 12 44 17.5 44 27C44 29 43.5 31 42.5 32C42.5 24 39.5 21 36 19C32.5 22 27 23.5 22 24C21.5 27.5 21.5 30 21.5 32C20.5 31 20 29 20 27Z" fill="#0d3b66"/>
    <rect x="23" y="26" width="7" height="4.5" rx="2" stroke="#0d3b66" stroke-width="1.5" fill="#ffffff"/>
    <rect x="34" y="26" width="7" height="4.5" rx="2" stroke="#0d3b66" stroke-width="1.5" fill="#ffffff"/>
    <line x1="30" y1="28" x2="34" y2="28" stroke="#0d3b66" stroke-width="1.5"/>
</svg>`;

function addMessage(text, sender, isTyping = false) {
    const message = document.createElement("div");
    message.classList.add("message", sender);

    const bubble = document.createElement("div");
    bubble.classList.add("bubble");

    const avatar = document.createElement("div");
    avatar.classList.add("avatar");
    avatar.innerHTML = sender === "bot" ? BOT_AVATAR_SVG : USER_AVATAR_SVG;

    const content = document.createElement("div");
    content.classList.add("message-content");

    if (isTyping) {
        content.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
    } else {
        content.textContent = text;
    }

    if (sender === "bot") {
        bubble.appendChild(avatar);
        bubble.appendChild(content);
    } else {
        bubble.appendChild(content);
        bubble.appendChild(avatar);
    }

    message.appendChild(bubble);
    chatBox.appendChild(message);
    chatBox.scrollTop = chatBox.scrollHeight;

    return content;
}

chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = userInput.value.trim();
    if (!message) return;

    // Tampilkan & simpan pesan user
    addMessage(message, "user");
    messages.push({ role: "user", content: message });

    // Reset & disable input sementara
    userInput.value = "";
    userInput.disabled = true;
    sendBtn.disabled = true;
    sendBtn.querySelector("span").textContent = "Menunggu...";

    // Buat bubble AI dengan animasi mengetik
    const botContent = addMessage("", "bot", true);
    let botResponse = "";

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Terjadi kesalahan");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || !trimmedLine.startsWith("data:")) continue;

                const data = trimmedLine.slice(5).trim();
                if (data === "[DONE]") continue;

                try {
                    const token = JSON.parse(data);
                    botResponse += token;
                    botContent.textContent = botResponse;
                    chatBox.scrollTop = chatBox.scrollHeight;
                } catch (error) {
                    console.error("Gagal membaca token:", error);
                }
            }
        }

        messages.push({ role: "assistant", content: botResponse });

    } catch (error) {
        console.error(error);
        botContent.textContent = "Maaf, terjadi kesalahan: " + error.message;
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
        sendBtn.querySelector("span").textContent = "Kirim";
        userInput.focus();
    }
});