import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'sonner';
import App from './App';
import './index.css';
import './sica.css';
import './menu.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/><Toaster richColors position="top-center"/></React.StrictMode>);
