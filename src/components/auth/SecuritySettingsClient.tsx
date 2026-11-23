"use client";

import React, { useState } from "react";
import { Fingerprint, ShieldCheck, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerPasskey } from "@/lib/auth/webauthn-browser";

interface PasskeyRow {
  id: string;
  credentialId: string;
  deviceName: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface Props {
  initialMfaEnabled: boolean;
  initialPasskeys: PasskeyRow[];
}

export function SecuritySettingsClient({ initialMfaEnabled, initialPasskeys }: Props) {
  const [mfaEnabled, setMfaEnabled] = useState(initialMfaEnabled);
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>(initialPasskeys);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [setupUri, setSetupUri] = useState<string | null>(null);
  const [setupQrDataUrl, setSetupQrDataUrl] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [deviceName, setDeviceName] = useState("Work Laptop Passkey");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function refreshSecurity() {
    const res = await fetch("/api/auth/security");
    if (res.ok) {
      const data = await res.json();
      setMfaEnabled(Boolean(data.mfaEnabled));
      setPasskeys(data.passkeys ?? []);
    }
  }

  return (
    <div className="space-y-6">
      {statusMsg && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Authenticator App MFA (TOTP)</span>
              </CardTitle>
              <Badge variant={mfaEnabled ? "success" : "secondary"}>
                {mfaEnabled ? "Enabled" : "Not Enabled"}
              </Badge>
            </div>
            <CardDescription>
              Protect your account with a 6-digit code from Google Authenticator, Microsoft Authenticator, or 1Password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {mfaEnabled ? (
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setStatusMsg(null);
                  setErrorMsg(null);
                  const res = await fetch("/api/auth/security", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "DISABLE_MFA", code: disableCode }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setDisableCode("");
                    setStatusMsg("Authenticator App MFA disabled.");
                    await refreshSecurity();
                  } else {
                    setErrorMsg(data.error || "Failed to disable MFA.");
                  }
                }}
              >
                <p className="text-muted-foreground">
                  MFA is active. To disable it, confirm with a current 6-digit code from your authenticator app:
                </p>
                <div className="flex gap-2">
                  <Input
                    required
                    maxLength={6}
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                    placeholder="6-digit code"
                    className="max-w-[160px]"
                  />
                  <Button type="submit" size="sm" variant="danger">
                    Disable MFA
                  </Button>
                </div>
              </form>
            ) : setupSecret ? (
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setStatusMsg(null);
                  setErrorMsg(null);
                  const res = await fetch("/api/auth/security", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "ENABLE_MFA", secret: setupSecret, code: totpCode }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setSetupSecret(null);
                    setSetupUri(null);
                    setSetupQrDataUrl(null);
                    setTotpCode("");
                    setStatusMsg("Authenticator App MFA enabled.");
                    await refreshSecurity();
                  } else {
                    setErrorMsg(data.error || "Invalid code.");
                  }
                }}
              >
                <div className="rounded-md border border-border bg-surface-muted/50 p-3 space-y-2.5">
                  <div className="font-semibold">1. Scan this QR code with your Authenticator App:</div>
                  {setupQrDataUrl && (
                    <div className="inline-block rounded-md border border-border bg-white p-2">
                      <img
                        src={setupQrDataUrl}
                        alt="Authenticator MFA QR Code"
                        className="h-44 w-44"
                      />
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground">
                    Or enter this secret key manually:{" "}
                    <span className="font-mono font-semibold text-foreground select-all">{setupSecret}</span>
                  </div>
                  {setupUri && (
                    <div className="text-[10px] text-muted-foreground break-all">
                      <code>{setupUri}</code>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    required
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    className="max-w-[180px]"
                  />
                  <Button type="submit" size="sm">
                    Verify &amp; Enable MFA
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  setStatusMsg(null);
                  setErrorMsg(null);
                  const res = await fetch("/api/auth/security", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "SETUP_MFA" }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setSetupSecret(data.secret);
                    setSetupUri(data.otpauthUri);
                    setSetupQrDataUrl(data.qrDataUrl || null);
                  } else {
                    setErrorMsg(data.error || "Failed to generate MFA secret.");
                  }
                }}
              >
                Set Up Authenticator MFA
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-primary" />
              <span>Passkeys (WebAuthn / FIDO2)</span>
            </CardTitle>
            <CardDescription>
              Sign in passwordlessly using Touch ID, Face ID, Windows Hello, or a hardware security key.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="flex gap-2">
              <Input
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="Passkey label (e.g. MacBook Touch ID)"
              />
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  setStatusMsg(null);
                  setErrorMsg(null);
                  try {
                    const res = await registerPasskey(deviceName);
                    if (res.ok) {
                      setStatusMsg(`Registered passkey "${deviceName}".`);
                      await refreshSecurity();
                    } else {
                      setErrorMsg(res.error || "Failed to register passkey.");
                    }
                  } catch (err) {
                    setErrorMsg(err instanceof Error ? err.message : "Failed to register passkey.");
                  }
                }}
              >
                Register Passkey
              </Button>
            </div>

            <div className="space-y-2">
              {passkeys.length === 0 ? (
                <div className="text-muted-foreground">No passkeys registered yet.</div>
              ) : (
                passkeys.map((pk) => (
                  <div
                    key={pk.id}
                    className="flex items-center justify-between rounded border border-border px-3 py-2"
                  >
                    <div>
                      <div className="font-semibold">{pk.deviceName}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Added {pk.createdAt.slice(0, 10)}
                        {pk.lastUsedAt ? ` · Last used ${pk.lastUsedAt.slice(0, 10)}` : ""}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await fetch(`/api/auth/security?id=${encodeURIComponent(pk.id)}`, {
                          method: "DELETE",
                        });
                        setStatusMsg(`Removed passkey "${pk.deviceName}".`);
                        await refreshSecurity();
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
