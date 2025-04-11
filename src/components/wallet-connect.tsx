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

  // Function to fetch ETH balance
  const fetchEthBalance = $(async (address: string) => {
    try {
      const ethereum = (window.frame?.ethereum || window.ethereum) as EthereumProvider | undefined;
      if (!ethereum) return;

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
      const ethereum = (window.frame?.ethereum || window.ethereum) as EthereumProvider | undefined;
      if (!ethereum) return;

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
        // Try to get the Frame SDK wallet provider first
        if (sdk && sdk.wallet && sdk.wallet.ethProvider) {
          console.log("Using Farcaster Frame SDK provider (sdk.wallet.ethProvider)");
          const provider = sdk.wallet.ethProvider;
          
          // Create wallet client
          const walletClient = createWalletClient({
            chain: base,
            transport: custom(provider)
          });

          // Request accounts
          const addresses = await walletClient.requestAddresses();
          
          if (addresses && addresses.length > 0) {
            const connectedAddr = addresses[0];
            address.value = connectedAddr;
            isConnected.value = true;
            
            // Fetch balances
            fetchEthBalance(connectedAddr);
            fetchUsdcBalance(connectedAddr);
            
            // Get chain ID
            const chainIdHex = await provider.request({ method: 'eth_chainId' });
            if (chainIdHex) {
              chainId.value = parseInt(chainIdHex, 16);
            }
            
            console.log('Automatically connected to Frame wallet:', connectedAddr);
          }
        } 
        // If not in Frame, try standard browser provider
        else if (typeof window !== 'undefined' && window.ethereum) {
          console.log("Using standard browser provider (window.ethereum)");
          const provider = window.ethereum;
          
          // Create wallet client
          const walletClient = createWalletClient({
            chain: base,
            transport: custom(provider)
          });

          // Request accounts
          const addresses = await walletClient.requestAddresses();
          
          if (addresses && addresses.length > 0) {
            const connectedAddr = addresses[0];
            address.value = connectedAddr;
            isConnected.value = true;
            
            // Fetch balances
            fetchEthBalance(connectedAddr);
            fetchUsdcBalance(connectedAddr);
            
            // Get chain ID
            const chainIdHex = await provider.request({ method: 'eth_chainId' });
            if (chainIdHex) {
              chainId.value = parseInt(chainIdHex, 16);
            }
            
            console.log('Automatically connected to browser wallet:', connectedAddr);
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
      const ethereum = (window.frame?.ethereum || window.ethereum) as EthereumProvider | undefined;
      
      if (ethereum) {
        ethereum.on('accountsChanged', (accounts: string[]) => {
          if (accounts.length > 0) {
            address.value = accounts[0];
            isConnected.value = true;
            fetchEthBalance(accounts[0]);
            fetchUsdcBalance(accounts[0]);
          } else {
            address.value = '';
            isConnected.value = false;
            ethBalance.value = '';
            usdcBalance.value = '';
          }
        });

        ethereum.on('chainChanged', (chainIdHex: string) => {
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
      const ethereum = (window.frame?.ethereum || window.ethereum) as EthereumProvider | undefined;
      if (ethereum) {
        ethereum.removeAllListeners?.();
      }
    });
  });
  
  // Connect wallet function
  const connectWallet = $(async () => {
    let provider: any | undefined = undefined;
    let environment: string = "";

    // 1. First try to get the Frame SDK wallet provider
    if (sdk && sdk.wallet && sdk.wallet.ethProvider) {
      console.log("Using Farcaster Frame SDK provider (sdk.wallet.ethProvider)");
      provider = sdk.wallet.ethProvider;
      environment = "Frame";
    } 
    // 2. If not in Frame, try standard browser provider
    else if (typeof window !== 'undefined' && window.ethereum) {
      console.log("Using standard browser provider (window.ethereum)");
      provider = window.ethereum;
      environment = "Desktop";
    }

    // 3. If a provider was found, try to connect
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
    // 4. If no provider found
    else {
      console.error('No wallet provider found (Frame SDK or window.ethereum).');
      error.value = 'Cannot connect wallet. No provider found. If on desktop, install MetaMask. If in a Farcaster app, ensure it supports wallet connections.';
    }
  });
  
  // Send a simple transaction - this is just a demo
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
      const txParams = {
        to: '0x0000000000000000000000000000000000000000', // Example: send to address zero
        value: '0x0', // Example: 0 ETH
        data: '0x', // Example: no data
      };
      
      // Request transaction signature
      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });
      
      console.log('Transaction sent:', txHash);
    } catch (err: any) {
      console.error('Error sending transaction:', err);
      error.value = err.message || 'Failed to send transaction';
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