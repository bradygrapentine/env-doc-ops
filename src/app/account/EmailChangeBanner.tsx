const MESSAGES: Record<string, { text: string; tone: "green" | "red" }> = {
  ok: { text: "Email updated successfully.", tone: "green" },
  expired: { text: "That confirmation link has expired. Try again.", tone: "red" },
  used: { text: "That confirmation link has already been used.", tone: "red" },
  invalid: { text: "That confirmation link is invalid.", tone: "red" },
  conflict: { text: "Email is already taken by another account.", tone: "red" },
  missing: { text: "Confirmation link is missing the token.", tone: "red" },
};

export default function EmailChangeBanner({ status }: { status?: string }) {
  if (!status) return null;
  const m = MESSAGES[status];
  if (!m) return null;
  const cls = m.tone === "green" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800";
  return <div className={`rounded border p-3 text-sm ${cls}`}>{m.text}</div>;
}
