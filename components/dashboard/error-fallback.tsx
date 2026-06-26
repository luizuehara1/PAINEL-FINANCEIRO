import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  sectionName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  // Explicit declarations to satisfy typescript environment
  props!: Props;
  state: State = {
    hasError: false,
    error: null,
  };
  setState!: (state: Partial<State> | ((state: State) => Partial<State>)) => void;

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-zinc-900/50 border border-red-500/20 rounded-2xl flex flex-col items-center justify-center text-center gap-3 my-4">
          <AlertCircle className="w-10 h-10 text-red-500/80 animate-pulse" />
          <h3 className="text-sm font-semibold text-zinc-200">
            Algo deu errado ao carregar {this.props.sectionName ? `esta seção (${this.props.sectionName})` : "esta seção"}.
          </h3>
          <p className="text-xs text-zinc-500 max-w-md font-mono">
            {this.state.error?.message || "Erro interno inesperado."}
          </p>
          <button
            onClick={this.handleReset}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-lg transition-colors border border-white/5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Tentar Novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ErrorFallback: React.FC<{ message?: string; sectionName?: string }> = ({
  message,
  sectionName,
}) => {
  return (
    <div className="p-6 bg-zinc-900/50 border border-red-500/20 rounded-2xl flex flex-col items-center justify-center text-center gap-3 my-4">
      <AlertCircle className="w-10 h-10 text-red-500/80 animate-pulse" />
      <h3 className="text-sm font-semibold text-zinc-200">
        Algo deu errado ao carregar {sectionName ? `esta seção (${sectionName})` : "esta seção"}.
      </h3>
      <p className="text-xs text-zinc-500 max-w-md font-mono">
        {message || "Erro ao carregar dados. Tente novamente."}
      </p>
    </div>
  );
};

export default ErrorBoundary;
