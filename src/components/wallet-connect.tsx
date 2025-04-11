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

// Type for Frame SDK
interface FrameSDK {
  wallet?: {
    ethProvider?: EthereumProvider;
  };
}

// Type for Frame window object
interface FrameWindow {
  frame?: {
    sdk?: FrameSDK;
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

  // USDC contract address on Base
  const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

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
      const provider = sdk?.wallet?.ethProvider || window.ethereum;
      if (!provider) return;

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
      const provider = sdk?.wallet?.ethProvider || window.ethereum;
      if (!provider) return;

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
        // Check localStorage first
        const wasConnected = typeof window !== 'undefined' && localStorage.getItem('walletConnected') === 'true';
        const savedAddress = typeof window !== 'undefined' ? localStorage.getItem('walletAddress') : null;

        // Check if we're in a Frame context
        const isInFrame = sdk?.wallet?.ethProvider;
        
        if (isInFrame) {
          console.log("Using Farcaster Frame SDK provider");
          const provider = sdk.wallet.ethProvider;
          
          if (provider) {
            // Check for existing accounts first
            const accounts = await provider.request({ method: 'eth_accounts' });
            
            if (accounts && accounts.length > 0) {
              const connectedAddr = accounts[0];
              address.value = connectedAddr;
              isConnected.value = true;
              saveConnectionState();
              
              // Fetch balances
              fetchEthBalance(connectedAddr);
              fetchUsdcBalance(connectedAddr);
              
              // Get chain ID
              const chainIdHex = await provider.request({ method: 'eth_chainId' });
              if (chainIdHex) {
                chainId.value = parseInt(chainIdHex, 16);
              }
              
              console.log('Automatically connected to Frame wallet:', connectedAddr);
            } else if (wasConnected && savedAddress) {
              // If we have a saved connection but no active accounts, try to reconnect
              try {
                await provider.request({ method: 'eth_requestAccounts' });
                address.value = savedAddress;
                isConnected.value = true;
                saveConnectionState();
                fetchEthBalance(savedAddress);
                fetchUsdcBalance(savedAddress);
              } catch (err) {
                console.error('Error reconnecting:', err);
                clearConnectionState();
              }
            }
          }
        } 
        // If not in Frame or Frame SDK not available, try standard browser provider
        else if (typeof window !== 'undefined' && window.ethereum) {
          console.log("Using standard browser provider");
          const provider = window.ethereum;
          
          // Check for existing accounts first
          const accounts = await provider.request({ method: 'eth_accounts' });
          
          if (accounts && accounts.length > 0) {
            const connectedAddr = accounts[0];
            address.value = connectedAddr;
            isConnected.value = true;
            saveConnectionState();
            
            // Fetch balances
            fetchEthBalance(connectedAddr);
            fetchUsdcBalance(connectedAddr);
            
            // Get chain ID
            const chainIdHex = await provider.request({ method: 'eth_chainId' });
            if (chainIdHex) {
              chainId.value = parseInt(chainIdHex, 16);
            }
            
            console.log('Automatically connected to browser wallet:', connectedAddr);
          } else if (wasConnected && savedAddress) {
            // If we have a saved connection but no active accounts, try to reconnect
            try {
              await provider.request({ method: 'eth_requestAccounts' });
              address.value = savedAddress;
              isConnected.value = true;
              saveConnectionState();
              fetchEthBalance(savedAddress);
              fetchUsdcBalance(savedAddress);
            } catch (err) {
              console.error('Error reconnecting:', err);
              clearConnectionState();
            }
          }
        }
      } catch (err) {
        console.error('Error checking existing connection:', err);
      }
    };

    // Check for existing connection immediately
    checkExistingConnection();

    // Set up event listeners for account changes
    const setupEventListeners = () => {
      const provider = sdk?.wallet?.ethProvider || window.ethereum;
      
      if (provider) {
        provider.on('accountsChanged', (accounts: readonly `0x${string}`[]) => {
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
    cleanup(() => {
      const provider = sdk?.wallet?.ethProvider || window.ethereum;
      if (provider) {
        provider.removeListener?.('accountsChanged', () => {});
        provider.removeListener?.('chainChanged', () => {});
      }
    });
  });
  
  // Connect wallet function
  const connectWallet = $(async () => {
    let provider: any | undefined = undefined;
    let environment: string = "";

    // Check if we're in a Frame context
    const isInFrame = typeof window !== 'undefined' && (window as unknown as FrameWindow).frame?.sdk;

    if (isInFrame) {
      // Try to get the Frame SDK wallet provider
      const frameSDK = (window as unknown as FrameWindow).frame?.sdk;
      if (frameSDK?.wallet?.ethProvider) {
        console.log("Using Farcaster Frame SDK provider");
        provider = frameSDK.wallet.ethProvider;
        environment = "Frame";
      }
    }
    
    // If not in Frame or Frame SDK not available, try standard browser provider
    if (!provider && typeof window !== 'undefined' && window.ethereum) {
      console.log("Using standard browser provider");
      provider = window.ethereum;
      environment = "Desktop";
    }

    // If a provider was found, try to connect
    if (provider) {
      try {
        // Create wallet client with the appropriate chain
        const walletClient = createWalletClient({
          chain: base, // Use Base chain
          transport: custom(provider)
        });

        // Request accounts
        const addresses = await walletClient.requestAddresses();
        
        if (addresses && addresses.length > 0) {
          const connectedAddr = addresses[0];
          address.value = connectedAddr;
          isConnected.value = true;
          
          // Fetch balances immediately after connecting
          fetchEthBalance(connectedAddr);
          fetchUsdcBalance(connectedAddr);
          
          // Get chain ID
          const chainIdHex = await provider.request({ method: 'eth_chainId' });
          if (chainIdHex) {
            chainId.value = parseInt(chainIdHex, 16);
          }
          
          console.log(`Wallet connected via ${environment}:`, connectedAddr);
        } else {
          console.error(`No addresses returned from ${environment} wallet.`);
          error.value = `Could not get address via ${environment}. Ensure wallet is connected properly.`;
        }
      } catch (error: any) {
        console.error(`Error connecting wallet via ${environment}:`, error);
        error.value = `Error connecting via ${environment}: ${error.message || error}`;
        address.value = '';
        isConnected.value = false;
      }
    } 
    // If no provider found
    else {
      console.error('No wallet provider found.');
      error.value = 'Cannot connect wallet. No provider found. If on desktop, install MetaMask. If in a Farcaster app, ensure it supports wallet connections.';
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

  return (
    <div class="wallet-section">
      <h3>Wallet Connection</h3>
      
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
              onClick$={sendTransaction}
            >
              Send Test Transaction
            </button>
          </div>
        </div>
      )}
    </div>
  );
}); 