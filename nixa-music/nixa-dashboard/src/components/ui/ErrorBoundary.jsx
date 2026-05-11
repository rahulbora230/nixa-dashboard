import { Component } from "react";
import EmptyState from "./EmptyState";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("UI Error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="shell-content">
          <EmptyState title="Something went wrong" message="Refresh the page or return to your dashboard." />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
