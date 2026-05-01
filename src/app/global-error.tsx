"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", background: "#f9fafb" }}>
        <div
          style={{
            maxWidth: "36rem",
            margin: "0 auto",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.25rem",
            padding: "1.5rem",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
            Something went wrong.
          </h1>
          {error.message ? (
            <pre
              style={{
                marginTop: "1rem",
                overflowX: "auto",
                background: "#f3f4f6",
                padding: "0.75rem",
                borderRadius: "0.25rem",
                fontSize: "0.75rem",
                color: "#1f2937",
              }}
            >
              <code>{error.message}</code>
            </pre>
          ) : null}
          <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                background: "#000",
                color: "#fff",
                padding: "0.5rem 1rem",
                borderRadius: "0.25rem",
                border: "none",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                border: "1px solid #e5e7eb",
                padding: "0.5rem 1rem",
                borderRadius: "0.25rem",
                color: "inherit",
                textDecoration: "none",
              }}
            >
              Back to projects
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
