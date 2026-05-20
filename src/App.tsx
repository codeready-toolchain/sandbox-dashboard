import { AuthProvider } from "./auth";

export function App() {
  return (
    <AuthProvider>
      <div>Developer Sandbox</div>
    </AuthProvider>
  );
}
