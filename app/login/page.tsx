import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function LoginPage() {
  return (
    <main className="login-page">
      <div style={{ position: "absolute", top: "20px", right: "20px", zIndex: 10 }}>
        <ThemeToggle compact />
      </div>
      <section className="login-card">
        <BrandLogo priority />
        <p className="eyebrow">LEAD MANAGEMENT WORKSPACE</p>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to manage campaigns and leads.</p>
        <Suspense fallback={<div className="loading-placeholder">Loading sign-in…</div>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
