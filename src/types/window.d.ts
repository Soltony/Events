
export {};

declare global {
  interface Window {
    myJsChannel?: {
      postMessage: (message: { token: string }) => void;
    };
  }
}
