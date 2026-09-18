"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isRateLimit = error.message?.includes("429");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        <h1 className="text-lg font-semibold text-text">
          {isRateLimit ? "Muitas requisições ao Discord" : "Algo deu errado"}
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          {isRateLimit
            ? "O Discord limitou temporariamente os pedidos desta conta. Espere alguns segundos e tente de novo."
            : "Não foi possível carregar esta página."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Tentar de novo
        </button>
      </div>
    </main>
  );
}
