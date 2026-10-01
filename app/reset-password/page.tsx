"use client";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [checking, setChecking] =
    useState(true);

  const [loading, setLoading] =
    useState(false);

  const [ready, setReady] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  useEffect(() => {
    let active = true;

    async function checkResetSession() {
      try {
        const {
          data,
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!active) return;

        if (sessionError || !data.session) {
          setReady(false);

          setError(
            "यो password reset link valid छैन वा expire भइसकेको छ।"
          );

          return;
        }

        setReady(true);
      } catch (error) {
        console.error(
          "Reset session error:",
          error
        );

        if (active) {
          setReady(false);

          setError(
            "Reset session verify गर्न सकिएन। फेरि reset link request गर्नुहोस्।"
          );
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    checkResetSession();

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
        "Password reset session valid छैन।"
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
        setError(updateError.message);
        return;
      }

      setSuccess(
        "Password सफलतापूर्वक परिवर्तन भयो। अब Login गर्नुहोस्।"
      );

      setPassword("");
      setConfirmPassword("");

      await supabase.auth.signOut();

      setTimeout(() => {
        router.replace("/login");
      }, 1800);
    } catch (error) {
      console.error(
        "Password update error:",
        error
      );

      setError(
        "Password परिवर्तन गर्दा समस्या आयो। फेरि प्रयास गर्नुहोस्।"
      );
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="auth-page">
        <div className="auth-card auth-loading-card">
          <div className="auth-logo">
            <img
              src="/logo.png"
              alt="Aaja Ke Chha"
            />
          </div>

          <div className="auth-heading">
            <h1>Checking...</h1>

            <p>
              Password reset session जाँच हुँदैछ।
            </p>
          </div>
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

        <div className="auth-heading">
          <h1>New Password</h1>

          <p>
            आफ्नो नयाँ password राख्नुहोस्।
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

        {ready && !success && (
          <form
            onSubmit={handleSubmit}
            className="auth-form"
          >
            <div className="auth-field">
              <label htmlFor="new-password">
                New Password
              </label>

              <div className="auth-password-wrap">
                <input
                  id="new-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  disabled={loading}
                />

                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() =>
                    setShowPassword(
                      (value) => !value
                    )
                  }
                  disabled={loading}
                >
                  {showPassword
                    ? "Hide"
                    : "Show"}
                </button>
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="confirm-password">
                Confirm Password
              </label>

              <input
                id="confirm-password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
                placeholder="Repeat password"
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

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