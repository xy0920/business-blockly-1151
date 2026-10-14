
(() => {
  "use strict";

  const APP_VERSION = "0.3.8.4-m3-part1-student-release";
  // Part 2 將於第二週由教師開放；目前保留程式與資料結構，禁止操作。
  const M3_PART2_OPEN = false;
  const DEFAULT_MODULE = "M2";
  const MODULE_CONFIG = {
    M1: {
      title: "M1 · 流程與順序",
      shortTitle: "M1 流程與順序",
      category: "M1 流程與順序",
      tipTitle: "M1 本階段重點",
      tipText: "從空白畫布重新練習流程順序：把顯示積木依照想要的執行順序接成一條主流程。",
      pythonNote: "M1 不要求寫 Python；這裡只觀察積木順序與 print 的對應關係。",
      flowNote: "M1 觀察程式執行順序：積木怎麼排，流程就怎麼走。"
    },
    M2: {
      title: "M2 · 資料與處理",
      shortTitle: "M2 資料與處理",
      category: "M2 資料與處理",
      tipTitle: "M2 本階段重點",
      tipText: "處理一筆會員購物交易：先設定商品與會員資料，再完成結帳、庫存與會員點數的資料運算。",
      pythonNote: "M2 不要求寫 Python；這裡用來觀察變數、指定、運算與 print 的對應關係。",
      flowNote: "M2 觀察資料怎麼一路被處理：設定商品與會員資料 → 結帳計算 → 庫存更新 → 點數累積 → 顯示結果。"
    },
    M3P1: {
      title: "M3 · Part 1｜條件判斷", shortTitle:"M3 Part 1", category:"M3 條件與判斷",
      tipTitle:"M3 Part 1｜本階段重點", tipText:"完成六題比較運算子練習，再依滿額免運情境自行堆積木。兩項成果會一起儲存，不必分開繳交。",
      pythonNote:"M3 Part 1：觀察 IF、ELSE 及比較運算的程式碼，無須手寫 Python。",
      flowNote:"M3 Part 1：菱形表示判斷；True 與 False 走不同的路徑。"
    },
    M3P2: {
      title: "M3 · Part 2｜多分支判斷", shortTitle:"M3 Part 2", category:"M3 條件與判斷",
      tipTitle:"M3 Part 2｜本階段重點", tipText:"自行設計多分支決策表，並完成老師指定的會員消費回饋分級 Blockly。",
      pythonNote:"M3 Part 2：觀察 IF / ELIF / ELSE 的條件順序及對應 Python。",
      flowNote:"M3 Part 2：按照條件先後順序逐一判斷；符合後便不再檢查後續分支。"
    }
  };
  let activeModule = DEFAULT_MODULE;
  const DEFAULT_PROJECT_NAME = "小店營運助手";
  const LEGACY_PROFILE_KEY = "businessBlockly.profile.v1";
  const PROFILE_REGISTRY_KEY = "businessBlockly.profileRegistry.v2";
  const ACTIVE_PROFILE_KEY = "businessBlockly.activeProfile.v2";
  const FONT_KEY = "businessBlockly.fontScale.student.v3";
  const DEV_UPLOAD_ENDPOINT_KEY = "businessBlockly.uploadEndpoint.dev.v1";
  const LAST_SUBMISSION_PREFIX = "businessBlockly.lastSubmission.v1";
  const CLOUD_CONFIG = window.BUSINESS_BLOCKLY_CONFIG || {};
  const COURSE_ID = String(CLOUD_CONFIG.courseId || "1151");
  const DEFAULT_UPLOAD_ENDPOINT = String(CLOUD_CONFIG.uploadEndpoint || "").trim();
  const UPLOAD_TIMEOUT_MS = Number(CLOUD_CONFIG.uploadTimeoutMs || 45000);


  let workspace = null;
  const moduleWorkspaceStates = { M1: null, M2: null, M3P1: null, M3P2: null };
  const M3_QUESTIONS = [
    {title:"滿額免運", description:"消費滿 1,000 元（含）免運，否則收取 60 元運費。", basis:"商品小計", n:1000, op:">=", yes:"運費 0 元", no:"運費 60 元"},
    {title:"訂單人力調整", description:"今日訂單超過 50 筆，啟動加派人力，否則維持原配置。", basis:"今日訂單數", n:50, op:">", yes:"加派人力", no:"正常配置"},
    {title:"庫存補貨提醒", description:"商品庫存不足 10 件，發出補貨提醒。", basis:"庫存數量", n:10, op:"<", yes:"發出補貨提醒", no:"庫存充足"},
    {title:"限量購買", description:"每人購買數量不得超過 5 件；5 件也符合規定。", basis:"購買數量", n:5, op:"<=", yes:"允許購買", no:"超過限量"},
    {title:"商品缺貨", description:"商品庫存剛好為 0 件，顯示缺貨。", basis:"庫存數量", n:0, op:"==", yes:"顯示缺貨", no:"仍有庫存"},
    {title:"商品接單", description:"剩餘庫存不等於 0 件，才可以繼續接單。", basis:"剩餘庫存", n:0, op:"!=", yes:"可接單", no:"停止接單"}
  ];
  const M3_OPERATORS = [["> 大於", ">"], ["≥ 大於等於", ">="], ["< 小於", "<"], ["≤ 小於等於", "<="], ["= 等於", "=="], ["≠ 不等於", "!="]];
  const defaultM3Decision = () => ({
    M3P1: { selected:0, items:M3_QUESTIONS.map(q => ({op:"", testValue:String(q.n), prediction:"", history:[]})) },
    M3P2: { topic:"", description:"", basis:"", rules:[{op:">=", threshold:"", result:""},{op:">=", threshold:"", result:""}], otherwise:"", testValue:"", prediction:"", history:[] }
  });
  let m3Decision = defaultM3Decision();
  let m3VisibleTab = {M3P1:"decision",M3P2:"decision"};
  let activeProfile = null;
  let autosaveTimer = null;
  let isRunning = false;
  let openedProjectMeta = null;
  let uploadInProgress = false;
  let isModuleSwitching = false;
  let projectState = {
    projectName: DEFAULT_PROJECT_NAME,
    eligible: true,
    records: [
      { name: "咖啡", price: 80, qty: 2, subtotal: null, status: "" },
      { name: "蛋糕", price: 120, qty: 1, subtotal: null, status: "" },
      { name: "果汁", price: 60, qty: 3, subtotal: null, status: "" }
    ]
  };

  const $ = (id) => document.getElementById(id);

  function safeParse(value, fallback = null) {
    try { return JSON.parse(value); }
    catch (_) { return fallback; }
  }

  function normalizeStudentId(value) {
    return String(value || "").trim().toUpperCase();
  }

  function loadProfileRegistry() {
    const registry = safeParse(localStorage.getItem(PROFILE_REGISTRY_KEY), {});
    return registry && typeof registry === "object" ? registry : {};
  }

  function saveProfileRegistry(registry) {
    localStorage.setItem(PROFILE_REGISTRY_KEY, JSON.stringify(registry));
  }

  function migrateLegacyProfile() {
    const registry = loadProfileRegistry();
    const legacy = safeParse(localStorage.getItem(LEGACY_PROFILE_KEY), null);

    if (legacy && legacy.studentId && legacy.studentKey) {
      const id = normalizeStudentId(legacy.studentId);
      if (!registry[id]) {
        registry[id] = {
          studentId: id,
          studentName: legacy.studentName || "",
          studentKey: legacy.studentKey,
          createdAt: legacy.createdAt || isoNow(),
          lastUsedAt: legacy.lastUsedAt || isoNow(),
          keyOrigin: "legacy-v0.2.3"
        };
        saveProfileRegistry(registry);
      }
      if (!localStorage.getItem(ACTIVE_PROFILE_KEY)) {
        localStorage.setItem(ACTIVE_PROFILE_KEY, id);
      }
      localStorage.removeItem(LEGACY_PROFILE_KEY);
    }
  }

  function loadActiveProfile() {
    const id = normalizeStudentId(localStorage.getItem(ACTIVE_PROFILE_KEY));
    if (!id) return null;
    const registry = loadProfileRegistry();
    return registry[id] || null;
  }

  function findStoredProfile(studentId) {
    const id = normalizeStudentId(studentId);
    if (!id) return null;
    const registry = loadProfileRegistry();
    return registry[id] || null;
  }

  function storeProfile(profile, makeActive = true) {
    const id = normalizeStudentId(profile.studentId);
    if (!id || !profile.studentKey) return null;

    const registry = loadProfileRegistry();
    const current = registry[id] || {};
    const stored = {
      studentId: id,
      studentName: profile.studentName || current.studentName || "",
      studentKey: profile.studentKey,
      createdAt: profile.createdAt || current.createdAt || isoNow(),
      lastUsedAt: isoNow(),
      keyOrigin: profile.keyOrigin || current.keyOrigin || "browser"
    };
    registry[id] = stored;
    saveProfileRegistry(registry);

    if (makeActive) {
      localStorage.setItem(ACTIVE_PROFILE_KEY, id);
    }
    return stored;
  }

  function deactivateProfile() {
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
  }

  function makeStudentKey() {
    try {
      if (crypto && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }
      if (crypto && typeof crypto.getRandomValues === "function") {
        const buf = new Uint32Array(4);
        crypto.getRandomValues(buf);
        return Array.from(buf).map(n => n.toString(16).padStart(8, "0")).join("-");
      }
    } catch (_) {}
    return `local-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }

  function sanitizeFilenamePart(text) {
    return String(text || "")
      .trim()
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 40) || "unknown";
  }

  function timestampForFilename(date = new Date()) {
    const p = (n, len = 2) => String(n).padStart(len, "0");
    return (
      date.getFullYear() +
      p(date.getMonth() + 1) +
      p(date.getDate()) + "_" +
      p(date.getHours()) +
      p(date.getMinutes()) +
      p(date.getSeconds())
    );
  }

  function isoNow() {
    return new Date().toISOString();
  }

  function getAutosaveKey() {
    if (!activeProfile) return null;
    return `businessBlockly.autosave.modules.v3.${activeProfile.studentKey}`;
  }

  function getLegacyAutosaveKey() {
    if (!activeProfile) return null;
    return `businessBlockly.autosave.m1.v2.${activeProfile.studentKey}`;
  }

  function getProgressKey() {
    if (!activeProfile) return null;
    return `businessBlockly.progress.m1.v2.${activeProfile.studentKey}`;
  }

  function shortStudentKey(key) {
    const value = String(key || "");
    return value.length > 8 ? value.slice(-8) : value;
  }

  function setIdentityUi() {
    if (!activeProfile) return;
    $("currentIdentity").textContent =
      `👤 ${activeProfile.studentId} ${activeProfile.studentName} · ✓ 身分已確認`;
    $("currentIdentity").title =
      `studentKey 末 8 碼：${shortStudentKey(activeProfile.studentKey)}`;
    $("footerIdentity").textContent =
      `使用者：${activeProfile.studentId} ${activeProfile.studentName}`;
  }

  function showIdentityScreen(forceNewUser = false) {
    migrateLegacyProfile();
    const profile = loadActiveProfile();
    $("identityScreen").classList.remove("hidden");
    $("identityError").textContent = "";

    if (!forceNewUser && profile && profile.studentId && profile.studentName && profile.studentKey) {
      $("newIdentityPanel").classList.add("hidden");
      $("returnIdentityPanel").classList.remove("hidden");
      $("returnUserName").textContent = `${profile.studentId} ${profile.studentName}`;
    } else {
      $("newIdentityPanel").classList.remove("hidden");
      $("returnIdentityPanel").classList.add("hidden");
      $("studentIdInput").value = "";
      $("studentNameInput").value = "";
      setTimeout(() => $("studentIdInput").focus(), 60);
    }
  }

  function createIdentity() {
    const studentId = normalizeStudentId($("studentIdInput").value);
    const studentName = $("studentNameInput").value.trim();
    const error = $("identityError");
    error.textContent = "";

    if (!studentId || !/^[A-Z0-9_-]{4,20}$/.test(studentId)) {
      error.textContent = "請輸入正確的學號。";
      $("studentIdInput").focus();
      return;
    }
    if (!studentName || studentName.length < 2) {
      error.textContent = "請輸入姓名。";
      $("studentNameInput").focus();
      return;
    }

    const existing = findStoredProfile(studentId);

    if (existing) {
      activeProfile = storeProfile({
        ...existing,
        studentName,
        keyOrigin: existing.keyOrigin || "browser"
      });
    } else {
      activeProfile = storeProfile({
        studentId,
        studentName,
        studentKey: makeStudentKey(),
        createdAt: isoNow(),
        keyOrigin: "browser"
      });
    }

    beginAppForProfile();

    const notice = $("projectNotice");
    if (existing) {
      notice.textContent =
        `✓ 已沿用 ${studentId} 在這台電腦原本的 studentKey（末 8 碼：${shortStudentKey(activeProfile.studentKey)}）。`;
      notice.classList.remove("hidden");
    }
  }

  function continueIdentity() {
    activeProfile = loadActiveProfile();
    if (!activeProfile) {
      showIdentityScreen(true);
      return;
    }
    activeProfile = storeProfile(activeProfile);
    beginAppForProfile();
  }

  function switchIdentity() {
    if (activeProfile && workspace) {
      scheduleAutosave(true);
    }
    deactivateProfile();
    activeProfile = null;
    showIdentityScreen(true);
  }

  function restoreStudentKeyFromOwnProject(sourceStudent) {
    if (!activeProfile || !sourceStudent) return false;

    const sourceId = normalizeStudentId(sourceStudent.studentId);
    const activeId = normalizeStudentId(activeProfile.studentId);
    const sourceKey = String(sourceStudent.studentKey || "").trim();

    if (!sourceId || !sourceKey || sourceId !== activeId) {
      return false;
    }

    if (sourceKey === activeProfile.studentKey) {
      return false;
    }

    activeProfile = storeProfile({
      ...activeProfile,
      studentKey: sourceKey,
      keyOrigin: "own-project",
      keyRestoredAt: isoNow()
    });
    setIdentityUi();
    return true;
  }

  function beginAppForProfile() {
    $("identityScreen").classList.add("hidden");
    activeProfile = storeProfile(activeProfile);
    setIdentityUi();

    if (!workspace) {
      initBlockly();
      bindWorkspaceEvents();
    }

    openedProjectMeta = null;
    $("projectNotice").classList.add("hidden");
    clearGuiMessages();
    setRunStatus("neutral", "尚未執行", "把積木接好後，按下執行程式。");

    const restored = restoreAutosave();
    if (!restored) {
      $("autosaveStatus").textContent = "自動暫存：已啟用";
    }
    applyModuleUi();
    restoreProgress();
    renderProjectState();
    updatePython();
    updateWorkspaceHint();

    // 重要：boot() 執行時 activeProfile 尚未建立，因此上傳按鈕會先被 disabled。
    // 身分確認完成後必須重新計算雲端狀態，才能正確啟用「上傳作業」。
    refreshCloudUi();
  }


  function normalizeWebAppUrl(value) {
    const url = String(value || "").trim();
    if (!url) return "";
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:[?#].*)?$/i.test(url)) {
      return "";
    }
    return url;
  }

  function getUploadEndpoint() {
    const fixed = normalizeWebAppUrl(DEFAULT_UPLOAD_ENDPOINT);
    if (fixed) return fixed;
    return normalizeWebAppUrl(localStorage.getItem(DEV_UPLOAD_ENDPOINT_KEY));
  }

  function setCloudStatus(kind, title, detail) {
    const box = $("cloudStatus");
    if (!box) return;
    box.className = `cloud-status ${kind}`;
    box.querySelector("strong").textContent = title;
    box.querySelector("p").textContent = detail;
  }

  function getLastSubmissionKey() {
    if (!activeProfile) return null;
    return `${LAST_SUBMISSION_PREFIX}.${activeProfile.studentKey}.${activeModule}`;
  }

  function refreshCloudUi() {
    if (!$("uploadProjectBtn")) return;

    const endpoint = getUploadEndpoint();
    const cloudSetupBtn = $("cloudSetupBtn");
    if (cloudSetupBtn) {
      cloudSetupBtn.classList.toggle("hidden", Boolean(endpoint));
    }
    const badge = $("cloudConfigBadge");
    const setupBtn = $("cloudSetupBtn");
    const uploadBtn = $("uploadProjectBtn");

    if (!endpoint) {
      badge.textContent = "尚未設定";
      badge.className = "cloud-badge pending";
      setupBtn.textContent = "⚙ 設定上傳後端";
      uploadBtn.disabled = true;
      setCloudStatus(
        "neutral",
        "尚未連接後端",
        "測試版先設定 Apps Script Web App，再使用「上傳作業」。"
      );
      return;
    }

    badge.textContent = "後端已設定";
    badge.className = "cloud-badge ready";
    setupBtn.textContent = DEFAULT_UPLOAD_ENDPOINT ? "✓ 使用正式後端設定" : "⚙ 變更測試後端";
    setupBtn.disabled = Boolean(DEFAULT_UPLOAD_ENDPOINT);
    uploadBtn.disabled = !activeProfile || uploadInProgress;

    const key = getLastSubmissionKey();
    const last = key ? safeParse(localStorage.getItem(key), null) : null;
    if (last && last.serverTime) {
      const when = new Date(last.serverTime);
      const displayTime = Number.isNaN(when.getTime())
        ? last.serverTime
        : when.toLocaleString("zh-TW", { hour12: false });
      setCloudStatus(
        "success",
        `${activeModule} 最近一次上傳成功`,
        `${displayTime} · 編號 ${String(last.submissionId || "").slice(0, 8)}`
      );
    } else {
      setCloudStatus(
        "neutral",
        "可以上傳",
        "按下上傳後會另開「上傳結果」頁面；請以該頁面顯示的成功／失敗為準。"
      );
    }
  }

  function configureUploadEndpoint() {
    if (DEFAULT_UPLOAD_ENDPOINT) {
      alert("目前版本已固定使用正式後端，不需要另外設定。");
      return;
    }

    const current = getUploadEndpoint();
    const entered = prompt(
      "請貼上 Apps Script Web App 的 /exec 網址：",
      current || ""
    );
    if (entered === null) return;

    const url = normalizeWebAppUrl(entered);
    if (!url) {
      alert("網址格式不正確。請使用部署後以 /exec 結尾的 Apps Script Web App 網址。");
      return;
    }

    localStorage.setItem(DEV_UPLOAD_ENDPOINT_KEY, url);
    refreshCloudUi();
  }

  function makeRequestId() {
    try {
      if (crypto && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }
    } catch (_) {}
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }

  function submitProjectToReceiptPage(endpoint, payload) {
    const receiptName =
      `bbReceipt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Open while still inside the user's click event so browsers treat it as intentional.
    const receiptWindow = window.open("", receiptName);
    if (!receiptWindow) {
      throw new Error(
        "瀏覽器阻擋了上傳確認頁。請允許此頁面開啟彈出式視窗後再試一次。"
      );
    }

    try {
      receiptWindow.document.write(
        '<!doctype html><html><head><meta charset="utf-8">' +
        '<title>作業上傳中</title></head>' +
        '<body style="font-family:system-ui,-apple-system,Segoe UI,Microsoft JhengHei,sans-serif;' +
        'padding:32px;color:#24324b;background:#f6f8fc">' +
        '<div style="max-width:620px;margin:auto;background:white;border:1px solid #dde5f0;' +
        'border-radius:16px;padding:26px;box-shadow:0 10px 30px rgba(35,55,90,.08)">' +
        '<h2 style="margin-top:0">☁️ 作業上傳中…</h2>' +
        '<p>正在等待伺服器處理，請不要關閉這個頁面。</p>' +
        '</div></body></html>'
      );
      receiptWindow.document.close();
    } catch (_) {}

    const form = document.createElement("form");
    form.method = "POST";
    form.action = endpoint;
    form.target = receiptName;
    form.acceptCharset = "UTF-8";
    form.style.display = "none";

    const payloadInput = document.createElement("input");
    payloadInput.type = "hidden";
    payloadInput.name = "payload";
    payloadInput.value = JSON.stringify(payload);
    form.appendChild(payloadInput);

    document.body.appendChild(form);
    try {
      form.submit();
    } finally {
      setTimeout(() => form.remove(), 1000);
    }
  }

  async function uploadProject() {
    if (uploadInProgress || !activeProfile || !workspace) return;

    const endpoint = getUploadEndpoint();
    if (!endpoint) {
      configureUploadEndpoint();
      return;
    }

    const project = buildProjectPayload();
    const requestId = makeRequestId();
    const payload = {
      action: "submitProject",
      requestId,
      courseId: COURSE_ID,
      clientSubmittedAt: isoNow(),
      ...project
    };

    uploadInProgress = true;
    $("uploadProjectBtn").disabled = true;
    setCloudStatus(
      "uploading",
      "正在送出作業…",
      "系統會開啟一個新的「上傳結果」頁面；請以該頁面顯示的結果為準。"
    );

    try {
      submitProjectToReceiptPage(endpoint, payload);

      // This is only "sent", not server-confirmed.
      setCloudStatus(
        "neutral",
        "已開啟上傳確認頁",
        "請以新視窗中的伺服器結果為準；看到綠色「上傳成功」才算完成。"
      );

      const notice = $("projectNotice");
      notice.textContent =
        `☁️ 已送出 ${activeProfile.studentId} ${activeProfile.studentName} · ${activeModule}。請查看新開啟的上傳結果頁面。`;
      notice.classList.remove("hidden");
    } catch (err) {
      console.error("Upload launch failed:", err);
      setCloudStatus(
        "error",
        "無法開啟上傳確認頁",
        err && err.message ? err.message : "請允許彈出式視窗後再試一次。"
      );
    } finally {
      setTimeout(() => {
        uploadInProgress = false;
        $("uploadProjectBtn").disabled = !getUploadEndpoint() || !activeProfile;
      }, 2500);
    }
  }

  function currentProjectName() {
    const input = $("projectTitleInput");
    const value = input ? input.value.trim() : String(projectState.projectName || "").trim();
    return value || DEFAULT_PROJECT_NAME;
  }

  function pythonString(value) {
    return JSON.stringify(String(value == null ? "" : value));
  }

  function defineBlocks() {
    Blockly.Blocks["flow_show_text"] = {
      init: function() {
        this.appendDummyInput()
          .appendField("顯示")
          .appendField(new Blockly.FieldTextInput("請輸入要顯示的文字"), "TEXT");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(214);
        this.setTooltip("M1：依照流程順序顯示一段可以自行修改的文字");
      }
    };

    const M2_VARIABLE_OPTIONS = [
      ["商品名稱", "productName"],
      ["商品單價", "price"],
      ["購買數量", "quantity"],
      ["目前庫存", "currentStock"],
      ["會員名稱", "memberName"],
      ["原有點數", "currentPoints"],
      ["商品小計", "subtotal"],
      ["剩餘庫存", "remainingStock"],
      ["本次獲得點數", "earnedPoints"],
      ["累積點數", "totalPoints"]
    ];

    const M3_VARIABLE_OPTIONS = [
      ["運費", "shippingFee"], ["應付總金額", "finalPayment"], ["消費金額", "spendingAmount"],
      ["回饋券金額", "voucherAmount"]
    ];
    const visibleVariableOptions = () => activeModule.startsWith("M3")
      ? M2_VARIABLE_OPTIONS.concat(M3_VARIABLE_OPTIONS) : M2_VARIABLE_OPTIONS;

    Blockly.Blocks["data_set_variable"] = {
      init: function() {
        this.appendValueInput("VALUE")
          .appendField("設定")
          .appendField(new Blockly.FieldDropdown(visibleVariableOptions), "VAR")
          .appendField("為");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(155);
        this.setTooltip("M2：把資料存進指定的變數");
      }
    };

    Blockly.Blocks["data_get_variable"] = {
      init: function() {
        this.appendDummyInput()
          .appendField("取得")
          .appendField(new Blockly.FieldDropdown(visibleVariableOptions), "VAR");
        this.setOutput(true, null);
        this.setColour(155);
        this.setTooltip("M2：取得變數目前保存的資料");
      }
    };

    Blockly.Blocks["data_text_value"] = {
      init: function() {
        this.appendDummyInput()
          .appendField("文字")
          .appendField(new Blockly.FieldTextInput("紅茶"), "TEXT");
        this.setOutput(true, "String");
        this.setColour(185);
        this.setTooltip("M2：文字資料，例如商品名稱");
      }
    };

    Blockly.Blocks["data_number_value"] = {
      init: function() {
        this.appendDummyInput()
          .appendField("數值")
          .appendField(new Blockly.FieldNumber(0, null, null, 0.1), "NUM");
        this.setOutput(true, "Number");
        this.setColour(185);
        this.setTooltip("M2：數值資料，可以是整數或小數");
      }
    };

    Blockly.Blocks["data_arithmetic"] = {
      init: function() {
        this.appendValueInput("A").setCheck(null);
        this.appendDummyInput()
          .appendField(new Blockly.FieldDropdown([
            ["＋", "ADD"],
            ["－", "MINUS"],
            ["×", "MULTIPLY"],
            ["÷", "DIVIDE"]
          ]), "OP");
        this.appendValueInput("B").setCheck(null);
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setColour(230);
        this.setTooltip("M2：使用四則運算處理數值資料");
      }
    };

    Blockly.Blocks["data_show_value"] = {
      init: function() {
        this.appendValueInput("VALUE")
          .appendField("顯示資料");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(214);
        this.setTooltip("M2：顯示資料；若接變數，會自動顯示變數名稱與目前值");
      }
    };

    Blockly.Blocks["data_reset_totals"] = {
      init: function() {
        this.appendDummyInput().appendField("初始化：總金額、處理筆數、折扣歸零");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(155);
        this.setTooltip("M2：建立並初始化程式需要使用的資料");
      }
    };

    Blockly.Blocks["data_calc_subtotal"] = {
      init: function() {
        this.appendDummyInput().appendField("計算本筆小計 = 單價 × 數量");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(155);
        this.setTooltip("M2：用資料進行計算");
      }
    };

    Blockly.Blocks["data_accumulate"] = {
      init: function() {
        this.appendDummyInput().appendField("累加小計到總金額，處理筆數 + 1");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(155);
        this.setTooltip("M2：更新變數與累加結果");
      }
    };

    Blockly.Blocks["m3_compare"] = {
      init: function() {
        this.appendValueInput("A").setCheck(null);
        this.appendDummyInput().appendField(new Blockly.FieldDropdown(M3_OPERATORS), "OP");
        this.appendValueInput("B").setCheck(null);
        this.setInputsInline(true); this.setOutput(true, "Boolean"); this.setColour(270);
        this.setTooltip("比較左、右兩筆資料。滿／含表示大於等於；超過表示大於。");
      }
    };
    Blockly.Blocks["m3_if_single"] = {
      init: function() {
        this.appendValueInput("IF0").setCheck("Boolean").appendField("如果");
        this.appendStatementInput("DO0").appendField("就執行");
        this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(35);
        this.setTooltip("單向 IF：條件成立才執行，否則略過。");
      }
    };
    Blockly.Blocks["m3_if_else"] = {
      init: function() {
        this.appendValueInput("IF0").setCheck("Boolean").appendField("如果");
        this.appendStatementInput("DO0").appendField("就執行");
        this.appendStatementInput("ELSE").appendField("否則");
        this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(35);
        this.setTooltip("雙向 IF / ELSE：成立與不成立時，執行不同內容。");
      }
    };

    Blockly.Blocks["condition_if_valid"] = {
      init: function() {
        this.appendDummyInput().appendField("如果 本筆資料正確");
        this.appendStatementInput("DO").appendField("就");
        this.appendStatementInput("ELSE").appendField("否則");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(35);
        this.setTooltip("M3：根據資料是否有效，決定要走哪一條流程");
      }
    };

    Blockly.Blocks["rule_eligible_discount"] = {
      init: function() {
        this.appendDummyInput()
          .appendField("商業規則：符合優惠資格 且 總金額 ≥")
          .appendField(new Blockly.FieldNumber(400, 0, 999999, 1), "THRESHOLD")
          .appendField("元，折扣")
          .appendField(new Blockly.FieldNumber(10, 0, 100, 1), "RATE")
          .appendField("%");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(300);
        this.setTooltip("M4：把條件、門檻與計算組合成真正的商業規則");
      }
    };

    Blockly.Blocks["loop_each_record"] = {
      init: function() {
        this.appendDummyInput().appendField("重複處理 每一筆資料");
        this.appendStatementInput("DO").appendField("執行");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(120);
        this.setTooltip("M5：對資料清單中的每一筆資料重複執行相同流程");
      }
    };

    Blockly.Blocks["summary_show"] = {
      init: function() {
        this.appendDummyInput().appendField("顯示整合摘要：筆數、原始金額、折扣、最後金額");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(20);
        this.setTooltip("M6：把前面所有處理結果整合成完整輸出");
      }
    };

    // Legacy M1 blocks remain loadable so earlier project files do not immediately break.
    const legacy = {
      shop_show_welcome: "歡迎使用小店營運助手",
      shop_show_start: "開始結帳",
      shop_show_done: "結帳完成"
    };
    Object.entries(legacy).forEach(([type, text]) => {
      Blockly.Blocks[type] = {
        init: function() {
          this.appendDummyInput().appendField(`顯示「${text}」`);
          this.setPreviousStatement(true, null);
          this.setNextStatement(true, null);
          this.setColour(214);
          this.setTooltip("舊版 M1 相容積木");
        }
      };
    });
  }

  function registerClassroomRenderer() {
    const rendererName = "classroom_geras";

    // v0.3.7.2：積木本體依 24px 教學字級重新計算尺寸，
    // 不是靠 workspace zoom 把整張畫布放大。
    class ClassroomConstantProvider extends Blockly.geras.ConstantProvider {
      constructor() {
        super();

        // 字體與欄位
        this.FIELD_TEXT_FONTSIZE = 24;
        this.FIELD_TEXT_FONTWEIGHT = "normal";
        this.FIELD_BORDER_RECT_HEIGHT = 34;
        this.FIELD_BORDER_RECT_X_PADDING = 9;
        this.FIELD_BORDER_RECT_Y_PADDING = 6;
        this.FIELD_BORDER_RECT_RADIUS = 6;
        this.FIELD_DROPDOWN_BORDER_RECT_HEIGHT = 34;
        this.FIELD_DROPDOWN_SVG_ARROW_SIZE = 14;
        this.FIELD_DROPDOWN_SVG_ARROW_PADDING = 8;

        // 積木本體與行距
        this.MIN_BLOCK_HEIGHT = 48;
        this.MIN_BLOCK_WIDTH = 20;
        this.SPACER_DEFAULT_HEIGHT = 24;
        this.DUMMY_INPUT_MIN_HEIGHT = 36;
        this.DUMMY_INPUT_SHADOW_MIN_HEIGHT = 36;
        this.EMPTY_INLINE_INPUT_HEIGHT = 42;
        this.EMPTY_INLINE_INPUT_PADDING = 22;
        this.EXTERNAL_VALUE_INPUT_PADDING = 5;
        this.SMALL_PADDING = 5;
        this.MEDIUM_PADDING = 8;
        this.MEDIUM_LARGE_PADDING = 12;
        this.LARGE_PADDING = 15;
        this.TALL_INPUT_FIELD_OFFSET_Y = 8;

        // 接合處也同步放大，避免大字配小凹槽。
        this.NOTCH_WIDTH = 22;
        this.NOTCH_HEIGHT = 6;
        this.NOTCH_OFFSET_LEFT = 22;
        this.TAB_HEIGHT = 23;
        this.TAB_WIDTH = 12;
        this.TAB_OFFSET_FROM_TOP = 8;
        this.TAB_VERTICAL_OVERLAP = 4;
        this.CORNER_RADIUS = 10;
        this.STATEMENT_INPUT_PADDING_LEFT = 30;
        this.BETWEEN_STATEMENT_PADDING_Y = 6;
        this.TOP_ROW_MIN_HEIGHT = 8;
        this.TOP_ROW_PRECEDES_STATEMENT_MIN_HEIGHT = 14;
        this.BOTTOM_ROW_MIN_HEIGHT = 8;
        this.BOTTOM_ROW_AFTER_STATEMENT_MIN_HEIGHT = 14;
      }
    }

    class ClassroomRenderer extends Blockly.geras.Renderer {
      makeConstants_() {
        return new ClassroomConstantProvider();
      }
    }

    try { Blockly.blockRendering.unregister(rendererName); } catch (_) {}
    Blockly.blockRendering.register(rendererName, ClassroomRenderer);
    return rendererName;
  }

  function buildToolbox(moduleName) {
    const contents = [
      {
        kind: "category",
        name: "前導｜操作練習",
        colour: "#6B7A90",
        contents: [
          { kind: "block", type: "flow_show_text", fields: { TEXT: "我的第一個顯示文字" } }
        ]
      },
      {
        kind: "category",
        name: "M1 流程與順序",
        colour: "#2F6FED",
        contents: [{ kind: "block", type: "flow_show_text" }]
      }
    ];

    if (moduleName !== "M1") {
      contents.push({
        kind: "category",
        name: "M2 資料與處理",
        colour: "#3F8F72",
        contents: [
          { kind: "block", type: "data_set_variable" },
          { kind: "block", type: "data_get_variable" },
          { kind: "block", type: "data_text_value" },
          { kind: "block", type: "data_number_value" },
          { kind: "block", type: "data_arithmetic" },
          { kind: "block", type: "data_show_value" }
        ]
      });
    }

    if (moduleName.startsWith("M3")) {
      const conditionBlocks = [
        {kind:"block",type:"m3_compare"},
        {kind:"block",type:"m3_if_single"},
        {kind:"block",type:"m3_if_else"}
      ];
      if (moduleName === "M3P2") {
        conditionBlocks.push({
          kind:"block",type:"controls_if",extraState:{elseIfCount:2,hasElse:true}
        });
      }

      // M3 是獨立畫布，條件判斷也需要 M1 / M2 已學過的資料積木。
      // 將必要積木直接放在 M3 抽屜中，學生不必切換到 M2 尋找；
      // M1 / M2 原本的工具箱及畫布保持不變。
      conditionBlocks.push(
        { kind: "block", type: "data_set_variable" },
        { kind: "block", type: "data_get_variable" },
        { kind: "block", type: "data_number_value" },
        { kind: "block", type: "data_arithmetic" },
        { kind: "block", type: "data_show_value" },
        { kind: "block", type: "data_text_value" },
        { kind: "block", type: "flow_show_text" }
      );
      contents.push({kind:"category",name:"M3 條件與判斷",colour:"#B17B2F",contents:conditionBlocks});
    }
    return { kind: "categoryToolbox", contents };
  }

  function initBlockly() {
    defineBlocks();
    const classroomRenderer = registerClassroomRenderer();

    workspace = Blockly.inject("blocklyDiv", {
      toolbox: buildToolbox(activeModule),
      media: "./vendor/blockly/media/",
      renderer: classroomRenderer,
      grid: { spacing: 22, length: 3, colour: "#d8dfeb", snap: true },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 1.0,
        maxScale: 1.35,
        minScale: 0.55,
        scaleSpeed: 1.08
      },
      trashcan: true,
      move: { scrollbars: true, drag: true, wheel: true }
    });

    setTimeout(() => {
      configurePersistentToolbox();
      bindToolboxFirstLevelAutoExpand();
      selectToolboxCategory(MODULE_CONFIG[activeModule].category);
      Blockly.svgResize(workspace);
    }, 100);
  }

  function selectToolboxCategory(categoryName) {
    if (!workspace) return;

    try {
      const toolbox = workspace.getToolbox && workspace.getToolbox();
      if (!toolbox) return;

      const items = toolbox.getToolboxItems && toolbox.getToolboxItems();
      if (!Array.isArray(items)) return;

      const item = items.find(candidate => {
        try {
          return candidate && candidate.getName && candidate.getName() === categoryName;
        } catch (_) {
          return false;
        }
      });

      if (!item) return;

      if (typeof toolbox.setSelectedItem === "function") {
        toolbox.setSelectedItem(item);
      }

      const flyout = toolbox.getFlyout && toolbox.getFlyout();
      if (flyout && item.getContents) {
        if (typeof flyout.setAutoClose === "function") {
          flyout.setAutoClose(false);
        } else {
          flyout.autoClose = false;
        }
        flyout.show(item.getContents());
        updateFlyoutButton(false);
      }
    } catch (err) {
      console.warn("selectToolboxCategory:", err);
    }
  }

  function getMainFlyout() {
    if (!workspace) return null;

    try {
      const toolbox = workspace.getToolbox && workspace.getToolbox();
      return (
        (toolbox && toolbox.getFlyout && toolbox.getFlyout()) ||
        (workspace.getFlyout && workspace.getFlyout()) ||
        null
      );
    } catch (_) {
      return null;
    }
  }

  function configurePersistentToolbox() {
    const flyout = getMainFlyout();
    if (!flyout) return;

    try {
      // While the drawer is open, dragging a block should NOT close it.
      // setAutoClose(false) also tells Blockly this flyout occupies workspace width.
      if (typeof flyout.setAutoClose === "function") {
        flyout.setAutoClose(false);
      } else {
        flyout.autoClose = false;
      }
    } catch (err) {
      console.warn("configurePersistentToolbox:", err);
    }
  }

  function refreshBlocklyLayout() {
    if (!workspace) return;

    try {
      if (typeof workspace.resizeContents === "function") {
        workspace.resizeContents();
      }
    } catch (_) {}

    try {
      Blockly.svgResize(workspace);
    } catch (_) {}
  }

  function updateFlyoutButton(collapsed) {
    const btn = $("toggleFlyoutBtn");
    const host = $("blocklyDiv");

    if (host) host.classList.toggle("flyout-collapsed", collapsed);

    if (btn) {
      btn.dataset.collapsed = collapsed ? "1" : "0";
      btn.textContent = collapsed ? "▶ 展開積木" : "◀ 收起積木";
      btn.title = collapsed
        ? "重新顯示目前分類的第二層積木"
        : "收起第二層積木並把空間還給畫布";
    }
  }

  function collapseFlyout() {
    const flyout = getMainFlyout();
    if (!flyout) return;

    try {
      // IMPORTANT:
      // Blockly's metrics reserve flyout width whenever autoClose === false.
      // So merely display:none leaves a fake blank area.
      // Switch to autoClose=true BEFORE hiding, so the canvas can reclaim width.
      if (typeof flyout.setAutoClose === "function") {
        flyout.setAutoClose(true);
      } else {
        flyout.autoClose = true;
      }

      if (typeof flyout.hide === "function") {
        flyout.hide();
      } else if (typeof flyout.setVisible === "function") {
        flyout.setVisible(false);
      }
    } catch (err) {
      console.warn("collapseFlyout:", err);
    }

    updateFlyoutButton(true);
    setTimeout(refreshBlocklyLayout, 30);
    setTimeout(refreshBlocklyLayout, 120);
  }

  function showSelectedFlyout() {
    if (!workspace) return;

    const toolbox = workspace.getToolbox && workspace.getToolbox();
    const flyout = getMainFlyout();
    if (!toolbox || !flyout) return;

    try {
      const selected =
        toolbox.getSelectedItem && toolbox.getSelectedItem();

      // Keep it persistent once opened.
      if (typeof flyout.setAutoClose === "function") {
        flyout.setAutoClose(false);
      } else {
        flyout.autoClose = false;
      }

      if (selected && typeof selected.getContents === "function") {
        flyout.show(selected.getContents());
      }

      updateFlyoutButton(false);
    } catch (err) {
      console.warn("showSelectedFlyout:", err);
    }

    setTimeout(refreshBlocklyLayout, 30);
    setTimeout(refreshBlocklyLayout, 120);
  }

  function toggleFlyout() {
    const btn = $("toggleFlyoutBtn");
    const collapsed = Boolean(btn && btn.dataset.collapsed === "1");

    if (collapsed) {
      showSelectedFlyout();
    } else {
      collapseFlyout();
    }
  }

  function bindToolboxFirstLevelAutoExpand() {
    const host = $("blocklyDiv");
    if (!host || host.dataset.flyoutBound === "1") return;
    host.dataset.flyoutBound = "1";

    host.addEventListener("click", e => {
      const firstLevel =
        e.target.closest(".blocklyToolboxCategory") ||
        e.target.closest(".blocklyTreeRow");

      if (!firstLevel) return;

      // Let Blockly process category selection first.
      // Then make the newly opened drawer persistent and recalculate metrics.
      setTimeout(() => {
        const flyout = getMainFlyout();
        if (!flyout) return;

        try {
          if (typeof flyout.setAutoClose === "function") {
            flyout.setAutoClose(false);
          } else {
            flyout.autoClose = false;
          }
        } catch (_) {}

        updateFlyoutButton(false);
        refreshBlocklyLayout();
      }, 0);
    }, false);
  }

  function bindWorkspaceEvents() {
    workspace.addChangeListener((event) => {
      if (isModuleSwitching) return;
      if (event && event.isUiEvent) return;
      updatePython();
      updateFlowchart();
      updateWorkspaceHint();
      captureActiveModuleState();
      scheduleAutosave();
    });
  }

  function getTopStacks() {
    if (!workspace) return [];
    return workspace.getTopBlocks(true).filter(b => !b.isShadow());
  }

  function flattenStack(topBlock) {
    const arr = [];
    let block = topBlock;
    while (block) {
      arr.push(block);
      block = block.getNextBlock();
    }
    return arr;
  }

  function allProgramStacks() {
    return getTopStacks().map(top => flattenStack(top));
  }

  function updateWorkspaceHint() {
    if (!workspace) return;
    const blocks = workspace.getAllBlocks(false).filter(b => !b.isShadow());
    const topCount = getTopStacks().length;
    let text = `${blocks.length} 個積木`;
    if (blocks.length > 0) {
      text += topCount === 1 ? " · 1 條主流程" : ` · ${topCount} 條主流程`;
    }
    $("workspaceHint").textContent = text;
  }

  function blockInput(block, name) {
    return block && block.getInputTargetBlock ? block.getInputTargetBlock(name) : null;
  }

  function m2VariableLabel(key) {
    const labels = {
      productName: "商品名稱",
      price: "商品單價",
      quantity: "購買數量",
      currentStock: "目前庫存",
      memberName: "會員名稱",
      currentPoints: "原有點數",
      subtotal: "商品小計",
      remainingStock: "剩餘庫存",
      earnedPoints: "本次獲得點數",
      totalPoints: "累積點數", shippingFee:"運費", finalPayment:"應付總金額",
      spendingAmount:"消費金額", voucherAmount:"回饋券金額"
    };
    return labels[key] || key || "變數";
  }

  function m2PythonVariable(key) {
    const names = {
      productName: "productName",
      price: "price",
      quantity: "quantity",
      currentStock: "currentStock",
      memberName: "memberName",
      currentPoints: "originalPoints",
      subtotal: "subtotal",
      remainingStock: "remainingStock",
      earnedPoints: "earnedPoints",
      totalPoints: "totalPoints", shippingFee:"shippingFee", finalPayment:"finalPayment",
      spendingAmount:"spendingAmount", voucherAmount:"voucherAmount"
    };
    return names[key] || "value";
  }

  function m2DisplayLabel(valueBlock) {
    if (valueBlock && valueBlock.type === "data_get_variable") {
      return m2VariableLabel(valueBlock.getFieldValue("VAR"));
    }
    return "結果";
  }

  function m2ExpressionText(block) {
    if (!block) return "□";
    switch (block.type) {
      case "data_get_variable":
        return m2VariableLabel(block.getFieldValue("VAR"));
      case "data_text_value":
        return `「${block.getFieldValue("TEXT") || ""}」`;
      case "data_number_value":
        return String(block.getFieldValue("NUM") || 0);
      case "m3_compare":
        return `${m2ExpressionText(blockInput(block,"A"))} ${block.getFieldValue("OP")} ${m2ExpressionText(blockInput(block,"B"))}`;
      case "data_arithmetic": {
        const symbols = { ADD: "+", MINUS: "−", MULTIPLY: "×", DIVIDE: "÷" };
        return `${m2ExpressionText(blockInput(block, "A"))} ${symbols[block.getFieldValue("OP")] || "?"} ${m2ExpressionText(blockInput(block, "B"))}`;
      }
      default:
        return block.type;
    }
  }

  function m2PythonExpression(block) {
    if (!block) return "None";
    switch (block.type) {
      case "data_get_variable":
        return m2PythonVariable(block.getFieldValue("VAR"));
      case "data_text_value":
        return pythonString(block.getFieldValue("TEXT") || "");
      case "data_number_value":
        return String(Number(block.getFieldValue("NUM") || 0));
      case "m3_compare": {
        const a = m2PythonExpression(blockInput(block,"A"));
        const b = m2PythonExpression(blockInput(block,"B"));
        const pyOps = {"==":"==","!=":"!=",">":">",">=":">=","<":"<","<=":"<="};
        return `(${a} ${pyOps[block.getFieldValue("OP")] || "=="} ${b})`;
      }
      case "data_arithmetic": {
        const ops = { ADD: "+", MINUS: "-", MULTIPLY: "*", DIVIDE: "/" };
        return `(${m2PythonExpression(blockInput(block, "A"))} ${ops[block.getFieldValue("OP")] || "+"} ${m2PythonExpression(blockInput(block, "B"))})`;
      }
      default:
        return "None";
    }
  }

  function generatePythonChain(startBlock, indent = 0) {
    const lines = [];
    let block = startBlock;
    const pad = () => "    ".repeat(indent);

    while (block) {
      switch (block.type) {
        case "flow_show_text":
          lines.push(`${pad()}print(${pythonString(block.getFieldValue("TEXT"))})`);
          break;
        case "shop_show_welcome":
          lines.push(`${pad()}print("歡迎使用小店營運助手")`);
          break;
        case "shop_show_start":
          lines.push(`${pad()}print("開始結帳")`);
          break;
        case "shop_show_done":
          lines.push(`${pad()}print("結帳完成")`);
          break;
        case "data_set_variable":
          lines.push(`${pad()}${m2PythonVariable(block.getFieldValue("VAR"))} = ${m2PythonExpression(blockInput(block, "VALUE"))}`);
          break;
        case "data_show_value": {
          const valueBlock = blockInput(block, "VALUE");
          const label = m2DisplayLabel(valueBlock);
          lines.push(`${pad()}print(${pythonString(`${label}：`)}, ${m2PythonExpression(valueBlock)})`);
          break;
        }
        case "data_reset_totals":
          lines.push(`${pad()}total_amount = 0`);
          lines.push(`${pad()}processed_count = 0`);
          lines.push(`${pad()}discount_amount = 0`);
          break;
        case "data_calc_subtotal":
          lines.push(`${pad()}subtotal = item["price"] * item["qty"]`);
          break;
        case "data_accumulate":
          lines.push(`${pad()}total_amount += subtotal`);
          lines.push(`${pad()}processed_count += 1`);
          break;
        case "m3_if_single":
        case "m3_if_else":
        case "controls_if": {
          let index = 0;
          while (block.getInput("IF" + index)) {
            lines.push(`${pad()}${index ? "elif" : "if"} ${m2PythonExpression(blockInput(block,"IF"+index))}:`);
            const body = generatePythonChain(blockInput(block,"DO"+index), indent+1);
            lines.push(...(body.length ? body : [`${"    ".repeat(indent+1)}pass`]));
            index++;
          }
          if (block.getInput("ELSE")) {
            lines.push(`${pad()}else:`);
            const otherwise = generatePythonChain(blockInput(block,"ELSE"), indent+1);
            lines.push(...(otherwise.length ? otherwise : [`${"    ".repeat(indent+1)}pass`]));
          }
          break;
        }
        case "condition_if_valid": {
          lines.push(`${pad()}if item["name"] and item["price"] > 0 and item["qty"] > 0:`);
          const yes = generatePythonChain(blockInput(block, "DO"), indent + 1);
          lines.push(...(yes.length ? yes : [`${"    ".repeat(indent + 1)}pass`]));
          lines.push(`${pad()}else:`);
          const no = generatePythonChain(blockInput(block, "ELSE"), indent + 1);
          lines.push(...(no.length ? no : [`${"    ".repeat(indent + 1)}pass`]));
          break;
        }
        case "loop_each_record": {
          lines.push(`${pad()}for item in records:`);
          const inner = generatePythonChain(blockInput(block, "DO"), indent + 1);
          lines.push(...(inner.length ? inner : [`${"    ".repeat(indent + 1)}pass`]));
          break;
        }
        case "rule_eligible_discount": {
          const threshold = Number(block.getFieldValue("THRESHOLD") || 0);
          const rate = Number(block.getFieldValue("RATE") || 0);
          lines.push(`${pad()}discount_amount = 0`);
          lines.push(`${pad()}if eligible and total_amount >= ${threshold}:`);
          lines.push(`${"    ".repeat(indent + 1)}discount_amount = total_amount * ${rate / 100}`);
          lines.push(`${pad()}final_amount = total_amount - discount_amount`);
          break;
        }
        case "summary_show":
          lines.push(`${pad()}final_amount = total_amount - discount_amount`);
          lines.push(`${pad()}print(f"處理筆數：{processed_count}")`);
          lines.push(`${pad()}print(f"原始金額：{total_amount}")`);
          lines.push(`${pad()}print(f"折扣金額：{discount_amount}")`);
          lines.push(`${pad()}print(f"最後金額：{final_amount}")`);
          break;
        default:
          lines.push(`${pad()}# 尚未支援的積木：${block.type}`);
      }
      block = block.getNextBlock();
    }
    return lines;
  }

  function generateM1PythonChain(startBlock) {
    const lines = [];
    let block = startBlock;

    while (block) {
      switch (block.type) {
        case "flow_show_text":
          lines.push(`print(${pythonString(block.getFieldValue("TEXT"))})`);
          break;
        case "shop_show_welcome":
          lines.push('print("歡迎使用小店營運助手")');
          break;
        case "shop_show_start":
          lines.push('print("開始結帳")');
          break;
        case "shop_show_done":
          lines.push('print("結帳完成")');
          break;
        default:
          // v0.3.6.1 學生發布版只顯示 M1 已開放內容。
          break;
      }
      block = block.getNextBlock();
    }
    return lines;
  }

  function updatePython() {
    if (!workspace) return;
    const stacks = getTopStacks();
    if (!stacks.length) {
      $("pythonCode").textContent =
        "# 把積木拖到工作區後\n# 這裡會出現對應的 Python";
      return;
    }

    const lines = [];
    stacks.forEach((top, index) => {
      const stackLines = generatePythonChain(top);
      if (!stackLines.length) return;
      if (lines.length > 0) {
        lines.push("");
        lines.push("# 另一條尚未接到主流程的積木");
      }
      lines.push(...stackLines);
    });

    $("pythonCode").textContent = lines.length
      ? lines.join("\n")
      : "# 把 M2 積木拖到工作區後，這裡會顯示變數與運算的 Python 對照";
  }

  function flowchartEscape(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function flowchartLines(text, maxChars = 16) {
    const raw = String(text == null ? "" : text).trim();
    if (!raw) return [""];

    const lines = [];
    let current = "";
    for (const ch of raw) {
      current += ch;
      if (current.length >= maxChars) {
        lines.push(current);
        current = "";
      }
    }
    if (current) lines.push(current);
    return lines.slice(0, 4);
  }

  function flowchartTextSvg(text, cx, cy, options = {}) {
    const lines = flowchartLines(text, options.maxChars || 16);
    const lineHeight = options.lineHeight || 20;
    const startY = cy - ((lines.length - 1) * lineHeight) / 2;
    const fill = options.fill || "#26354f";
    const size = options.size || 15;
    const weight = options.weight || 700;

    return `<text x="${cx}" y="${startY}" text-anchor="middle" dominant-baseline="middle" ` +
      `font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft JhengHei',sans-serif" ` +
      `font-size="${size}" font-weight="${weight}" fill="${fill}">` +
      lines.map((line, i) =>
        `<tspan x="${cx}" dy="${i === 0 ? 0 : lineHeight}">${flowchartEscape(line)}</tspan>`
      ).join("") +
      `</text>`;
  }

  function flowchartBlockLabel(block) {
    if (!block) return "";
    switch (block.type) {
      case "flow_show_text":
        return `顯示：${block.getFieldValue("TEXT") || ""}`;
      case "shop_show_welcome":
        return "顯示：歡迎使用系統";
      case "shop_show_start":
        return "顯示：開始處理";
      case "shop_show_done":
        return "顯示：處理完成";
      case "data_set_variable":
        return `設定 ${m2VariableLabel(block.getFieldValue("VAR"))} = ${m2ExpressionText(blockInput(block, "VALUE"))}`;
      case "data_show_value":
        return `顯示：${m2ExpressionText(blockInput(block, "VALUE"))}`;
      case "data_reset_totals":
        return "初始化資料";
      case "data_calc_subtotal":
        return "計算小計 = 單價 × 數量";
      case "data_accumulate":
        return "累加總金額／處理筆數";
      case "m3_if_single":
      case "m3_if_else":
      case "controls_if":
        return `${m2ExpressionText(blockInput(block,"IF0"))}？`;
      case "condition_if_valid":
        return "本筆資料正確？";
      case "rule_eligible_discount":
        return `符合優惠資格 且 總金額 ≥ ${block.getFieldValue("THRESHOLD") || 0}？`;
      case "loop_each_record":
        return "還有下一筆資料？";
      case "summary_show":
        return "顯示整合摘要";
      default:
        return block.type;
    }
  }

  function updateFlowchart() {
    const svg = $("flowchartSvg");
    const empty = $("flowchartEmpty");
    const meta = $("flowchartMeta");
    if (!svg || !empty || !meta || !workspace) return;
    const flowPanel = $("flowchartFloat");
    if (flowPanel) flowPanel.classList.toggle("m3-flow-compact", activeModule.startsWith("M3"));

    const stacks = getTopStacks();
    if (!stacks.length) {
      svg.innerHTML = "";
      svg.setAttribute("viewBox", "0 0 760 420");
      empty.style.display = "grid";
      meta.textContent = "0 條流程";
      return;
    }

    empty.style.display = "none";
    meta.textContent = stacks.length === 1
      ? "1 條主流程 · 流程圖會隨積木即時更新"
      : `${stacks.length} 條獨立流程 · 目前先顯示第一條；建議先把積木連成一條主流程`;

    const compactFlow = activeModule.startsWith("M3");
    const WIDTH = compactFlow ? 700 : 860;
    const CENTER = WIDTH / 2;
    const NODE_W = compactFlow ? 270 : 320;
    const IO_W = compactFlow ? 282 : 350;
    const DEC_W = compactFlow ? 240 : 300;
    const NODE_H = compactFlow ? 52 : 70;
    const DEC_H = compactFlow ? 82 : 110;
    const GAP = compactFlow ? 22 : 42;
    const BRANCH_GAP = compactFlow ? 28 : 54;
    const elements = [];

    const defs = `
      <defs>
        <marker id="flowArrow" markerWidth="8" markerHeight="8" refX="7" refY="4"
          orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L8,4 L0,8 z" fill="#65758f"></path>
        </marker>
      </defs>`;

    function arrow(x1, y1, x2, y2, label = "") {
      elements.push(
        `<path d="M ${x1} ${y1} L ${x2} ${y2}" fill="none" stroke="#65758f" ` +
        `stroke-width="2" marker-end="url(#flowArrow)"></path>`
      );
      if (label) {
        elements.push(
          `<text x="${(x1 + x2) / 2 + 7}" y="${(y1 + y2) / 2 - 5}" ` +
          `font-size="13" font-weight="800" fill="#4b5d79">${flowchartEscape(label)}</text>`
        );
      }
    }

    function orthogonal(points, label = "", lx = null, ly = null) {
      if (!points.length) return;
      const d = points.map((p, i) => `${i ? "L" : "M"} ${p[0]} ${p[1]}`).join(" ");
      elements.push(
        `<path d="${d}" fill="none" stroke="#65758f" stroke-width="2" ` +
        `marker-end="url(#flowArrow)"></path>`
      );
      if (label) {
        elements.push(
          `<text x="${lx == null ? points[0][0] : lx}" y="${ly == null ? points[0][1] : ly}" ` +
          `font-size="13" font-weight="800" fill="#4b5d79">${flowchartEscape(label)}</text>`
        );
      }
    }

    function terminal(x, y, label) {
      const w = 170, h = 46;
      elements.push(
        `<ellipse cx="${x}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" ` +
        `fill="#eef8f2" stroke="#4f9a70" stroke-width="2"></ellipse>`
      );
      elements.push(flowchartTextSvg(label, x, y + h / 2, { maxChars: 14 }));
      return { top: [x, y], bottom: [x, y + h], bottomY: y + h };
    }

    function processNode(x, y, label, tone = "process") {
      const lines = flowchartLines(label, 17);
      const h = Math.max(NODE_H, (compactFlow ? 16 : 26) + lines.length * (compactFlow ? 14 : 16));
      const palette = tone === "rule"
        ? { fill: "#f8f1fb", stroke: "#9b57c7" }
        : { fill: "#f1f7f4", stroke: "#4b9870" };

      elements.push(
        `<rect x="${x - NODE_W / 2}" y="${y}" width="${NODE_W}" height="${h}" rx="9" ` +
        `fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="2"></rect>`
      );
      elements.push(flowchartTextSvg(label, x, y + h / 2, { maxChars: 17 }));
      return { top: [x, y], bottom: [x, y + h], bottomY: y + h };
    }

    function ioNode(x, y, label) {
      const lines = flowchartLines(label, 18);
      const h = Math.max(NODE_H, (compactFlow ? 16 : 26) + lines.length * (compactFlow ? 14 : 16));
      const left = x - IO_W / 2;
      const right = x + IO_W / 2;
      const slant = 24;

      elements.push(
        `<polygon points="${left + slant},${y} ${right},${y} ${right - slant},${y + h} ${left},${y + h}" ` +
        `fill="#eef4ff" stroke="#4f79c9" stroke-width="2"></polygon>`
      );
      elements.push(flowchartTextSvg(label, x, y + h / 2, { maxChars: 18 }));
      return { top: [x, y], bottom: [x, y + h], bottomY: y + h };
    }

    function decisionNode(x, y, label) {
      const halfW = DEC_W / 2;
      const halfH = DEC_H / 2;
      const cy = y + halfH;

      elements.push(
        `<polygon points="${x},${y} ${x + halfW},${cy} ${x},${y + DEC_H} ${x - halfW},${cy}" ` +
        `fill="#fff8e8" stroke="#d28a2d" stroke-width="2"></polygon>`
      );
      elements.push(flowchartTextSvg(label, x, cy, { maxChars: 13, size: 14 }));
      return {
        top: [x, y],
        bottom: [x, y + DEC_H],
        left: [x - halfW, cy],
        right: [x + halfW, cy],
        bottomY: y + DEC_H
      };
    }

    function placeholderNode(x, y, label) {
      const w = 185, h = 42;
      elements.push(
        `<rect x="${x - w / 2}" y="${y}" width="${w}" height="${h}" rx="8" ` +
        `fill="#fafbfd" stroke="#b9c3d2" stroke-width="1.5" stroke-dasharray="5 4"></rect>`
      );
      elements.push(flowchartTextSvg(label, x, y + h / 2, {
        maxChars: 14, size: 10.5, fill: "#78869b", weight: 650
      }));
      return { top: [x, y], bottom: [x, y + h], bottomY: y + h };
    }

    function drawSimpleBlock(block, x, y) {
      const label = flowchartBlockLabel(block);
      if (block.type === "flow_show_text" ||
          block.type === "shop_show_welcome" ||
          block.type === "shop_show_start" ||
          block.type === "shop_show_done" ||
          block.type === "data_show_value" ||
          block.type === "summary_show") {
        return ioNode(x, y, label);
      }
      return processNode(x, y, label);
    }

    function renderCondition(block, x, y, entry) {
      const d = decisionNode(x, y, flowchartBlockLabel(block));
      if (entry) arrow(entry[0], entry[1], d.top[0], d.top[1]);

      const branchY = d.bottomY + 54;
      const yesX = x - 220;
      const noX = x + 220;
      const yesStart = blockInput(block, "DO");
      const noStart = blockInput(block, "ELSE");

      let yes;
      if (yesStart) {
        yes = renderChain(yesStart, yesX, branchY, null, false);
        orthogonal(
          [[d.left[0], d.left[1]], [yesX, d.left[1]], [yesX, yes.topY]],
          "是", d.left[0] - 34, d.left[1] - 8
        );
      } else {
        const p = placeholderNode(yesX, branchY, "（無動作）");
        yes = { topY: p.top[1], bottom: p.bottom, bottomY: p.bottomY };
        orthogonal(
          [[d.left[0], d.left[1]], [yesX, d.left[1]], [yesX, p.top[1]]],
          "是", d.left[0] - 34, d.left[1] - 8
        );
      }

      let no;
      if (noStart) {
        no = renderChain(noStart, noX, branchY, null, false);
        orthogonal(
          [[d.right[0], d.right[1]], [noX, d.right[1]], [noX, no.topY]],
          "否", d.right[0] + 12, d.right[1] - 8
        );
      } else {
        const p = placeholderNode(noX, branchY, "（無動作）");
        no = { topY: p.top[1], bottom: p.bottom, bottomY: p.bottomY };
        orthogonal(
          [[d.right[0], d.right[1]], [noX, d.right[1]], [noX, p.top[1]]],
          "否", d.right[0] + 12, d.right[1] - 8
        );
      }

      const mergeY = Math.max(yes.bottomY, no.bottomY) + 48;
      orthogonal([[yes.bottom[0], yes.bottom[1]], [yes.bottom[0], mergeY], [x, mergeY]]);
      orthogonal([[no.bottom[0], no.bottom[1]], [no.bottom[0], mergeY], [x, mergeY]]);
      elements.push(`<circle cx="${x}" cy="${mergeY}" r="4" fill="#65758f"></circle>`);

      return { bottom: [x, mergeY], bottomY: mergeY, topY: y };
    }

    function renderM3If(block, x, y, entry) {
      // 單向 IF 的「否」直接跳到後續流程，無需多畫一格「不執行」。
      const conditionCount = Array.from({length: 16}, (_,i)=>i).filter(i=>block.getInput("IF"+i)).length;
      const branchOffset = compactFlow ? 168 : 235;
      const leftX = x - branchOffset, rightX = x + branchOffset;
      const hasElse = Boolean(block.getInput("ELSE"));
      const finalBottom = [];
      let bypassFrom = null;
      let atY = y;
      let incoming = entry;
      for (let i=0; i<conditionCount; i++) {
        const d = decisionNode(x, atY, `${m2ExpressionText(blockInput(block,"IF"+i))}？`);
        if (incoming) arrow(incoming[0],incoming[1],d.top[0],d.top[1]);
        const branchY = d.bottomY + BRANCH_GAP;
        const yesBlock = blockInput(block,"DO"+i);
        const yes = yesBlock ? renderChain(yesBlock,leftX,branchY,null,false)
          : (()=>{const p=placeholderNode(leftX,branchY,"（無動作）");return {topY:p.top[1],bottom:p.bottom,bottomY:p.bottomY};})();
        orthogonal([[d.left[0],d.left[1]],[leftX,d.left[1]],[leftX,yes.topY]],"是",d.left[0]-29,d.left[1]-8);
        finalBottom.push(yes.bottom);
        const isLast = i===conditionCount-1;
        if (!isLast) {
          const nextY = Math.max(yes.bottomY + (compactFlow?30:38), d.bottomY + (compactFlow?43:60));
          const bridgeY=nextY-14;
          orthogonal([[d.right[0],d.right[1]],[rightX,d.right[1]],[rightX,bridgeY],[x,bridgeY],[x,nextY]],"否",d.right[0]+10,d.right[1]-8);
          atY=nextY;
        } else if (hasElse) {
          const noBlock = blockInput(block,"ELSE");
          const no = noBlock ? renderChain(noBlock,rightX,branchY,null,false)
            : (()=>{const p=placeholderNode(rightX,branchY,"（無動作）");return {topY:p.top[1],bottom:p.bottom,bottomY:p.bottomY};})();
          orthogonal([[d.right[0],d.right[1]],[rightX,d.right[1]],[rightX,no.topY]],"否",d.right[0]+10,d.right[1]-8);
          finalBottom.push(no.bottom);
        } else {
          // 沒有 ELSE 時，False 路徑略過 IF 內容，直接回到主流程。
          bypassFrom = d.right;
          finalBottom.push([rightX, d.right[1]]);
        }
        incoming=null;
      }
      const mergeY = Math.max(...finalBottom.map(p=>p[1]),atY+DEC_H) + (compactFlow?34:55);
      finalBottom.forEach((p,idx)=>{
        // 最後一條無 ELSE 的 False 路徑從右側繞過，直接接回主流程。
        const isBypass = !hasElse && idx===finalBottom.length-1;
        if (isBypass && bypassFrom) {
          orthogonal([[bypassFrom[0],bypassFrom[1]],[rightX,bypassFrom[1]],[rightX,mergeY],[x,mergeY]],
            "否",bypassFrom[0]+11,bypassFrom[1]-8);
        } else {
          orthogonal([[p[0],p[1]],[p[0],mergeY],[x,mergeY]]);
        }
      });
      elements.push(`<circle cx="${x}" cy="${mergeY}" r="4" fill="#65758f"></circle>`);
      return {bottom:[x,mergeY],bottomY:mergeY,topY:y};
    }

    function renderRule(block, x, y, entry) {
      const threshold = Number(block.getFieldValue("THRESHOLD") || 0);
      const rate = Number(block.getFieldValue("RATE") || 0);
      const d = decisionNode(x, y, `符合優惠資格且總金額 ≥ ${threshold}？`);
      if (entry) arrow(entry[0], entry[1], d.top[0], d.top[1]);

      const branchY = d.bottomY + 54;
      const yesX = x - 200;
      const noX = x + 200;
      const yes = processNode(yesX, branchY, `套用 ${rate}% 折扣`, "rule");
      const no = processNode(noX, branchY, "不套用折扣", "rule");

      orthogonal(
        [[d.left[0], d.left[1]], [yesX, d.left[1]], [yesX, yes.top[1]]],
        "是", d.left[0] - 34, d.left[1] - 8
      );
      orthogonal(
        [[d.right[0], d.right[1]], [noX, d.right[1]], [noX, no.top[1]]],
        "否", d.right[0] + 12, d.right[1] - 8
      );

      const mergeY = Math.max(yes.bottomY, no.bottomY) + 46;
      orthogonal([[yes.bottom[0], yes.bottom[1]], [yes.bottom[0], mergeY], [x, mergeY]]);
      orthogonal([[no.bottom[0], no.bottom[1]], [no.bottom[0], mergeY], [x, mergeY]]);
      elements.push(`<circle cx="${x}" cy="${mergeY}" r="4" fill="#65758f"></circle>`);

      return { bottom: [x, mergeY], bottomY: mergeY, topY: y };
    }

    function renderLoop(block, x, y, entry) {
      const d = decisionNode(x, y, "還有下一筆資料？");
      if (entry) arrow(entry[0], entry[1], d.top[0], d.top[1]);

      const bodyStart = blockInput(block, "DO");
      const bodyY = d.bottomY + 54;
      let body;

      if (bodyStart) {
        body = renderChain(bodyStart, x, bodyY, null, false);
        arrow(d.bottom[0], d.bottom[1], x, body.topY, "是");
      } else {
        const p = placeholderNode(x, bodyY, "（重複內容）");
        body = { topY: p.top[1], bottom: p.bottom, bottomY: p.bottomY };
        arrow(d.bottom[0], d.bottom[1], x, p.top[1], "是");
      }

      const loopX = Math.min(WIDTH - 42, x + 270);
      orthogonal(
        [[body.bottom[0], body.bottom[1]], [loopX, body.bottom[1]], [loopX, d.top[1] + 12], [x + 28, d.top[1] + 12]],
        "重複", loopX - 42, body.bottom[1] - 8
      );

      const exitY = body.bottomY + 64;
      const exitX = Math.max(42, x - 255);
      orthogonal(
        [[d.left[0], d.left[1]], [exitX, d.left[1]], [exitX, exitY], [x, exitY]],
        "否", d.left[0] - 34, d.left[1] - 8
      );
      elements.push(`<circle cx="${x}" cy="${exitY}" r="4" fill="#65758f"></circle>`);

      return { bottom: [x, exitY], bottomY: exitY, topY: y };
    }

    function renderChain(startBlock, x, startY, entry = null, addTerminals = false) {
      let block = startBlock;
      let cursorY = startY;
      let currentEntry = entry;
      let firstTopY = startY;

      while (block) {
        let result;

        if (["m3_if_single","m3_if_else","controls_if"].includes(block.type)) {
          result = renderM3If(block,x,cursorY,currentEntry);
        } else if (block.type === "condition_if_valid") {
          result = renderCondition(block, x, cursorY, currentEntry);
        } else if (block.type === "loop_each_record") {
          result = renderLoop(block, x, cursorY, currentEntry);
        } else if (block.type === "rule_eligible_discount") {
          result = renderRule(block, x, cursorY, currentEntry);
        } else {
          const node = drawSimpleBlock(block, x, cursorY);
          if (currentEntry) arrow(currentEntry[0], currentEntry[1], node.top[0], node.top[1]);
          result = { bottom: node.bottom, bottomY: node.bottomY, topY: node.top[1] };
        }

        if (block === startBlock) firstTopY = result.topY;
        currentEntry = result.bottom;
        cursorY = result.bottomY + GAP;
        block = block.getNextBlock();
      }

      return {
        topY: firstTopY,
        bottom: currentEntry || [x, startY],
        bottomY: currentEntry ? currentEntry[1] : startY
      };
    }

    const start = terminal(CENTER, 24, "開始");
    const main = renderChain(stacks[0], CENTER, start.bottomY + GAP, start.bottom, false);
    const endY = main.bottomY + GAP;
    const end = terminal(CENTER, endY, "結束");
    if (main.bottom) arrow(main.bottom[0], main.bottom[1], end.top[0], end.top[1]);

    const height = Math.max(420, end.bottomY + 38);
    svg.setAttribute("viewBox", `0 0 ${WIDTH} ${height}`);
    svg.innerHTML = defs + elements.join("");
  }

  function setFlowchartVisible(visible) {
    const panel = $("flowchartFloat");
    const btn = $("toggleFlowchartBtn");
    if (!panel || !btn) return;

    panel.classList.toggle("is-hidden", !visible);
    btn.classList.toggle("is-active", visible);
    btn.setAttribute("aria-pressed", visible ? "true" : "false");
    btn.textContent = visible ? "◇ 關閉流程圖" : "◇ 流程圖";

    if (visible) {
      collapseFlyout();
      updateFlowchart();
    }
  }

  function toggleFlowchartPanel() {
    const panel = $("flowchartFloat");
    if (!panel) return;
    setFlowchartVisible(panel.classList.contains("is-hidden"));
  }

  function initFlowchartPanel() {
    bindFloatingPanel(
      "flowchartFloat",
      "flowchartDragHandle",
      "flowchartCollapseBtn",
      "flowchartResetPositionBtn",
      { label: "流程圖", top: "54px" }
    );

    const closeBtn = $("flowchartCloseBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => setFlowchartVisible(false));
    }

    updateFlowchart();
  }

  function setRunStatus(kind, title, detail) {
    const box = $("runStatus");
    box.className = `run-status ${kind}`;
    box.querySelector("strong").textContent = title;
    box.querySelector("p").textContent = detail;
  }

  function clearGuiMessages() {
    $("guiMessages").innerHTML = '<li class="placeholder">等待執行你的程式…</li>';
  }

  function appendGuiMessage(text, kind = "") {
    const list = $("guiMessages");
    const placeholder = list.querySelector(".placeholder");
    if (placeholder) placeholder.remove();
    const li = document.createElement("li");
    li.textContent = String(text);
    if (kind) li.className = kind;
    list.appendChild(li);
    list.scrollTop = list.scrollHeight;
    return li;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function numeric(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function formatMoney(value) {
    const n = numeric(value);
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.00$/, "");
  }

  function getProjectData() {
    return {
      projectName: currentProjectName(),
      eligible: Boolean(projectState.eligible),
      records: projectState.records.map(r => ({
        name: String(r.name || ""),
        price: numeric(r.price),
        qty: numeric(r.qty)
      }))
    };
  }

  function restoreProjectData(data, fallbackProjectName) {
    const source = data && typeof data === "object" ? data : {};
    const records = Array.isArray(source.records) && source.records.length
      ? source.records.map(r => ({
          name: String(r && r.name || ""),
          price: numeric(r && r.price),
          qty: numeric(r && r.qty),
          subtotal: null,
          status: ""
        }))
      : [
          { name: "咖啡", price: 80, qty: 2, subtotal: null, status: "" },
          { name: "蛋糕", price: 120, qty: 1, subtotal: null, status: "" },
          { name: "果汁", price: 60, qty: 3, subtotal: null, status: "" }
        ];

    projectState = {
      projectName: String(source.projectName || fallbackProjectName || DEFAULT_PROJECT_NAME),
      eligible: source.eligible !== false,
      records
    };
    renderProjectState();
  }

  function renderProjectState() {
    const title = $("projectTitleInput");
    if (title && title.value !== projectState.projectName) {
      title.value = projectState.projectName;
    }
    const eligible = $("eligibleInput");
    if (eligible) eligible.checked = Boolean(projectState.eligible);

    const displayName = currentProjectName();
    projectState.projectName = displayName;
    const guiTitle = $("guiProjectName");
    if (guiTitle) guiTitle.textContent = displayName;
    const guiWindowTitle = $("guiWindowTitle");
    if (guiWindowTitle) guiWindowTitle.textContent = `🧩 ${displayName} · ${activeModule}`;
    const footerProject = $("footerProject");
    if (footerProject) footerProject.textContent = `專案：${displayName}`;

    renderRecords();
    resetSummary();
    updatePython();
  }

  function renderRecords() {
    const tbody = $("recordsTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    projectState.records.forEach((record, index) => {
      const tr = document.createElement("tr");
      tr.dataset.index = String(index);
      tr.innerHTML = `
        <td><input class="grid-input record-name" data-field="name" value="${escapeHtmlForAttribute(record.name)}" aria-label="第 ${index + 1} 筆項目名稱"></td>
        <td><input class="grid-input record-number" data-field="price" type="number" min="0" step="1" value="${numeric(record.price)}" aria-label="第 ${index + 1} 筆單價"></td>
        <td><input class="grid-input record-number" data-field="qty" type="number" min="0" step="1" value="${numeric(record.qty)}" aria-label="第 ${index + 1} 筆數量"></td>
        <td class="subtotal-cell">${record.subtotal == null ? "—" : formatMoney(record.subtotal)}</td>
        <td class="record-state">${record.status || "待處理"}</td>
        <td><button type="button" class="row-delete" data-action="delete" title="刪除這一筆">×</button></td>`;
      tbody.appendChild(tr);
    });
  }

  function escapeHtmlForAttribute(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function updateRecordRow(index) {
    const row = $("recordsTableBody").querySelector(`tr[data-index="${index}"]`);
    const record = projectState.records[index];
    if (!row || !record) return;
    row.querySelector(".subtotal-cell").textContent =
      record.subtotal == null ? "—" : formatMoney(record.subtotal);
    const state = row.querySelector(".record-state");
    state.textContent = record.status || "待處理";
    state.className = "record-state" + (record.status === "✓ 已處理" ? " ok" : record.status.startsWith("⚠") ? " bad" : "");
  }

  function resetRecordResults() {
    projectState.records.forEach(r => {
      r.subtotal = null;
      r.status = "";
    });
    renderRecords();
  }

  function resetSummary() {
    $("summaryCount").textContent = "0";
    $("summaryTotal").textContent = "0";
    $("summaryDiscount").textContent = "0";
    $("summaryFinal").textContent = "0";
    $("ruleResult").textContent = "尚未判斷";
    $("ruleResult").className = "rule-result neutral";
  }

  function updateSummary(ctx) {
    $("summaryCount").textContent = String(ctx.count || 0);
    $("summaryTotal").textContent = formatMoney(ctx.total || 0);
    $("summaryDiscount").textContent = formatMoney(ctx.discount || 0);
    $("summaryFinal").textContent = formatMoney(
      Number.isFinite(ctx.finalAmount) ? ctx.finalAmount : (ctx.total || 0) - (ctx.discount || 0)
    );
  }

  function validateRecord(record) {
    return Boolean(
      String(record && record.name || "").trim() &&
      numeric(record && record.price) > 0 &&
      numeric(record && record.qty) > 0
    );
  }

  function ensureCurrentRecord(ctx) {
    if (ctx.current) return ctx.current;
    if (!ctx.records || !ctx.records.length) return null;

    // 漸進教學模式：
    // M5 以前還沒有迴圈時，M2 / M3 先把第一筆資料視為「本筆資料」。
    ctx.currentIndex = 0;
    ctx.current = ctx.records[0];
    return ctx.current;
  }

  function compareValues(a,b,op) {
    return op === ">" ? a>b : op === ">=" ? a>=b : op === "<" ? a<b : op === "<=" ? a<=b : op === "==" ? a===b : a!==b;
  }

  function m2Evaluate(block, ctx) {
    if (!block) return null;
    const vars = ctx.vars || (ctx.vars = {});
    switch (block.type) {
      case "data_get_variable":
        return vars[block.getFieldValue("VAR")];
      case "data_text_value":
        return String(block.getFieldValue("TEXT") || "");
      case "data_number_value":
        return Number(block.getFieldValue("NUM") || 0);
      case "m3_compare": {
        const aBlock=blockInput(block,"A"), bBlock=blockInput(block,"B");
        if (!aBlock || !bBlock) throw new Error("比較積木的左右兩端都必須接上數值或變數。");
        const a=Number(m2Evaluate(aBlock,ctx)), b=Number(m2Evaluate(bBlock,ctx));
        if (!Number.isFinite(a)||!Number.isFinite(b)) throw new Error("比較條件需要有效的數值資料。");
        return compareValues(a,b,block.getFieldValue("OP"));
      }
      case "data_arithmetic": {
        const a = Number(m2Evaluate(blockInput(block, "A"), ctx));
        const b = Number(m2Evaluate(blockInput(block, "B"), ctx));
        const op = block.getFieldValue("OP");
        if (!Number.isFinite(a) || !Number.isFinite(b)) {
          throw new Error("運算積木左右兩邊都需要可計算的數值資料。");
        }
        if (op === "ADD") return a + b;
        if (op === "MINUS") return a - b;
        if (op === "MULTIPLY") return a * b;
        if (op === "DIVIDE") {
          if (b === 0) throw new Error("除數不能是 0。");
          return a / b;
        }
        return 0;
      }
      default:
        return null;
    }
  }

  async function executeChain(startBlock, ctx) {
    let block = startBlock;
    while (block) {
      try { block.select(); } catch (_) {}
      await sleep(160);

      switch (block.type) {
        case "flow_show_text":
          appendGuiMessage(block.getFieldValue("TEXT") || "");
          break;
        case "shop_show_welcome":
          appendGuiMessage("歡迎使用小店營運助手");
          break;
        case "shop_show_start":
          appendGuiMessage("開始結帳");
          break;
        case "shop_show_done":
          appendGuiMessage("結帳完成");
          break;
        case "data_set_variable": {
          const key = block.getFieldValue("VAR");
          const valueBlock = blockInput(block, "VALUE");
          if (!valueBlock) throw new Error(`「${m2VariableLabel(key)}」還沒有接上資料。`);
          ctx.vars[key] = m2Evaluate(valueBlock, ctx);
          if (ctx.assigned) ctx.assigned.add(key);
          appendGuiMessage(`${m2VariableLabel(key)} = ${ctx.vars[key]}`);
          break;
        }
        case "data_show_value": {
          const valueBlock = blockInput(block, "VALUE");
          if (!valueBlock) throw new Error("「顯示資料」還沒有接上要顯示的內容。");
          const value = m2Evaluate(valueBlock, ctx);
          const label = m2DisplayLabel(valueBlock);
          appendGuiMessage(`${label}：${String(value == null ? "" : value)}`);
          if (ctx.displayOutputs) ctx.displayOutputs.push({label,value:String(value == null ? "" : value)});
          break;
        }
        case "data_reset_totals":
          ctx.total = 0;
          ctx.count = 0;
          ctx.discount = 0;
          ctx.finalAmount = 0;
          resetRecordResults();
          resetSummary();
          break;
        case "data_calc_subtotal": {
          const current = ensureCurrentRecord(ctx);
          if (current) {
            current.subtotal = numeric(current.price) * numeric(current.qty);
            updateRecordRow(ctx.currentIndex);
          }
          break;
        }
        case "data_accumulate": {
          const current = ensureCurrentRecord(ctx);
          if (current) {
            const subtotal = numeric(current.subtotal);
            ctx.total += subtotal;
            ctx.count += 1;
            current.status = "✓ 已處理";
            updateRecordRow(ctx.currentIndex);
            updateSummary(ctx);
          }
          break;
        }
        case "m3_if_single":
        case "m3_if_else":
        case "controls_if": {
          let branch=0, matched=false;
          while (block.getInput("IF"+branch)) {
            const cond=blockInput(block,"IF"+branch);
            if (!cond) throw new Error(`第 ${branch+1} 個 IF / ELIF 還沒有接比較條件。`);
            const isTrue=Boolean(m2Evaluate(cond,ctx));
            if (isTrue) {
              appendGuiMessage(`條件 ${branch+1}：True → 執行這個分支`);
              await executeChain(blockInput(block,"DO"+branch),ctx);matched=true;break;
            }
            appendGuiMessage(`條件 ${branch+1}：False`);
            branch++;
          }
          if (!matched && block.getInput("ELSE")) {
            appendGuiMessage("進入 ELSE 分支");
            await executeChain(blockInput(block,"ELSE"),ctx);
          }
          break;
        }
        case "condition_if_valid": {
          const current = ensureCurrentRecord(ctx);
          const valid = validateRecord(current);
          if (!valid && current) {
            current.status = "⚠ 資料有誤";
            current.subtotal = null;
            updateRecordRow(ctx.currentIndex);
          }
          await executeChain(blockInput(block, valid ? "DO" : "ELSE"), ctx);
          break;
        }
        case "loop_each_record":
          for (let i = 0; i < ctx.records.length; i++) {
            ctx.currentIndex = i;
            ctx.current = ctx.records[i];
            await executeChain(blockInput(block, "DO"), ctx);
          }
          ctx.current = null;
          ctx.currentIndex = -1;
          break;
        case "rule_eligible_discount": {
          const threshold = numeric(block.getFieldValue("THRESHOLD"));
          const rate = numeric(block.getFieldValue("RATE"));
          const qualified = Boolean(projectState.eligible) && ctx.total >= threshold;
          ctx.discount = qualified ? ctx.total * rate / 100 : 0;
          ctx.finalAmount = ctx.total - ctx.discount;
          const rule = $("ruleResult");
          if (qualified) {
            rule.textContent = `✓ 符合資格且滿 ${formatMoney(threshold)} 元，套用 ${formatMoney(rate)}% 折扣`;
            rule.className = "rule-result success";
          } else {
            rule.textContent = projectState.eligible
              ? `未達 ${formatMoney(threshold)} 元門檻，不折扣`
              : "未符合優惠資格，不折扣";
            rule.className = "rule-result neutral";
          }
          updateSummary(ctx);
          break;
        }
        case "summary_show":
          ctx.finalAmount = ctx.total - ctx.discount;
          updateSummary(ctx);
          appendGuiMessage(`處理筆數：${ctx.count}`);
          appendGuiMessage(`原始金額：${formatMoney(ctx.total)}`);
          appendGuiMessage(`折扣金額：${formatMoney(ctx.discount)}`);
          appendGuiMessage(`最後金額：${formatMoney(ctx.finalAmount)}`);
          break;
        default:
          appendGuiMessage(`無法執行的積木：${block.type}`, "error");
      }

      block = block.getNextBlock();
    }
  }

  function renderM3Gui(ctx) {
    const panel=$("m3GuiLines");if(!panel) return;
    const outputs=ctx.displayOutputs||[];
    panel.innerHTML="";
    if(!outputs.length) {panel.textContent="程式已執行；尚未使用「顯示資料」積木輸出結果。";return;}
    outputs.forEach(item=>{
      const line=document.createElement("div");line.className="m3-gui-line";
      const label=document.createElement("span");label.textContent=item.label;
      const value=document.createElement("strong");value.textContent=item.value;
      line.append(label,value);panel.appendChild(line);
    });
  }

  function programHasAllFinalCapabilities() {
    const types = new Set(
      workspace.getAllBlocks(false).filter(b => !b.isShadow()).map(b => b.type)
    );
    return [
      "flow_show_text",
      "data_reset_totals",
      "data_calc_subtotal",
      "data_accumulate",
      "condition_if_valid",
      "rule_eligible_discount",
      "loop_each_record",
      "summary_show"
    ].every(type => types.has(type));
  }

  function isM1DisplayBlock(block) {
    return Boolean(block) && (
      block.type === "flow_show_text" ||
      block.type === "shop_show_welcome" ||
      block.type === "shop_show_start" ||
      block.type === "shop_show_done"
    );
  }

  function isM2TeachingBlock(block) {
    return Boolean(block) && [
      "flow_show_text",
      "shop_show_welcome",
      "shop_show_start",
      "shop_show_done",
      "data_set_variable",
      "data_get_variable",
      "data_text_value",
      "data_number_value",
      "data_arithmetic",
      "data_show_value"
    ].includes(block.type);
  }

  async function runProgram() {
    if (isRunning || !workspace) return;

    const stacks = getTopStacks();
    const allBlocks = workspace.getAllBlocks(false).filter(b => !b.isShadow());

    if (!allBlocks.length) {
      setRunStatus("warning", "還沒有積木", activeModule === "M1" ? "先從 M1 積木盒拖出顯示積木，重新組一條流程。" : activeModule === "M2" ? "先從 M2 積木盒拖出「設定變數」積木，從商品與會員資料開始組流程。" : "請從積木盒拖曳資料與條件積木，組成一條完整流程。");
      return;
    }

    if (stacks.length !== 1) {
      setRunStatus("warning", "目前有多條流程", activeModule === "M1"
        ? "請把 M1 的顯示積木接成一條主流程，再執行測試。"
        : activeModule === "M2" ? "請把 M2 的設定、運算與顯示積木接成一條主流程，再執行測試。" : "請把 M3 的設定、判斷與顯示積木接成一條主流程，再執行。");
      return;
    }

    if (activeModule === "M1") {
      const m1Only = allBlocks.every(isM1DisplayBlock);
      if (!m1Only) {
        setRunStatus("warning", "M1 只使用流程積木", "請切回 M2 再使用資料與運算積木。");
        return;
      }

      isRunning = true;
      $("runProgramBtn").disabled = true;
      clearGuiMessages();
      setRunStatus("neutral", "執行中…", "正在依照 M1 積木由上往下執行。");
      const ctx = { records: [], vars: {}, assigned: new Set(), total: 0, count: 0, discount: 0, finalAmount: 0 };
      try {
        await executeChain(stacks[0], ctx);
        setRunStatus("success", "M1 流程完成！", "積木已依照由上到下的順序執行。切換到 M2 時，會進入另一張獨立畫布。");
        markM1Complete();
      } catch (err) {
        console.error(err);
        setRunStatus("error", "執行發生錯誤", err && err.message ? err.message : "請檢查積木結構。");
      } finally {
        isRunning = false;
        $("runProgramBtn").disabled = false;
        scheduleAutosave(true);
      }
      return;
    }

    isRunning = true;
    $("runProgramBtn").disabled = true;
    $("guiRunBtn").disabled = true;
    clearGuiMessages();
    setRunStatus("neutral", "執行中…", "正在依照積木由上往下執行。");

    const ctx = {
      records: projectState.records,
      current: null,
      currentIndex: -1,
      total: 0,
      count: 0,
      discount: 0,
      finalAmount: 0,
      vars: {
        productName: "",
        price: 0,
        quantity: 0,
        currentStock: 0,
        memberName: "",
        currentPoints: 0,
        subtotal: 0,
        remainingStock: 0,
        earnedPoints: 0,
        totalPoints: 0, shippingFee:0, finalPayment:0, spendingAmount:0, voucherAmount:0
      },
      assigned: new Set(),
      displayOutputs: []
    };

    try {
      await executeChain(stacks[0], ctx);

      if (activeModule.startsWith("M3")) {
        const assigned = ctx.assigned || new Set();
        const summary = [...assigned].filter(k=>["shippingFee","finalPayment","voucherAmount","spendingAmount","subtotal"].includes(k))
          .map(k=>`${m2VariableLabel(k)}：${ctx.vars[k]}`).join("｜");
        setRunStatus("success", `${activeModule === "M3P1" ? "M3 Part 1" : "M3 Part 2"} 執行完成`,
          summary || "已按照學生排列的條件執行，請對照題目測試不同邊界值。");
        renderM3Gui(ctx);
      } else {
      const m2Only = allBlocks.every(isM2TeachingBlock);
      if (m2Only) {
        const vars = ctx.vars || {};
        const assigned = ctx.assigned || new Set();
        const requiredInputs = ["productName", "price", "quantity", "currentStock", "memberName", "currentPoints"];
        const requiredResults = ["subtotal", "remainingStock", "earnedPoints", "totalPoints"];
        const taskComplete = requiredInputs.every(key => assigned.has(key)) &&
          requiredResults.every(key => assigned.has(key) && Number.isFinite(Number(vars[key])));
        if (taskComplete) {
          setRunStatus(
            "success",
            "M2 會員購物交易完成！",
            `會員：${vars.memberName || "—"}｜商品小計：${vars.subtotal}｜剩餘庫存：${vars.remainingStock}｜本次獲得點數：${vars.earnedPoints}｜累積點數：${vars.totalPoints}`
          );
          markM2Complete();
        } else {
          const done = requiredResults.filter(key => assigned.has(key)).map(m2VariableLabel);
          setRunStatus(
            "success",
            "M2 程式已成功執行",
            done.length
              ? `目前已完成：${done.join("、")}。再把結帳、庫存與會員點數三段資料處理串完整。`
              : "資料已依照積木順序處理；接著完成商品、庫存與會員點數的計算。"
          );
        }
      } else {
        setRunStatus(
          "warning",
          "程式可以執行",
          "目前工作區包含尚未開放的後續 Module 積木；M2 先專注在資料、變數、運算與輸出。"
        );
      }
      }
    } catch (err) {
      console.error(err);
      setRunStatus(
        "error",
        "執行發生錯誤",
        err && err.message ? err.message : "請檢查積木結構。"
      );
    } finally {
      try { workspace.getSelected()?.unselect(); } catch (_) {}
      isRunning = false;
      $("runProgramBtn").disabled = false;
      $("guiRunBtn").disabled = false;
      scheduleAutosave(true);
    }
  }

  function connectNext(a, b) {
    if (a && b && a.nextConnection && b.previousConnection) {
      a.nextConnection.connect(b.previousConnection);
    }
  }

  function connectStatement(parent, inputName, child) {
    const input = parent && parent.getInput(inputName);
    if (input && input.connection && child && child.previousConnection) {
      input.connection.connect(child.previousConnection);
    }
  }

  function newBlock(type, fields = {}) {
    const block = workspace.newBlock(type);
    Object.entries(fields).forEach(([name, value]) => block.setFieldValue(String(value), name));
    block.initSvg();
    block.render();
    return block;
  }

  function loadM1Starter(ask = true) {
    if (!workspace) return;

    if (ask) {
      const ok = confirm(
        "要載入 M1 範例嗎？\n\n目前工作區會被取代；如果需要保留，請先儲存專案。"
      );
      if (!ok) return;
    }

    workspace.clear();
    openedProjectMeta = null;

    const a = newBlock("flow_show_text", { TEXT: "A" });
    const b = newBlock("flow_show_text", { TEXT: "B" });
    const c = newBlock("flow_show_text", { TEXT: "C" });

    connectNext(a, b);
    connectNext(b, c);

    try { a.moveBy(55, 45); } catch (_) {}

    clearGuiMessages();
    resetSummary();
    resetRecordResults();
    setRunStatus(
      "neutral",
      "M1 範例已載入",
      "試著修改 A、B、C 的文字或交換順序，再開啟 Python／流程圖比較。"
    );

    updatePython();
    updateFlowchart();
    updateWorkspaceHint();
    scheduleAutosave(true);

    setTimeout(() => {
      try { workspace.zoomToFit(); } catch (_) {}
    }, 80);
  }

  function loadGoldenFinal(ask = true) {
    if (!workspace) return;
    if (ask) {
      const ok = confirm(
        "要載入老師的 M1～M6 完整示範嗎？\n\n目前工作區會被取代；如果需要保留，請先儲存專案。"
      );
      if (!ok) return;
    }

    workspace.clear();
    projectState = {
      projectName: "商業流程整合示範",
      eligible: true,
      records: [
        { name: "咖啡", price: 80, qty: 2, subtotal: null, status: "" },
        { name: "蛋糕", price: 120, qty: 1, subtotal: null, status: "" },
        { name: "果汁", price: 60, qty: 3, subtotal: null, status: "" }
      ]
    };

    const welcome = newBlock("flow_show_text", { TEXT: "歡迎使用我的商業流程系統" });
    const reset = newBlock("data_reset_totals");
    const loop = newBlock("loop_each_record");
    const rule = newBlock("rule_eligible_discount", { THRESHOLD: 400, RATE: 10 });
    const summary = newBlock("summary_show");
    const done = newBlock("flow_show_text", { TEXT: "處理完成，謝謝使用" });

    connectNext(welcome, reset);
    connectNext(reset, loop);
    connectNext(loop, rule);
    connectNext(rule, summary);
    connectNext(summary, done);

    const condition = newBlock("condition_if_valid");
    connectStatement(loop, "DO", condition);

    const calc = newBlock("data_calc_subtotal");
    const accumulate = newBlock("data_accumulate");
    const processed = newBlock("flow_show_text", { TEXT: "已處理一筆資料" });
    connectStatement(condition, "DO", calc);
    connectNext(calc, accumulate);
    connectNext(accumulate, processed);

    const invalid = newBlock("flow_show_text", { TEXT: "資料有誤，略過這一筆" });
    connectStatement(condition, "ELSE", invalid);

    try { welcome.moveBy(45, 36); } catch (_) {}
    openedProjectMeta = null;
    renderProjectState();
    clearGuiMessages();
    setRunStatus("neutral", "完整示範已載入", "先按「執行程式」看看 M1～M6 如何一起運作，再自由修改積木。 ");
    updatePython();
    updateFlowchart();
    updateWorkspaceHint();
    scheduleAutosave(true);
    setTimeout(() => {
      try { workspace.zoomToFit(); } catch (_) {}
    }, 80);
  }

  function captureActiveModuleState() {
    if (!workspace || !activeModule) return;
    moduleWorkspaceStates[activeModule] = Blockly.serialization.workspaces.save(workspace);
  }

  function validModuleName(value) {
    if (value === "M3P2" && !M3_PART2_OPEN) return "M3P1";
    return ["M1","M2","M3P1","M3P2"].includes(value) ? value : DEFAULT_MODULE;
  }

  function applyModuleUi() {
    const cfg = MODULE_CONFIG[activeModule] || MODULE_CONFIG[DEFAULT_MODULE];
    document.title = `商業軟體 Blockly｜${cfg.title}`;
    document.querySelectorAll("[data-module-context]").forEach(el => { el.textContent = cfg.title; });
    const tipTitle = $("moduleTipTitle");
    const tipText = $("moduleTipText");
    if (tipTitle) tipTitle.textContent = cfg.tipTitle;
    if (tipText) tipText.textContent = cfg.tipText;
    const pythonNote = $("pythonModuleNote");
    const flowNote = $("flowchartModuleNote");
    if (pythonNote) pythonNote.textContent = cfg.pythonNote;
    if (flowNote) flowNote.textContent = cfg.flowNote;
    if ($("guiWindowTitle")) $("guiWindowTitle").textContent = `🧩 ${currentProjectName()} · ${activeModule}`;
    [["moduleTabM1", "M1"], ["moduleTabM2", "M2"], ["moduleTabM3P1", "M3P1"], ["moduleTabM3P2", "M3P2"]].forEach(([id, moduleName]) => {
      const btn = $(id);
      if (!btn) return;
      const selected = moduleName === activeModule;
      btn.classList.toggle("active", selected);
      btn.setAttribute("aria-selected", selected ? "true" : "false");
    });
    // 同時鎖定側邊與頂部入口，避免以鍵盤或開啟專案跳入未開放內容。
    ["moduleM3P2", "moduleTabM3P2"].forEach(id => {
      const control = $(id);
      if (!control) return;
      control.classList.toggle("m3-p2-locked", !M3_PART2_OPEN);
      control.setAttribute("aria-disabled", M3_PART2_OPEN ? "false" : "true");
      control.setAttribute("title", M3_PART2_OPEN ? "" : "Part 2 尚未開放，請先完成 Part 1");
      if (id === "moduleTabM3P2") control.disabled = !M3_PART2_OPEN;
      else control.tabIndex = M3_PART2_OPEN ? 0 : -1;
    });
    const m3=activeModule.startsWith("M3");
    $("m3ModeTabs").hidden=!m3;
    $("m3DecisionPanel").hidden=!m3 || m3VisibleTab[activeModule]!=="decision";
    $("m3WorkspaceStage").hidden=m3 && m3VisibleTab[activeModule]==="decision";
    const taskBox=$("m3TaskBox");
    if(taskBox){
      taskBox.hidden=!m3||m3VisibleTab[activeModule]!=="blocks";
      if(m3)taskBox.innerHTML=activeModule==="M3P1"
        ? `<strong>Part 1｜指定情境：小店滿額免運</strong><p>消費滿 1,000 元（含）免運費，未滿收取 60 元。請自行設定商品小計、判斷運費、計算應付總金額，並使用「顯示資料」積木呈現三個數值。</p><p>請測試：999、1000、1001 元。這裡不提供積木排列答案。</p>`
        : `<strong>Part 2｜指定情境：會員消費回饋分級</strong><p>消費滿 3,000 元回饋券 100 元；滿 1,500 元回饋券 50 元；滿 500 元回饋券 10 元；未滿 500 元為 0 元。每筆消費只取得最高符合的單一級距。</p><p>請自行堆出 IF／ELIF／ELSE 並顯示消費金額和回饋券金額。請測試：499、500、1499、1500、2999、3000 元。</p>`;
    }
    $("m3ModeDecision").classList.toggle("active",m3&&m3VisibleTab[activeModule]==="decision");
    $("m3ModeBlocks").classList.toggle("active",m3&&m3VisibleTab[activeModule]==="blocks");
    const tools=$("workspaceTools"),title=$("workspaceCardTitle");
    if(tools)tools.hidden=m3&&m3VisibleTab[activeModule]==="decision";
    if(title)title.textContent=m3&&m3VisibleTab[activeModule]==="decision"?"決策表練習":"積木工作區";
    const gui=document.querySelector(".gui-card");
    if(gui){
      gui.classList.toggle("m3-mode",m3);gui.classList.toggle("gui-locked",!m3);
      if(!m3){gui.classList.add("is-collapsed");document.body.classList.remove("gui-expanded");}
    }
    const guiButton=$("guiToggleBtn");
    if(guiButton){guiButton.disabled=!m3;guiButton.textContent=m3?(gui.classList.contains("is-collapsed")?"展開 GUI":"收起 GUI"):"暫不開放";}
    const runBtn=$("guiRunBtn");if(runBtn)runBtn.textContent=`▶ 執行 ${activeModule}`;
    if(m3)renderM3Decision();
    restoreProgress();
  }

  function loadModuleWorkspace(moduleName) {
    if (!workspace) return;
    const state = moduleWorkspaceStates[moduleName];
    isModuleSwitching = true;
    try {
      if (Blockly.Events && typeof Blockly.Events.disable === "function") Blockly.Events.disable();
      workspace.clear();
      if (state) {
        try { Blockly.serialization.workspaces.load(state, workspace); }
        catch (err) { console.warn(`Unable to restore ${moduleName} workspace`, err); }
      }
    } finally {
      if (Blockly.Events && typeof Blockly.Events.enable === "function") Blockly.Events.enable();
      isModuleSwitching = false;
    }
  }

  function switchModule(moduleName, options = {}) {
    if (moduleName === "M3P2" && !M3_PART2_OPEN) return;
    const target = validModuleName(moduleName);
    if (!workspace) { activeModule = target; return; }
    if (target === activeModule && !options.force) return;

    captureActiveModuleState();
    activeModule = target;
    workspace.updateToolbox(buildToolbox(activeModule));
    configurePersistentToolbox();
    loadModuleWorkspace(activeModule);
    selectToolboxCategory(MODULE_CONFIG[activeModule].category);
    applyModuleUi();
    clearGuiMessages();
    if($("m3GuiLines"))$("m3GuiLines").textContent="執行 Blockly 後顯示資料。";
    resetSummary();
    updatePython();
    updateFlowchart();
    updateWorkspaceHint();
    setRunStatus(
      "neutral",
      `${activeModule} 工作區`,
      activeModule === "M1" ? "這是獨立的 M1 畫布；重新練習流程順序。"
      : activeModule === "M2" ? "這是獨立的 M2 畫布；從設定資料開始完成會員購物交易。"
      : "決策表與 Blockly 是兩個不同任務，切換頁籤不會清空任何內容。"
    );
    if (!options.skipAutosave) scheduleAutosave(true);
    setTimeout(() => { try { Blockly.svgResize(workspace); } catch (_) {} }, 30);
  }

  function markM1Complete() {
    const key = getProgressKey();
    if (!key) return;

    const progress = safeParse(localStorage.getItem(key), {}) || {};
    progress.M1 = true;
    progress.completedAt = progress.completedAt || isoNow();
    localStorage.setItem(key, JSON.stringify(progress));
    restoreProgress();
  }

  function markM2Complete() {
    const key = getProgressKey();
    if (!key) return;
    const progress = safeParse(localStorage.getItem(key), {}) || {};
    progress.M1 = true;
    progress.M2 = true;
    progress.m2CompletedAt = progress.m2CompletedAt || isoNow();
    localStorage.setItem(key, JSON.stringify(progress));
    restoreProgress();
  }

  function restoreProgress() {
    const key = getProgressKey();
    const progress = key ? (safeParse(localStorage.getItem(key), {}) || {}) : {};
    const row1 = $("moduleM1");
    const row2 = $("moduleM2");
    const state1 = $("m1State");
    const state2 = $("m2State");

    [row1, row2].forEach(row => { if (row) row.classList.remove("current", "complete"); });

    if (row1) {
      if (progress.M1) row1.classList.add("complete");
      if (activeModule === "M1") row1.classList.add("current");
      row1.setAttribute("aria-selected", activeModule === "M1" ? "true" : "false");
    }
    if (row2) {
      if (progress.M2) row2.classList.add("complete");
      if (activeModule === "M2") row2.classList.add("current");
      row2.setAttribute("aria-selected", activeModule === "M2" ? "true" : "false");
    }

    if (state1) state1.textContent = progress.M1 ? "✓ 已完成" : (activeModule === "M1" ? "進行中" : "可練習");
    if (state2) state2.textContent = progress.M2 ? "✓ 已完成" : (activeModule === "M2" ? "進行中" : "可練習");
    [["moduleM3P1","m3p1State","M3P1"],["moduleM3P2","m3p2State","M3P2"]].forEach(([rid,sid,key])=>{
      const row=$(rid),state=$(sid);if(!row)return;
      row.classList.toggle("current",activeModule===key);
      row.setAttribute("aria-selected",activeModule===key?"true":"false");
      if(state)state.textContent=(key==="M3P2"&&!M3_PART2_OPEN)?"🔒 尚未開放":activeModule===key?"進行中":"可練習";
    });
    $("footerProgress").textContent = `進度：${MODULE_CONFIG[activeModule].title}`;
  }

  function scheduleAutosave(immediate = false) {
    if (!activeProfile || !workspace) return;
    clearTimeout(autosaveTimer);

    const doSave = () => {
      const key = getAutosaveKey();
      if (!key) return;
      captureActiveModuleState();
      const payload = {
        formatVersion: 3,
        appVersion: APP_VERSION,
        module: activeModule,
        activeModule,
        workspaces: { ...moduleWorkspaceStates },
      m3Decisions: structuredClone(m3Decision),
      m3Tabs: {...m3VisibleTab},
        projectName: currentProjectName(),
        savedAt: isoNow(),
        student: activeProfile,
        projectData: getProjectData(),
        workspace: Blockly.serialization.workspaces.save(workspace)
      };
      localStorage.setItem(key, JSON.stringify(payload));
      $("autosaveStatus").textContent =
        `自動暫存：已儲存 ${new Date().toLocaleTimeString("zh-TW", {hour:"2-digit", minute:"2-digit"})}`;
    };

    if (immediate) doSave();
    else autosaveTimer = setTimeout(doSave, 500);
  }

  function restoreAutosave() {
    if (!workspace || !activeProfile) return false;

    const key = getAutosaveKey();
    let saved = key ? safeParse(localStorage.getItem(key), null) : null;

    if (saved && saved.workspaces) {
      moduleWorkspaceStates.M1 = saved.workspaces.M1 || null;
      moduleWorkspaceStates.M2 = saved.workspaces.M2 || null;
      moduleWorkspaceStates.M3P1 = saved.workspaces.M3P1 || null;
      moduleWorkspaceStates.M3P2 = saved.workspaces.M3P2 || null;
      restoreM3Decisions(saved.m3Decisions);
      restoreM3VisibleTabs(saved.m3Tabs);
      activeModule = validModuleName(saved.activeModule || saved.module || DEFAULT_MODULE);
      workspace.updateToolbox(buildToolbox(activeModule));
      loadModuleWorkspace(activeModule);
      selectToolboxCategory(MODULE_CONFIG[activeModule].category);
      restoreProjectData(saved.projectData, saved.projectName);
      applyModuleUi();
      $("autosaveStatus").textContent = `自動暫存：已還原 ${activeModule}`;
      return true;
    }

    // 相容 v0.3.7.3 以前：舊版只有一張工作區，視為 M2。
    const legacyKey = getLegacyAutosaveKey();
    saved = legacyKey ? safeParse(localStorage.getItem(legacyKey), null) : null;
    if (saved && saved.workspace) {
      moduleWorkspaceStates.M1 = null;
      moduleWorkspaceStates.M3P1 = null;
      moduleWorkspaceStates.M3P2 = null;
      restoreM3Decisions(null);
      restoreM3VisibleTabs(null);
      moduleWorkspaceStates.M2 = saved.workspace;
      activeModule = "M2";
      workspace.updateToolbox(buildToolbox(activeModule));
      loadModuleWorkspace(activeModule);
      selectToolboxCategory(MODULE_CONFIG[activeModule].category);
      restoreProjectData(saved.projectData, saved.projectName);
      applyModuleUi();
      $("autosaveStatus").textContent = "自動暫存：已還原舊版 M2";
      return true;
    }

    workspace.clear();
    moduleWorkspaceStates.M1 = null;
    moduleWorkspaceStates.M2 = null;
    moduleWorkspaceStates.M3P1 = null;
    moduleWorkspaceStates.M3P2 = null;
    restoreM3Decisions(null);
    restoreM3VisibleTabs(null);
    activeModule = DEFAULT_MODULE;
    workspace.updateToolbox(buildToolbox(activeModule));
    applyModuleUi();
    selectToolboxCategory(MODULE_CONFIG[activeModule].category);
    return false;
  }

  function buildProjectPayload() {
    captureActiveModuleState();
    return {
      formatVersion: 3,
      appVersion: APP_VERSION,
      module: activeModule,
      activeModule,
      workspaces: { ...moduleWorkspaceStates },
      m3Decisions: structuredClone(m3Decision),
      m3Tabs: {...m3VisibleTab},
      projectName: currentProjectName(),
      savedAt: isoNow(),
      student: {
        studentId: activeProfile.studentId,
        studentName: activeProfile.studentName,
        studentKey: activeProfile.studentKey,
        keyCreatedAt: activeProfile.createdAt || null,
        keyOrigin: activeProfile.keyOrigin || "browser"
      },
      projectData: getProjectData(),
      sourceProject: openedProjectMeta
        ? {
            originalStudentId: openedProjectMeta.originalStudentId || null,
            originalStudentName: openedProjectMeta.originalStudentName || null,
            originalSavedAt: openedProjectMeta.originalSavedAt || null
          }
        : null,
      workspace: Blockly.serialization.workspaces.save(workspace)
    };
  }

  function moduleFileTag(moduleName) {
    return moduleName === "M3P1" ? "M3-Part1" : moduleName === "M3P2" ? "M3-Part2" : moduleName;
  }

  function saveProject() {
    if (!activeProfile || !workspace) return;

    const payload = buildProjectPayload();
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const fileName = [
      sanitizeFilenamePart(activeProfile.studentId),
      sanitizeFilenamePart(activeProfile.studentName),
      moduleFileTag(activeModule),
      timestampForFilename()
    ].join("_") + ".json";

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    $("autosaveStatus").textContent = `專案檔：已另存新版本 ${fileName}`;
    scheduleAutosave(true);
  }

  async function openProjectFile(file) {
    if (!file || !workspace) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload || (!payload.workspace && !payload.workspaces)) throw new Error("專案檔格式不正確");

      const sourceStudent = payload.student || {};
      const sourceId = normalizeStudentId(sourceStudent.studentId);
      const activeId = normalizeStudentId(activeProfile.studentId);
      const isSameStudentId = Boolean(sourceId && activeId && sourceId === activeId);
      const keyWasRestored = isSameStudentId && restoreStudentKeyFromOwnProject(sourceStudent);

      if (payload.workspaces) {
        moduleWorkspaceStates.M1 = payload.workspaces.M1 || null;
        moduleWorkspaceStates.M2 = payload.workspaces.M2 || null;
        moduleWorkspaceStates.M3P1 = payload.workspaces.M3P1 || null;
        moduleWorkspaceStates.M3P2 = payload.workspaces.M3P2 || null;
        activeModule = validModuleName(payload.activeModule || payload.module || DEFAULT_MODULE);
      } else {
        Object.keys(moduleWorkspaceStates).forEach(key=>{moduleWorkspaceStates[key]=null;});
        const sourceModule = validModuleName(payload.module || DEFAULT_MODULE);
        moduleWorkspaceStates[sourceModule] = payload.workspace;
        activeModule = sourceModule;
      }
      restoreM3Decisions(payload.m3Decisions);
      restoreM3VisibleTabs(payload.m3Tabs);
      workspace.updateToolbox(buildToolbox(activeModule));
      loadModuleWorkspace(activeModule);
      selectToolboxCategory(MODULE_CONFIG[activeModule].category);
      applyModuleUi();
      restoreProjectData(payload.projectData, payload.projectName);

      openedProjectMeta = {
        originalStudentId: sourceStudent.studentId || null,
        originalStudentName: sourceStudent.studentName || null,
        originalStudentKey: sourceStudent.studentKey || null,
        originalSavedAt: payload.savedAt || null
      };

      const notice = $("projectNotice");
      const sourceName = `${sourceStudent.studentId || ""} ${sourceStudent.studentName || ""}`.trim();
      if (isSameStudentId) {
        notice.textContent = keyWasRestored
          ? `🔑 已開啟自己的 ${activeModule} 專案，並恢復 studentKey（末 8 碼：${shortStudentKey(activeProfile.studentKey)}）。`
          : `📂 已開啟自己的 ${activeModule} 專案：${file.name}。`;
      } else if (sourceId) {
        notice.textContent = `📂 已開啟「${sourceName || "其他同學"}」的專案內容作為起點；目前身分仍是 ${activeProfile.studentId} ${activeProfile.studentName}。`;
      } else {
        notice.textContent = `📂 已開啟 ${file.name}；目前身分仍是 ${activeProfile.studentId} ${activeProfile.studentName}。`;
      }
      notice.classList.remove("hidden");

      clearGuiMessages();
      resetSummary();
      updatePython();
      updateWorkspaceHint();
      scheduleAutosave(true);
      setRunStatus("neutral", "專案已開啟", `目前顯示 ${activeModule} 獨立工作區，可以繼續修改並重新執行。`);
      setTimeout(() => { try { workspace.zoomToFit(); } catch (_) {} }, 80);
    } catch (err) {
      console.error(err);
      alert("無法開啟這個專案檔。請確認它是本系統儲存的 JSON 專案。\n\n舊版 M1 積木仍可相容，但其他未知積木可能無法載入。");
    } finally {
      $("projectFileInput").value = "";
    }
  }

  function resetWorkspace() {
    if (!workspace) return;
    const ok = confirm(`要清空目前的 ${activeModule} 積木重新開始嗎？\n\n只會清空這個 Module 的獨立畫布；如果需要保留，請先儲存專案。`);
    if (!ok) return;
    workspace.clear();
    openedProjectMeta = null;
    $("projectNotice").classList.add("hidden");
    clearGuiMessages();
    resetSummary();
    resetRecordResults();
    setRunStatus("neutral", "工作區已清空", activeModule === "M1" ? "可以從 M1 積木盒重新練習流程順序。" : "可以從 M2 積木盒重新設定商品與會員資料、運算並顯示結果。");
    updatePython();
    updateFlowchart();
    updateWorkspaceHint();
    scheduleAutosave(true);
  }

  function bindFloatingPanel(panelId, handleId, collapseBtnId, resetBtnId, defaults) {
    const panel = $(panelId);
    const handle = $(handleId);
    const stage = panel && panel.closest(".workspace-stage");
    const collapseBtn = $(collapseBtnId);
    const resetBtn = $(resetBtnId);

    if (!panel || !handle || !stage || panel.dataset.dragReady === "1") return;
    panel.dataset.dragReady = "1";

    let drag = null;

    function clampPosition(left, top) {
      const stageRect = stage.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const maxLeft = Math.max(0, stageRect.width - panelRect.width);
      const maxTop = Math.max(0, stageRect.height - panelRect.height);
      return {
        left: Math.min(Math.max(0, left), maxLeft),
        top: Math.min(Math.max(0, top), maxTop)
      };
    }

    function normalizeCurrentPosition() {
      const stageRect = stage.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const pos = clampPosition(
        panelRect.left - stageRect.left,
        panelRect.top - stageRect.top
      );
      panel.style.left = `${pos.left}px`;
      panel.style.top = `${pos.top}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    }

    handle.addEventListener("pointerdown", e => {
      if (e.target.closest("button")) return;
      if (e.button !== 0) return;

      normalizeCurrentPosition();
      const left = parseFloat(panel.style.left) || 0;
      const top = parseFloat(panel.style.top) || 0;

      drag = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        left,
        top
      };

      try { handle.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });

    handle.addEventListener("pointermove", e => {
      if (!drag || e.pointerId !== drag.pointerId) return;

      const pos = clampPosition(
        drag.left + (e.clientX - drag.startX),
        drag.top + (e.clientY - drag.startY)
      );

      panel.style.left = `${pos.left}px`;
      panel.style.top = `${pos.top}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    });

    function endDrag(e) {
      if (!drag || e.pointerId !== drag.pointerId) return;
      try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
      drag = null;
    }

    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);

    if (collapseBtn) {
      collapseBtn.addEventListener("click", () => {
        const collapsed = panel.classList.toggle("is-collapsed");
        collapseBtn.textContent = collapsed ? "＋" : "—";
        collapseBtn.title = collapsed
          ? `展開${defaults.label}`
          : `收起${defaults.label}`;

        setTimeout(() => {
          if (panel.style.left) normalizeCurrentPosition();
        }, 0);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        panel.classList.remove("is-collapsed");
        if (collapseBtn) {
          collapseBtn.textContent = "—";
          collapseBtn.title = `收起${defaults.label}`;
        }
        panel.style.left = "";
        panel.style.top = defaults.top || "";
        panel.style.right = defaults.right || "";
        panel.style.bottom = defaults.bottom || "";
      });
    }

    window.addEventListener("resize", () => {
      if (panel.style.left) normalizeCurrentPosition();
    });
  }

  function initMessageFloatingPanel() {
    bindFloatingPanel(
      "messageFloat",
      "messageDragHandle",
      "messageCollapseBtn",
      "messageResetPositionBtn",
      { label: "流程訊息", right: "14px", bottom: "14px" }
    );
  }

  function initPythonFloatingPanel() {
    const panel = $("pythonFloat");
    const handle = $("pythonDragHandle");
    const stage = panel && panel.closest(".workspace-stage");
    const collapseBtn = $("pythonCollapseBtn");
    const resetBtn = $("pythonResetPositionBtn");

    if (!panel || !handle || !stage || panel.dataset.dragReady === "1") return;
    panel.dataset.dragReady = "1";

    let drag = null;

    function clampPosition(left, top) {
      const stageRect = stage.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const maxLeft = Math.max(0, stageRect.width - panelRect.width);
      const maxTop = Math.max(0, stageRect.height - panelRect.height);
      return {
        left: Math.min(Math.max(0, left), maxLeft),
        top: Math.min(Math.max(0, top), maxTop)
      };
    }

    function normalizeCurrentPosition() {
      const stageRect = stage.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const pos = clampPosition(
        panelRect.left - stageRect.left,
        panelRect.top - stageRect.top
      );
      panel.style.left = `${pos.left}px`;
      panel.style.top = `${pos.top}px`;
      panel.style.right = "auto";
    }

    handle.addEventListener("pointerdown", e => {
      if (e.target.closest("button")) return;
      if (e.button !== 0) return;

      normalizeCurrentPosition();
      const left = parseFloat(panel.style.left) || 0;
      const top = parseFloat(panel.style.top) || 0;

      drag = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        left,
        top
      };

      try { handle.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });

    handle.addEventListener("pointermove", e => {
      if (!drag || e.pointerId !== drag.pointerId) return;

      const pos = clampPosition(
        drag.left + (e.clientX - drag.startX),
        drag.top + (e.clientY - drag.startY)
      );

      panel.style.left = `${pos.left}px`;
      panel.style.top = `${pos.top}px`;
      panel.style.right = "auto";
    });

    function endDrag(e) {
      if (!drag || e.pointerId !== drag.pointerId) return;
      try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
      drag = null;
    }

    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);

    if (collapseBtn) {
      collapseBtn.addEventListener("click", () => {
        const collapsed = panel.classList.toggle("is-collapsed");
        collapseBtn.textContent = collapsed ? "＋" : "—";
        collapseBtn.title = collapsed ? "展開 Python 對照" : "收起 Python 對照";
        setTimeout(() => {
          if (panel.style.left) normalizeCurrentPosition();
        }, 0);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        panel.classList.remove("is-collapsed");
        if (collapseBtn) {
          collapseBtn.textContent = "—";
          collapseBtn.title = "收起 Python 對照";
        }
        panel.style.left = "";
        panel.style.top = "14px";
        panel.style.right = "14px";
      });
    }

    window.addEventListener("resize", () => {
      if (panel.style.left) normalizeCurrentPosition();
    });
  }

  function setPythonVisible(visible) {
    const panel = $("pythonFloat");
    const btn = $("togglePythonBtn");
    if (!panel || !btn) return;

    panel.classList.toggle("is-hidden", !visible);
    btn.classList.toggle("is-active", visible);
    btn.setAttribute("aria-pressed", visible ? "true" : "false");
    btn.textContent = visible ? "🐍 關閉 Python" : "🐍 Python";

    if (visible) {
      collapseFlyout();
      updatePython();
    }
  }

  function togglePythonPanel() {
    const panel = $("pythonFloat");
    if (!panel) return;
    setPythonVisible(panel.classList.contains("is-hidden"));
  }

  function applyFontScale(scale) {
    const clamped = Math.max(0.9, Math.min(1.2, scale));
    document.documentElement.style.setProperty("--ui-scale", String(clamped));
    document.documentElement.style.setProperty(
      "--block-font-size",
      `${Math.round(24 * clamped)}px`
    );
    $("fontScaleLabel").textContent = `${Math.round(clamped * 100)}%`;
    localStorage.setItem(FONT_KEY, String(clamped));
    setTimeout(() => {
      if (workspace) Blockly.svgResize(workspace);
    }, 50);
  }

  function currentFontScale() {
    const saved = parseFloat(localStorage.getItem(FONT_KEY));
    return Number.isFinite(saved) ? saved : 1.05;
  }

  function updateOfflineBadge() {
    $("offlineBadge").textContent = navigator.onLine
      ? "✓ 離線核心已就緒"
      : "✓ 目前已離線 · 核心可用";
  }

  function restoreM3VisibleTabs(saved) {
    m3VisibleTab={M3P1:saved&&saved.M3P1==="blocks"?"blocks":"decision",
                  M3P2:saved&&saved.M3P2==="blocks"?"blocks":"decision"};
  }

  function restoreM3Decisions(saved) {
    const defaults=defaultM3Decision();
    if(!saved||typeof saved!=="object") {m3Decision=defaults;return;}
    const p1=saved.M3P1,p2=saved.M3P2;
    m3Decision={
      M3P1: p1&&Array.isArray(p1.items)&&p1.items.length===6 ? {
        selected: Math.max(0,Math.min(5,Number(p1.selected)||0)),
        items: p1.items.map((item,i)=>({op:String(item.op||""),testValue:String(item.testValue??M3_QUESTIONS[i].n),prediction:String(item.prediction||""),history:Array.isArray(item.history)?item.history.slice(-20):[]}))
      } : defaults.M3P1,
      M3P2: p2&&Array.isArray(p2.rules) ? {
        topic:String(p2.topic||""),description:String(p2.description||""),basis:String(p2.basis||""),
        rules:p2.rules.slice(0,16).map(r=>({op:String(r.op||">="),threshold:String(r.threshold??""),result:String(r.result||"")})),
        otherwise:String(p2.otherwise||""),testValue:String(p2.testValue??""),
        prediction:String(p2.prediction||""),history:Array.isArray(p2.history)?p2.history.slice(-20):[]
      } : defaults.M3P2
    };
  }

  function m3Escape(v) {return escapeHtmlForAttribute(v);}
  function m3OpOptions(selected) {
    return `<option value="">選擇運算子</option>`+M3_OPERATORS.map(([label,v])=>
      `<option value="${m3Escape(v)}" ${selected===v?"selected":""}>${m3Escape(label)}</option>`).join("");
  }
  function m3BranchBadge(branch) {
    const kind = /^IF$/.test(String(branch)) ? "if" : /^ELSE$/.test(String(branch)) ? "else" : "other";
    return `<span class="m3-branch-badge ${kind}">${m3Escape(branch || "—")}</span>`;
  }
  function m3DecisionHistory(history) {
    if (!history || !history.length) return '<p class="m3-hint">尚無測試紀錄。請按下各筆的「測試」，觀察判斷結果。</p>';
    return `<div class="m3-history"><table><thead><tr><th>測試值</th><th>運算子</th><th>實際分支</th><th>處理結果</th></tr></thead><tbody>`+
      history.slice(-10).map(h=>`<tr><td>${m3Escape(h.value)}</td><td>${m3Escape(h.op||"—")}</td><td>${m3BranchBadge(h.branch)}</td><td>${m3Escape(h.result)}</td></tr>`).join("")+`</tbody></table></div>`;
  }
  function m3SuggestedValues(q) {
    // 庫存不可為負，缺貨情境採 0、1、2；其他題目觀察門檻前、門檻本身、門檻後。
    return q.n===0 ? [0,1,2] : [q.n-1,q.n,q.n+1];
  }
  function m3P1TestGrid(question, answer) {
    const suggested=m3SuggestedValues(question);
    return `<div class="m3-history"><table class="m3-test-grid"><thead><tr><th>測試值</th><th>實際分支</th><th>處理結果</th><th>操作</th></tr></thead><tbody>`+
      suggested.map(v=>{
        const last=[...answer.history].reverse().find(h=>Number(h.value)===v && h.op===answer.op);
        return `<tr><td><strong>${v}</strong></td><td>${last?m3BranchBadge(last.branch):'<span class="m3-not-tested">尚未測試</span>'}</td>`+
          `<td>${last?m3Escape(last.result):'—'}</td><td><button type="button" class="btn btn-light btn-small m3-run-case" data-m3-case="${v}" ${!answer.op?'disabled title="請先選擇比較運算子"':''}>測試</button></td></tr>`;
      }).join("")+`</tbody></table></div>`;
  }
  function renderM3Decision() {
    const panel=$("m3DecisionPanel");if(!panel||!activeModule.startsWith("M3"))return;
    const isP1=activeModule==="M3P1";
    if(isP1) {
      const d=m3Decision.M3P1, i=d.selected,q=M3_QUESTIONS[i],a=d.items[i];
      panel.innerHTML=`
        <div class="m3-section-heading"><strong>六種比較運算子練習</strong><span>第 ${i+1} / 6 題</span></div>
        <div class="m3-instructions"><strong>練習方式</strong><p>閱讀題目 → 選擇正確的比較運算子 → 分別按下三筆測試值的「測試」，觀察 IF／ELSE 與結果。<br>六題完成後，切到「Blockly 畫布」完成指定情境。</p>
          <p class="m3-save-note">💾 決策表和積木會一起存入同一份專案；不需單獨上傳決策表。完成兩項練習後，再一起儲存、繳交作業。</p></div>
        <div class="m3-question-tabs">${M3_QUESTIONS.map((v,j)=>`<button type="button" data-m3-question="${j}" class="${i===j?"active":""}">${j+1} ${m3Escape(v.title)}</button>`).join("")}</div>
        <section class="m3-scenario"><span>老師提供的情境</span><h3>${m3Escape(q.title)}</h3><p>${m3Escape(q.description)}</p></section>
        <section class="m3-decision-rule"><h3>① 將文字需求轉換成比較條件</h3>
         <div class="m3-condition"><strong>IF｜如果 ${m3Escape(q.basis)}</strong>
          <select aria-label="選擇比較運算子" data-m3-p1="op">${m3OpOptions(a.op)}</select><strong>${q.n}</strong></div>
         <div class="m3-outcome"><div>符合條件（IF）→ ${m3Escape(q.yes)}</div><div>不符合（ELSE）→ ${m3Escape(q.no)}</div></div>
         <p class="m3-hint">觀察題目是否「包含門檻」：「滿／含」通常包含該值；「超過／不足」不包含。</p>
        </section><section class="m3-decision-test"><h3>② 測試三筆數值，看看條件是否正確</h3>
          <p class="m3-hint">先選比較運算子，再逐筆按「測試」。<span class="m3-branch-badge if">IF 綠色：條件成立</span> <span class="m3-branch-badge else">ELSE 紅色：條件不成立</span>。改變運算子後，再重新測試看看。</p>
          ${m3P1TestGrid(q,a)}
          <div id="m3TestFeedback" role="status"></div>
          <details class="m3-test-history"><summary>查看過去測試紀錄</summary>${m3DecisionHistory(a.history)}</details>
        </section>`;
    } else {
      const d=m3Decision.M3P2;
      panel.innerHTML=`<div class="m3-section-heading"><strong>自由設計多分支決策表</strong><span>與 Blockly 指定題目不同</span></div>
        <section class="m3-scenario m3-inputs"><label>決策主題 <input data-m3-p2="topic" maxlength="80" value="${m3Escape(d.topic)}" placeholder="例如：庫存補貨等級"></label>
        <label>判斷依據 <input data-m3-p2="basis" maxlength="60" value="${m3Escape(d.basis)}" placeholder="例如：剩餘庫存數量"></label>
        <label class="m3-description">情境說明 <input data-m3-p2="description" maxlength="240" value="${m3Escape(d.description)}" placeholder="請說明你設計的商業或生活規則"></label></section>
        <section class="m3-decision-rule"><h3>依順序設定 IF / ELIF 條件</h3>
        ${d.rules.map((r,i)=>`<div class="m3-rule-row"><div class="m3-rule-title"><strong>${i===0?"IF":"ELIF "+i}</strong><span>
          <button class="btn btn-ghost btn-small" data-m3-move="${i}" data-dir="up" ${i===0?"disabled":""}>↑</button>
          <button class="btn btn-ghost btn-small" data-m3-move="${i}" data-dir="down" ${i===d.rules.length-1?"disabled":""}>↓</button>
          <button class="btn btn-ghost btn-small" data-m3-delete="${i}" ${d.rules.length===1?"disabled":""}>刪除</button></span></div>
          <div class="m3-rule-fields"><span class="m3-basis">${m3Escape(d.basis||"判斷依據")}</span>
          <select data-m3-rule="${i}" data-field="op">${m3OpOptions(r.op)}</select>
          <input type="number" data-m3-rule="${i}" data-field="threshold" value="${m3Escape(r.threshold)}" placeholder="比較數值"></div>
          <label>符合條件時的處理結果 <input data-m3-rule="${i}" data-field="result" maxlength="120" value="${m3Escape(r.result)}" placeholder="例如：立即補貨"></label></div>`).join("")}
        <button class="btn btn-light" type="button" data-m3-action="add">＋ 新增 ELIF 分支</button>
        <label class="m3-else">ELSE｜其他情況的處理結果 <input maxlength="120" data-m3-p2="otherwise" value="${m3Escape(d.otherwise)}" placeholder="例如：正常庫存"></label>
        <p class="m3-hint">必須有 IF、至少一個 ELIF 與 ELSE；可增加或調整判斷順序。只用一項數值判斷，不使用 AND／OR。</p></section>
        <section class="m3-decision-test"><h3>決策測試</h3>
          <label>測試數值 <input type="number" data-m3-p2="testValue" value="${m3Escape(d.testValue)}"></label>
          <label>預測結果 <input data-m3-p2="prediction" maxlength="120" placeholder="先預測會執行哪個分支或結果" value="${m3Escape(d.prediction)}"></label>
          <button class="btn btn-primary" type="button" data-m3-action="p2-test">執行決策表測試</button>
          <div id="m3TestFeedback" role="status"></div>${m3DecisionHistory(d.history)}</section>`;
    }
  }

  function testM3Decision() {
    const output=$("m3TestFeedback");
    if(activeModule==="M3P1") {
      const d=m3Decision.M3P1,q=M3_QUESTIONS[d.selected],a=d.items[d.selected];
      if(!M3_OPERATORS.some(v=>v[1]===a.op)||a.testValue.trim()===""||!Number.isFinite(Number(a.testValue))) {
        output.textContent="請先選擇比較運算子，再按各筆測試值的「測試」。";return;
      }
      const matched=compareValues(Number(a.testValue),q.n,a.op),branch=matched?"IF":"ELSE";
      const matchAnswer=a.op===q.op;
      a.history.push({value:a.testValue,op:a.op,branch,result:matched?q.yes:q.no});
      a.history=a.history.slice(-20);
      renderM3Decision();
      const feedback=$("m3TestFeedback");
      feedback.className=matchAnswer?"m3-feedback-ok":"m3-feedback-review";
      feedback.textContent=`測試 ${a.testValue} → ${branch}：${matched?q.yes:q.no}。${matchAnswer?"目前的運算子符合題目語意。":"請再檢查運算子是否符合原始題目，尤其是門檻值是否包含在內。"}`;
    } else {
      const d=m3Decision.M3P2;
      if(!d.topic.trim()||!d.basis.trim()||d.rules.length<2||!d.otherwise.trim()||d.testValue.trim()===""||!Number.isFinite(Number(d.testValue))||
        d.rules.some(r=>r.threshold.trim()===""||!Number.isFinite(Number(r.threshold))||!r.op||!r.result.trim())) {
        output.textContent="請填完整主題、判斷依據、至少兩個條件、ELSE 與有效測試值。";return;
      }
      const v=Number(d.testValue),at=d.rules.findIndex(r=>compareValues(v,Number(r.threshold),r.op));
      const branch=at<0?"ELSE":at===0?"IF":`ELIF ${at}`;
      const result=at<0?d.otherwise:d.rules[at].result;
      d.history.push({value:d.testValue,prediction:d.prediction,branch,result});d.history=d.history.slice(-20);
      renderM3Decision();$("m3TestFeedback").textContent=`執行 ${branch} → ${result}。請自行核對預測與判斷順序。`;
    }
    scheduleAutosave(true);
  }

  function bindM3Ui() {
    [["m3ModeDecision","decision"],["m3ModeBlocks","blocks"]].forEach(([id,mode])=>$(id).addEventListener("click",()=>{
      if(!activeModule.startsWith("M3"))return;
      m3VisibleTab[activeModule]=mode;
      applyModuleUi();
      if(mode==="blocks")setTimeout(()=>{try{Blockly.svgResize(workspace);}catch(_){}},80);
    }));
    const panel=$("m3DecisionPanel");
    panel.addEventListener("input",e=>{
      const el=e.target, p1=el.dataset.m3P1,p2=el.dataset.m3P2,index=el.dataset.m3Rule;
      if(p1) m3Decision.M3P1.items[m3Decision.M3P1.selected][p1]=el.value;
      else if(p2) m3Decision.M3P2[p2]=el.value;
      else if(index!==undefined) m3Decision.M3P2.rules[Number(index)][el.dataset.field]=el.value;
      scheduleAutosave();
    });
    panel.addEventListener("change",e=>{
      if (e.target.dataset.m3P1==="op") renderM3Decision();
      if(e.target.dataset.m3P1||e.target.dataset.m3P2||e.target.dataset.m3Rule!==undefined)scheduleAutosave(true);
    });
    panel.addEventListener("click",e=>{
      const btn=e.target.closest("button");if(!btn)return;
      if(btn.dataset.m3Question!==undefined){m3Decision.M3P1.selected=Number(btn.dataset.m3Question);renderM3Decision();scheduleAutosave();return;}
      if(btn.dataset.m3Case!==undefined && activeModule==="M3P1") {
        m3Decision.M3P1.items[m3Decision.M3P1.selected].testValue=btn.dataset.m3Case;
        testM3Decision();return;
      }
      const d=m3Decision.M3P2;
      if(btn.dataset.m3Delete!==undefined){d.rules.splice(Number(btn.dataset.m3Delete),1);renderM3Decision();scheduleAutosave(true);return;}
      if(btn.dataset.m3Move!==undefined){let i=Number(btn.dataset.m3Move),j=i+(btn.dataset.dir==="up"?-1:1);
        if(j>=0&&j<d.rules.length){[d.rules[i],d.rules[j]]=[d.rules[j],d.rules[i]];renderM3Decision();scheduleAutosave(true);}return;}
      if(btn.dataset.m3Action==="add"){
        if(d.rules.length>=16){alert("最多 16 個條件，請先整理判斷規則。");return;}
        d.rules.push({op:">=",threshold:"",result:""});renderM3Decision();scheduleAutosave(true);return;
      }
      if(["p1-test","p2-test"].includes(btn.dataset.m3Action))testM3Decision();
    });
  }

  function bindUi() {
    bindM3Ui();
    $("createIdentityBtn").addEventListener("click", createIdentity);
    $("continueIdentityBtn").addEventListener("click", continueIdentity);
    $("switchIdentityBtn").addEventListener("click", switchIdentity);
    $("switchUserTopBtn").addEventListener("click", switchIdentity);

    [["moduleM1", "M1"], ["moduleM2", "M2"], ["moduleM3P1", "M3P1"], ["moduleM3P2", "M3P2"],
      ["moduleTabM1", "M1"], ["moduleTabM2", "M2"], ["moduleTabM3P1", "M3P1"], ["moduleTabM3P2", "M3P2"]].forEach(([id, moduleName]) => {
      const control = $(id);
      if (!control) return;
      control.addEventListener("click", () => switchModule(moduleName));
      control.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          switchModule(moduleName);
        }
      });
    });

    $("studentIdInput").addEventListener("keydown", e => {
      if (e.key === "Enter") $("studentNameInput").focus();
    });
    $("studentNameInput").addEventListener("keydown", e => {
      if (e.key === "Enter") createIdentity();
    });

    $("runProgramBtn").addEventListener("click", runProgram);
    $("guiRunBtn").addEventListener("click", runProgram);
    $("clearMessagesBtn").addEventListener("click", clearGuiMessages);
    $("guiToggleBtn").addEventListener("click", () => {
      const card = document.querySelector(".gui-card");
      if (!card) return;

      const collapsed = card.classList.toggle("is-collapsed");
      document.body.classList.toggle("gui-expanded", !collapsed);

      const btn = $("guiToggleBtn");
      btn.textContent = collapsed ? "展開 GUI" : "收起 GUI";
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");

      setTimeout(() => {
        if (workspace) Blockly.svgResize(workspace);
      }, 180);
    });
    $("resetWorkspaceBtn").addEventListener("click", resetWorkspace);
    $("toggleFlyoutBtn").addEventListener("click", toggleFlyout);
    $("togglePythonBtn").addEventListener("click", togglePythonPanel);
