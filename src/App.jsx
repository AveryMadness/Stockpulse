import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import LandingPage from './pages/LandingPage.jsx';
import StockDetailPage from './pages/StockDetailPage.jsx';
import WatchlistPage from './pages/WatchlistPage.jsx';
import PortfolioPage from './pages/PortfolioPage.jsx';
import ChatPage from './pages/ChatPage.jsx';

/**
 * App - root component.
 * Sets up the global navigation bar and all page routes.
 */
export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/"              element={<LandingPage />}     />
        <Route path="/stock/:symbol" element={<StockDetailPage />} />
        <Route path="/watchlist"     element={<WatchlistPage />}   />
        <Route path="/portfolio"     element={<PortfolioPage />}   />
        <Route path="/chat"          element={<ChatPage />}         />
        <Route path="/chat/:roomId"  element={<ChatPage />}         />
      </Routes>
    </>
  );
}
