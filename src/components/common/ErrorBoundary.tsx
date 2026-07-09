import React from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

interface ErrorBoundaryProps {
  fallbackMessage?: string;
  fallback?: React.ReactNode;
  onReset?: () => void;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            gap: 2,
            p: 4,
          }}
        >
          <Paper
            elevation={2}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              p: 4,
              maxWidth: 520,
              borderRadius: 3,
            }}
          >
            <Typography variant="h6" color="error" sx={{ fontWeight: 700 }}>
              {this.props.fallbackMessage || "Une erreur est survenue"}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ maxWidth: 500, textAlign: "center", fontFamily: "monospace", fontSize: "0.75rem" }}
            >
              {this.state.error?.message || "Une erreur inattendue est survenue lors du rendu."}
            </Typography>
            <Button variant="contained" onClick={this.handleReset} sx={{ mt: 1 }}>
              Recharger
            </Button>
          </Paper>
        </Box>
      );
    }
    return this.props.children;
  }
}

(ErrorBoundary as any).displayName = "ErrorBoundary";

export default ErrorBoundary;
