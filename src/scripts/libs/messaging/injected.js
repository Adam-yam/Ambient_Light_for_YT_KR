import { wrapErrorHandler } from '../generic';
import { extensionId, isSameWindowMessage } from './utils';
class InjectedScript {
  globalListener;
  listeners = [];
  addMessageListener = (type, handler) => {
    if (!this.globalListener) {
      this.globalListener = wrapErrorHandler(function injectedScriptMessageListenerGlobal(event) {
        if (!event.detail || typeof event.detail !== 'string') return;
        const detail = JSON.parse(event.detail);
        if (!isSameWindowMessage || detail?.injectedScript !== extensionId || !detail?.type) return;
        for (const listener of this.listeners) {
          listener(detail);
        }
      }.bind(this), true);
      document.addEventListener('ytal-message', this.globalListener);
    }
    const listener = wrapErrorHandler(function injectedScriptMessageListener(detail) {
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
      document.removeEventListener('ytal-message', this.globalListener);
      this.globalListener = undefined;
    }
  };
  postMessage(type, message) {
    const event = new CustomEvent('ytal-message', {
      detail: JSON.stringify({
        type,
        message,
        contentScript: extensionId
      })
    });
    return document.dispatchEvent(event);
  }
  receiveMessage = (type, timeout = 3000) => new Promise(function receiveMessagePromise(resolve, reject) {
    try {
      const receivedMessage = function reveicedMessage(message) {
        clearTimeout(timeoutId);
        injectedScript.removeMessageListener(changedListener);
        resolve(message);
      }.bind(this);
      const receiveMessageTimeout = function receiveMessageTimeout() {
        console.warn(`Never received a response message for "${type}" after ${timeout}ms`);
        receivedMessage();
      }.bind(this);
      const timeoutId = setTimeout(receiveMessageTimeout, timeout);
      const changedListener = injectedScript.addMessageListener(type, receivedMessage);
    } catch (ex) {
      reject(ex);
    }
  });
  postAndReceiveMessage = async (type, message, timeout) => {
    const receiveMessagePromise = this.receiveMessage(type, timeout);
    this.postMessage(type, message);
    return await receiveMessagePromise;
  };
}
export const injectedScript = new InjectedScript();
