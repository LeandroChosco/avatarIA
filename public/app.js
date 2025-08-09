const $ = (s) => document.querySelector(s);
const messages = $("#messages");
const input = $("#input");
const sendBtn = $("#send");
const avatarInput = $("#avatarId");
const saveIdBtn = $("#saveId");

function appendMsg(text, who) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function getAvatarId() {
  return localStorage.getItem("avatarId") || "";
}

function setAvatarId(id) {
  localStorage.setItem("avatarId", id);
}

async function ensureSeed() {
  const avatarId = getAvatarId();
  if (!avatarId) return; // no iniciar hasta seleccionar
  try {
    await fetch("/api/seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarId }),
    });
    // pedir una apertura
    const res = await fetch("/api/opening", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarId }),
    });
    const data = await res.json();
    if (data?.opening) {
      data.opening.split("||").map(s => s.trim()).filter(Boolean).forEach((m, i) => {
        const delay = i === 0 ? 0 : (3000 + Math.floor(Math.random() * 2000));
        setTimeout(() => appendMsg(m, "bot"), delay);
      });
    }
  } catch (e) {
    console.error(e);
  }
}

async function send() {
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  const avatarId = getAvatarId();
  appendMsg(text, "user");
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarId, userMessage: text }),
    });
    const data = await res.json();
    const raw = data.reply || "(sin respuesta)";
    // Soporta múltiples mensajes separados por ' || ' y los envía con delay 3–5s
    const parts = raw.split("||").map(s => s.trim()).filter(Boolean);
    let acc = 0;
    parts.forEach((msg, idx) => {
      const gap = idx === 0 ? 0 : (3000 + Math.floor(Math.random() * 2000));
      acc += gap;
      setTimeout(() => appendMsg(msg, "bot"), acc);
    });
  } catch (e) {
    appendMsg("Error de conexión", "bot");
  }
}

sendBtn.addEventListener("click", send);
input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
saveIdBtn.addEventListener("click", () => { const id = (avatarInput.value || "").trim(); if (!id) return; setAvatarId(id); messages.innerHTML = ""; ensureSeed(); });

// init
avatarInput.value = getAvatarId();
// No auto seed en carga: espera a selección


