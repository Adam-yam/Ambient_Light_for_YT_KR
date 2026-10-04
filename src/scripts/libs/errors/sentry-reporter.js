export const crashOptions = Object.freeze({
  video: false,
  technical: false,
  crash: false
});
export const setCrashOptions = () => {};
export const setVersion = () => {};
export const parseSettingsToSentry = () => {};
export default class SentryReporter {
  static captureException() {}
}
