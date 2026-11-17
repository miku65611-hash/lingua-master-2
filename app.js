"use strict";

window.addEventListener("error", function (e) {
  var c = document.getElementById("counter");
  if (c) {
    c.textContent = "⚠️ Lỗi script: " + e.message;
    c.classList.add("error");
  }
});

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
const K_LEARNED = "linguaLearned";
const K_CUSTOM = "linguaCustomWords";
const PAGE_SIZE = 50;
const DATA_URL = "vocabulary.json";

const $ = id => document.getElementById(id);

let base = {};
let vocabulary = {};
let level = "N5";
let index = 0;
let filtered = [];
let answerShown = false;
let listLimit = PAGE_SIZE;
let dataLoaded = false;

/* ---------- Lưu trữ ---------- */
function read(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { alert("Không thể lưu dữ liệu. Bộ nhớ trình duyệt có thể đã đầy."); return false; }
}
const keyOf = (lv, w) => lv + "_" + w;
const str = v => (typeof v === "string" ? v : "");

function getCustomWords() {
  const d = read(K_CUSTOM, []);
  return Array.isArray(d) ? d : [];
}
function getLearned() {
  const d = read(K_LEARNED, {});
  return d && typeof d === "object" && !Array.isArray(d) ? d : {};
}
function matches(it, kw) {
  if (!kw) return true;
  return [it.w, it.r, it.m, it.type, it.jp, it.vi]
    .some(v => str(v).toLowerCase().includes(kw));
}

/* ---------- Chuẩn hóa dữ liệu ---------- */
function normalizeWord(it) {
  if (!it || typeof it !== "object") return null;
  const w = str(it.w ?? it.word).trim();
  const r = str(it.r ?? it.reading).trim();
  const m = str(it.m ?? it.meaning).trim();
  if (!w || !m) return null;
  return {
    w,
    r: r || w,
    m,
    type: str(it.type).trim(),
    jp: str(it.jp ?? it.example),
    vi: str(it.vi ?? it.exampleVi ?? it.example_vi)
  };
}

// Nhận cả dạng {N5:[...]} lẫn mảng phẳng có trường level
function parseData(data) {
  const out = {};
  LEVELS.forEach(lv => { out[lv] = []; });

  if (Array.isArray(data)) {
    data.forEach(it => {
      const lv = str(it && it.level).toUpperCase();
      const n = normalizeWord(it);
      if (out[lv] && n) out[lv].push(n);
    });
  } else if (data && typeof data === "object") {
    Object.keys(data).forEach(k => {
      const lv = k.toUpperCase();
      if (out[lv] && Array.isArray(data[k])) {
        out[lv] = data[k].map(normalizeWord).filter(Boolean);
      }
    });
  }
  return out;
}

function rebuild() {
  const custom = getCustomWords();
  vocabulary = {};
  LEVELS.forEach(lv => {
    const words = base[lv] || [];
    const seen = new Set(words.map(x => x.w.toLowerCase()));
    const extra = custom
      .filter(c => c && c.level === lv && typeof c.w === "string" &&
                   typeof c.r === "string" && typeof c.m === "string")
      .filter(c => !seen.has(c.w.trim().toLowerCase()))
      .map(c => ({ ...c, custom: true }));
    vocabulary[lv] = words.concat(extra);
  });
}

/* ---------- Lọc ---------- */
function applyFilter(keepWord) {
  const kw = $("search").value.trim().toLowerCase();
  const onlyNew = $("filterMode").value === "unlearned";
  const learned = getLearned();

  filtered = (vocabulary[level] || []).filter(it =>
    (!onlyNew || !learned[keyOf(level, it.w)]) && matches(it, kw)
  );

  const i = keepWord ? filtered.findIndex(it => it.w === keepWord) : -1;
  index = i >= 0 ? i : 0;
}

/* ---------- Thống kê ---------- */
function updateStats() {
  const learned = getLearned();
  const words = vocabulary[level] || [];
  const count = words.filter(it => learned[keyOf(level, it.w)]).length;
  const percent = words.length ? Math.round(count / words.length * 100) : 0;

  $("total").textContent = words.length;
  $("learned").textContent = count;
  $("percent").textContent = percent + "%";
  $("progress").style.width = percent + "%";
}

/* ---------- Flashcard ---------- */
function setCounter(text, isError) {
  $("counter").textContent = text;
  $("counter").classList.toggle("error", !!isError);
}

