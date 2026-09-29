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
const [message, setMessage] = useState("");

async function handleLogin(
event: FormEvent<HTMLFormElement>
) {
event.preventDefault();


setError("");
setMessage("");

const cleanEmail = email.trim().toLowerCase();

if (!cleanEmail || !password) {
  setError("Email र password दुवै राख्नुहोस्।");
  return;
}

setLoading(true);

try {
  const { error: loginError } =
    await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

  if (loginError) {
    if (
      loginError.message
        .toLowerCase()
        .includes("email not confirmed")
    ) {
      setError(
        "पहिले आफ्नो email verify गर्नुहोस्।"
      );
    } else {
      setError("Email वा password गलत छ।");
    }

    return;
  }

  const requestedNext =
    searchParams.get("next") || "/";

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

return ( <main className="auth-page"> <div className="auth-card"> <div className="auth-logo"> <img
         src="/logo.png"
         alt="Aaja Ke Chha"
       /> </div>


    <h1>Welcome back</h1>

    <p className="auth-subtitle">
      आज के छ? मा फेरि स्वागत छ।
    </p>

    {error && (
      <div className="auth-alert error">
        {error}
      </div>
    )}

    {message && (
      <div className="auth-alert success">
        {message}
      </div>
    )}

    <form onSubmit={handleLogin}>
      <label htmlFor="email">
        Email
      </label>

      <input
        id="email"
        type="email"
        value={email}
        onChange={(event) =>
          setEmail(event.target.value)
        }
        placeholder="you@example.com"
        autoComplete="email"
        disabled={loading}
      />

      <label htmlFor="password">
        Password
      </label>

      <div className="password-wrap">
        <input
          id="password"
          type={
            showPassword
              ? "text"
              : "password"
          }
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          placeholder="Your password"
          autoComplete="current-password"
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
          disabled={loading}
        >
          {showPassword
            ? "Hide"
            : "Show"}
        </button>
      </div>

      <div className="forgot-row">
        <Link href="/forgot-password">
          Forgot password?
        </Link>
      </div>

      <button
        type="submit"
        className="auth-submit"
        disabled={loading}
      >
        {loading
          ? "Signing in..."
          : "Sign In"}
      </button>
    </form>

    <div className="auth-divider">
      <span>OR</span>
    </div>

    <p className="auth-bottom">
      नयाँ account छैन?{" "}
      <Link href="/signup">
        Create account
      </Link>
    </p>
  </div>
</main>


);
}

export default function LoginPage() {
return (
<Suspense
fallback={ <main className="auth-page"> <div className="auth-card"> <div className="auth-logo"> <img
             src="/logo.png"
             alt="Aaja Ke Chha"
           /> </div>


        <h1>Welcome back</h1>
      </div>
    </main>
  }
>
  <LoginForm />
</Suspense>


);
}

