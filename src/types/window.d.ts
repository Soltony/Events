
export {};

declare global {
  interface Window {
    myJsChannel?: {
      postMessage: (message: { type: 'PAYMENT'; token: string } | { token: string }) => void;
      postMessage: (message: { type: 'PAYMENT'; token: string }) => void;
    };
  }
}
