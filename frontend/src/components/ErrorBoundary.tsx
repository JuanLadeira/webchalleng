import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="max-w-sm rounded-xl border bg-white p-8 shadow text-center">
            <p className="mb-4 text-4xl" aria-hidden="true">⚠️</p>
            <h2 className="mb-2 text-lg font-bold text-gray-800">Algo deu errado</h2>
            <p className="mb-6 text-sm text-gray-600">
              {this.state.error?.message ?? "Erro inesperado na aplicação."}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
