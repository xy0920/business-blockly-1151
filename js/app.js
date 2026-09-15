
(() => {
  "use strict";

  const APP_VERSION = "0.2.8.1-intro-student";
  const MODULE = "INTRO";
  const PROJECT_NAME = "商業流程整合示範";
  const LEGACY_PROFILE_KEY = "businessBlockly.profile.v1";
  const PROFILE_REGISTRY_KEY = "businessBlockly.profileRegistry.v2";
  const ACTIVE_PROFILE_KEY = "businessBlockly.activeProfile.v2";
  const FONT_KEY = "businessBlockly.fontScale.v1";
  const DEV_UPLOAD_ENDPOINT_KEY = "businessBlockly.uploadEndpoint.dev.v1";
  const LAST_SUBMISSION_PREFIX = "businessBlockly.lastSubmission.v1";
  const CLOUD_CONFIG = window.BUSINESS_BLOCKLY_CONFIG || {};
  const COURSE_ID = String(CLOUD_CONFIG.courseId || "1151");
  const DEFAULT_UPLOAD_ENDPOINT = String(CLOUD_CONFIG.uploadEndpoint || "").trim();
  const UPLOAD_TIMEOUT_MS = Number(CLOUD_CONFIG.uploadTimeoutMs || 45000);

  const PROGRAM = {
    shop_show_welcome: {
      message: "歡迎使用商業流程整合示範",
      python: 'print("歡迎使用商業流程整合示範")'
    },
    shop_show_start: {
      message: "開始處理",
      python: 'print("開始處理")'
    },
    shop_show_done: {
      message: "處理完成",
      python: 'print("處理完成")'
    }
  };

  const CORRECT_ORDER = [
    "shop_show_welcome",
    "shop_show_start",
    "shop_show_done"
  ];

  let workspace = null;
  let activeProfile = null;
  let autosaveTimer = null;
  let isRunning = false;
  let openedProjectMeta = null;
  let uploadInProgress = false;

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
    return `businessBlockly.autosave.${activeProfile.studentKey}`;
  }

  function getProgressKey() {
    if (!activeProfile) return null;
    return `businessBlockly.progress.${activeProfile.studentKey}`;
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

    restoreAutosave();
    restoreProgress();
    updatePython();
    updateWorkspaceHint();
    $("autosaveStatus").textContent = "自動暫存：已啟用";

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
    return `${LAST_SUBMISSION_PREFIX}.${activeProfile.studentKey}.${MODULE}`;
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
        `${MODULE} 最近一次上傳成功`,
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
        `☁️ 已送出 ${activeProfile.studentId} ${activeProfile.studentName} · ${MODULE}。請查看新開啟的上傳結果頁面。`;
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

  function defineBlocks() {
    Blockly.Blocks["flow_show_text"] = {
      init: function() {
        this.appendDummyInput()
          .appendField("顯示")
          .appendField(new Blockly.FieldTextInput("請輸入要顯示的文字"), "TEXT");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(214);
        this.setTooltip("顯示一段可以自己修改的文字");
      }
    };

    Blockly.Blocks["shop_show_welcome"] = {
      init: function() {
        this.appendDummyInput()
          .appendField('顯示「歡迎使用小店結帳助手」');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(214);
        this.setTooltip("顯示歡迎訊息");
      }
    };

    Blockly.Blocks["shop_show_start"] = {
      init: function() {
        this.appendDummyInput()
          .appendField('顯示「開始結帳」');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(214);
        this.setTooltip("顯示開始處理");
      }
    };

    Blockly.Blocks["shop_show_done"] = {
      init: function() {
        this.appendDummyInput()
          .appendField('顯示「結帳完成」');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(214);
        this.setTooltip("顯示處理完成");
      }
    };
  }

  function initBlockly() {
    defineBlocks();

    const toolbox = {
      kind: "categoryToolbox",
      contents: [
        {
          kind: "category",
          name: "前導｜操作練習",
          colour: "#6B7A90",
          contents: [
            {
              kind: "block",
              type: "flow_show_text",
              fields: { TEXT: "請輸入要顯示的文字" }
            }
          ]
        },
        {
          kind: "category",
          name: "M1｜流程與順序",
          colour: "#2F6FED",
          contents: [
            { kind: "block", type: "shop_show_welcome" },
            { kind: "block", type: "shop_show_start" },
            { kind: "block", type: "shop_show_done" }
          ]
        }
      ]
    };

    workspace = Blockly.inject("blocklyDiv", {
      toolbox,
      media: "./vendor/blockly/media/",
      renderer: "geras",
      grid: {
        spacing: 22,
        length: 3,
        colour: "#d8dfeb",
        snap: true
      },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 0.92,
        maxScale: 1.35,
        minScale: 0.65,
        scaleSpeed: 1.08
      },
      trashcan: true,
      move: {
        scrollbars: true,
        drag: true,
        wheel: true
      }
    });

    setTimeout(() => Blockly.svgResize(workspace), 100);
  }

  function bindWorkspaceEvents() {
    workspace.addChangeListener((event) => {
      if (event && event.isUiEvent) return;
      updatePython();
      updateWorkspaceHint();
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
      text += topCount === 1 ? " · 已連成一串" : ` · ${topCount} 串尚未連接`;
    }
    $("workspaceHint").textContent = text;
  }

  function updatePython() {
    if (!workspace) return;
    const stacks = allProgramStacks();
    if (!stacks.length) {
      $("pythonCode").textContent =
        "# 把積木拖到工作區後\n# 這裡會出現對應的 Python";
      return;
    }

    const lines = [];
    stacks.forEach((stack, index) => {
      if (index > 0) {
        lines.push("");
        lines.push("# 另一串尚未連接的積木");
      }
      stack.forEach(block => {
        if (block.type === "flow_show_text") {
          lines.push(`print(${JSON.stringify(block.getFieldValue("TEXT") || "")})`);
        } else if (PROGRAM[block.type]) {
          lines.push(PROGRAM[block.type].python);
        } else {
          lines.push(`# 未知積木：${block.type}`);
        }
      });
    });
    $("pythonCode").textContent = lines.join("\n");
  }

  function setRunStatus(kind, title, detail) {
    const box = $("runStatus");
    box.className = `run-status ${kind}`;
    box.querySelector("strong").textContent = title;
    box.querySelector("p").textContent = detail;
  }

  function clearGuiMessages() {
    $("guiMessages").innerHTML =
      '<li class="placeholder">等待執行你的程式…</li>';
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function runProgram() {
    if (isRunning || !workspace) return;

    const stacks = allProgramStacks();
    const allBlocks = workspace.getAllBlocks(false).filter(b => !b.isShadow());

    if (allBlocks.length === 0) {
      setRunStatus(
        "warning",
        "還沒有積木",
        "先從「前導｜操作練習」拖出積木，再把它們接起來。"
      );
      return;
    }

    if (stacks.length !== 1) {
      setRunStatus(
        "warning",
        "積木還沒有接成一串",
        "請把積木上下連接成一串，再按一次執行程式。"
      );
      return;
    }

    const stack = stacks[0];
    if (!stack.every(block => block.type === "flow_show_text" || PROGRAM[block.type])) {
      setRunStatus("error", "出現無法執行的積木", "請清空工作區後再試一次。");
      return;
    }

    isRunning = true;
    $("runProgramBtn").disabled = true;
    $("guiRunBtn").disabled = true;
    $("guiMessages").innerHTML = "";
    setRunStatus("neutral", "執行中…", "看看訊息出現的順序。");

    for (const block of stack) {
      try { block.select(); } catch (_) {}
      const li = document.createElement("li");
      li.textContent = block.type === "flow_show_text"
        ? (block.getFieldValue("TEXT") || "")
        : PROGRAM[block.type].message;
      li.className = "executing";
      $("guiMessages").appendChild(li);
      await sleep(420);
      li.classList.remove("executing");
    }

    const order = stack.map(b => b.type);
    const introOnly = stack.every(b => b.type === "flow_show_text");
    const exactCorrect =
      order.length === CORRECT_ORDER.length &&
      order.every((value, i) => value === CORRECT_ORDER[i]);

    if (introOnly && order.length >= 3) {
      setRunStatus(
        "success",
        "前導練習完成！",
        "你已經會拖積木、改文字、連接與執行。下一步才會正式進入 M1。"
      );
      markIntroComplete();
    } else if (exactCorrect) {
      setRunStatus(
        "success",
        "M1 流程執行成功！",
        "程式會依照積木連接的順序，由上往下執行。"
      );
      markM1Complete();
    } else if (order.length < 3) {
      setRunStatus(
        "warning",
        "程式可以執行，再多試幾個積木",
        `目前有 ${order.length} 個積木；前導任務建議連接 3 個。`
      );
    } else {
      setRunStatus(
        "success",
        "程式已執行",
        "觀察顯示文字的先後順序，也可以繼續修改文字再執行一次。"
      );
    }

    try { workspace.getSelected()?.unselect(); } catch (_) {}
    isRunning = false;
    $("runProgramBtn").disabled = false;
    $("guiRunBtn").disabled = false;
    scheduleAutosave(true);
  }

  function markIntroComplete() {
    const key = getProgressKey();
    if (!key) return;
    const progress = safeParse(localStorage.getItem(key), {}) || {};
    progress.INTRO = true;
    progress.introCompletedAt = progress.introCompletedAt || isoNow();
    localStorage.setItem(key, JSON.stringify(progress));
    restoreProgress();
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

  function restoreProgress() {
    const key = getProgressKey();
    if (!key) return;
    const progress = safeParse(localStorage.getItem(key), {}) || {};

    if (progress.INTRO) {
      $("moduleIntro").classList.add("complete");
      $("introState").textContent = "✓ 已完成";
      $("footerProgress").textContent = "進度：前導已完成 · 下一步 M1";
    } else {
      $("moduleIntro").classList.remove("complete");
      $("introState").textContent = "進行中";
      $("footerProgress").textContent = "進度：前導";
    }

    if (progress.M1) {
      $("moduleM1").classList.add("complete");
      $("m1State").textContent = "✓ 已完成";
    } else {
      $("moduleM1").classList.remove("complete");
      $("m1State").textContent = progress.INTRO ? "下一階段" : "下一階段";
    }
  }

  function scheduleAutosave(immediate = false) {
    if (!activeProfile || !workspace) return;
    clearTimeout(autosaveTimer);

    const doSave = () => {
      const key = getAutosaveKey();
      if (!key) return;
      const payload = {
        formatVersion: 1,
        appVersion: APP_VERSION,
        module: MODULE,
        projectName: PROJECT_NAME,
        savedAt: isoNow(),
        student: activeProfile,
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
    if (!workspace || !activeProfile) return;
    workspace.clear();

    const key = getAutosaveKey();
    const saved = key ? safeParse(localStorage.getItem(key), null) : null;
    if (saved && saved.workspace) {
      try {
        Blockly.serialization.workspaces.load(saved.workspace, workspace);
        $("autosaveStatus").textContent = "自動暫存：已還原";
        return;
      } catch (err) {
        console.warn("Autosave restore failed:", err);
      }
    }
    $("autosaveStatus").textContent = "自動暫存：已啟用";
  }

  function buildProjectPayload() {
    return {
      formatVersion: 1,
      appVersion: APP_VERSION,
      module: MODULE,
      projectName: PROJECT_NAME,
      savedAt: isoNow(),
      student: {
        studentId: activeProfile.studentId,
        studentName: activeProfile.studentName,
        studentKey: activeProfile.studentKey,
        keyCreatedAt: activeProfile.createdAt || null,
        keyOrigin: activeProfile.keyOrigin || "browser"
      },
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
      sanitizeFilenamePart(PROJECT_NAME),
      MODULE,
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

      if (!payload || !payload.workspace) {
        throw new Error("專案檔格式不正確");
      }

      const sourceStudent = payload.student || {};
      const sourceId = normalizeStudentId(sourceStudent.studentId);
      const activeId = normalizeStudentId(activeProfile.studentId);
      const isSameStudentId = Boolean(sourceId && activeId && sourceId === activeId);
      const keyWasRestored =
        isSameStudentId && restoreStudentKeyFromOwnProject(sourceStudent);

      workspace.clear();
      Blockly.serialization.workspaces.load(payload.workspace, workspace);

      openedProjectMeta = {
        originalStudentId: sourceStudent.studentId || null,
        originalStudentName: sourceStudent.studentName || null,
        originalStudentKey: sourceStudent.studentKey || null,
        originalSavedAt: payload.savedAt || null
      };

      const notice = $("projectNotice");
      const sourceName =
        `${sourceStudent.studentId || ""} ${sourceStudent.studentName || ""}`.trim();

      if (isSameStudentId) {
        if (keyWasRestored) {
          notice.textContent =
            `🔑 已開啟你自己的專案，並恢復這份專案裡的 studentKey（末 8 碼：${shortStudentKey(activeProfile.studentKey)}）。這可讓你換電腦後延續同一個身分。`;
        } else {
          notice.textContent =
            `📂 已開啟你先前的專案：${file.name}。目前 studentKey 保持不變（末 8 碼：${shortStudentKey(activeProfile.studentKey)}）。`;
        }
      } else if (sourceId) {
        notice.textContent =
          `📂 已開啟「${sourceName || "其他同學"}」的專案作為起點。只載入作品內容，不會接收對方的 studentKey；之後儲存仍屬於 ${activeProfile.studentId} ${activeProfile.studentName}。`;
      } else {
        notice.textContent =
          `📂 已開啟 ${file.name}。專案沒有可辨識的原始身分；目前身分仍是 ${activeProfile.studentId} ${activeProfile.studentName}。`;
      }
      notice.classList.remove("hidden");

      updatePython();
      updateWorkspaceHint();
      scheduleAutosave(true);
      setRunStatus("neutral", "專案已開啟", "可以直接繼續修改積木，或按執行程式測試。");
    } catch (err) {
      console.error(err);
      alert("無法開啟這個專案檔。請確認它是本系統儲存的 JSON 專案。");
    } finally {
      $("projectFileInput").value = "";
    }
  }

  function resetWorkspace() {
    if (!workspace) return;
    const ok = confirm("要清空目前的積木重新開始嗎？\n\n瀏覽器的自動暫存也會更新成清空後的狀態。");
    if (!ok) return;
    workspace.clear();
    openedProjectMeta = null;
    $("projectNotice").classList.add("hidden");
    clearGuiMessages();
    setRunStatus("neutral", "尚未執行", "把積木接好後，按下執行程式。");
    updatePython();
    updateWorkspaceHint();
    scheduleAutosave(true);
  }

  function applyFontScale(scale) {
    const clamped = Math.max(0.9, Math.min(1.25, scale));
    document.documentElement.style.setProperty("--ui-scale", String(clamped));
    document.documentElement.style.setProperty(
      "--block-font-size",
      `${Math.round(16 * clamped)}px`
    );
    $("fontScaleLabel").textContent = `${Math.round(clamped * 100)}%`;
    localStorage.setItem(FONT_KEY, String(clamped));
    setTimeout(() => {
      if (workspace) Blockly.svgResize(workspace);
    }, 50);
  }

  function currentFontScale() {
    const saved = parseFloat(localStorage.getItem(FONT_KEY));
    return Number.isFinite(saved) ? saved : 1;
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

    $("studentIdInput").addEventListener("keydown", e => {
      if (e.key === "Enter") $("studentNameInput").focus();
    });
    $("studentNameInput").addEventListener("keydown", e => {
      if (e.key === "Enter") createIdentity();
    });

    $("runProgramBtn").addEventListener("click", runProgram);
    $("guiRunBtn").addEventListener("click", runProgram);
    $("clearMessagesBtn").addEventListener("click", clearGuiMessages);
    $("resetWorkspaceBtn").addEventListener("click", resetWorkspace);

    $("saveProjectBtn").addEventListener("click", saveProject);
    $("uploadProjectBtn").addEventListener("click", uploadProject);
    $("cloudSetupBtn").addEventListener("click", configureUploadEndpoint);
    $("openProjectBtn").addEventListener("click", () => $("projectFileInput").click());
    $("projectFileInput").addEventListener("change", e => {
      openProjectFile(e.target.files && e.target.files[0]);
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
    applyFontScale(currentFontScale());
    updateOfflineBadge();
    refreshCloudUi();
    showIdentityScreen();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
