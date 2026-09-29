"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { createClient } from "../lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();

  const supabase = createClient();

  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [checking, setChecking] =
    useState(true);

  const [ready, setReady] =
    useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const {
          data,
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!active) {
          return;
        }

        if (
          sessionError ||
          !data.session
        ) {
          setError(
            "Password reset session expired. फेरि Forgot Password बाट request गर्नुहोस्।"
          );

          setReady(false);
        } else {
          setReady(true);
        }
      } catch {
        if (active) {
          setError(
            "Reset session verify गर्न सकिएन।"
          );
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    checkSession();

    return () => {
      active = false;
    };
  }, [supabase]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!ready) {
      setError(
        "Reset session valid छैन।"
      );
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
      const {
        error: updateError,
      } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(
          updateError.message
        );
        return;
      }

      setSuccess(
        "Password successfully change भयो। अब login गर्नुहोस्।"
      );

      await supabase.auth.signOut();

      setTimeout(() => {
        router.replace("/login");
      }, 1500);
    } catch {
      setError(
        "Password update गर्दा समस्या आयो।"
      );
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            <img
              src="/logo.png"
              alt="Aaja Ke Chha"
            />
          </div>

          <h1>Checking...</h1>

          <p className="auth-subtitle">
            Secure reset session verify हुँदैछ।
          </p>
        </div>
      </main>
    );
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

        <h1>New password</h1>

        <p className="auth-subtitle">
          आफ्नो नयाँ password राख्नुहोस्।
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

        {ready && !success && (
          <form onSubmit={handleSubmit}>
            <label>
              New password
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
                  setPassword(
                    e.target.value
                  )
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
              Confirm new password
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
                ? "Updating..."
                : "Update Password"}
            </button>
          </form>
        )}

        {!ready && !success && (
          <a
            href="/forgot-password"
            className="auth-submit auth-link-button"
          >
            Request New Reset Link
          </a>
        )}
      </div>
    </main>
  );
}