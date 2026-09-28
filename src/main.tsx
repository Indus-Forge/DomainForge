import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorScreen } from './ui/ErrorScreen';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorScreen>
      <App />
    </ErrorScreen>
  </StrictMode>,
);
