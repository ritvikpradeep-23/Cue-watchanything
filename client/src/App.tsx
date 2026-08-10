import { Routes, Route } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { AdminLayout } from "./components/AdminLayout";
import { NotSureFab } from "./components/NotSureFab";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { HomeRoute } from "./pages/HomeRoute";
import { SignupPage } from "./pages/SignupPage";
import { LoginPage } from "./pages/LoginPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { QuizPage } from "./pages/QuizPage";
import { SwipePage } from "./pages/SwipePage";
import { TitleDetailPage } from "./pages/TitleDetailPage";
import { WatchlistPage } from "./pages/WatchlistPage";
import { HistoryPage } from "./pages/HistoryPage";
import { NextShowPage } from "./pages/NextShowPage";
import { ProfilePage } from "./pages/ProfilePage";
import { TasteTimelinePage } from "./pages/TasteTimelinePage";
import { AdminAddTitlePage } from "./pages/AdminAddTitlePage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AdminReportsPage } from "./pages/AdminReportsPage";
import { TwinsPage } from "./pages/TwinsPage";
import { TwinProfilePage } from "./pages/TwinProfilePage";
import { ChatPage } from "./pages/ChatPage";
import { FriendsPage } from "./pages/FriendsPage";
import { WatchTogetherPage } from "./pages/WatchTogetherPage";

function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
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
            path="/profile/timeline"
            element={
              <ProtectedRoute>
                <TasteTimelinePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/twins"
            element={
              <ProtectedRoute>
                <TwinsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/twins/:username"
            element={
              <ProtectedRoute>
                <TwinProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:userId"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/friends"
            element={
              <ProtectedRoute>
                <FriendsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/watch-together/:sessionId"
            element={
              <ProtectedRoute>
                <WatchTogetherPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/add-title"
            element={
              <ProtectedRoute adminOnly>
                <AdminAddTitlePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout>
                  <AdminDashboardPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout>
                  <AdminUsersPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout>
                  <AdminReportsPage />
                </AdminLayout>
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
