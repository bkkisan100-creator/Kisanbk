"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "../lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("कृपया आफ्नो email राख्नुहोस्।");
      return;
    }

    setLoading(true);

    try {
      const origin = window.location.origin;

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo:
              `${origin}/auth/callback?next=/reset-password`,
          }
        );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess(
        "यदि यो email सँग account जोडिएको छ भने password reset link पठाइएको छ। आफ्नो inbox जाँच गर्नुहोस्।"
      );
    } catch (error) {
      console.error(
        "Forgot password error:",
        error
      );

      setError(
        "Reset link पठाउँदा समस्या आयो। फेरि प्रयास गर्नुहोस्।"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img
            src="/logo.png"
            alt="Aaja Ke Chha"
          />
        </div>

        <div className="auth-heading">
          <h1>Forgot Password?</h1>

          <p>
            आफ्नो account को email राख्नुहोस्। हामी password reset link पठाउँछौँ।
          </p>
        </div>

        {error && (
          <div className="auth-alert error">
            <span>!</span>
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="auth-alert success">
            <span>✓</span>
            <p>{success}</p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="auth-form"
        >
          <div className="auth-field">
            <label htmlFor="forgot-email">
              Email
            </label>

            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading
              ? "Sending..."
              : "Send Reset Link"}
          </button>
        </form>

        <div className="auth-bottom auth-back">
          <Link href="/login">
            ← Back to Login
          </Link>
        </div>
      </div>
    </main>
  );
}