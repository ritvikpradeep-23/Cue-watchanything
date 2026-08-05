import { Routes, Route } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { NotSureFab } from "./components/NotSureFab";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { HomeRoute } from "./pages/HomeRoute";
import { SignupPage } from "./pages/SignupPage";
import { LoginPage } from "./pages/LoginPage";
import { QuizPage } from "./pages/QuizPage";
import { SwipePage } from "./pages/SwipePage";
import { TitleDetailPage } from "./pages/TitleDetailPage";
import { WatchlistPage } from "./pages/WatchlistPage";
import { HistoryPage } from "./pages/HistoryPage";
import { NextShowPage } from "./pages/NextShowPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AdminAddTitlePage } from "./pages/AdminAddTitlePage";

function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/titles/:id" element={<TitleDetailPage />} />
          <Route
            path="/quiz"
            element={
              <ProtectedRoute>
                <QuizPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/swipe"
            element={
              <ProtectedRoute>
                <SwipePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/watchlist"
            element={
              <ProtectedRoute>
                <WatchlistPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <HistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/next-show/:watchedTitleId"
            element={
              <ProtectedRoute>
                <NextShowPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/add-title"
            element={
              <ProtectedRoute>
                <AdminAddTitlePage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      <NotSureFab />
    </div>
  );
}

export default App;
