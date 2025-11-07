// src/components/WidgetInstaller.js

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import '../styles/WidgetInstaller.css';

const WidgetInstaller = ({ isOpen, onClose }) => {
  const { user, activeTenant } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [apiToken, setApiToken] = useState(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [tokenError, setTokenError] = useState(null);

  // Determine the effective user ID for the widget
  const isUserRole = user?.role === 'user';
  const effectiveUser = isUserRole ? user : activeTenant;
  const userId = effectiveUser?.id || effectiveUser?._id;

  // Get the widget domain from config (or use current location origin for widget script)
  const widgetDomain = window.location.origin;

  // Fetch API token when modal opens
  useEffect(() => {
    if (isOpen && userId) {
      fetchApiToken();
    }
  }, [isOpen, userId]);

  const fetchApiToken = async () => {
    setLoadingToken(true);
    setTokenError(null);
    try {
      const token = localStorage.getItem('jwt');
      const endpoint = isUserRole 
        ? `${API_BASE_URL}/user/api-token`
        : `${API_BASE_URL}/users/${userId}/api-token`;
      
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setApiToken(data.apiToken);
      } else {
        const errorData = await response.json();
        setTokenError(errorData.error || 'Failed to fetch API token');
      }
    } catch (error) {
      console.error('Error fetching API token:', error);
      setTokenError('Network error while fetching API token');
    } finally {
      setLoadingToken(false);
    }
  };
  
  // Generate the installation snippet
  const installSnippet = useMemo(() => {
    if (!userId || !apiToken) return '';
    
    return `<!-- RAG Chatbot Widget -->
<script src="${widgetDomain}/ragChatWidget.js"></script>
<script>
  window.RAGWidget.init({
    apiBase: "${API_BASE_URL}",
    userId: "${userId}",
    authToken: "${apiToken}"
  });
</script>`;
  }, [userId, apiToken, widgetDomain]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(installSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = installSnippet;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="widget-installer-overlay" role="dialog" aria-modal="true">
      <div className="widget-installer-modal">
        <div className="widget-installer-header">
          <h3>🚀 Install Chatbot on Your Site</h3>
          <button 
            className="widget-installer-close" 
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {!userId ? (
          <div className="widget-installer-error">
            <p>
              {isUserRole 
                ? 'Your account is not fully set up. Please contact your administrator.'
                : 'Please create or select a user before installing the widget.'
              }
            </p>
          </div>
        ) : loadingToken ? (
          <div className="widget-installer-loading">
            <p>🔑 Generating secure authentication token...</p>
          </div>
        ) : tokenError ? (
          <div className="widget-installer-error">
            <p>❌ {tokenError}</p>
            <button onClick={fetchApiToken} className="widget-installer-retry-btn">
              🔄 Retry
            </button>
          </div>
        ) : !apiToken ? (
          <div className="widget-installer-loading">
            <p>⏳ Loading widget configuration...</p>
          </div>
        ) : (
          <>
            <div className="widget-installer-content">
              <p className="widget-installer-description">
                Copy the code below and paste it into your website's HTML, just before the closing <code>&lt;/body&gt;</code> tag. 
                This will enable your personalized AI chatbot for all visitors to your site.
              </p>

              <div className="widget-installer-user-info">
                <p><strong>User:</strong> {effectiveUser?.name || effectiveUser?.username}</p>
                <p><strong>User ID:</strong> <code>{userId}</code></p>
                <p><strong>Auth Token:</strong> <code style={{fontSize: '0.75em'}}>{apiToken.substring(0, 16)}...●●●●</code></p>
              </div>

              <div className="widget-installer-snippet-container">
                <pre className="widget-installer-snippet">{installSnippet}</pre>
                <button 
                  className={`widget-installer-copy-btn ${copied ? 'copied' : ''}`}
                  onClick={handleCopy}
                  disabled={!installSnippet}
                >
                  {copied ? '✓ Copied!' : '📋 Copy Code'}
                </button>
              </div>

              <div className="widget-installer-security-notice">
                <p><strong>🔒 Security Note:</strong> Your authentication token is included in this snippet. Keep it secure and don't share it publicly. If compromised, contact your administrator to regenerate it.</p>
              </div>

              <div className="widget-installer-instructions">
                <h4>Installation Instructions:</h4>
                <ol>
                  <li>Copy the code snippet above using the "Copy Code" button.</li>
                  <li>Open your website's HTML file in your editor.</li>
                  <li>Locate the closing <code>&lt;/body&gt;</code> tag near the end of the file.</li>
                  <li>Paste the copied code just before the <code>&lt;/body&gt;</code> tag.</li>
                  <li>Save your HTML file and refresh your website.</li>
                  <li>The chatbot widget will appear in the bottom-right corner of your site!</li>
                </ol>
              </div>

              <div className="widget-installer-features">
                <h4>✨ Widget Features:</h4>
                <ul>
                  <li>✅ Fully functional AI chatbot with your personalized knowledge base</li>
                  <li>✅ Secure authentication with your unique API token</li>
                  <li>✅ Automatic session management for each visitor</li>
                  <li>✅ Context-aware responses based on your scraped content</li>
                  <li>✅ Responsive design that works on all devices</li>
                  <li>✅ Easy to customize and update</li>
                </ul>
              </div>

              <div className="widget-installer-preview-section">
                <button 
                  className="widget-installer-preview-btn"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? '🙈 Hide Preview' : '👁️ Show Live Preview'}
                </button>
                
                {showPreview && (
                  <div className="widget-installer-preview">
                    <p className="widget-installer-preview-label">
                      Preview of how the widget will appear on your site:
                    </p>
                    <div className="widget-installer-preview-frame">
                      <div className="widget-installer-preview-site">
                        <div className="preview-site-header">Your Website</div>
                        <div className="preview-site-content">
                          <p>Your website content goes here...</p>
                        </div>
                        <div className="preview-widget-placeholder">
                          <div className="preview-widget-icon">💬</div>
                          <div className="preview-widget-text">Chat with AI</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="widget-installer-notes">
                <h4>📝 Important Notes:</h4>
                <ul>
                  <li><strong>No functionality changes:</strong> The widget uses the same bot logic and features as your dashboard chatbot.</li>
                  <li><strong>Secure:</strong> All requests are authenticated using your unique user ID.</li>
                  <li><strong>Data context:</strong> The widget automatically uses your knowledge base and trained data.</li>
                  <li><strong>Customization:</strong> Contact support if you need to customize colors or positioning.</li>
                </ul>
              </div>
            </div>

            <div className="widget-installer-actions">
              <button 
                className="widget-installer-btn-neutral"
                onClick={onClose}
              >
                Close
              </button>
              <button 
                className="widget-installer-btn-primary"
                onClick={handleCopy}
              >
                {copied ? '✓ Copied to Clipboard' : '📋 Copy Installation Code'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WidgetInstaller;