function renderWord() {
  const item = filtered[index];
  updateStats();

  if (!item) {
    $("wordCard").classList.add("hidden");
    setCounter(dataLoaded ? "Không có từ vựng phù hợp." : "Không thể tải dữ liệu từ vựng.", !dataLoaded);
    return;
  }

  $("wordCard").classList.remove("hidden");
  $("levelLabel").textContent = "JLPT " + level + (item.custom ? " · ⭐ Từ của tôi" : "");
  $("word").textContent = item.w;
  $("reading").textContent = item.r;
  $("wordType").textContent = item.type || "";
  $("wordType").classList.toggle("hidden", !item.type);
  $("meaning").textContent = item.m;
  $("exampleJP").textContent = item.jp || "";
  $("exampleVI").textContent = item.vi || "";
  $("exampleBox").classList.toggle("hidden", !item.jp && !item.vi);

  setAnswer(false);

  $("knownBtn").textContent = getLearned()[keyOf(level, item.w)] ? "✓ Đã thuộc" : "✓ Đánh dấu đã thuộc";
  setCounter((index + 1) + " / " + filtered.length, false);
}

function setAnswer(show) {
  answerShown = show;
  $("meaning").style.display = show ? "block" : "none";
  $("exampleVI").style.display = show ? "block" : "none";
  $("flipBtn").textContent = show ? "🙈 Ẩn đáp án" : "👁 Hiện đáp án";
}

function move(step) {
  if (!filtered.length) return;
  index = (index + step + filtered.length) % filtered.length;
  renderWord();
}

function changeLevel(lv, keepWord) {
  if (!LEVELS.includes(lv)) return;
  level = lv;
  document.querySelectorAll(".level-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.level === lv)
  );
  $("search").value = "";
  applyFilter(keepWord);
  renderWord();
}

/* ---------- Danh sách ---------- */
function renderList() {
  const kw = $("listSearch").value.trim().toLowerCase();
  const sel = $("listLevel").value;
  const learned = getLearned();
  const levels = sel === "ALL" ? LEVELS : [sel];

  const all = [];
  levels.forEach(lv => (vocabulary[lv] || []).forEach(it => {
    if (matches(it, kw)) all.push({ ...it, level: lv });
  }));

  $("listCount").textContent = "Tổng: " + all.length + " từ";

  const box = $("vocabularyList");
  box.textContent = "";
  const frag = document.createDocumentFragment();

  all.slice(0, listLimit).forEach(it => {
    const row = document.createElement("div");
    row.className = "row clickable";

    const info = document.createElement("div");
    info.className = "info";
    const title = document.createElement("strong");
    title.textContent = it.w + " (" + it.r + ")";
    const meaning = document.createElement("div");
    meaning.textContent = it.m;
    const lv = document.createElement("small");
    lv.textContent = "JLPT " + it.level + (it.type ? " · " + it.type : "");
    info.append(title, meaning, lv);

    const mark = document.createElement("span");
    mark.textContent = learned[keyOf(it.level, it.w)] ? "✅" : "";

    row.append(info, mark);
    row.addEventListener("click", () => {
      changeLevel(it.level, it.w);
      $("wordCard").scrollIntoView({ behavior: "smooth", block: "center" });
    });
    frag.appendChild(row);
  });

  box.appendChild(frag);
  $("moreBtn").classList.toggle("hidden", all.length <= listLimit);

  if (!all.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = dataLoaded ? "Không tìm thấy từ vựng." : "Chưa có dữ liệu.";
    box.appendChild(empty);
  }
}

/* ---------- Từ vựng cá nhân ---------- */
function showMessage(text, color) {
  $("customMessage").textContent = text;
  $("customMessage").style.color = color;
}

function renderCustomWords() {
  const words = getCustomWords();
  const list = $("customWordList");
  list.textContent = "";

  if (!words.length) {
    list.textContent = "Chưa có từ vựng cá nhân.";
    return;
  }

  words.forEach(item => {
    const row = document.createElement("div");
    row.className = "row";

    const info = document.createElement("div");
    info.className = "info";
    const title = document.createElement("strong");
    title.textContent = item.w + " (" + item.r + ")";
    const meaning = document.createElement("div");
    meaning.textContent = item.m;
    const lv = document.createElement("small");
    lv.textContent = "JLPT " + item.level;
    info.append(title, meaning, lv);

    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "Xóa";
    del.addEventListener("click", () => deleteCustom(item.id));

    row.append(info, del);
    list.appendChild(row);
  });
}

function addCustom() {
  if (!dataLoaded) return showMessage("⚠️ Dữ liệu chưa tải xong.", "#e34d59");

  const w = $("customWord").value.trim();
  const r = $("customReading").value.trim();
  const m = $("customMeaning").value.trim();
  const jp = $("customExampleJP").value.trim();
  const vi = $("customExampleVI").value.trim();
  const lv = $("customLevel").value;

  if (!w || !r || !m) return showMessage("⚠️ Hãy nhập từ, cách đọc và nghĩa.", "#e34d59");
  if (!LEVELS.includes(lv)) return showMessage("⚠️ Cấp độ không hợp lệ.", "#e34d59");

  const exists = (vocabulary[lv] || []).some(it => it.w.toLowerCase() === w.toLowerCase());
  if (exists) return showMessage("⚠️ Từ này đã tồn tại.", "#e34d59");

  const custom = getCustomWords();
  custom.push({
    id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
    w, r, m, jp, vi, level: lv
  });
  if (!write(K_CUSTOM, custom)) return;

  rebuild();
  if (level === lv) {
    applyFilter(w);
    renderWord();
  }

  ["customWord", "customReading", "customMeaning", "customExampleJP", "customExampleVI"]
    .forEach(id => { $(id).value = ""; });

  showMessage("✅ Đã lưu từ vựng thành công!", "#16a36a");
  renderCustomWords();
  renderList();
}

