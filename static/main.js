// === HARİTA BAŞLAT ===
const map = L.map('map', {
  center: [31.8, 34.9],   // Kudüs - Tel Aviv ortası
  zoom: 11,               // Daha yakın başlat
  minZoom: 8,             // Çok uzağa çıkmasın
  maxZoom: 18,            // Artık tam yakınlaştırma açık
  worldCopyJump: false,   // Harita tekrarlanmasın
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

map.on('moveend', () => {
  const center = map.getCenter();
  if (center.lat < 29.0) map.panTo([29.0, center.lng]);
  if (center.lat > 33.5) map.panTo([33.5, center.lng]);
  if (center.lng < 33.0) map.panTo([center.lat, 33.0]);
  if (center.lng > 35.9) map.panTo([center.lat, 35.9]);
});

// === DURUMLAR ===
let addMode = false, drawMode = false;
let deleteMarkerMode = false, deletePathMode = false;
let editMode = false, editingMarkerId = null;
let tempMarker = null, tempLine = null, linePoints = [];

// === DOM ELEMENTLERİ ===
const markerForm = document.getElementById("markerForm");
const titleInput = document.getElementById("titleInput");
const descInput = document.getElementById("descInput");
const photoInput = document.getElementById("photoInput");
const audioInput = document.getElementById("audioInput");
const saveMarkerBtn = document.getElementById("saveMarkerBtn");
const cancelMarkerBtn = document.getElementById("cancelMarkerBtn");
const addMarkerBtn = document.getElementById("addMarkerBtn");
const drawPathBtn = document.getElementById("drawPathBtn");
const pathColorPicker = document.getElementById("pathColorPicker"); // 🎨 EKLENDİ
const savePathBtn = document.getElementById("savePathBtn");
const cancelPathBtn = document.getElementById("cancelPathBtn");
const deleteMarkerModeBtn = document.getElementById("deleteMarkerModeBtn");
const deletePathModeBtn = document.getElementById("deletePathModeBtn");
const playAllBtn = document.getElementById("playAllBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
const addressInput = document.getElementById("addressInput");
const addressBtn = document.getElementById("addressBtn");
const markerList = document.getElementById("markerList");
const pathList = document.getElementById("pathList");
const markersTab = document.getElementById("markersTab");
const pathsTab = document.getElementById("pathsTab");
const markerPanel = document.getElementById("markerPanel");
const pathPanel = document.getElementById("pathPanel");

// === MARKER RENK (SABİT MAVİ) ===
function getDefaultIcon() {
  return L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
}

// === SEKME GEÇİŞLERİ ===
function togglePanel(tab, panel) {
  const active = tab.classList.contains("active");
  markersTab.classList.remove("active");
  pathsTab.classList.remove("active");
  markerPanel.classList.add("hidden");
  pathPanel.classList.add("hidden");
  if (!active) {
    tab.classList.add("active");
    panel.classList.remove("hidden");
  }
}
markersTab.onclick = () => togglePanel(markersTab, markerPanel);
pathsTab.onclick = () => togglePanel(pathsTab, pathPanel);

// === MARKER VE YOLLARI YÜKLE ===
async function loadMarkers() {
  const res = await fetch('/api/markers');
  const data = await res.json();
  markerList.innerHTML = "";
  pathList.innerHTML = "";
  Object.values(markersOnMap).forEach(m => map.removeLayer(m.obj));
  markersOnMap = {};
  for (const m of data) m.is_path ? addPathToMap(m) : addMarkerToMap(m);
}
let markersOnMap = {}, audios = {};

function addMarkerToMap(m) {
  const marker = L.marker([m.lat, m.lng], { icon: getDefaultIcon() }).addTo(map);
  let html = `<b>${m.title || "Marker"}</b><br>${m.description || ""}`;
  if (m.photo_path) html += `<br><img src="${m.photo_path}" width="200" style="margin-top:4px;border-radius:6px;">`;
  marker.bindPopup(html);
  marker.on("click", () => {
    if (deleteMarkerMode) deleteById(m.id);
    else if (m.audio_path) toggleAudio(m.id);
  });
  markersOnMap[m.id] = { obj: marker };
  if (m.audio_path) audios[m.id] = new Audio(m.audio_path);

  const li = document.createElement("li");
  li.innerHTML = `
    <div>${m.title || "Marker"}</div>
    <div>
      <button onclick="centerMarker(${m.id})">🔎</button>
      <button onclick="editMarker(${m.id})">✏️</button>
      <button class="delete" onclick="deleteById(${m.id})">🗑️</button>
    </div>`;
  markerList.appendChild(li);
}

function addPathToMap(m) {
  const pts = JSON.parse(m.description || "[]");
  const path = L.polyline(pts, { color: m.color || "#2e6de4", weight: 4 }).addTo(map);
  path.on("click", () => { if (deletePathMode) deleteById(m.id); });
  markersOnMap[m.id] = { obj: path };
  const li = document.createElement("li");
  li.innerHTML = `
    <div>${m.title || "Yol"}</div>
    <div>
      <button onclick="centerPath(${m.id})">🔎</button>
      <button class="delete" onclick="deleteById(${m.id})">🗑️</button>
    </div>`;
  pathList.appendChild(li);
}

window.centerMarker = id => {
  const m = markersOnMap[id];
  if (m) map.setView(m.obj.getLatLng(), 18);
};
window.centerPath = id => {
  const m = markersOnMap[id];
  if (m) map.fitBounds(m.obj.getBounds());
};
async function deleteById(id) {
  await fetch(`/api/markers/${id}`, { method: "DELETE" });
  loadMarkers();
}
function toggleAudio(id) {
  const a = audios[id];
  if (!a) return;
  a.paused ? a.play() : (a.pause(), a.currentTime = 0);
}

// === MARKER EKLEME ===
addMarkerBtn.onclick = () => {
  drawMode = false;
  addMode = true;
  map.getContainer().style.cursor = "crosshair";
  alert("Haritaya tıklayarak marker konumu seçin.");
};

map.on("click", e => {
  if (addMode && !editMode) {
    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = L.marker(e.latlng, { icon: getDefaultIcon() }).addTo(map);
    markerForm.classList.remove("hidden");
    addMode = false;
    map.getContainer().style.cursor = "default";
  } else if (drawMode) {
    linePoints.push(e.latlng);
    if (tempLine) map.removeLayer(tempLine);
    tempLine = L.polyline(linePoints, { color: pathColorPicker.value, weight: 4 }).addTo(map); // 🎨 Renkli çizgi
  }
});

// === MARKER KAYDET ===
saveMarkerBtn.onclick = async () => {
  const f = new FormData();
  f.append("title", titleInput.value);
  f.append("description", descInput.value);
  f.append("color", "#2e6de4");
  if (photoInput.files[0]) f.append("photo", photoInput.files[0]);
  if (audioInput.files[0]) f.append("audio", audioInput.files[0]);

  if (editMode) {
    await fetch(`/api/marker/${editingMarkerId}`, { method: "PUT", body: f });
  } else {
    if (!tempMarker) return alert("Önce haritaya tıklayarak konum seçin.");
    const pos = tempMarker.getLatLng();
    f.append("lat", pos.lat);
    f.append("lng", pos.lng);
    await fetch("/api/markers", { method: "POST", body: f });
  }
  if (tempMarker) map.removeLayer(tempMarker);
  markerForm.classList.add("hidden");
  editMode = false;
  loadMarkers();
};

cancelMarkerBtn.onclick = () => {
  if (tempMarker) map.removeLayer(tempMarker);
  markerForm.classList.add("hidden");
  addMode = false;
  editMode = false;
  map.getContainer().style.cursor = "default";
};

// === DÜZENLE ===
window.editMarker = async id => {
  const res = await fetch(`/api/marker/${id}`);
  const m = await res.json();
  editMode = true;
  editingMarkerId = id;
  titleInput.value = m.title || "";
  descInput.value = m.description || "";
  markerForm.classList.remove("hidden");
  document.getElementById("formTitle").textContent = "Marker Düzenle";
};

// === YOL ÇİZME ===
drawPathBtn.onclick = () => {
  addMode = false;
  drawMode = true;
  deleteMarkerMode = false;
  deletePathMode = false;
  linePoints = [];
  pathColorPicker.classList.remove("hidden"); // 🎨 Görünür
  map.getContainer().style.cursor = "crosshair";
  savePathBtn.classList.remove("hidden");
  cancelPathBtn.classList.remove("hidden");
};
cancelPathBtn.onclick = () => {
  if (tempLine) map.removeLayer(tempLine);
  drawMode = false;
  linePoints = [];
  pathColorPicker.classList.add("hidden"); // 🎨 Gizle
  savePathBtn.classList.add("hidden");
  cancelPathBtn.classList.add("hidden");
  map.getContainer().style.cursor = "default";
};
savePathBtn.onclick = async () => {
  if (linePoints.length < 2) return alert("En az iki nokta gerekli.");
  const coords = linePoints.map(p => [p.lat, p.lng]);
  const f = new FormData();
  f.append("title", "Yol");
  f.append("description", JSON.stringify(coords));
  f.append("lat", coords[0][0]);
  f.append("lng", coords[0][1]);
  f.append("color", pathColorPicker.value); // 🎨 Seçilen rengi kaydet
  f.append("is_path", "1");
  await fetch("/api/markers", { method: "POST", body: f });
  if (tempLine) map.removeLayer(tempLine);
  drawMode = false;
  linePoints = [];
  pathColorPicker.classList.add("hidden"); // 🎨 Gizle
  savePathBtn.classList.add("hidden");
  cancelPathBtn.classList.add("hidden");
  map.getContainer().style.cursor = "default";
  loadMarkers();
};

// === SİLME MODLARI ===
deleteMarkerModeBtn.onclick = () => {
  deleteMarkerMode = !deleteMarkerMode;
  deletePathMode = false;
  deleteMarkerModeBtn.style.background = deleteMarkerMode ? "#dc2626" : "#111827";
  map.getContainer().style.cursor = deleteMarkerMode ? "not-allowed" : "default";
};
deletePathModeBtn.onclick = () => {
  deletePathMode = !deletePathMode;
  deleteMarkerMode = false;
  deletePathModeBtn.style.background = deletePathMode ? "#dc2626" : "#111827";
  map.getContainer().style.cursor = deletePathMode ? "not-allowed" : "default";
};

// === ADRES ARAMA ===
addressBtn.onclick = async () => {
  const q = addressInput.value.trim();
  if (!q) return;
  addressBtn.disabled = true;
  addressBtn.textContent = "⏳";
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
    const d = await r.json();
    if (!d.length) return alert("Adres bulunamadı.");
    map.setView([+d[0].lat, +d[0].lon], 14);
  } catch (e) {
    alert("Arama sırasında hata oluştu.");
  } finally {
    addressBtn.disabled = false;
    addressBtn.textContent = "Ara";
  }
};

// === SESLER ===
let playingAll = false;
playAllBtn.onclick = () => {
  if (!playingAll) {
    Object.values(audios).forEach(a => a.play());
    playingAll = true;
    playAllBtn.textContent = "⏸️ Durdur";
  } else {
    Object.values(audios).forEach(a => { a.pause(); a.currentTime = 0; });
    playingAll = false;
    playAllBtn.textContent = "▶️ Sesler";
  }
};

// === JSON İÇE/DIŞA AKTAR ===
exportBtn.onclick = async () => {
  const res = await fetch("/api/markers");
  const data = await res.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "harita_verileri.json";
  a.click();
  URL.revokeObjectURL(url);
};

importBtn.onclick = () => importFile.click();
importFile.onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const data = JSON.parse(text);
  for (const m of data) {
    const f = new FormData();
    f.append("title", m.title);
    f.append("description", m.description);
    f.append("lat", m.lat);
    f.append("lng", m.lng);
    f.append("color", "#2e6de4");
    f.append("is_path", m.is_path ? "1" : "0");
    await fetch("/api/markers", { method: "POST", body: f });
  }
  loadMarkers();
};

// === BAŞLAT ===
loadMarkers();
