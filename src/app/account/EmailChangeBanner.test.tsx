import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import EmailChangeBanner from "./EmailChangeBanner";

describe("EmailChangeBanner", () => {
  it("renders nothing without status", () => {
    const { container } = render(<EmailChangeBanner />);
    expect(container.textContent).toBe("");
  });

  it("renders nothing for unknown status", () => {
    const { container } = render(<EmailChangeBanner status="other" />);
    expect(container.textContent).toBe("");
  });

  it.each(["ok", "expired", "used", "invalid", "conflict", "missing"])(
    "renders message for %s",
    (status) => {
      const { container } = render(<EmailChangeBanner status={status} />);
      expect(container.textContent?.length ?? 0).toBeGreaterThan(0);
    },
  );
});
