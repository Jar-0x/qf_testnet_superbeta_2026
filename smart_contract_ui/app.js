// Configuration
const DIAMOND_ADDRESS = "0x9d5C25B34769b77901D63258ba5651dfA4e2cA30";
const FUJI_RPC_URL = "https://api.avax-test.network/ext/bc/C/rpc";

// Globals
let provider;
let signer;
let walletAddress;
let isDummyWallet = false;

let contractA0;
let contractP0;
let contractP5;

// DOM Elements
const consoleOutput = document.getElementById('consoleOutput');
const walletInfoLabel = document.getElementById('walletLabel');
const walletInfoAddress = document.getElementById('walletAddress');
const btnConnect = document.getElementById('connectWalletBtn');
const btnClearConsole = document.getElementById('btnClearConsole');

// -----------------------------------------
// Console UI Logic
// -----------------------------------------
function logToConsole(message, type = 'system') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;

    // Format objects nicely
    if (typeof message === 'object') {
        // Handle BigInts in ethers.js v6 responses
        const stringified = JSON.stringify(message, (key, value) => {
            return typeof value === 'bigint' ? value.toString() : value;
        }, 2);
        entry.textContent = `[${type.toUpperCase()}] ${stringified}`;
        entry.style.whiteSpace = "pre-wrap";
    } else {
        entry.textContent = `[${type.toUpperCase()}] ${message}`;
    }

    consoleOutput.insertBefore(entry, consoleOutput.firstChild);
}

btnClearConsole.addEventListener('click', () => {
    consoleOutput.innerHTML = '';
    logToConsole('Terminal cleared.', 'system');
});

// -----------------------------------------
// Wallet & Provider Setup
// -----------------------------------------
async function initEthers() {
    logToConsole('Initializing Ethers.js...', 'system');

    // Create Read-Only Provider for Fuji
    provider = new ethers.JsonRpcProvider(FUJI_RPC_URL);
    logToConsole('Connected to AVAX Fuji Testnet RPC.', 'success');

    // Attempt to load existing dummy wallet or check MM
    await setupWallet();

    // Initialize Contracts
    initContracts();
}

async function setupWallet() {
    // Check if user has explicitely connected via Metamask before
    // For now, we default to dummy wallet unless they click Provider Connect.

    const storedKey = localStorage.getItem('dummy_wallet_key');

    if (storedKey) {
        logToConsole('Found existing dummy wallet.', 'info');
        signer = new ethers.Wallet(storedKey, provider);
        walletAddress = signer.address;
        isDummyWallet = true;
    } else {
        logToConsole('No wallet found. Generating new dummy wallet...', 'info');
        const randomWallet = ethers.Wallet.createRandom();
        localStorage.setItem('dummy_wallet_key', randomWallet.privateKey);
        signer = randomWallet.connect(provider);
        walletAddress = signer.address;
        isDummyWallet = true;
        logToConsole(`Generated new wallet: ${walletAddress}`, 'success');
    }

    updateWalletUI();
}

async function connectBrowserProvider() {
    if (window.ethereum) {
        try {
            logToConsole('Connecting to browser provider (MetaMask)...', 'pending');
            const browserProvider = new ethers.BrowserProvider(window.ethereum);
            await browserProvider.send("eth_requestAccounts", []);

            // Re-assign signer to use Metamask
            signer = await browserProvider.getSigner();
            walletAddress = await signer.getAddress();
            isDummyWallet = false;

            logToConsole(`Successfully connected browser wallet: ${walletAddress}`, 'success');

            // Optional: You could check/switch to Fuji Network here, but we will leave it simple.
            initContracts(); // re-init with new signer
            updateWalletUI();

        } catch (error) {
            logToConsole(`Provider connection failed: ${error.message}`, 'error');
        }
    } else {
        logToConsole('No Ethereum browser extension detected.', 'error');
    }
}

function updateWalletUI() {
    walletInfoLabel.textContent = isDummyWallet ? "Dummy Wallet (Local)" : "Connected Wallet";
    walletInfoLabel.style.color = isDummyWallet ? "var(--win-min)" : "var(--accent-green)";

    walletInfoAddress.innerHTML = `${walletAddress} <span style="cursor:pointer; margin-left:8px; opacity:0.8; font-size:1rem;" title="Copy Address" onclick="navigator.clipboard.writeText('${walletAddress}'); alert('Wallet Address copied to clipboard!');">📋</span>`;
}

