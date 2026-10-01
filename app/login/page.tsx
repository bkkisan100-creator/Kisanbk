"use client";

import {
  Suspense,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import { createClient } from "../lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("कृपया आफ्नो email राख्नुहोस्।");
      return;
    }

    if (!password) {
      setError("कृपया password राख्नुहोस्।");
      return;
    }

    setLoading(true);

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (loginError) {
        const message =
          loginError.message.toLowerCase();

        if (message.includes("email not confirmed")) {
          setError(
            "पहिले आफ्नो email verify गर्नुहोस्।"
          );
        } else {
          setError(
            "Email वा password गलत छ।"
          );
        }

        return;
      }

      if (!data.user) {
        setError(
          "Login हुन सकेन। फेरि प्रयास गर्नुहोस्।"
        );
        return;
      }

      const requestedNext =
        searchParams.get("redirect") ||
        searchParams.get("next") ||
        "/";

      const safeNext =
        requestedNext.startsWith("/") &&
        !requestedNext.startsWith("//")
          ? requestedNext
          : "/";

      router.replace(safeNext);
      router.refresh();
    } catch (error) {
      console.error("Login error:", error);

      setError(
        "Login गर्दा समस्या आयो। फेरि प्रयास गर्नुहोस्।"
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
          <h1>फेरि स्वागत छ</h1>

          <p>
            आज के छ? मा आफ्नो account मा login गर्नुहोस्।
          </p>
        </div>

        {error && (
          <div className="auth-alert error">
            <span>!</span>
            <p>{error}</p>
          </div>
        )}

        <form
          onSubmit={handleLogin}
          className="auth-form"
        >
          <div className="auth-field">
            <label htmlFor="login-email">
              Email
            </label>

            <input
              id="login-email"
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

          <div className="auth-field">
            <div className="auth-label-row">
              <label htmlFor="login-password">
                Password
              </label>

              <Link href="/forgot-password">
                Forgot password?
              </Link>
            </div>

            <div className="auth-password-wrap">
              <input
                id="login-password"
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
                placeholder="Your password"
                autoComplete="current-password"
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

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading
              ? "Login हुँदैछ..."
              : "Login"}
          </button>
        </form>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <div className="auth-bottom">
          <span>Account छैन?</span>

          <Link href="/signup">
            Create Account
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-page">
          <div className="auth-card auth-loading-card">
            <div className="auth-logo">
              <img
                src="/logo.png"
                alt="Aaja Ke Chha"
              />
            </div>

            <div className="auth-heading">
              <h1>आज के छ?</h1>
              <p>Loading...</p>
            </div>
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}