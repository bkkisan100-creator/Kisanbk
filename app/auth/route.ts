import { NextResponse } from "next/server";
import { createClient } from "../lib/supabase/server";

export async function GET(
  request: Request
) {
  const url = new URL(request.url);

  const code =
    url.searchParams.get("code");

  const next =
    url.searchParams.get("next") || "/";

  const safeNext =
    next.startsWith("/") &&
    !next.startsWith("//")
      ? next
      : "/";

  if (!code) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(
          "Invalid authentication link."
        )}`,
        url.origin
      )
    );
  }

  const supabase =
    await createClient();

  const {
    error,
  } =
    await supabase.auth.exchangeCodeForSession(
      code
    );

  if (error) {
    console.error(
      "Auth callback error:",
      error
    );

    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(
          "Authentication link expired or invalid."
        )}`,
        url.origin
      )
    );
  }

  return NextResponse.redirect(
    new URL(
      safeNext,
      url.origin
    )
  );
}