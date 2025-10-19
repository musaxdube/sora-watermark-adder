import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import VideoUploader from './VideoUploader.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VideoUploader />
  </StrictMode>,
)
