/**
 * @file permissions.ts
 * @description 麦克风权限授权页面脚本
 *
 * 为什么需要独立的授权页面？
 * Chrome 扩展的侧边栏窗口由于安全限制，无法直接请求麦克风权限（会被自动拒绝）。
 * 解决方案是通过 web_accessible_resources 暴露一个独立的 HTML 页面，
 * 在新标签页中打开，让用户在这里完成权限授权。
 *
 * 授权流程：
 * 1. 侧边栏检测到权限被拒绝 → 调用 chrome.tabs.create() 打开本页面
 * 2. 用户点击「授权麦克风」按钮 → 调用 getUserMedia 触发权限对话框
 * 3. 用户允许后，关闭此页面，返回侧边栏即可正常使用录音功能
 *
 * @author Lingride Team
 * @since 1.0.0
 */

// ====== DOM 元素引用 ======

const authorizeBtn = document.getElementById("authorizeBtn") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLElement;

// ====== 事件处理 ======

/**
 * 处理授权按钮点击
 *
 * 通过 getUserMedia 请求麦克风权限，成功后立即释放资源。
 * 权限状态会被浏览器记住，后续在侧边栏中使用时无需再次授权。
 */
authorizeBtn.addEventListener("click", async () => {
  authorizeBtn.disabled = true;
  authorizeBtn.textContent = "请求中...";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // 成功获取权限后停止流
    stream.getTracks().forEach((track) => track.stop());

    statusEl.className = "status success";
    statusEl.textContent =
      "麦克风授权成功！现在可以关闭此页面，返回扩展使用录音功能。";
    authorizeBtn.textContent = "已授权";
  } catch (err) {
    statusEl.className = "status error";
    if (err instanceof DOMException) {
      if (err.name === "NotAllowedError") {
        statusEl.textContent =
          "您拒绝了麦克风权限。请点击地址栏左侧的图标，将麦克风设置为「允许」后刷新页面重试。";
      } else if (err.name === "NotFoundError") {
        statusEl.textContent = "未检测到麦克风设备，请检查麦克风是否正确连接。";
      } else {
        statusEl.textContent = "授权失败：" + err.message;
      }
    } else {
      statusEl.textContent =
        "授权失败：" + (err instanceof Error ? err.message : String(err));
    }
    authorizeBtn.disabled = false;
    authorizeBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
      </svg>
      重试授权
    `;
  }
});
