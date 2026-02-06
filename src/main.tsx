import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

import App from './App';
import { store } from './app/store';
import { theme } from './theme/theme';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/+$/, '')}>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <Notifications position="bottom-right" />
          <App />
        </MantineProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
