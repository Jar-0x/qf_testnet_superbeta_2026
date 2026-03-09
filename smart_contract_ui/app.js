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

    // Start random 30-40s polling interval for gas balance
    const pollGasBalance = async () => {
        try {
            await updateWalletUI();
        } catch (e) {
            console.error("Gas polling failed", e);
        }
        const nextDelay = Math.floor(Math.random() * 10000) + 30000; // 30,000ms to 40,000ms
        setTimeout(pollGasBalance, nextDelay);
    };

    // Kickoff the loop
    setTimeout(pollGasBalance, 30000);
}

async function setupWallet() {
    // Hardcoded FIXED dummy wallet for all users on testnet
    // NEVER use this private key on mainnet as it is public
    const FIXED_PRIVATE_KEY = "0x8fa40e2d3ebbba9d8c0b2fef4515bd3a02a4bf746b149b1aaffbd30f55cf5fc3";

    logToConsole('Loading fixed dummy testnet wallet...', 'info');
    signer = new ethers.Wallet(FIXED_PRIVATE_KEY, provider);
    walletAddress = signer.address;
    isDummyWallet = true;

    await updateWalletUI();
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
            await updateWalletUI();

        } catch (error) {
            logToConsole(`Provider connection failed: ${error.message}`, 'error');
        }
    } else {
        logToConsole('No Ethereum browser extension detected.', 'error');
    }
}

async function updateWalletUI() {
    walletInfoLabel.textContent = isDummyWallet ? "Dummy Wallet (Local)" : "Connected Wallet";
    walletInfoLabel.style.color = isDummyWallet ? "var(--win-min)" : "var(--accent-green)";

    const copyIconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-bottom: 2px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    walletInfoAddress.innerHTML = `${walletAddress} <span style="cursor:pointer; margin-left:8px; opacity:0.6; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6" title="Copy Address" onclick="navigator.clipboard.writeText('${walletAddress}'); alert('Wallet Address copied!');">${copyIconSvg}</span>`;

    // Fetch and display balance
    try {
        const balanceWei = await provider.getBalance(walletAddress);
        // Convert to ether string (AVAX) and safely isolate 9 decimals
        let balanceEth = ethers.formatEther(balanceWei);
        // Format to exactly 9 decimals
        let parts = balanceEth.split('.');
        if (parts.length === 2 && parts[1].length > 9) {
            balanceEth = `${parts[0]}.${parts[1].substring(0, 9)}`;
        }

        const balanceEl = document.getElementById('walletBalance');
        if (balanceEl) {
            balanceEl.textContent = `${balanceEth} AVAX`;
        }
    } catch (e) {
        console.error("Failed to fetch balance", e);
    }
}

btnConnect.addEventListener('click', connectBrowserProvider);

// -----------------------------------------
// Utility Tools Setup
// -----------------------------------------
const utilityBtn = document.getElementById('utilityBtn');
const utilityMenu = document.getElementById('utilityMenu');
const genRandomWalletBtn = document.getElementById('genRandomWalletBtn');
const randomWalletResult = document.getElementById('randomWalletResult');

utilityBtn.addEventListener('click', () => {
    utilityMenu.style.display = utilityMenu.style.display === 'none' ? 'flex' : 'none';
});

// Close utility menu if clicking outside
document.addEventListener('click', (e) => {
    if (!utilityBtn.contains(e.target) && !utilityMenu.contains(e.target)) {
        utilityMenu.style.display = 'none';
    }
});

