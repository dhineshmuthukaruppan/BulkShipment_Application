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
  // Initialize theme from localStorage or default to 'light'
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });

  // Initialize from localStorage or default to 'upload'
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'upload' | 'master'>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dashboard' || saved === 'upload' || saved === 'master') {
      return saved;
    }
    return 'upload'; // Default to upload instead of dashboard
  });

  // Save theme to localStorage and update DOM immediately for CSS variables
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
    // Update document body and root for CSS variables - do this synchronously
    document.body.setAttribute('data-theme', currentTheme);
    const root = document.getElementById('root');
    if (root) {
      root.setAttribute('data-theme', currentTheme);
    }
    // Force immediate style recalculation
    document.body.style.colorScheme = currentTheme;
  }, [currentTheme]);

  // Save to localStorage whenever currentPage changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, currentPage);
  }, [currentPage]);

  // Initialize body theme class on mount
  useEffect(() => {
    document.body.setAttribute('data-theme', currentTheme);
    const root = document.getElementById('root');
    if (root) {
      root.setAttribute('data-theme', currentTheme);
    }
    document.body.style.colorScheme = currentTheme;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      document.body.setAttribute('data-theme', newTheme);
      const root = document.getElementById('root');
      if (root) {
        root.setAttribute('data-theme', newTheme);
      }
      document.body.style.colorScheme = newTheme;
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
