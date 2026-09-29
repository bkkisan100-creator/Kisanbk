"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();

  const supabase = createClient();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  async function handleSignup(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const cleanEmail =
      email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Email राख्नुहोस्।");
      return;
    }

    if (password.length < 8) {
      setError(
        "Password कम्तीमा 8 characters हुनुपर्छ।"
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Password र confirm password मिलेन।"
      );
      return;
    }

    setLoading(true);

    try {
      const origin =
        window.location.origin;

      const {
        data,
        error: signupError,
      } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo:
            `${origin}/auth/callback?next=/`,
        },
      });

      if (signupError) {
        setError(
          signupError.message
        );
        return;
      }

      /*
       * If email confirmation is enabled,
       * Supabase normally returns a user
       * without an active session.
       */
      if (
        data.user &&
        !data.session
      ) {
        setSuccess(
          "Account तयार भयो। आफ्नो email खोल्नुहोस् र verification link क्लिक गर्नुहोस्।"
        );

        return;
      }

      if (data.session) {
        router.replace("/");
        router.refresh();
      }
    } catch {
      setError(
        "Account बनाउन समस्या आयो। फेरि प्रयास गर्नुहोस्।"
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

        <h1>Create account</h1>

        <p className="auth-subtitle">
          आज के छ? मा आफ्नो account बनाउनुहोस्।
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

        <form onSubmit={handleSignup}>
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

          <label>
            Password
          </label>

          <div className="password-wrap">
            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="At least 8 characters"
              autoComplete="new-password"
              disabled={loading}
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() =>
                setShowPassword(
                  (value) => !value
                )
              }
            >
              {showPassword
                ? "Hide"
                : "Show"}
            </button>
          </div>

          <label>
            Confirm password
          </label>

          <input
            type={
              showPassword
                ? "text"
                : "password"
            }
            value={confirmPassword}
            onChange={(e) =>
              setConfirmPassword(
                e.target.value
              )
            }
            placeholder="Repeat password"
            autoComplete="new-password"
            disabled={loading}
          />

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading
              ? "Creating account..."
              : "Create Account"}
          </button>
        </form>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <p className="auth-bottom">
          पहिले नै account छ?
          {" "}
          <Link href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}