$("toggleFlowchartBtn").addEventListener("click", toggleFlowchartPanel);
    $("pythonCloseBtn").addEventListener("click", () => setPythonVisible(false));

    $("saveProjectBtn").addEventListener("click", saveProject);
    $("uploadProjectBtn").addEventListener("click", uploadProject);
    $("cloudSetupBtn").addEventListener("click", configureUploadEndpoint);
    $("openProjectBtn").addEventListener("click", () => $("projectFileInput").click());
    $("projectFileInput").addEventListener("change", e => {
      openProjectFile(e.target.files && e.target.files[0]);
    });


    $("projectTitleInput").addEventListener("input", e => {
      projectState.projectName = e.target.value;
      const name = currentProjectName();
      $("guiProjectName").textContent = name;
      $("guiWindowTitle").textContent = `🧩 ${name} · ${activeModule}`;
      $("footerProject").textContent = `專案：${name}`;
      updatePython();
      scheduleAutosave();
    });
    $("eligibleInput").addEventListener("change", e => {
      projectState.eligible = Boolean(e.target.checked);
      resetSummary();
      updatePython();
      scheduleAutosave();
    });
    $("addRecordBtn").addEventListener("click", () => {
      projectState.records.push({ name: "新項目", price: 0, qty: 1, subtotal: null, status: "" });
      renderRecords();
      resetSummary();
      updatePython();
      scheduleAutosave(true);
    });
    $("resetSampleBtn").addEventListener("click", () => {
      const ok = confirm("要把 GUI 測試資料恢復成預設的 3 筆範例嗎？");
      if (!ok) return;
      projectState.records = [
        { name: "咖啡", price: 80, qty: 2, subtotal: null, status: "" },
        { name: "蛋糕", price: 120, qty: 1, subtotal: null, status: "" },
        { name: "果汁", price: 60, qty: 3, subtotal: null, status: "" }
      ];
      projectState.eligible = true;
      renderProjectState();
      clearGuiMessages();
      scheduleAutosave(true);
    });
    $("recordsTableBody").addEventListener("input", e => {
      const input = e.target.closest("input[data-field]");
      if (!input) return;
      const row = input.closest("tr[data-index]");
      if (!row) return;
      const index = Number(row.dataset.index);
      const record = projectState.records[index];
      if (!record) return;
      const field = input.dataset.field;
      record[field] = field === "name" ? input.value : numeric(input.value);
      record.subtotal = null;
      record.status = "";
      resetSummary();
      updateRecordRow(index);
      updatePython();
      scheduleAutosave();
    });
    $("recordsTableBody").addEventListener("click", e => {
      const btn = e.target.closest("button[data-action=\"delete\"]");
      if (!btn) return;
      const row = btn.closest("tr[data-index]");
      const index = row ? Number(row.dataset.index) : -1;
      if (index < 0 || projectState.records.length <= 1) return;
      projectState.records.splice(index, 1);
      renderRecords();
      resetSummary();
      updatePython();
      scheduleAutosave(true);
    });

    $("fontDownBtn").addEventListener("click", () => {
      applyFontScale(currentFontScale() - 0.05);
    });
    $("fontUpBtn").addEventListener("click", () => {
      applyFontScale(currentFontScale() + 0.05);
    });

    window.addEventListener("resize", () => {
      if (workspace) Blockly.svgResize(workspace);
    });
    window.addEventListener("online", updateOfflineBadge);
    window.addEventListener("offline", updateOfflineBadge);
    window.addEventListener("beforeunload", () => {
      if (activeProfile && workspace) scheduleAutosave(true);
    });
  }

  function boot() {
    if (typeof Blockly === "undefined") {
      alert("Blockly 本機核心載入失敗。請確認 vendor/blockly 資料夾完整存在。");
      return;
    }
    migrateLegacyProfile();
    bindUi();
    initPythonFloatingPanel();
    initFlowchartPanel();

    const guiCard = document.querySelector(".gui-card");
    if (guiCard) guiCard.classList.add("is-collapsed");
    document.body.classList.remove("gui-expanded");

    applyFontScale(currentFontScale());
    updateOfflineBadge();
    refreshCloudUi();
    showIdentityScreen();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
