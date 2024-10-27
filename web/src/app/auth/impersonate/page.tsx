"use client";
import AuthFlowContainer from "@/components/auth/AuthFlowContainer";
import { HealthCheckBanner } from "@/components/health/healthcheck";
import { useUser } from "@/components/user/UserProvider";
import { redirect } from "next/navigation";
import { useState } from "react";

export default function ImpersonatePage() {
  const { user, isLoadingUser, isCloudSuperuser } = useUser();

  if (isLoadingUser) {
    return null;
  }

  if (!user) {
    redirect("/auth/login");
  }

  if (!isCloudSuperuser) {
    redirect("/search");
  }
  const [email, setEmail] = useState("");
  const [apiKey, setApiKey] = useState("");

  const handleImpersonate = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const response = await fetch("/api/tenants/impersonate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, api_key: apiKey }),
    });
    console.log(response);
  };

  return (
    <AuthFlowContainer>
      <div className="absolute top-10x w-full">
        <HealthCheckBanner />
      </div>

      <div className="flex flex-col w-full justify-center">
        <h2 className="text-center text-xl text-strong font-bold mb-8">
          Impersonate User
        </h2>

        <div className="flex flex-col space-y-6">
          <div className="relative">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              name="email"
              placeholder="Enter user email to impersonate"
              className="w-full px-4 py-3 border border-border rounded-lg bg-input focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
              required
            />
          </div>

          <div className="relative">
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
              name="api_key"
              placeholder="Enter API Key"
              className="w-full px-4 py-3 border border-border rounded-lg bg-input focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
              required
            />
          </div>

          <button
            onClick={handleImpersonate}
            className="w-full py-3 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
          >
            Impersonate User
          </button>
        </div>
        <div className="text-sm text-text-500 mt-4 text-center px-4 rounded-md">
          Note: This feature is only available for @danswer.ai administrators
        </div>
      </div>
    </AuthFlowContainer>
  );
}
