function cleanEnv(value: string | undefined) {
  return (value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^["']|["']$/g, "")
}

export function resendEnv() {
  // Referencias literales: Turbopack/Vercel las tienen que ver en el bundle.
  void process.env.RESEND_API_KEY
  void process.env.RESEND_FROM
  void process.env.RESEND_REPLY_TO
  return {
    apiKey: cleanEnv(process.env.RESEND_API_KEY),
    from: cleanEnv(process.env.RESEND_FROM) || "Technik Solutions <noreply@solutionstechnik.com>",
    replyTo: cleanEnv(process.env.RESEND_REPLY_TO),
  }
}

export function isResendConfigured() {
  const { apiKey } = resendEnv()
  return apiKey.startsWith("re_") && apiKey.length > 12
}