function deleteCustom(id) {
  if (!confirm("Bạn có chắc muốn xóa từ này?")) return;
  const custom = getCustomWords().filter(c => c.id !== id);
  if (!write(K_CUSTOM, custom)) return;

  rebuild();
  applyFilter();
  renderWord();
  renderCustomWords();
  renderList();
}

/* ---------- Sao lưu ---------- */
function exportCustom() {
  const blob = new Blob([JSON.stringify(getCustomWords(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "tu-vung-cua-toi.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showMessage("✅ Đã xuất file sao lưu!", "#16a36a");
}

async function importCustom(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error("bad");
    const cur = getCustomWords();

    data.forEach(d => {
      const valid = d && d.w && d.r && d.m && LEVELS.includes(d.level);
      const dup = valid && cur.some(c =>
        c.w.toLowerCase() === String(d.w).toLowerCase() && c.level === d.level
      );
      if (valid && !dup) {
        cur.push({
          id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
          w: String(d.w), r: String(d.r), m: String(d.m),
          jp: str(d.jp), vi: str(d.vi), level: d.level
        });
      }
    });

    if (!write(K_CUSTOM, cur)) return;
    rebuild();
    applyFilter();
    renderWord();
    renderCustomWords();
    renderList();
    showMessage("✅ Đã nhập sao lưu!", "#16a36a");
  } catch {
    showMessage("⚠️ File không hợp lệ!", "#e34d59");
  }
}

/* ---------- Sự kiện ---------- */
function bindEvents() {
  document.querySelectorAll(".level-btn").forEach(btn =>
    btn.addEventListener("click", () => changeLevel(btn.dataset.level))
  );

  $("search").addEventListener("input", () => { applyFilter(); renderWord(); });
  $("filterMode").addEventListener("change", () => { applyFilter(); renderWord(); });

  $("flipBtn").addEventListener("click", () => setAnswer(!answerShown));
  $("prevBtn").addEventListener("click", () => move(-1));
  $("nextBtn").addEventListener("click", () => move(1));

  $("knownBtn").addEventListener("click", () => {
    const item = filtered[index];
    if (!item) return;
    const learned = getLearned();
    learned[keyOf(level, item.w)] = true;
    write(K_LEARNED, learned);
    if (index < filtered.length - 1) index++;
    renderWord();
    renderList();
  });

  $("unknownBtn").addEventListener("click", () => {
    const item = filtered[index];
    if (!item) return;
    const learned = getLearned();
    delete learned[keyOf(level, item.w)];
    write(K_LEARNED, learned);
    renderList();
    move(1);
  });

  $("listSearch").addEventListener("input", () => { listLimit = PAGE_SIZE; renderList(); });
  $("listLevel").addEventListener("change", () => { listLimit = PAGE_SIZE; renderList(); });
  $("moreBtn").addEventListener("click", () => { listLimit += PAGE_SIZE; renderList(); });

  $("addCustomWord").addEventListener("click", addCustom);
  $("exportBtn").addEventListener("click", exportCustom);
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", e => {
    if (e.target.files[0]) importCustom(e.target.files[0]);
    e.target.value = "";
  });
}

/* ---------- Tải vocabulary.json ---------- */
function showLoadError(message) {
  $("wordCard").classList.add("hidden");
  setCounter("⚠️ " + message, true);
  $("vocabularyList").textContent = "";
  $("listCount").textContent = "Tổng: 0 từ";
  updateStats();
}

async function loadVocabulary() {
  try {
    const res = await fetch(DATA_URL + "?v=" + Date.now(), { cache: "no-store" });

    if (!res.ok) {
      throw new Error(
        "Không tìm thấy " + DATA_URL + " (mã lỗi " + res.status + "). " +
        "File phải nằm cùng thư mục với index.html và đúng tên, viết thường."
      );
    }

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(DATA_URL + " sai định dạng JSON (thừa/thiếu dấu phẩy, ngoặc hoặc dấu nháy).");
    }

    base = parseData(data);
    const total = LEVELS.reduce((s, lv) => s + base[lv].length, 0);

    if (!total) {
      throw new Error("Đọc được file nhưng không có từ nào hợp lệ.");
    }

    dataLoaded = true;
    rebuild();
    applyFilter();
    renderWord();
    renderList();
  } catch (err) {
    console.error(err);
    const offline = location.protocol === "file:"
      ? " Bạn đang mở file trực tiếp, hãy mở qua link GitHub Pages."
      : "";
    showLoadError(err.message + offline);
  }
}

bindEvents();
renderCustomWords();
loadVocabulary();
window.__linguaReady = true;
