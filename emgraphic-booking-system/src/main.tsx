import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { startServerClock } from './utils/clock';

startServerClock();
createRoot(document.getElementById('root')!).render(<App />);
