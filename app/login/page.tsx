import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark">LM</div>
        <p className="eyebrow">INTERNAL WORKSPACE</p>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to manage your sales leads.</p>
        <Suspense fallback={<div className="loading-placeholder">Loading sign-in…</div>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
