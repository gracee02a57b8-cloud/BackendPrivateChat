import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import "./styles/index.css";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MessageView from "./features/messageArea/MessageView";
import { UiProvider } from "./contexts/UiContext";
import { CallProvider } from "./contexts/CallContext";
import { ConferenceProvider } from "./contexts/ConferenceContext";
import { UserProfileModalProvider } from "./contexts/UserProfileModalContext";
import CallOverlay from "./components/CallOverlay";
import ConferenceOverlay from "./components/ConferenceOverlay";
import NotFound from "./components/NotFound";
import { Toaster } from "react-hot-toast";
import AllRoutesWrapper from "./components/AllRoutesWrapper";

// Perf F2: lazy-load heavy route-level components
const Signup = lazy(() => import("./features/authentication/Signup"));
const Signin = lazy(() => import("./features/authentication/Signin"));
const JoinConferencePage = lazy(() => import("./components/JoinConferencePage"));
const AboutPage = lazy(() => import("./components/AboutPage"));
const PrivacyPolicy = lazy(() => import("./components/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./components/TermsOfService"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

/*
 * Copyright [2024] [Al-Amin]
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

function App() {
  return (
    <UiProvider>
      <QueryClientProvider client={queryClient}>
        <CallProvider>
          <ConferenceProvider>
            <UserProfileModalProvider>
            <Toaster
              position="top-center"
              toastOptions={{
                error: {
                  duration: 5000,
                },
                style: {
                  maxWidth: "500px",
                },
              }}
            />

            {/* Global call & conference overlays */}
            <CallOverlay />
            <ConferenceOverlay />

            <BrowserRouter>
          <AllRoutesWrapper>
            <Routes>
              <Route path="/" element={<Navigate to="/chat" replace />} />
              <Route
                path="/chat"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/chat/room/:roomId" element={<MessageView />} />
                <Route path="/chat/:userId" element={<MessageView />} />
              </Route>

              <Route path="signup" element={<Suspense fallback={null}><Signup /></Suspense>} />
              <Route path="signin" element={<Suspense fallback={null}><Signin /></Suspense>} />
              <Route
                path="conference/:confId"
                element={<Suspense fallback={null}><JoinConferencePage /></Suspense>}
              />
              <Route path="about" element={<Suspense fallback={null}><AboutPage /></Suspense>} />
              <Route path="privacy" element={<Suspense fallback={null}><PrivacyPolicy /></Suspense>} />
              <Route path="terms" element={<Suspense fallback={null}><TermsOfService /></Suspense>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AllRoutesWrapper>
            </BrowserRouter>
            </UserProfileModalProvider>
          </ConferenceProvider>
        </CallProvider>
      </QueryClientProvider>
    </UiProvider>
  );
}

export default App;
