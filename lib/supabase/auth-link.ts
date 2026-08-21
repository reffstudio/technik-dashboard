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

export async function generateAuthActionLink(input: {
  type: LinkType
  email: string
  redirectTo: string
  data?: Record<string, string | boolean>
}): Promise<{ user?: User; actionLink?: string; error?: string }> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin.auth.admin.generateLink({
    type: input.type,
    email: input.email,
    options: { data: input.data, redirectTo: input.redirectTo },
  })
  return {
    user: data.user ?? undefined,
    actionLink: withRedirect(data.properties?.action_link, input.redirectTo),
    error: error?.message,
  }
}
