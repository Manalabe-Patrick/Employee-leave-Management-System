"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="w-full max-w-md">
      <div className="lg:hidden flex items-center gap-3 mb-10">
        <div className="w-10 h-10 rounded-full bg-[#D4654A] flex items-center justify-center">
          <span className="text-white font-bold text-base">L</span>
        </div>
        <span className="text-lg font-semibold text-[#1A1A1A]">LeaveDesk</span>
      </div>

      <h1 className="text-3xl font-bold text-[#1A1A1A] tracking-tight">
        Welcome back
      </h1>
      <p className="text-[#8A8A8A] mt-2 mb-8">
        Enter your credentials to access your account
      </p>

      {registered && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 mb-6">
          Account created successfully. Please log in.
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label
            htmlFor="email"
            className="text-sm font-medium text-[#3A3A3A]"
          >
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-12 rounded-xl border-[#E5E2DE] bg-white px-4 text-[#1A1A1A] placeholder:text-[#C5C0B8] focus-visible:border-[#D4654A] focus-visible:ring-[#D4654A]/20"
          />
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="password"
            className="text-sm font-medium text-[#3A3A3A]"
          >
            Password
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-12 rounded-xl border-[#E5E2DE] bg-white px-4 text-[#1A1A1A] placeholder:text-[#C5C0B8] focus-visible:border-[#D4654A] focus-visible:ring-[#D4654A]/20"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl bg-[#D4654A] hover:bg-[#C05540] text-white font-medium text-base border-transparent shadow-none cursor-pointer disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="text-sm text-[#8A8A8A] text-center mt-8">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="text-[#D4654A] font-medium hover:underline"
        >
          Register
        </Link>
      </p>
    </div>
  );
}
