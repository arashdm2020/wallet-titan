const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export interface AddressAsset {
  symbol: string;
  network: string;
}

export function validateRecipientAddress(value: string, asset: AddressAsset) {
  const address = value.trim();
  const symbol = asset.symbol.toUpperCase();
  const network = asset.network.toUpperCase();

  if (!address) return { valid: false, error: "Recipient is required" };
  if (symbol === "BTC" || network.includes("BITCOIN")) {
    if (/^(bc1|[13])[a-zA-Z0-9]{20,90}$/.test(address)) return { valid: true, error: "" };
    return { valid: false, error: "Enter a Bitcoin address" };
  }
  if (symbol === "ETH" || network.includes("ETHEREUM")) {
    if (/^0x[a-fA-F0-9]{40}$/.test(address)) return { valid: true, error: "" };
    return { valid: false, error: "Enter an Ethereum address" };
  }
  if (symbol === "TRX" || symbol === "USDT" || network.includes("TRON")) {
    if (/^T[1-9A-HJ-NP-Za-km-z]{25,40}$/.test(address)) return { valid: true, error: "" };
    return { valid: false, error: "Enter a TRON address" };
  }

  if (address.length >= 12) return { valid: true, error: "" };
  return { valid: false, error: "Recipient address is too short" };
}

export function generateWalletAddress(symbol: string, network: string, walletId: string, username: string) {
  const digest = deterministicHex(`${symbol}:${network}:${walletId}:${username}`);
  const upperSymbol = symbol.toUpperCase();
  const upperNetwork = network.toUpperCase();

  if (upperSymbol === "ETH" || upperNetwork.includes("ETHEREUM")) {
    return `0x${digest.slice(0, 40)}`;
  }
  if (upperSymbol === "BTC" || upperNetwork.includes("BITCOIN")) {
    return `bc1q${digest.slice(0, 34)}`;
  }
  if (upperSymbol === "TRX" || upperSymbol === "USDT" || upperNetwork.includes("TRON")) {
    let out = "T";
    for (let i = 0; out.length < 34; i += 2) {
      const byte = Number.parseInt(digest.slice(i % digest.length, (i % digest.length) + 2), 16);
      out += base58Alphabet[byte % base58Alphabet.length];
    }
    return out;
  }
  return `${upperSymbol}-${digest.slice(0, 32)}`;
}

function deterministicHex(input: string) {
  let hashA = 0x811c9dc5;
  let hashB = 0x01000193;
  for (let i = 0; i < input.length; i += 1) {
    hashA ^= input.charCodeAt(i);
    hashA = Math.imul(hashA, 0x01000193) >>> 0;
    hashB ^= input.charCodeAt(input.length - i - 1);
    hashB = Math.imul(hashB, 0x85ebca6b) >>> 0;
  }
  let seed = `${hashA.toString(16).padStart(8, "0")}${hashB.toString(16).padStart(8, "0")}`;
  while (seed.length < 96) {
    hashA = Math.imul(hashA ^ hashB, 0x27d4eb2d) >>> 0;
    hashB = Math.imul(hashB ^ hashA, 0x165667b1) >>> 0;
    seed += `${hashA.toString(16).padStart(8, "0")}${hashB.toString(16).padStart(8, "0")}`;
  }
  return seed;
}
