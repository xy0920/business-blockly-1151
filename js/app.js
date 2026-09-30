
(() => {
  "use strict";

  const APP_VERSION = "0.3.7.5-m2-labeled-output-test";
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
  const moduleWorkspaceStates = { M1: null, M2: null };
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
        "success",
        "作業已送出",
        "請查看新開啟的「作業上傳結果」頁面；看到綠色「上傳成功」才算完成。"
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

    Blockly.Blocks["data_set_variable"] = {
      init: function() {
        this.appendValueInput("VALUE")
          .appendField("設定")
          .appendField(new Blockly.FieldDropdown(M2_VARIABLE_OPTIONS), "VAR")
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
          .appendField(new Blockly.FieldDropdown(M2_VARIABLE_OPTIONS), "VAR");
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

    if (moduleName === "M2") {
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
      totalPoints: "累積點數"
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
      totalPoints: "totalPoints"
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

    const WIDTH = 860;
    const CENTER = 430;
    const NODE_W = 320;
    const IO_W = 350;
    const DEC_W = 300;
    const NODE_H = 70;
    const DEC_H = 110;
    const GAP = 42;
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
      const h = Math.max(NODE_H, 26 + lines.length * 16);
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
      const h = Math.max(NODE_H, 26 + lines.length * 16);
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

        if (block.type === "condition_if_valid") {
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
      setRunStatus("warning", "還沒有積木", activeModule === "M1" ? "先從 M1 積木盒拖出顯示積木，重新組一條流程。" : "先從 M2 積木盒拖出「設定變數」積木，從商品與會員資料開始組流程。");
      return;
    }

    if (stacks.length !== 1) {
      setRunStatus("warning", "目前有多條流程", activeModule === "M1"
        ? "請把 M1 的顯示積木接成一條主流程，再執行測試。"
        : "請把 M2 的設定、運算與顯示積木接成一條主流程，再執行測試。");
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
        totalPoints: 0
      },
      assigned: new Set()
    };

    try {
      await executeChain(stacks[0], ctx);

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
    return value === "M1" || value === "M2" ? value : DEFAULT_MODULE;
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
    [["moduleTabM1", "M1"], ["moduleTabM2", "M2"]].forEach(([id, moduleName]) => {
      const btn = $(id);
      if (!btn) return;
      const selected = moduleName === activeModule;
      btn.classList.toggle("active", selected);
      btn.setAttribute("aria-selected", selected ? "true" : "false");
    });
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
    resetSummary();
    updatePython();
    updateFlowchart();
    updateWorkspaceHint();
    setRunStatus(
      "neutral",
      `${activeModule} 工作區`,
      activeModule === "M1"
        ? "這是獨立的 M1 畫布；請重新用已學過的流程積木完成練習。"
        : "這是獨立的 M2 畫布；請從設定資料開始，重新完成一筆會員購物交易。"
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
        workspaces: { M1: moduleWorkspaceStates.M1, M2: moduleWorkspaceStates.M2 },
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
      workspaces: { M1: moduleWorkspaceStates.M1, M2: moduleWorkspaceStates.M2 },
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

  function saveProject() {
    if (!activeProfile || !workspace) return;

    const payload = buildProjectPayload();
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const fileName = [
      sanitizeFilenamePart(activeProfile.studentId),
      sanitizeFilenamePart(activeProfile.studentName),
      activeModule,
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
        activeModule = validModuleName(payload.activeModule || payload.module || DEFAULT_MODULE);
      } else {
        const sourceModule = validModuleName(payload.module || DEFAULT_MODULE);
        moduleWorkspaceStates[sourceModule] = payload.workspace;
        activeModule = sourceModule;
      }
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

  function bindUi() {
    $("createIdentityBtn").addEventListener("click", createIdentity);
    $("continueIdentityBtn").addEventListener("click", continueIdentity);
    $("switchIdentityBtn").addEventListener("click", switchIdentity);
    $("switchUserTopBtn").addEventListener("click", switchIdentity);

    [["moduleM1", "M1"], ["moduleM2", "M2"], ["moduleTabM1", "M1"], ["moduleTabM2", "M2"]].forEach(([id, moduleName]) => {
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
