import { wrapErrorHandler } from '../generic';
import { extensionId, isSameWindowMessage } from './utils';
class ContentScript {
  globalListener;
  listeners = [];
  addMessageListener = (type, handler) => {
    if (!this.globalListener) {
      this.globalListener = wrapErrorHandler(function contentScriptMessageListenerGlobal(event) {
        if (!event.detail || typeof event.detail !== 'string') return;
        const detail = JSON.parse(event.detail);
        if (!isSameWindowMessage || detail?.contentScript !== extensionId || !detail?.type) return;
        for (const listener of this.listeners) {
          listener(detail);
        }
      }.bind(this), true);
      document.addEventListener('ytal-message', this.globalListener);
    }
    const listener = wrapErrorHandler(function contentScriptMessageListener(detail) {
      if (detail.type !== type) return;
      handler(detail?.message);
    }.bind(this), true);
    this.listeners.push(listener);
    return listener;
  };
  removeMessageListener = listener => {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
    if (this.globalListener && this.listeners.length === 0) {
      document.removeEventListener('ytal-message', this.globalListener, true);
      this.globalListener = undefined;
    }
  };
  postMessage = (type, message) => {
    const event = new CustomEvent('ytal-message', {
      detail: JSON.stringify({
        type,
        message,
        injectedScript: extensionId
      })
    });
    return document.dispatchEvent(event);
  };
}
export const contentScript = new ContentScript();
