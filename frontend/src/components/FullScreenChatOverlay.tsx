import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import ChatInterface from './ChatInterface';
import { ChatThread } from '../backend';

interface FullscreenChatOverlayProps {
  thread: ChatThread;
  onClose: () => void;
}

export default function FullscreenChatOverlay({ thread, onClose }: FullscreenChatOverlayProps) {
  // Add immersive-chat class to body on mount, remove on unmount
  useEffect(() => {
    document.body.classList.add('immersive-chat');
    
    return () => {
      document.body.classList.remove('immersive-chat');
    };
  }, []);

  // Create portal to document.body
  return createPortal(
    <ChatInterface thread={thread} onClose={onClose} />,
    document.body
  );
}
