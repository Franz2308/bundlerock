const DEFAULT_PORT = 18200;

const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const btnCheck = document.getElementById("btnCheck");
const btnDownload = document.getElementById("btnDownload");
const urlInput = document.getElementById("urlInput");
const openOptions = document.getElementById("openOptions");

async function getPort() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ port: DEFAULT_PORT }, (res) => {
      resolve(res.port || DEFAULT_PORT);
    });
  });
}

async function checkStatus() {
  statusDot.className = "status-dot";
  statusText.textContent = "Conectando...";
  const port = await getPort();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/status`, { method: "GET" });
    if (res.ok) {
      const data = await res.json();
      statusDot.className = "status-dot online";
      statusText.textContent = `Conectado (v${data.version || "0.2.2"})`;
    } else {
      statusDot.className = "status-dot offline";
      statusText.textContent = "Error en el servidor";
    }
  } catch (e) {
    statusDot.className = "status-dot offline";
    statusText.textContent = "BundleRock cerrado";
  }
}

btnCheck.addEventListener("click", checkStatus);

btnDownload.addEventListener("click", async () => {
  const url = urlInput.value.trim();
  if (!url) return;

  const port = await getPort();
  btnDownload.disabled = true;
  btnDownload.textContent = "Enviando...";

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    if (res.ok) {
      urlInput.value = "";
      btnDownload.textContent = "¡Enviado a BundleRock!";
      setTimeout(() => {
        btnDownload.disabled = false;
        btnDownload.textContent = "Enviar a BundleRock";
        window.close();
      }, 1000);
    } else {
      btnDownload.disabled = false;
      btnDownload.textContent = "Error al enviar";
    }
  } catch (err) {
    btnDownload.disabled = false;
    btnDownload.textContent = "No conectado";
  }
});

openOptions.addEventListener("click", (e) => {
  e.preventDefault();
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL("options.html"));
  }
});

// Run check immediately on popup open
checkStatus();
