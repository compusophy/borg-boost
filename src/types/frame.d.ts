// Type declarations for the Farcaster Frame SDK
interface EthereumProvider {
  request(args: { method: string; params?: any[] }): Promise<any>;
  on(eventName: string, handler: (...args: any[]) => void): void;
  removeAllListeners?(): void;
}

interface FrameSDK {
  ready(): void;
  ethereum: EthereumProvider;
}

declare global {
  interface Window {
    frame: FrameSDK;
  }
}

export {}; 