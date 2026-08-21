"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { inputCls } from "./ui"
import { isEmailAddress, normalizeEmails } from "@/lib/technik/outbound"

export function CcEmailField({
  emails,
  onChange,
  placeholder = "Agregar correo y Enter",
  label,
}: {
  emails: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  label?: string
}) {
  const [draft, setDraft] = useState("")
  const [error, setError] = useState("")

  function add(raw: string) {
    const value = raw.trim()
    if (!value) return
    if (!isEmailAddress(value)) {
      setError("Correo inválido.")
      return
    }
    const next = normalizeEmails([...emails, value])
    onChange(next)
    setDraft("")
    setError("")
  }

  function remove(email: string) {
    onChange(emails.filter((e) => e !== email))
  }

  return (
    <div>
      {label ? (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
          {label}
        </p>
      ) : null}
      {emails.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {emails.map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-foreground"
            >
              {email}
              <button
                type="button"
                onClick={() => remove(email)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Quitar ${email}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <input
        type="email"
        className={inputCls}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => {
          setDraft(e.target.value)
          if (error) setError("")
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault()
            add(draft)
          }
        }}
        onBlur={() => {
          if (draft.trim()) add(draft)
        }}
      />
      {error ? <p className="text-[11px] text-destructive mt-1">{error}</p> : null}
    </div>
  )
}