genRandomWalletBtn.addEventListener('click', () => {
    // Helper to generate the SVG with an inline copy payload
    const getCopyIcon = (payload) => `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -1px; margin-left: 4px; cursor: pointer; opacity: 0.6;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6" onclick="navigator.clipboard.writeText('${payload}'); alert('Copied!')"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

    // ethers.Wallet.createRandom() creates a new random wallet with a mnemonic
    const randomWallet = ethers.Wallet.createRandom();

    randomWalletResult.style.display = 'block';
    randomWalletResult.innerHTML = `
        <div class="util-row">
            <span class="util-label">Address:</span>
            <span class="util-val">${randomWallet.address}</span>
            ${getCopyIcon(randomWallet.address)}
        </div>
        <div class="util-row">
            <span class="util-label">Private Key:</span>
            <span class="util-val pkey">${randomWallet.privateKey}</span>
            ${getCopyIcon(randomWallet.privateKey)}
        </div>
        <div class="util-row">
            <span class="util-label">Mnemonic:</span>
            <span class="util-val mnemonic">${randomWallet.mnemonic.phrase}</span>
            ${getCopyIcon(randomWallet.mnemonic.phrase)}
        </div>
    `;
    logToConsole('Generated a new random wallet for testing.', 'info');
});

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
    const badge = el.previousElementSibling.querySelector('.badge');
    if (el.style.display === 'none') {
        el.style.display = 'block';
        if (badge) badge.textContent = badge.textContent.replace('▶', '▼');
    } else {
        el.style.display = 'none';
        if (badge) badge.textContent = badge.textContent.replace('▼', '▶');
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
        if (name.includes('PassiveResourceInput')) {
            return JSON.stringify({
                buildingUIDs: new Array(150).fill(111),
                resourceIDs: new Array(150).fill(222),
                lastClaimedTimes: new Array(150).fill(999999)
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
        const labelColor = isRead ? '#4fb2f0' : '#e8a841'; // match Remix button colors

        const group = document.createElement('div');
        group.className = 'form-group doc-group';

        // Create header label with toggle arrow
        const label = document.createElement('div');
        label.className = 'func-label';

        const titleSpan = document.createElement('span');
        titleSpan.textContent = func.name;
        titleSpan.style.color = labelColor;

        const arrowSpan = document.createElement('span');
        arrowSpan.textContent = '▶';

        label.appendChild(titleSpan);
        label.appendChild(arrowSpan);

        const funcBody = document.createElement('div');
        funcBody.className = 'func-body';
        funcBody.style.display = 'none';

        // Toggle logic
        label.onclick = () => {
            if (funcBody.style.display === 'none') {
                funcBody.style.display = 'block';
                arrowSpan.textContent = '▼';
            } else {
                funcBody.style.display = 'none';
                arrowSpan.textContent = '▶';
            }
        };
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

                // Remix row container
                const rowDiv = document.createElement('div');
                rowDiv.className = 'input-row-remix';

                const inpLabel = document.createElement('label');
                inpLabel.textContent = `${inp.name || 'arg' + idx}:`;

                const inputEl = document.createElement('input');
                inputEl.type = 'text';
                inputEl.id = inputId;
                inputEl.className = 'input-field';

                if (inp.type.includes('tuple') || inp.type.includes('[')) {
                    inputEl.placeholder = `[JSON array/tuple]`;

                    if (!isRead) {
                        needsExampleBox = true;
                        const exampleVal = getExampleInput(inp.type, inp.internalType || inp.name);
                        exampleBoxHTML += `<strong>${inp.name || 'arg'}:</strong><div class="copy-area" onclick="navigator.clipboard.writeText(this.innerText); alert('Copied!')" title="Click to copy">${exampleVal}</div>`;
                    }
                } else {
                    inputEl.placeholder = `${inp.type}`;
                }

                rowDiv.appendChild(inpLabel);
                rowDiv.appendChild(inputEl);
                inputsDiv.appendChild(rowDiv);
            });
            funcBody.appendChild(inputsDiv);

            // Append copy-paste box if needed
            if (needsExampleBox) {
                const exBox = document.createElement('div');
                exBox.className = 'example-box';
                exBox.innerHTML = `<strong>Data Examples:</strong>${exampleBoxHTML}`;
                funcBody.appendChild(exBox);
            }
        } else {
            const noArgs = document.createElement('p');
            noArgs.className = 'helper-text';
            noArgs.textContent = 'No arguments required.';
            funcBody.appendChild(noArgs);
        }

        const btn = document.createElement('button');
        btn.className = `btn ${btnClass} exec-btn`;
        btn.textContent = isRead ? 'call' : 'transact';

        // Output container for readbacks
        const outputDiv = document.createElement('div');
        outputDiv.className = 'inline-readback';
        outputDiv.style.display = 'none';

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

                    // Format readback output
                    let outStr = '';
                    if (func.outputs && func.outputs.length > 0) {
                        const formatEthersResult = (val) => {
                            if (typeof val === 'bigint') return val.toString();
                            if (typeof val === 'object' && val !== null) {
                                // Convert ethers Result proxy to a clean array to prevent object stringification issues
                                if (val.length !== undefined) {
                                    return JSON.stringify(Array.from(val), (k, v) => typeof v === 'bigint' ? v.toString() : v);
                                }
                                return JSON.stringify(val, (k, v) => typeof v === 'bigint' ? v.toString() : v);
                            }
                            return String(val);
                        };

                        if (func.outputs.length === 1) {
                            // Single output: result IS the value
                            let formatted = formatEthersResult(result);
                            outStr += `**0**: ${func.outputs[0].type} ${func.outputs[0].name ? func.outputs[0].name : ''}\n${formatted}`;
                        } else {
                            // Multiple outputs: result is an array-like object of values
                            func.outputs.forEach((outDef, index) => {
                                let formatted = formatEthersResult(result[index]);
                                outStr += `**${index}**: ${outDef.type} ${outDef.name ? outDef.name : ''}\n${formatted}\n\n`;
                            });
                        }
                    } else {
                        outStr = typeof result === 'object' ? JSON.stringify(result, (k, v) => typeof v === 'bigint' ? v.toString() : v) : String(result);
                    }

                    outputDiv.style.display = 'block';
                    // Sanitize innerHTML safely, or use textContent carefully. Since we use literal **0**, we'll just format manually
                    outputDiv.innerHTML = outStr.replace(/\*\*(.*?)\*\*/g, '<strong style="color:white">$1</strong>');
                } else {
                    logToConsole(`Tx Hash: ${result.hash}`, 'info');

                    // Show pending state inline quickly
                    outputDiv.style.display = 'block';
                    outputDiv.style.borderLeftColor = 'var(--accent-orange)';
                    outputDiv.textContent = `Pending Tx: ${result.hash}`;

                    const receipt = await result.wait();
                    logToConsole(`${func.name} successful! Block: ${receipt.blockNumber}`, 'success');

                    // Show success inline
                    outputDiv.style.borderLeftColor = 'var(--accent-green)';
                    outputDiv.innerHTML = `<strong style="color:var(--accent-green)">Success!</strong>\nTransaction Hash: ${receipt.hash}\nBlock Number: ${receipt.blockNumber}\nGas Used: ${receipt.gasUsed.toString()}`;

                    // Refresh gas balance automatically after a transaction concludes
                    await updateWalletUI();
                }
            } catch (error) {
                logToConsole(`Revert: error: ${error.shortMessage || error.message}`, 'error');

                // Show error inline for immediate feedback
                outputDiv.style.display = 'block';
                outputDiv.style.borderLeftColor = 'var(--accent-red)';
                outputDiv.textContent = `Error: ${error.shortMessage || error.message}`;
            }
        };

        // Append elements
        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.appendChild(btn);

        funcBody.appendChild(btnRow);
        funcBody.appendChild(outputDiv);

        group.appendChild(funcBody);
        container.appendChild(group);
    });
}

// App Entry
window.addEventListener('DOMContentLoaded', initEthers);
