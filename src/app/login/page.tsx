"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signInWithPasskey } from "@/lib/auth/webauthn-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [ssoInfo, setSsoInfo] = useState<{ enabled: boolean; providerName: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/sso")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.enabled) setSsoInfo(data);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = mfaChallengeToken
        ? { challengeToken: mfaChallengeToken, mfaCode }
        : { email, password };

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign-in failed.");
        return;
      }
      if (data.mfaRequired && data.challengeToken) {
        setMfaChallengeToken(data.challengeToken);
        setMfaCode("");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error while signing in.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasskeySignIn() {
    setError(null);
    setPasskeyLoading(true);
    try {
      const res = await signInWithPasskey(email.trim() || undefined);
      if (!res.ok) {
        setError(res.error || "Passkey sign-in failed.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey sign-in failed.");
    } finally {
      setPasskeyLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 shadow-sm border border-border">
            <img
              src="/aegis-logo.png"
              alt="Aegis AI Governance Platform"
              className="h-14 w-auto object-contain"
            />
          </div>
          <h1 className="sr-only">Aegis: AI Governance Platform</h1>
          <p className="text-sm text-muted-foreground">
            Evidence-based governance for enterprise AI and autonomous agents.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{mfaChallengeToken ? "Two-Factor Verification" : "Sign in"}</CardTitle>
            <CardDescription>
              {mfaChallengeToken
                ? "Enter the 6-digit code from your authenticator app."
                : "Enter your credentials, or sign in with a registered Passkey."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
                >
                  {error}
                </div>
              )}

              {mfaChallengeToken ? (
                <>
                  <div className="space-y-1.5">
                    <label htmlFor="mfaCode" className="block text-xs font-medium text-foreground">
                      Authenticator Code
                    </label>
                    <Input
                      id="mfaCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      maxLength={6}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      placeholder="123456"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    <ShieldCheck className="h-4 w-4 mr-1.5" />
                    {loading ? "Verifying..." : "Verify MFA Code"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-xs"
                    onClick={() => {
                      setMfaChallengeToken(null);
                      setMfaCode("");
                      setError(null);
                    }}
                  >
                    Back to password sign-in
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="block text-xs font-medium text-foreground">
                      Email address
                    </label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email webauthn"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@organisation.org"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="password" className="block text-xs font-medium text-foreground">
                      Password
                    </label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign in"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={passkeyLoading}
                    onClick={handlePasskeySignIn}
                  >
                    <Fingerprint className="h-4 w-4 mr-1.5" />
                    {passkeyLoading ? "Waiting for Passkey..." : "Sign in with Passkey"}
                  </Button>

                  {ssoInfo?.enabled && (
                    <a href="/api/auth/sso?action=login" className="block">
                      <Button type="button" variant="outline" className="w-full">
                        Sign in with {ssoInfo.providerName}
                      </Button>
                    </a>
                  )}
                </>
              )}
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground">
          FRAME and AAEF by Ian Loe, Tactics Solutions, licensed CC BY-NC 4.0.
        </p>
      </div>
    </div>
  );
}
