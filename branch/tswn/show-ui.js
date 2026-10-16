/** 原生主题、焦点判定、剪贴板及角色悬浮高亮，不参与战斗数据。 */

export function createThemeControls({ themeBtn, themeLightIcon, themeDarkIcon }) {
  const themeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const THEME_STORAGE_KEY = "tswn-show-theme";
  function currentTheme() {
    return document.documentElement.dataset.theme ?? (themeMediaQuery.matches ? "dark" : "light");
  }

  function syncThemeUi() {
    const isDark = currentTheme() === "dark";
    themeLightIcon.toggleAttribute("hidden", !isDark);
    themeDarkIcon.toggleAttribute("hidden", isDark);
    const label = isDark ? "切换到浅色模式" : "切换到深色模式";
    themeBtn.title = `${label} (D)`;
    themeBtn.setAttribute("aria-label", label);
    themeBtn.setAttribute("aria-pressed", String(isDark));
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themeSource = "user";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // 存储不可用时仍保留本次页面会话的主题。
    }
    syncThemeUi();
  }

  syncThemeUi();
  themeMediaQuery.addEventListener("change", () => {
    if (document.documentElement.dataset.themeSource === "system") {
      document.documentElement.dataset.theme = themeMediaQuery.matches ? "dark" : "light";
      syncThemeUi();
    }
  });
  return { currentTheme, setTheme };
}

export function setupPlayerHighlight() {
  let highlightTimer = null;

  function clearHighlightTimer() {
    if (highlightTimer) {
      clearTimeout(highlightTimer);
      highlightTimer = null;
    }
  }

  /**
   * 高亮指定 playerId 对应的所有元素，其余淡化。
   * @param {string|number|null} playerId
   */
  function setPlayerHighlight(playerId) {
    // 清除旧的高亮标记
    document
      .querySelectorAll("[data-player-id].hl-active")
      .forEach((el) => el.classList.remove("hl-active"));

    if (playerId) {
      document.body.classList.add("highlight-active");
      document
        .querySelectorAll('[data-player-id="' + playerId + '"]')
        .forEach((el) => el.classList.add("hl-active"));
    } else {
      document.body.classList.remove("highlight-active");
    }
  }

  function clearPlayerHighlight() {
    clearHighlightTimer();
    setPlayerHighlight(null);
  }

  function clearPlayerHighlightSoon() {
    clearHighlightTimer();
    highlightTimer = setTimeout(() => {
      setPlayerHighlight(null);
      highlightTimer = null;
    }, 80);
  }

  document.addEventListener("mouseover", (event) => {
    const el = event.target instanceof Element ? event.target.closest("[data-player-id]") : null;
    if (el) {
      clearHighlightTimer();
      setPlayerHighlight(el.dataset.playerId);
    } else if (!document.querySelector("[data-player-id]:hover")) {
      clearPlayerHighlightSoon();
    }
  });

  document.addEventListener("mouseout", (event) => {
    if (event.relatedTarget instanceof Node && document.documentElement.contains(event.relatedTarget)) {
      if (!document.querySelector("[data-player-id]:hover")) {
        clearPlayerHighlightSoon();
      }
      return;
    }
    clearPlayerHighlight();
  });

  window.addEventListener("blur", clearPlayerHighlight);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      clearPlayerHighlight();
    }
  });

  return { clearPlayerHighlight };
}

export function isEditableKeyTarget(target) {
  if (!(target instanceof Element)) {
    return false;
  }
  if (target.closest("textarea, select, input")) {
    return true;
  }
  const editableTarget =
    target instanceof HTMLElement ? target : target.closest("[contenteditable]");
  return editableTarget instanceof HTMLElement && editableTarget.isContentEditable;
}

export async function copyTextToClipboard(text) {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.append(textarea);
  textarea.select();
  try {
    if (!document.execCommand("copy")) {
      throw new Error("浏览器拒绝复制操作。");
    }
  } finally {
    textarea.remove();
  }
}
