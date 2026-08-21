import type { User } from "@supabase/supabase-js"
import { getSupabaseAdmin } from "./admin"

type LinkType = "invite" | "recovery"

export function withRedirect(actionLink: string | undefined, redirectTo: string) {
  if (!actionLink) return undefined
  try {
    const link = new URL(actionLink)
    if (link.searchParams.has("redirect_to")) link.searchParams.set("redirect_to", redirectTo)
    return link.toString()
  } catch {
    return actionLink
  }
}

/** Enlace directo al dashboard (verifyOtp). Evita el verify PKCE de action_link de Supabase. */
export function appAuthCallbackUrl(redirectTo: string, hashedToken: string, type: string) {
  const url = new URL(redirectTo)
  url.searchParams.set("token_hash", hashedToken)
  url.searchParams.set("type", type)
  return url.toString()
}

export async function generateAuthActionLink(input: {
  type: LinkType
  email: string
  redirectTo: string
  data?: Record<string, string | boolean>
}): Promise<{ user?: User; actionLink?: string; error?: string }> {
  const admin = getSupabaseAdmin()
  const { data, error } =
    input.type === "invite"
      ? await admin.auth.admin.generateLink({
          type: "invite",
          email: input.email,
          options: { data: input.data, redirectTo: input.redirectTo },
        })
      : await admin.auth.admin.generateLink({
          type: "recovery",
          email: input.email,
          options: { redirectTo: input.redirectTo },
        })
  const hashed = data.properties?.hashed_token
  const verifyType = data.properties?.verification_type || input.type
  const actionLink = hashed
    ? appAuthCallbackUrl(input.redirectTo, hashed, verifyType)
    : withRedirect(data.properties?.action_link, input.redirectTo)
  return {
    user: data.user ?? undefined,
    actionLink,
    error: error?.message,
  }
}
