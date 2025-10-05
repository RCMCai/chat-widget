// Rapid Reply Admin Widget - Final Version
(function() {
    'use strict';

    var config = window.RAPID_REPLY_ADMIN_CONFIG || {};
    var userId = config.userId;
    var webhookUrl = config.webhookUrl || 'https://n8n.ie-manage.com/webhook/live-chat';
    
    var activeSessions = 0;
    var pollInterval = null;
    var notificationSound = null;

    function initSound() {
        notificationSound = new Audio('data:audio/wav;base64,UklGRnoFAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoFAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE');
    }

    var html = `
        <style>
            #rr-admin-widget * {
                box-sizing: border-box;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            }
            
            #rr-admin-button {
                position: fixed;
                bottom: 20px;
                left: 20px;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9998;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            
            #rr-admin-button:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(0,0,0,0.3);
            }
            
            #rr-admin-button svg {
                width: 28px;
                height: 28px;
                fill: white;
            }
            
            .rr-admin-badge {
                position: absolute;
                top: -5px;
                right: -5px;
                background: #ef4444;
                color: white;
                border-radius: 12px;
                padding: 2px 7px;
                font-size: 11px;
                font-weight: bold;
                min-width: 20px;
                text-align: center;
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
            
            #rr-admin-panel {
                position: fixed;
                bottom: 90px;
                left: 20px;
                width: 900px;
                height: 600px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                display: none;
                flex-direction: column;
                z-index: 9999;
                overflow: hidden;
            }
            
            #rr-admin-panel.open {
                display: flex;
            }
            
            .rr-admin-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 16px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .rr-admin-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
            }
            
            .rr-admin-close {
                background: none;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                width: 30px;
                height: 30px;
                line-height: 30px;
            }
            
            .rr-admin-body {
                display: flex;
                flex: 1;
                overflow: hidden;
            }
            
            .rr-sessions-list {
                width: 300px;
                border-right: 1px solid #e5e7eb;
                overflow-y: auto;
                background: #f9fafb;
            }
            
            .rr-session-item {
                padding: 16px;
                border-bottom: 1px solid #e5e7eb;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .rr-session-item:hover {
                background: #f3f4f6;
            }
            
            .rr-session-item.active {
                background: #dbeafe;
                border-left: 4px solid #3b82f6;
            }
            
            .rr-session-name {
                font-weight: 600;
                color: #1f2937;
                margin-bottom: 4px;
                font-size: 15px;
            }
            
            .rr-session-email {
                font-size: 12px;
                color: #6b7280;
                margin-bottom: 2px;
            }
            
            .rr-session-phone {
                font-size: 12px;
                color: #6b7280;
                margin-bottom: 8px;
            }
            
            .rr-session-meta {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 11px;
                color: #9ca3af;
            }
            
            .rr-status-badge {
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 10px;
                font-weight: 600;
            }
            
            .rr-status-active {
                background: #d1fae5;
                color: #065f46;
            }
            
            .rr-chat-area {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            
            .rr-chat-header {
                padding: 16px 20px;
                border-bottom: 1px solid #e5e7eb;
                background: white;
            }
            
            .rr-messages-container {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                background: #f9fafb;
            }
            
            .rr-message {
                margin-bottom: 16px;
                display: flex;
            }
            
            .rr-message.customer {
                justify-content: flex-start;
            }
            
            .rr-message.agent {
                justify-content: flex-end;
            }
            
            .rr-message-bubble {
                max-width: 70%;
                padding: 10px 14px;
                border-radius: 12px;
                font-size: 14px;
                line-height: 1.4;
            }
            
            .rr-message.customer .rr-message-bubble {
                background: white;
                color: #1f2937;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            }
            
            .rr-message.agent .rr-message-bubble {
                background: #3b82f6;
                color: white;
            }
            
            .rr-message.bot .rr-message-bubble {
                background: #f3e8ff;
                color: #6b21a8;
            }
            
            .rr-message-label {
                font-size: 10px;
                font-weight: 600;
                margin-bottom: 4px;
                opacity: 0.8;
            }
            
            .rr-message-time {
                font-size: 11px;
                margin-top: 4px;
                opacity: 0.7;
            }
            
            .rr-input-area {
                padding: 16px 20px;
                border-top: 1px solid #e5e7eb;
                background: white;
                display: flex;
                gap: 12px;
            }
            
            .rr-input-area input {
                flex: 1;
                padding: 10px 14px;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                font-size: 14px;
                outline: none;
            }
            
            .rr-input-area input:focus {
                border-color: #3b82f6;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }
            
            .rr-send-btn {
                padding: 10px 24px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .rr-send-btn:hover {
                background: #2563eb;
            }
            
            .rr-send-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .rr-empty-state {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #9ca3af;
                flex-direction: column;
                gap: 12px;
            }
            
            .rr-empty-icon {
                width: 64px;
                height: 64px;
                opacity: 0.3;
            }
            
            .rr-close-session-btn {
                padding: 8px 16px;
                background: #ef4444;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                margin-top: 8px;
            }
        </style>

        <div id="rr-admin-widget">
            <button id="rr-admin-button" aria-label="Open admin dashboard">
                <svg viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                </svg>
                <span class="rr-admin-badge" id="rr-admin-badge" style="display: none;">0</span>
            </button>

            <div id="rr-admin-panel">
                <div class="rr-admin-header">
                    <h3>Live Support Dashboard</h3>
                    <button class="rr-admin-close" id="rr-admin-close">×</button>
                </div>
                
                <div class="rr-admin-body">
                    <div class="rr-sessions-list" id="rr-sessions-list"></div>
                    <div class="rr-chat-area" id="rr-chat-area">
                        <div class="rr-empty-state">
                            <svg class="rr-empty-icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                            </svg>
                            <p>Select a session to start chatting</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    var adminButton = document.getElementById('rr-admin-button');
    var adminPanel = document.getElementById('rr-admin-panel');
    var adminClose = document.getElementById('rr-admin-close');
    var sessionsList = document.getElementById('rr-sessions-list');
    var chatArea = document.getElementById('rr-chat-area');
    var badge = document.getElementById('rr-admin-badge');
    
    var selectedSession = null;
    var sessions = [];

    initSound();

    adminButton.addEventListener('click', function() {
        adminPanel.classList.toggle('open');
        if (adminPanel.classList.contains('open')) {
            fetchSessions();
        }
    });

    adminClose.addEventListener('click', function() {
        adminPanel.classList.remove('open');
    });

    function fetchSessions() {
        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'fetch-sessions',
                userId: userId
            })
        })
            .then(function(response) { return response.json(); })
            .then(function(data) {
                if (data.sessions) {
                    var oldCount = activeSessions;
                    sessions = data.sessions;
                    activeSessions = sessions.length;
                    
                    if (activeSessions > oldCount && oldCount > 0) {
                        playNotification();
                    }
                    
                    updateBadge();
                    renderSessions();
                }
            })
            .catch(function(error) {
                console.error('Error fetching sessions:', error);
            });
    }

    function updateBadge() {
        if (activeSessions > 0) {
            badge.textContent = activeSessions;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }

    function playNotification() {
        if (notificationSound && document.hidden) {
            notificationSound.play().catch(function() {});
        }
        
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('New Support Request', {
                body: 'A customer is requesting live agent support',
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%233b82f6"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>'
            });
        }
    }

    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    function renderSessions() {
        sessionsList.innerHTML = '';
        
        if (sessions.length === 0) {
            sessionsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #9ca3af;">No sessions yet</div>';
            return;
        }
        
        sessions.forEach(function(session) {
            // Initialize messages array if it doesn't exist
            if (!session.messages) {
                session.messages = [];
            }
            
            var div = document.createElement('div');
            div.className = 'rr-session-item';
            if (selectedSession && selectedSession.sessionId === session.sessionId) {
                div.className += ' active';
            }
            
            var statusClass = session.status === 'open' ? 'rr-status-active' : '';
            
            div.innerHTML = `
                <div class="rr-session-name">${session.clientName || 'Unknown Client'}</div>
                <div class="rr-session-email">${session.clientEmail || 'No email'}</div>
                <div class="rr-session-phone">${session.clientPhone || 'No phone'}</div>
                <div class="rr-session-meta">
                    <span class="rr-status-badge ${statusClass}">${session.status || 'open'}</span>
                    <span>${session.messages.length} messages</span>
                </div>
            `;
            
            div.addEventListener('click', function() {
                selectSession(session);
            });
            
            sessionsList.appendChild(div);
        });
    }

    function selectSession(session) {
        selectedSession = session;
        if (!selectedSession.messages) {
            selectedSession.messages = [];
        }
        renderSessions();
        renderChat();
    }

    function renderChat() {
        if (!selectedSession) {
            chatArea.innerHTML = `
                <div class="rr-empty-state">
                    <svg class="rr-empty-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                    </svg>
                    <p>Select a session to start chatting</p>
                </div>
            `;
            return;
        }
        
        chatArea.innerHTML = `
            <div class="rr-chat-header">
                <div style="font-weight: 600; font-size: 16px;">${selectedSession.clientName || 'Client'}</div>
                <div style="font-size: 13px; color: #6b7280; margin-top: 2px;">
                    ${selectedSession.clientEmail || 'No email'} • ${selectedSession.clientPhone || 'No phone'}
                </div>
                <button class="rr-close-session-btn" id="rr-close-session">Close Session</button>
            </div>
            <div class="rr-messages-container" id="rr-messages-container"></div>
            <div class="rr-input-area">
                <input type="text" id="rr-admin-input" placeholder="Type your message...">
                <button class="rr-send-btn" id="rr-admin-send">Send</button>
            </div>
        `;
        
        var messagesContainer = document.getElementById('rr-messages-container');
        var input = document.getElementById('rr-admin-input');
        var sendBtn = document.getElementById('rr-admin-send');
        var closeBtn = document.getElementById('rr-close-session');
        
        if (selectedSession.messages && selectedSession.messages.length > 0) {
            selectedSession.messages.forEach(function(msg) {
                var msgDiv = document.createElement('div');
                msgDiv.className = 'rr-message ' + (msg.sender || 'customer');
                
                var label = msg.sender === 'agent' ? 'YOU' : msg.sender === 'bot' ? 'BOT' : 'CUSTOMER';
                
                msgDiv.innerHTML = `
                    <div class="rr-message-bubble">
                        <div class="rr-message-label">${label}</div>
                        <div>${msg.text}</div>
                        <div class="rr-message-time">${formatTime(msg.timestamp)}</div>
                    </div>
                `;
                
                messagesContainer.appendChild(msgDiv);
            });
            
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        
        function sendMessage() {
            var message = input.value.trim();
            if (!message) return;
            
            sendBtn.disabled = true;
            input.disabled = true;
            
            var newMessage = {
                sender: 'agent',
                text: message,
                timestamp: new Date().toISOString()
            };
            
            fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'send-agent-message',
                    userId: userId,
                    sessionId: selectedSession.sessionId,
                    message: newMessage
                })
            })
            .then(function(response) { 
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json(); 
            })
            .then(function(data) {
                if (!selectedSession.messages) {
                    selectedSession.messages = [];
                }
                selectedSession.messages.push(newMessage);
                input.value = '';
                renderChat();
            })
            .catch(function(error) {
                console.error('Error sending message:', error);
                alert('Failed to send message. Please try again.');
            })
            .finally(function() {
                sendBtn.disabled = false;
                input.disabled = false;
                input.focus();
            });
        }
        
        sendBtn.addEventListener('click', sendMessage);
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') sendMessage();
        });
        
        closeBtn.addEventListener('click', function() {
            if (!confirm('Close this session?')) return;
            
            fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'close-session',
                    userId: userId,
                    sessionId: selectedSession.sessionId
                })
            })
            .then(function(response) { return response.json(); })
            .then(function(data) {
                selectedSession = null;
                fetchSessions();
            })
            .catch(function(error) {
                console.error('Error closing session:', error);
            });
        });
        
        input.focus();
    }

    function formatTime(timestamp) {
        var date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    // Start polling every 5 seconds
    pollInterval = setInterval(fetchSessions, 5000);
    
    // Initial fetch
    fetchSessions();
})();