import React from 'react';
import { ConfigProvider } from 'antd';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import 'antd/dist/antd.css';
import { store, persistor } from './store/store';
import MainLayout from './components/Layout/MainLayout';
import WizardSteps from './components/Wizard/WizardSteps';

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: '#1890ff',
            },
          }}
        >
          <MainLayout selectedKey="upload">
            <WizardSteps />
          </MainLayout>
        </ConfigProvider>
      </PersistGate>
    </Provider>
  );
}

export default App;
