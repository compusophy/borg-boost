import { component$, useSignal, useVisibleTask$, $ } from '@builder.io/qwik';
import { createWalletClient, custom, createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { sdk } from '@farcaster/frame-sdk';

// Simple truncate address utility
const truncateAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Type for Ethereum provider
interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, callback: (...args: any[]) => void) => void;
  removeAllListeners?: () => void;
}

// Type for Frame window object
interface FrameWindow {
  frame?: {
    sdk?: typeof sdk;
  };
}

export const WalletConnect = component$(() => {
  const address = useSignal('');
  const chainId = useSignal(0);
  const isConnected = useSignal(false);
  const isConnecting = useSignal(false);
  const error = useSignal('');
  const ethBalance = useSignal('');
  const usdcBalance = useSignal('');
  const isSending = useSignal(false);
  const showWallet = useSignal(true);

  // USDC contract address on Base
  const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

  // Get the frame SDK instance
  const getFrameSDK = $(() => {
    if (typeof window !== 'undefined') {
      const frameSDK = (window as unknown as FrameWindow).frame?.sdk;
      console.log('Frame SDK found:', !!frameSDK);
      return frameSDK;
    }
    return undefined;
  });

  // Get the provider
  const getProvider = $(async () => {
    try {
      // First check if we're in a frame context
      const frameSDK = await getFrameSDK();
      if (frameSDK?.wallet?.ethProvider) {
        console.log("Using Farcaster Frame SDK provider");
        return frameSDK.wallet.ethProvider;
      }
      
      // Fall back to standard browser provider
      if (typeof window !== 'undefined' && window.ethereum) {
        console.log("Using standard browser provider");
        return window.ethereum;
      }

      // Check for injected providers
      if (typeof window !== 'undefined') {
        const injectedProviders = (window as any).ethereum?.providers || [];
        if (injectedProviders.length > 0) {
          console.log("Using injected provider");
          return injectedProviders[0];
        }
      }
      
      console.log("No provider found");
      return undefined;
    } catch (err) {
      console.error("Error getting provider:", err);
      return undefined;
    }
  });

  // Function to save connection state
  const saveConnectionState = $(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('walletConnected', 'true');
      localStorage.setItem('walletAddress', address.value);
    }
  });

  // Function to clear connection state
  const clearConnectionState = $(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('walletConnected');
      localStorage.removeItem('walletAddress');
    }
  });

  // Function to fetch ETH balance
  const fetchEthBalance = $(async (address: string) => {
    try {
      const provider = await getProvider();
      if (!provider) {
        console.error('No provider available for balance check');
        return;
      }

      const publicClient = createPublicClient({
        chain: base,
        transport: http()
      });

      const balance = await publicClient.getBalance({
        address: address as `0x${string}`,
      });

      // Convert from wei to ETH and format
      ethBalance.value = (Number(balance) / 1e18).toFixed(4);
    } catch (err) {
      console.error('Error fetching ETH balance:', err);
    }
  });

  // Function to fetch USDC balance
  const fetchUsdcBalance = $(async (address: string) => {
    try {
      const provider = await getProvider();
      if (!provider) {
        console.error('No provider available for USDC balance check');
        return;
      }

      const publicClient = createPublicClient({
        chain: base,
        transport: http()
      });

      // USDC has 6 decimals
      const balance = await publicClient.readContract({
        address: USDC_CONTRACT as `0x${string}`,
        abi: [
          {
            inputs: [{ name: 'account', type: 'address' }],
            name: 'balanceOf',
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      });

      // Convert from 6 decimals to USDC and format
      usdcBalance.value = (Number(balance) / 1e6).toFixed(2);
    } catch (err) {
      console.error('Error fetching USDC balance:', err);
    }
  });

  // Check for existing wallet connection on mount
  useVisibleTask$(({ cleanup }) => {
    const checkExistingConnection = async () => {
      try {
        console.log('Checking for existing connection...');
        
        // Check localStorage first
        const wasConnected = typeof window !== 'undefined' && localStorage.getItem('walletConnected') === 'true';
        const savedAddress = typeof window !== 'undefined' ? localStorage.getItem('walletAddress') : null;
        
        console.log('Previous connection state:', { wasConnected, savedAddress });

        // Get the provider
        const provider = await getProvider();
        if (!provider) {
          console.log("No provider found");
          error.value = 'No wallet provider found. Please install MetaMask or use a Farcaster app.';
          return;
        }

        // Check for existing accounts first
        const accounts = await provider.request({ method: 'eth_accounts' });
        console.log('Found accounts:', accounts);
        
        if (accounts && accounts.length > 0) {
          const connectedAddr = accounts[0];
          console.log('Found connected account:', connectedAddr);
          
          address.value = connectedAddr;
          isConnected.value = true;
          saveConnectionState();
          
          // Fetch balances
          await fetchEthBalance(connectedAddr);
          await fetchUsdcBalance(connectedAddr);
          
          // Get chain ID
          const chainIdHex = await provider.request({ method: 'eth_chainId' });
          if (chainIdHex) {
            chainId.value = parseInt(chainIdHex, 16);
            console.log('Connected to chain:', chainId.value);
          }
        } else if (wasConnected && savedAddress) {
          console.log('Attempting to reconnect to saved address:', savedAddress);
          // If we have a saved connection but no active accounts, try to reconnect
          try {
            await provider.request({ method: 'eth_requestAccounts' });
            address.value = savedAddress;
            isConnected.value = true;
            saveConnectionState();
            await fetchEthBalance(savedAddress);
            await fetchUsdcBalance(savedAddress);
          } catch (err) {
            console.error('Error reconnecting:', err);
            error.value = 'Failed to reconnect to wallet. Please try connecting again.';
            clearConnectionState();
          }
        }
      } catch (err) {
        console.error('Error checking existing connection:', err);
        error.value = 'Error checking wallet connection. Please try again.';
      }
    };

    // Check for existing connection immediately
    checkExistingConnection();

    // Set up event listeners for account changes
    const setupEventListeners = async () => {
      const provider = await getProvider();
      
      if (provider) {
        console.log('Setting up wallet event listeners');
        
        provider.on('accountsChanged', (accounts: readonly `0x${string}`[]) => {
          console.log('Accounts changed:', accounts);
          if (accounts.length > 0) {
            address.value = accounts[0];
            isConnected.value = true;
            saveConnectionState();
            fetchEthBalance(accounts[0]);
            fetchUsdcBalance(accounts[0]);
          } else {
            address.value = '';
            isConnected.value = false;
            clearConnectionState();
            ethBalance.value = '';
            usdcBalance.value = '';
          }
        });

        provider.on('chainChanged', (chainIdHex: string) => {
          console.log('Chain changed:', chainIdHex);
          chainId.value = parseInt(chainIdHex, 16);
          if (address.value) {
            fetchEthBalance(address.value);
            fetchUsdcBalance(address.value);
          }
        });
      }
    };

    // Set up event listeners after a short delay
    setTimeout(setupEventListeners, 1000);

    // Cleanup function
    cleanup(async () => {
      const provider = await getProvider();
      if (provider) {
        console.log('Cleaning up wallet event listeners');
        // Remove specific event listeners instead of all listeners
        provider.on('accountsChanged', () => {});
        provider.on('chainChanged', () => {});
      }
    });
  });
  
  // Connect wallet function
  const connectWallet = $(async () => {
    try {
      isConnecting.value = true;
      error.value = '';
      
      console.log('Starting wallet connection...');
      
      const provider = await getProvider();
      if (!provider) {
        error.value = 'No wallet provider found. Please install MetaMask or use a Farcaster app.';
        isConnecting.value = false;
        return;
      }

      console.log('Requesting accounts...');
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      
      if (accounts && accounts.length > 0) {
        const connectedAddr = accounts[0];
        console.log('Connected to account:', connectedAddr);
        
        address.value = connectedAddr;
        isConnected.value = true;
        saveConnectionState();
        
        // Fetch balances
        await fetchEthBalance(connectedAddr);
        await fetchUsdcBalance(connectedAddr);
        
        // Get chain ID
        const chainIdHex = await provider.request({ method: 'eth_chainId' });
        if (chainIdHex) {
          chainId.value = parseInt(chainIdHex, 16);
          console.log('Connected to chain:', chainId.value);
        }
      } else {
        error.value = 'No accounts found. Please try again.';
      }
    } catch (err: any) {
      console.error('Error connecting wallet:', err);
      error.value = err.message || 'Failed to connect wallet. Please try again.';
    } finally {
      isConnecting.value = false;
    }
  });
  
  // Send USDC transaction
  const sendTransaction = $(async () => {
    if (!isConnected.value) {
      error.value = 'Please connect your wallet first';
      return;
    }
    
    const ethereum = (window.frame?.ethereum || window.ethereum) as EthereumProvider | undefined;
    
    if (!ethereum) {
      error.value = 'No Ethereum provider found';
      return;
    }
    
    try {
      // Create wallet client
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(ethereum)
      });

      // Amount in USDC (0.01 USDC = 10000 because USDC has 6 decimals)
      const amount = BigInt(10000); // 0.01 USDC

      // Check if we already have accounts
      const accounts = await ethereum.request({ method: 'eth_accounts' });
      if (!accounts || accounts.length === 0) {
        // Only request new connection if we don't have any accounts
        try {
          await ethereum.request({
            method: 'eth_requestAccounts'
          });
        } catch (err) {
          console.error('Error requesting accounts:', err);
          error.value = 'Please approve the wallet connection request';
          return;
        }
      }

      // Send USDC transfer transaction
      const hash = await walletClient.writeContract({
        address: USDC_CONTRACT as `0x${string}`,
        abi: [
          {
            inputs: [
              { name: 'to', type: 'address' },
              { name: 'amount', type: 'uint256' }
            ],
            name: 'transfer',
            outputs: [{ name: '', type: 'bool' }],
            stateMutability: 'nonpayable',
            type: 'function',
          },
        ],
        functionName: 'transfer',
        args: [address.value as `0x${string}`, amount],
        account: address.value as `0x${string}`,
      });
      
      console.log('Transaction sent:', hash);
      
      // Update balances after successful transaction
      fetchUsdcBalance(address.value);
      
    } catch (err: any) {
      console.error('Error sending transaction:', err);
      if (err.message?.includes('authorized')) {
        error.value = 'Please approve the transaction in your wallet';
      } else {
        error.value = err.message || 'Failed to send transaction';
      }
    }
  });
  
  // Get the chain name
  const getChainName = $(() => {
    const chains: Record<number, string> = {
      1: 'Ethereum Mainnet',
      10: 'Optimism',
      8453: 'Base',
      137: 'Polygon',
      42161: 'Arbitrum',
    };
    
    return chains[chainId.value] || `Chain ID ${chainId.value}`;
  });

  // Function to send ETH to self
  const sendEthToSelf = $(async () => {
    try {
      isSending.value = true;
      const frameSDK = await getFrameSDK();
      const provider = frameSDK?.wallet?.ethProvider || window.ethereum;
      
      if (!provider) {
        throw new Error('No provider found');
      }

      // Send 0.001 ETH (0.001 * 10^18 wei)
      const amount = `0x${BigInt(1000000000000000).toString(16)}`; // 0.001 ETH in wei

      // Send the transaction
      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address.value as `0x${string}`,
          to: address.value as `0x${string}`,
          value: amount as `0x${string}`
        }]
      });

      console.log('Transaction sent:', hash);
      
      // Wait a bit and refresh balance
      setTimeout(() => {
        fetchEthBalance(address.value);
      }, 5000);
    } catch (err) {
      console.error('Error sending ETH:', err);
      error.value = err instanceof Error ? err.message : 'Failed to send ETH';
    } finally {
      isSending.value = false;
    }
  });

  return (
    <div class="wallet-section">
      <div 
        class="wallet-header"
        onClick$={() => {
          showWallet.value = !showWallet.value;
          localStorage.setItem('show-wallet', showWallet.value.toString());
        }}
      >
        <span class={`chevron ${showWallet.value ? 'rotated' : ''}`}>▶</span>
        <h3>Wallet</h3>
      </div>

      <div class={`wallet-content ${showWallet.value ? 'visible' : ''}`}>
        {!isConnected.value ? (
          <div>
            <button 
              class="wallet-button"
              onClick$={connectWallet}
              disabled={isConnecting.value}
            >
              {isConnecting.value ? 'Connecting...' : 'Connect Wallet'}
            </button>
            
            {error.value && (
              <div class="error-message">{error.value}</div>
            )}
          </div>
        ) : (
          <div class="wallet-info">
            <div class="address-display">
              <strong>Address:</strong> {truncateAddress(address.value)}
            </div>
            <div class="network-display">
              <strong>Network:</strong> {getChainName()}
            </div>
            <div class="balance-display">
              <strong>ETH Balance:</strong> {ethBalance.value || '0.0000'} ETH
            </div>
            <div class="balance-display">
              <strong>USDC Balance:</strong> {usdcBalance.value || '0.00'} USDC
            </div>
            <div class="wallet-actions">
              <button 
                class="transaction-button"
                onClick$={sendEthToSelf}
                disabled={isSending.value}
              >
                {isSending.value ? 'Sending...' : 'Send 0.001 ETH to Self'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}); 