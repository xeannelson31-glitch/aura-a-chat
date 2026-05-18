import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

function Boom({ msg = "Kaboom" }: { msg?: string }) {
  throw new Error(msg);
}

describe("AppErrorBoundary", () => {
  it("renders children when no error is thrown", () => {
    render(
      <AppErrorBoundary>
        <p>safe content</p>
      </AppErrorBoundary>,
    );
    expect(screen.getByText("safe content")).toBeInTheDocument();
  });

  it("renders recovery UI when a child throws", () => {
    // Silence the expected React error log noise
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <AppErrorBoundary>
        <Boom msg="Streaming failure simulated" />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/streaming failure simulated/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload page/i })).toBeInTheDocument();
    spy.mockRestore();
  });

  it("recovers via 'Try again' when the child no longer throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    let shouldThrow = true;
    function Maybe() {
      if (shouldThrow) throw new Error("transient");
      return <p>recovered</p>;
    }
    const { rerender } = render(
      <AppErrorBoundary>
        <Maybe />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Fix the underlying condition, then click Try again.
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    rerender(
      <AppErrorBoundary>
        <Maybe />
      </AppErrorBoundary>,
    );
    expect(screen.getByText("recovered")).toBeInTheDocument();
    spy.mockRestore();
  });
});
