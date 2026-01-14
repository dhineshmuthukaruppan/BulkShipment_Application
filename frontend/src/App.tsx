import React, { useState, useEffect } from 'react';
import { ConfigProvider, theme } from 'antd';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import 'antd/dist/antd.css';
import { store, persistor } from './store/store';
import MainLayout from './components/Layout/MainLayout';
import WizardSteps from './components/Wizard/WizardSteps';
import Dashboard from './components/Dashboard/Dashboard';
import Master from './components/Master/Master';
import ErrorBoundary from './components/common/ErrorBoundary';
import { ThemeContext } from './contexts/ThemeContext';

const STORAGE_KEY = 'shipping_pro_selected_page';
const THEME_STORAGE_KEY = 'shipping_pro_theme';

function App() {
  // Initialize theme synchronously from DOM (set by inline script) to prevent flicker
  // The inline script in index.html sets data-theme before React renders
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(() => {
    // Read from DOM first (set by inline script) - this is the fastest way
    const domTheme = document.documentElement.getAttribute('data-theme') || 
                     document.body.getAttribute('data-theme');
    if (domTheme === 'dark' || domTheme === 'light') {
      return domTheme;
    }
    // Fallback to localStorage (shouldn't happen if inline script works)
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      return (saved === 'dark' || saved === 'light') ? saved : 'light';
    } catch {
      return 'light';
    }
  });
  
  // Track if this is the first render
  const [isFirstRender, setIsFirstRender] = useState(true);

  // Initialize from localStorage or default to 'upload'
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'upload' | 'master'>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dashboard' || saved === 'upload' || saved === 'master') {
      return saved;
    }
    return 'upload'; // Default to upload instead of dashboard
  });

  // Re-enable transitions after first render to prevent flicker
  useEffect(() => {
    if (isFirstRender) {
      // Re-enable transitions after a short delay to allow initial render
      const timer = setTimeout(() => {
        const style = document.createElement('style');
        style.textContent = `
          * {
            transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease !important;
          }
        `;
        document.head.appendChild(style);
        setIsFirstRender(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isFirstRender]);

  // Save theme to localStorage and update DOM immediately for CSS variables
  useEffect(() => {
    // Only update if theme actually changed (not on first render if already set)
    const currentDomTheme = document.documentElement.getAttribute('data-theme');
    if (currentDomTheme !== currentTheme) {
      localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
      // Update document elements for CSS variables
      document.documentElement.setAttribute('data-theme', currentTheme);
      document.body.setAttribute('data-theme', currentTheme);
      document.body.style.colorScheme = currentTheme;
      const root = document.getElementById('root');
      if (root) {
        root.setAttribute('data-theme', currentTheme);
      }
    }
  }, [currentTheme]);

  // Save to localStorage whenever currentPage changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, currentPage);
  }, [currentPage]);

  const handleMenuClick = (key: string) => {
    if (key === 'dashboard') {
      setCurrentPage('dashboard');
    } else if (key === 'upload' || key === 'create') {
      setCurrentPage('upload');
    } else if (key === 'master') {
      setCurrentPage('master');
    }
  };

  const toggleTheme = () => {
    setCurrentTheme(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      // Update DOM immediately for instant CSS variable changes
      document.documentElement.setAttribute('data-theme', newTheme);
      document.body.setAttribute('data-theme', newTheme);
      document.body.style.colorScheme = newTheme;
      const root = document.getElementById('root');
      if (root) {
        root.setAttribute('data-theme', newTheme);
      }
      // Save to localStorage immediately
      try {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      } catch (e) {
        console.warn('Failed to save theme to localStorage:', e);
      }
      return newTheme;
    });
  };

  // Ant Design theme configuration
  const antdTheme = {
    algorithm: currentTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: '#1890ff',
      borderRadius: 6,
      fontSize: 16, // Increased base font size
      fontSizeLG: 18, // Large text
      fontSizeSM: 14, // Small text
      fontSizeXL: 20, // Extra large
    },
    components: {
      Layout: {
        bodyBg: currentTheme === 'dark' ? '#141414' : '#fff',
        headerBg: currentTheme === 'dark' ? '#1f1f1f' : '#fff',
        siderBg: currentTheme === 'dark' ? '#1f1f1f' : '#fff',
      },
      Menu: {
        itemBg: currentTheme === 'dark' ? '#1f1f1f' : '#fff',
        itemSelectedBg: currentTheme === 'dark' ? '#111b26' : '#e6f7ff',
        itemHoverBg: currentTheme === 'dark' ? '#262626' : '#f5f5f5',
      },
      Card: {
        headerBg: currentTheme === 'dark' ? '#1f1f1f' : '#fafafa',
      },
      Table: {
        headerBg: currentTheme === 'dark' ? '#1f1f1f' : '#fafafa',
        rowHoverBg: currentTheme === 'dark' ? '#262626' : '#fafafa',
      },
    },
  };

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ThemeContext.Provider value={{ theme: currentTheme, toggleTheme }}>
          <ConfigProvider 
            theme={antdTheme}
            key={currentTheme} // Force re-render when theme changes
          >
            <ErrorBoundary>
              <MainLayout 
                selectedKey={
                  currentPage === 'dashboard' ? 'dashboard' 
                  : currentPage === 'master' ? 'master' 
                  : 'upload' // Both 'upload' and 'create' map to 'upload' page
                }
                onMenuClick={handleMenuClick}
              >
                <ErrorBoundary>
                  {currentPage === 'dashboard' ? (
                    <Dashboard />
                  ) : currentPage === 'master' ? (
                    <Master />
                  ) : (
                    <WizardSteps />
                  )}
                </ErrorBoundary>
              </MainLayout>
            </ErrorBoundary>
          </ConfigProvider>
        </ThemeContext.Provider>
      </PersistGate>
    </Provider>
  );
}

export default App;
