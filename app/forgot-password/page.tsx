"use client";

import {
  FormEvent,
  useState,
} from "react";

import Link from "next/link";

import { createClient } from "../lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const cleanEmail =
      email.trim().toLowerCase();

    if (!cleanEmail) {
      setError(
        "Email राख्नुहोस्।"
      );
      return;
    }

    setLoading(true);

    try {
      const origin =
        window.location.origin;

      const {
        error: resetError,
      } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo:
              `${origin}/auth/callback?next=/reset-password`,
          }
        );

      if (resetError) {
        setError(
          resetError.message
        );
        return;
      }

      /*
       * Don't reveal whether an email
       * exists in the system.
       */
      setSuccess(
        "यदि यो email account सँग जोडिएको छ भने password reset link पठाइएको छ। आफ्नो inbox जाँच गर्नुहोस्।"
      );
    } catch {
      setError(
        "Request पठाउँदा समस्या आयो।"
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

        <h1>Forgot password?</h1>

        <p className="auth-subtitle">
          आफ्नो account को email राख्नुहोस्।
        </p>

        {error && (
          <div className="auth-alert error">
            {error}
          </div>
        )}

        {success && (
          <div className="auth-alert success">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label>
            Email
          </label>

          <input
            type="email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            placeholder="you@example.com"
            autoComplete="email"
            disabled={loading}
          />

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

        <p className="auth-bottom">
          <Link href="/login">
            ← Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}