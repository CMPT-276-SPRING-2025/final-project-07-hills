// app/page.tsx
"use client";
import React from "react"
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { login } = useAuth();

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Sign in with Google
      await login();
      
      // Redirect to welcome page after successful login
      router.push("/welcome");
    } catch (err) {
      console.error("Login error:", err);
      setError("Failed to sign in with Google. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FAF3E9] flex flex-col items-center justify-center p-8 text-center">
      {/* Large Heading */}
      <h1 className="text-9xl font-bold text-[#cda584] leading-tight">
        Welcome To <br /> Cirkle!
      </h1>

      {/* Subtitle */}
      <p className="mt-4 text-4xl font-semibold text-[#A98973] tracking-wide">
        COLLABORATIVE STUDY FOR{" "}
        <span className="text-[#924747] italic">'BETTER RESULTS'</span>
      </p>

      {/* Error Message (if any) */}
      {error && (
        <p className="mt-4 text-red-500">{error}</p>
      )}

      {/* Google Login Button */}
      <div className="mt-12">
        <Button 
          className="flex items-center space-x-3 bg-[#924747] hover:bg-[#924747]/90 text-white px-8 py-5 rounded-full text-xl"
          onClick={handleGoogleLogin}
          disabled={isLoading}
        >
          <img src="/google.png" alt="Google Icon" className="text-4xl h-6 w-6"/>
          <span>{isLoading ? "Signing in..." : "Login with Google"}</span>
        </Button>
      </div>
    </main>
  );
}