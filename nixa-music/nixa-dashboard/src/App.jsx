import AppRoutes from "./routes/AppRoutes";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import './styles/design-system.css';

function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-primary text-primary">
        <AppRoutes />
      </div>
    </ErrorBoundary>
  );
}

export default App;