btnConnect.addEventListener('click', connectBrowserProvider);

// -----------------------------------------
// Contract Initialization
// -----------------------------------------
function initContracts() {
    // Contract Instances (Using the Diamond Address and imported ABIs)
    // We pass 'signer' to allow write transactions. Read functions will still work.
    contractA0 = new ethers.Contract(DIAMOND_ADDRESS, window.A0_ABI, signer);
    contractP0 = new ethers.Contract(DIAMOND_ADDRESS, window.P0_ABI, signer);
    contractP5 = new ethers.Contract(DIAMOND_ADDRESS, window.P5_ABI, signer);

    logToConsole('Contract interfaces initialized locally.', 'info');

    // Generate UI
    generateUI(window.A0_ABI, 'a0-body', contractA0);
    generateUI(window.P5_ABI, 'p5-body', contractP5);
    generateUI(window.P0_ABI, 'p0-body', contractP0);
}

// -----------------------------------------
// UI Generation from ABI
// -----------------------------------------
function togglePanel(id) {
    const el = document.getElementById(id);
    if (el.style.display === 'none') {
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

// Generate example mock inputs based on type
function getExampleInput(type, name) {
    if (type.includes('[200]')) {
        let arr = [];
        for (let i = 1; i <= 200; i++) arr.push(i * 10); // Not using 0 to differentiate test values
        return JSON.stringify(arr);
    }
    if (type.includes('[150]')) {
        let arr = [];
        if (type.includes('Vector2') || type.includes('tuple')) {
            for (let i = 0; i < 150; i++) arr.push({ x: (i + 1) * 10, y: (i + 2) * 10 });
        } else if (type.includes('bool')) {
            for (let i = 0; i < 150; i++) arr.push(true);
        } else {
            for (let i = 1; i <= 150; i++) arr.push(i * 10);
        }
        return JSON.stringify(arr);
    }
    if (type.includes('[100]')) {
        let arr = [];
        for (let i = 1; i <= 100; i++) arr.push(i * 5);
        return JSON.stringify(arr);
    }
    if (type.includes('[5]')) {
        if (type.includes('[16]')) { // e.g. [5][16]
            let outer = [];
            for (let i = 0; i < 5; i++) {
                let inner = [];
                for (let j = 0; j < 16; j++) inner.push((i + 1) * 10 + j);
                outer.push(inner);
            }
            return JSON.stringify(outer);
        } else if (type.includes('[2]')) { // e.g. [5][2]
            let outer = [];
            for (let i = 0; i < 5; i++) { outer.push([11, 22]); }
            return JSON.stringify(outer);
        } else {
            return JSON.stringify([10, 20, 30, 40, 50]);
        }
    }
    if (type.includes('tuple')) {
        // Fallback for generic tuple structures
        if (name.includes('CraftingQueueInput')) {
            return JSON.stringify({
                craftingIDs: new Array(100).fill(11),
                craftingTypes: new Array(100).fill(22),
                buildingIndexes: new Array(100).fill(33),
                amounts: new Array(100).fill(44),
                finishTimes: new Array(100).fill(999999)
            });
        }
        if (name.includes('BuildingUpdateInput')) {
            return JSON.stringify({
                buildingIDs: new Array(150).fill(100),
                buildingIndexes: new Array(150).fill(200),
                coordinates: new Array(150).fill({ x: 10, y: 20 }),
                isRotated: new Array(150).fill(true)
            });
        }
        if (name.includes('MechaLoadoutInput')) {
            return JSON.stringify({
                mechaIDs: [1, 2, 3, 4, 5],
                weaponIDs: new Array(5).fill(new Array(16).fill(99)),
                weaponLayouts: new Array(5).fill(new Array(16).fill(88)),
                accessories: new Array(5).fill([11, 22]),
                pilotIDs: [5, 4, 3, 2, 1]
            });
        }
        return JSON.stringify({ example: "data" });
    }
    return "";
}

function generateUI(abi, containerId, contractInstance) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; // clear initial

    const functions = abi.filter(item => item.type === 'function');

    functions.forEach(func => {
        const isRead = func.stateMutability === 'view' || func.stateMutability === 'pure';
        const btnClass = isRead ? 'btn-read' : 'btn-write';
        const labelColor = isRead ? 'var(--accent-cyan-hover)' : 'var(--accent-orange-hover)';

        const group = document.createElement('div');
        group.className = 'form-group doc-group';

        const label = document.createElement('label');
        label.textContent = func.name;
        label.className = 'func-label';
        label.style.color = labelColor;
        group.appendChild(label);

        const inputsDiv = document.createElement('div');
        inputsDiv.className = 'input-col';

        const inputIds = [];
        let needsExampleBox = false;
        let exampleBoxHTML = '';

        if (func.inputs && func.inputs.length > 0) {
            func.inputs.forEach((inp, idx) => {
                const inputId = `${containerId}-${func.name}-arg-${idx}`;
                inputIds.push({ id: inputId, type: inp.type });

                const inputEl = document.createElement('input');
                inputEl.type = 'text';
                inputEl.id = inputId;
                inputEl.placeholder = `${inp.name || 'arg' + idx} (${inp.type})`;
                inputEl.className = 'input-field';

                if (inp.type.includes('tuple') || inp.type.includes('[')) {
                    inputEl.placeholder += ' -> [JSON format]';

                    if (!isRead) {
                        needsExampleBox = true;
                        const exampleVal = getExampleInput(inp.type, inp.internalType || inp.name);
                        exampleBoxHTML += `<strong>${inp.name || 'arg'}:</strong><div class="copy-area" onclick="navigator.clipboard.writeText(this.innerText); alert('Copied!')" title="Click to copy">${exampleVal}</div>`;
                    }
                }

                inputsDiv.appendChild(inputEl);
            });
            group.appendChild(inputsDiv);

            // Append copy-paste box if needed
            if (needsExampleBox) {
                const exBox = document.createElement('div');
                exBox.className = 'example-box';
                exBox.innerHTML = `<strong>Data Examples:</strong>${exampleBoxHTML}`;
                group.appendChild(exBox);
            }
        } else {
            const noArgs = document.createElement('p');
            noArgs.className = 'helper-text';
            noArgs.textContent = 'No arguments required.';
            group.appendChild(noArgs);
        }

        const btn = document.createElement('button');
        btn.className = `btn ${btnClass} exec-btn`;
        btn.textContent = `Execute ${func.name}`;

        btn.onclick = async () => {
            try {
                const args = inputIds.map(inpObj => {
                    let val = document.getElementById(inpObj.id).value;
                    if (!val && val !== '0') return undefined; // handle empty strings safely but allow 0

                    if (inpObj.type.includes('tuple') || inpObj.type.includes('[')) {
                        try {
                            val = JSON.parse(val);
                        } catch (e) {
                            logToConsole(`Warning: Failed to parse JSON for ${inpObj.id}, sending as string/empty.`, 'system');
                        }
                    } else if (inpObj.type.includes('bool')) {
                        val = (val === 'true' || val === '1');
                    }
                    return val;
                });

                // Filter out undefined arguments if they left it blank (though ethers might revert if expecting args)
                const cleanArgs = args.filter(a => a !== undefined);

                logToConsole(`Executing ${func.name}(${cleanArgs.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(', ')})...`, 'pending');
                const result = await contractInstance[func.name](...cleanArgs);

                if (isRead) {
                    logToConsole(`${func.name} Success!`, 'success');
                    logToConsole(result, 'info');
                } else {
                    logToConsole(`Tx Hash: ${result.hash}`, 'info');
                    const receipt = await result.wait();
                    logToConsole(`${func.name} successful! Block: ${receipt.blockNumber}`, 'success');
                }
            } catch (error) {
                logToConsole(`Revert: error: ${error.shortMessage || error.message}`, 'error');
            }
        };
        group.appendChild(btn);
        container.appendChild(group);
    });
}

// App Entry
window.addEventListener('DOMContentLoaded', initEthers);
