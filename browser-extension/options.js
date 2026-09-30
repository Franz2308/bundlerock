const portInput = document.getElementById("portInput");
const btnTest = document.getElementById("btnTest");
const testResult = document.getElementById("testResult");
const chkErrorNotif = document.getElementById("chkErrorNotif");
const chkSuccessNotif = document.getElementById("chkSuccessNotif");
const chkFloatingButton = document.getElementById("chkFloatingButton");
const btnSave = document.getElementById("btnSave");
const saveStatus = document.getElementById("saveStatus");

function loadOptions() {
  chrome.storage.local.get(
    {
      port: 18200,
      showSuccessNotification: false,
      showErrorNotification: true,
      showFloatingButton: true
    },
    (items) => {
      portInput.value = items.port || 18200;
      chkSuccessNotif.checked = !!items.showSuccessNotification;
      chkErrorNotif.checked = items.showErrorNotification !== false;
      chkFloatingButton.checked = items.showFloatingButton !== false;
    }
  );
}

function saveOptions() {
  const port = parseInt(portInput.value, 10) || 18200;
  const showSuccessNotification = chkSuccessNotif.checked;
  const showErrorNotification = chkErrorNotif.checked;
  const showFloatingButton = chkFloatingButton.checked;

  chrome.storage.local.set(
    {
      port,
      showSuccessNotification,
      showErrorNotification,
      showFloatingButton
    },
    () => {
      saveStatus.textContent = "¡Configuración guardada correctamente!";
      setTimeout(() => {
        saveStatus.textContent = "";
      }, 2500);
    }
  );
}

async function testConnection() {
  const port = parseInt(portInput.value, 10) || 18200;
  testResult.style.color = "#94a3b8";
  testResult.textContent = "Probando conexión con http://127.0.0.1:" + port + "...";

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/status`);
    if (res.ok) {
      const data = await res.json();
      testResult.style.color = "#10b981";
      testResult.textContent = `Conexión exitosa con BundleRock (versión ${data.version || "0.2.2"}).`;
    } else {
      testResult.style.color = "#ef4444";
      testResult.textContent = `El servidor respondió con código ${res.status}.`;
    }
  } catch (err) {
    testResult.style.color = "#ef4444";
    testResult.textContent = "No se pudo conectar. Verifica que BundleRock esté abierto o en la bandeja del sistema.";
  }
}

document.addEventListener("DOMContentLoaded", loadOptions);
btnSave.addEventListener("click", saveOptions);
btnTest.addEventListener("click", testConnection);
