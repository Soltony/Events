
export {};

declare global {
  interface Window {
    myJsChannel?: {
      postMessage: (message: { type: string; token: string }) => void;
    };
  }
}
