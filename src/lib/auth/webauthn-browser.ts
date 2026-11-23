export function arrayBufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64UrlToUint8Array(b64url: string): Uint8Array<ArrayBuffer> {
  const padded = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function signInWithPasskey(email?: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return { ok: false, error: "Passkeys are not supported in this browser." };
  }

  const optRes = await fetch("/api/auth/passkey/options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const opts = await optRes.json();
  if (!optRes.ok) {
    return { ok: false, error: opts.error || "Failed to start passkey sign-in." };
  }

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: base64UrlToUint8Array(opts.challenge),
      rpId: opts.rpId,
      allowCredentials: (opts.allowCredentials ?? []).map((c: { id: string; type: "public-key" }) => ({
        id: base64UrlToUint8Array(c.id),
        type: c.type,
      })),
      userVerification: "preferred",
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) {
    return { ok: false, error: "Passkey prompt was cancelled." };
  }

  const resp = assertion.response as AuthenticatorAssertionResponse;
  const verifyRes = await fetch("/api/auth/passkey/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challenge: opts.challenge,
      credentialId: arrayBufferToBase64Url(assertion.rawId),
      authenticatorData: arrayBufferToBase64Url(resp.authenticatorData),
      clientDataJSON: arrayBufferToBase64Url(resp.clientDataJSON),
      signature: arrayBufferToBase64Url(resp.signature),
    }),
  });

  const verifyJson = await verifyRes.json();
  if (!verifyRes.ok) {
    return { ok: false, error: verifyJson.error || "Passkey verification failed." };
  }
  return { ok: true };
}

export async function registerPasskey(deviceName: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return { ok: false, error: "Passkeys are not supported in this browser." };
  }

  const optRes = await fetch("/api/auth/security", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "PASSKEY_REGISTER_OPTIONS" }),
  });
  const opts = await optRes.json();
  if (!optRes.ok) {
    return { ok: false, error: opts.error || "Failed to start passkey registration." };
  }

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: base64UrlToUint8Array(opts.challenge),
      rp: opts.rp,
      user: {
        id: base64UrlToUint8Array(opts.user.id),
        name: opts.user.name,
        displayName: opts.user.displayName,
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },
        { alg: -257, type: "public-key" },
      ],
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!cred) {
    return { ok: false, error: "Passkey registration was cancelled." };
  }

  const attResp = cred.response as AuthenticatorAttestationResponse;
  const spkiBuffer = typeof attResp.getPublicKey === "function" ? attResp.getPublicKey() : null;
  if (!spkiBuffer) {
    return { ok: false, error: "Browser did not expose SPKI public key for this passkey." };
  }

  const alg = typeof attResp.getPublicKeyAlgorithm === "function" ? attResp.getPublicKeyAlgorithm() : -7;

  const verifyRes = await fetch("/api/auth/security", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "PASSKEY_REGISTER_VERIFY",
      challenge: opts.challenge,
      credentialId: arrayBufferToBase64Url(cred.rawId),
      publicKeySpki: arrayBufferToBase64(spkiBuffer),
      algorithm: alg,
      deviceName: deviceName.trim() || "Passkey",
    }),
  });

  const verifyJson = await verifyRes.json();
  if (!verifyRes.ok) {
    return { ok: false, error: verifyJson.error || "Failed to save passkey." };
  }
  return { ok: true };
}
