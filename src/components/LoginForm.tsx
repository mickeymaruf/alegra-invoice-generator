"use client";

import { useActionState, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { login } from "@/actions/auth";

const initialState = {
  success: false,
  message: "",
};

type Props = {
  email?: string;
  token?: string;
  authenticated?: boolean;
};

export default function LoginForm({
  email = "",
  token = "",
  authenticated = false,
}: Props) {
  const [state, formAction, pending] = useActionState(login, initialState);

  const [showSecret, setShowSecret] = useState(false);

  const [emailValue, setEmailValue] = useState(email);
  const [tokenValue, setTokenValue] = useState(token);
  const [isAuthenticated, setIsAuthenticated] = useState(authenticated);

  useEffect(() => {
    if (state.success) {
      setIsAuthenticated(true);
    }
  }, [state.success]);

  return (
    <div className="flex flex-col gap-1 min-w-[500px]">
      {/* Header row matching Alegra UI header style */}
      <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-gray-600 uppercase">
        <span>Credentials</span>
      </div>

      <form action={formAction} className="flex flex-col gap-1">
        {/* Main horizontal bar container */}
        <div className="flex items-center rounded-lg border border-gray-300 bg-white p-1 focus-within:ring-1 focus-within:ring-gray-400">
          {/* Basic label prefix section */}
          <div className="border-r border-gray-200 px-3 py-1 text-xs font-medium text-gray-600">
            Basic
          </div>

          {/* Email Input */}
          <div className="relative flex-1">
            <input
              name="email"
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              type={showSecret ? "text" : "password"}
              placeholder="Email"
              className="w-full bg-transparent px-2 text-xs outline-none text-gray-800 placeholder-gray-400"
            />
          </div>

          <span className="text-gray-400 font-bold text-xs px-1">:</span>

          {/* Token Input */}
          <div className="relative flex-1">
            <input
              name="token"
              value={tokenValue}
              onChange={(e) => setTokenValue(e.target.value)}
              type={showSecret ? "text" : "password"}
              placeholder="API Token"
              className="w-full bg-transparent px-2 text-xs outline-none text-gray-800 placeholder-gray-400"
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {/* Authenticate Action Button */}
          <button
            disabled={pending}
            className={`ml-2 rounded-md px-3 py-1.5 text-xs font-medium text-white transition whitespace-nowrap disabled:opacity-50 ${
              isAuthenticated
                ? "bg-[#2bbab4] hover:bg-[#239c96]"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {pending
              ? "Authenticating..."
              : isAuthenticated
                ? "Re-authenticate"
                : "Authenticate"}
          </button>
        </div>

        {!state.success && state.message && (
          <p className="text-xs text-red-600">{state.message}</p>
        )}
      </form>
    </div>
  );
}
