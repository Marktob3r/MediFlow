import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-8 text-center">
            {/* Icon */}
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg
                className="w-10 h-10 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>

            {/* Heading */}
            <h1 className="text-xl font-extrabold text-gray-900 mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-gray-500 leading-relaxed mb-1">
              An unexpected error occurred. Your session and queue data are safe.
            </p>

            {/* Error detail (dev-friendly) */}
            {this.state.error && (
              <p className="text-xs text-red-400 font-mono bg-red-50 rounded-xl px-3 py-2 mt-3 mb-5 text-left break-all">
                {this.state.error.message}
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3 mt-4">
              <button
                onClick={this.handleReload}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
              >
                Reload Page
              </button>
              <button
                onClick={() => (window.location.href = "/")}
                className="w-full border-2 border-gray-200 text-gray-600 font-semibold py-3 rounded-2xl hover:bg-gray-50 transition-all text-sm"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
