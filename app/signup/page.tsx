"use client";

import {
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSignup(
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
      const origin = window.location.origin;

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
        setError(signupError.message);
        return;
      }

      if (!data.user) {
        setError(
          "Account बनाउन सकिएन। फेरि प्रयास गर्नुहोस्।"
        );
        return;
      }

      if (!data.session) {
        setSuccess(
          "Account तयार भयो। आफ्नो email खोल्नुहोस् र verification link क्लिक गर्नुहोस्। त्यसपछि Login गर्नुहोस्।"
        );

        setPassword("");
        setConfirmPassword("");

        return;
      }

      const fullName =
        cleanEmail.split("@")[0];

      const { error: profileError } =
        await supabase.from("profiles").upsert({
          id: data.user.id,
          email: cleanEmail,
          full_name: fullName,
        });

      if (profileError) {
        console.error(
          "Profile creation error:",
          profileError
        );
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      console.error(
        "Signup error:",
        error
      );

      setError(
        "Account बनाउँदा समस्या आयो। फेरि प्रयास गर्नुहोस्।"
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
          <h1>Create Account</h1>

          <p>
            आज के छ? मा आफ्नो account बनाउनुहोस्।
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
          onSubmit={handleSignup}
          className="auth-form"
        >
          <div className="auth-field">
            <label htmlFor="signup-email">
              Email
            </label>

            <input
              id="signup-email"
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
            <label htmlFor="signup-password">
              Password
            </label>

            <div className="auth-password-wrap">
              <input
                id="signup-password"
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
            <label htmlFor="signup-confirm">
              Confirm Password
            </label>

            <input
              id="signup-confirm"
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
              ? "Account बनाउँदै..."
              : "Create Account"}
          </button>
        </form>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <div className="auth-bottom">
          <span>पहिले नै account छ?</span>

          <Link href="/login">
            Login
          </Link>
        </div>
      </div>
    </main>
  );
}