/** 原生主题声明与 Dark Reader 冲突提醒；只观察本页标记，不读取插件全局设置。 */

export function watchDarkReader(document, Observer = document.defaultView.MutationObserver) {
  const root = document.documentElement;
  const notice = document.querySelector("#themeNotice");
  const scheme = document.querySelector('meta[name="color-scheme"]');
  const message = "检测到 Dark Reader 正在转换本页。这里已有原生明暗主题，二次转换可能造成重影或颜色异常；请在插件中关闭本站转换，再用右下角主题按钮（D）切换。";

  const refresh = () => {
    const theme = root.dataset.theme === "dark" ? "dark" : "light";
    if (scheme && scheme.content !== theme) scheme.content = theme;
    // 当前 Dynamic 模式写入这两个属性；没有注入标记时不能推断插件是否全局开启。
    const active = root.getAttribute("data-darkreader-scheme") === "dark"
      && Boolean(root.getAttribute("data-darkreader-mode"));
    if (notice) {
      const text = active ? message : "";
      if (notice.textContent !== text) notice.textContent = text;
      notice.hidden = !active;
    }
  };

  refresh();
  const observer = new Observer(refresh);
  observer.observe(root, {
    attributes: true,
    attributeFilter: ["data-theme", "data-darkreader-mode", "data-darkreader-scheme"],
  });
  return () => observer.disconnect();
}

if (typeof document !== "undefined") watchDarkReader(document);
